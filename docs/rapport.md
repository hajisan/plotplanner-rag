# PlotPlanner — Rapport

**Kursus**: AI Agenter og Automatisering, KEA 4. semester  
**Afleveringsfrist**: 26. maj 2026

---

## Side 1 — Platform, arkitektur og modelreflection

### Valg af agent-platform: Hermes Agent

Hermes Agent (Nous Research) er valgt som agent-platform frem for NanoClaw. Den primære begrundelse er at Hermes er model-agnostisk — agenten er ikke bundet til én LLM-udbyder og kan skifte model uden at ændre agentens konfiguration, system prompt eller MCP-integration. Det har vist sig at være en reel fordel i dette projekt, da det var nødvendigt at skifte model undervejs (se modelvalg nedenfor).

Hermes indlæser automatisk `AGENTS.md` fra arbejdsmappen som system prompt, understøtter MCP-servere via konfiguration, og har en built-in gateway til Telegram — hvilket eliminerede behovet for en separat n8n Workflow D som Telegram-bridge.

### Modelvalg: fra Llama til Gemini

Modelvalget var ikke trivielt. Projektet gennemgik en række modeller:

**llama3.1:8b (lokalt via Ollama)** — hallucinererede og kaldte aldrig MCP tools. Returnerede meningsløse svar i stedet for at bruge de eksponerede tools.

**hermes3:8b (lokalt via Ollama)** — Nous Researchs eget model, designet til agentisk brug. Samme problem som llama3.1 — ingen tool-calling.

**mistral:7b (lokalt via Ollama)** — afvist af Hermes grundet context window på 32K tokens, under Hermes' minimum på 64K.

**gemini-2.5-flash via Google AI Studio** — kalder MCP tools korrekt, svarer på dansk og følger system prompt-instruktionerne. Valgt som produktionsmodel.

Observationen er at 7-8B lokale modeller generelt ikke er tilstrækkelige til pålidelig multi-step tool-calling. Gemini 2.5 Flash er en cloud-model (gratis tier, 250 req/dag), hvilket introducerer en ekstern afhængighed. Det er en reel begrænsning der adresseres under reflection.

### Arkitektur

Systemet er bygget i tre lag:

**Interface-lag**: Hermes' built-in Telegram gateway kører som en launchd-service og starter automatisk ved opstart. Telegram-beskeder routes direkte til Hermes Agent uden mellemliggende n8n-workflow.

**Agent-lag**: Hermes Agent fortolker brugerens intent og vælger tools via MCP. System prompten i `AGENTS.md` definerer eksplicit hvornår hvert tool er relevant. MCP-serveren (Node.js, port 3000) eksponerer tre tools som REST-endpoints.

**Vidensbase**: Neo4j Desktop bruges til både vector RAG og graph RAG i samme instans. Det muliggør fremtidigt at kombinere vector-resultater med graph-traversal i én Cypher-query.

---

## Side 2–3 — Implementering

### Neo4j til both vector og graph

Valget om at bruge Neo4j til begge RAG-typer er en bevidst arkitekturbeslutning. Alternativet ville være en separat vector-database (Pinecone, Weaviate el.lign.) og en separat graph-database — to systemer at drifte og vedligeholde. Med Neo4j samles begge i én forbindelse og én forespørgselssyntaks (Cypher).

Native vector-indeks er understøttet siden Neo4j 5.11 via cosine similarity. Threshold er sat til 0.7 — lavere returnerer for støjede resultater, højere giver for lidt.

### Data-pipeline og chunking-strategi

Data-pipelinen (Workflow A del 1 og A del 2) genererer 104 planter med LLM-berigede felter via Ollama (Mistral 7B). Staging-JSON gennemses manuelt inden Neo4j-skrivning — et human-in-the-loop trin der fanger hallucineringer i felter som `follows_well_after` og `avoid_after`.

Vector Ingestion (Workflow B) henter Wikipedia-tekst per plante og chunker i 500-tegns segmenter med 50 tegns overlap. 500 tegn giver tilstrækkelig kontekst om én egenskab uden at blande for mange emner i samme embedding. 50 tegns overlap sikrer at information ved chunk-grænser ikke går tabt. Resultat: 228 chunks, 104/104 planter dækket.

Embeddings genereres med nomic-embed-text (768 dimensioner, multilingual). Modellen understøtter dansk input implicit — brugeren kan søge på "tomat" og ramme chunks med "tomato" via embedding-rummet uden eksplicit oversættelse.

### MCP-server: design og transport

MCP-serveren er bygget med `@modelcontextprotocol/sdk` og bruger StreamableHTTP transport. En udfordring under implementeringen var at Hermes ikke sender den krævede `Accept: application/json, text/event-stream` header — løst ved at patche headeren i Express middleware inden transport-håndtering.

En anden udfordring var "server already initialized"-fejl ved genforbindelse. Løst ved et per-session mønster: en ny `McpServer` og `StreamableHTTPServerTransport` instantieres for hvert initialize-kald (ingen session-id header), og gemmes i en Map. Det tillader Hermes at genforbinde uden fejl.

### System prompt og tool-strategi (AGENTS.md)

`AGENTS.md` definerer agentens rolle og eksplicit tool-strategi. Tre centrale designvalg:

**Eksplicit tool-mapping**: Agenten instrueres i præcist hvornår hvert tool bruges. `graph_query` til spørgsmål om én specifik plante, `vector_search` til åbne dyrkningsspørgsmål, `season_soil_filter` til "hvad kan jeg plante"-spørgsmål. Uden denne instruktion valgte agenten tools inkonsekvent.

**Engelsk plantenavn til graph_query**: Databasen indekserer planter på `name_en`. Agenten instrueres eksplicit i at bruge engelske plantenavne ("tomatoes", "carrots") til `graph_query`. Dansk input ("tomat") matcher ikke "Tomatoes" i grafen.

**Dansk kommunikation**: Agenten kommunikerer altid på dansk selvom kildedataen er på engelsk. Planternes engelske navne angives i parentes første gang.

### Custom skill: markplan-sekvens

`hermes/skills/markplan.md` definerer en fast 5-trins ræsonnerings-sekvens til markplanlægning. Sekvensen er designet til at minimere unødvendige tool-kald og give en struktureret anbefaling:

1. Afklar sæson og jordbundstype — ét spørgsmål ad gangen
2. Kald `season_soil_filter` — filtrer kandidater (vis ikke listen)
3. Kald `graph_query` for 3-5 kandidater — hent companions og sædskifte
4. Kald `vector_search` — berig med dyrkningsdetaljer
5. Præsenter struktureret anbefaling

Rækkefølgen er valgt fordi filtrering (trin 2) indsnævrer kandidatmængden inden de dyrere graph- og vector-kald. Instruksen "spørg ikke brugeren undervejs" er tilføjet efter test viste at agenten stoppede og spurgte mellem trin.

### n8n's rolle

n8n bruges til to formål: data-pipeline (Workflow A1, A2, B) og domænetransformation eksponeret som MCP tool (Workflow E).

Workflow E er et webhook-workflow der modtager `season`, `soil_type` og `moisture` som parametre, mapper dansk input til engelske Neo4j-værdier ("forår" → "spring", "lerjord" → "clay"), og returnerer egnede planter via dynamisk Cypher-query. Logikken lever i n8n frem for direkte i MCP-serveren fordi mapping-tabellen er nem at vedligeholde visuelt og kan udvides uden kodeændringer.

---

## Side 4 — Brug af agenten i casen

Systemet er tilgængeligt via Telegram og kan besvare tre typer spørgsmål:

### Graf-forespørgsel: companion planting

> **Bruger**: hvad trives godt med tomater?

Agenten kalder `graph_query("tomatoes")` og returnerer companions (peberfrugter, kål, asparges, løg, broccoli), antagonister (ærter, majs, dild, fennikel, rosmarin) og sædskifterelationer direkte fra grafen. Svartid: ca. 10 sekunder inklusive LLM-inferens.

### Semantisk søgning: dyrkningsforhold

> **Bruger**: hvad kræver spinat af jordbund?

Agenten kalder `vector_search` med flere søgetekster ("spinat jordbund", "spinach soil requirements") og rapporterer ærligt at specifikke spinat-data ikke er tilgængelige i korpus. Den finder relaterede planter (bladbede) og informerer brugeren om begrænsningen. Det er korrekt adfærd — agenten hallucinerer ikke.

### Markplan-sekvens: struktureret anbefaling

> **Bruger**: hvad kan jeg plante i foråret på lerjord?

Agenten kører den fulde markplan-sekvens autonomt:
- `season_soil_filter(forår, ler)` → 53 kandidater
- `graph_query` × 4 (gulerødder, kål, løg, spinat) parallelt
- `vector_search` × 4 med plantespecifikke søgetekster parallelt
- Struktureret anbefaling med companions og dyrkningsråd

Hele sekvensen gennemføres uden at spørge brugeren undervejs — en direkte effekt af opdateringen til markplan-sekvensen i AGENTS.md.

---

## Side 5 — Reflection, sikkerhed og fremtidigt arbejde

### Begrænsninger

**Modelafhængighed**: Systemet kræver en cloud-model (Gemini 2.5 Flash) for pålidelig tool-calling. Alle testede lokale modeller (llama3.1, hermes3, mistral) fejlede. Det introducerer en ekstern afhængighed og rate-limiting (20 req/min, 250 req/dag på gratis tier). For produktionsbrug ville en betalt tier eller en stærkere lokal model (f.eks. llama3.3:70b) være nødvendig.

**Datakvalitet**: Staging-data er genereret med Mistral 7B og ikke fagligt valideret. Felter som sædskifte og næringsstoffer kan indeholde fejl. Vector-korpus er udelukkende Wikipedia — kvaliteten varierer per plante.

**Lokal drift**: Systemet kører kun lokalt. Ingen skalering, ingen redundans, ingen tilgængelighed for andre brugere uden eksplicit opsætning.

**Prompt compliance**: Agenten følger ikke altid systemprompten præcist. Den spørger undertiden om fugtighed selvom det ikke er relevant, og stopper indimellem midt i markplan-sekvensen. Stærkere instruktioner reducerer men eliminerer ikke problemet.

### Sikkerhed og akademisk integritet

Credentials (Neo4j-adgangskode, API keys) opbevares i `.env` og er ikke committet til repository. Telegram-beskeder routes til Hermes og logges ikke. Ingen brugerdata gemmes persistent.

Staging-datasættet bygger på to open source datasæt (MIT-licens). LLM-genererede felter er tydeligt markeret i datasætstrukturen. Vector-tekst er fra Wikipedia (åben licens). Systemprompten og markplan-sekvensen er eget arbejde.

### Fremtidigt arbejde

- Stærkere lokal model til tool-calling (llama3.3:70b eller tilsvarende) for at eliminere cloud-afhængighed
- `Pest`-node med `REPELS`-relationer — skadedyrsafvisende companion planting
- ØKO-Portalen som dansk tekstkilde til vector-embeddings
- Validering af staging-data af fagperson (agronom eller erfaren gartner)
- Selvhosted backend med brugerkonti og markdata — produktudvikling ovenpå dette fundament
