# Rapport-noter — PlotPlanner Eksamensprojekt

> Løbende noter til rapport-skrivning. Struktureret efter de fem rapport-sider.
> Udfyld efterhånden som beslutninger tages og implementering skrider frem.
> Redigér sproget inden aflevering — indholdet skal bare være her.

---

## Side 1 — Platform, arkitektur og modelreflection

### Valg af agent-platform: Hermes frem for NanoClaw

Hermes Agent (Nous Research) er valgt frem for NanoClaw af to primære grunde:

**Model-agnostisk**: Hermes er ikke bundet til én LLM-udbyder. Det betyder at systemet kan skifte model (f.eks. fra Llama 3.1 til en større model) uden at ændre agentens konfiguration eller MCP-integration. I et lokalt system hvor ressourcer er begrænsede er det en reel fordel — man kan skalere op og ned efter behov.

**Lokalt Ollama-understøttelse**: Hermes understøtter Ollama direkte. Det er afgørende for dette projekt, da al inferens kører lokalt af hensyn til dataprivacy — data forlader ikke maskinen.

*[Tilføj: hvad undersøgte du om NanoClaw, og hvad var den konkrete forskel?]*

### Valg af LLM: gemini-2.5-flash

Gemini 2.5 Flash via Google AI Studio er den endelige agent-LLM.

Llama 3.1 testedes først — hallucinererede og kaldte ikke MCP tools pålideligt i Hermes' protokol. 8B parametre er for lidt til pålidelig tool-calling med multi-trin ræsonnering. Gemini 2.5 Flash kalder `graph_query` korrekt og svarer konsistent på dansk.

Google AI Studio gratis tier holdt ikke til demo (rate limits). Billing aktiveret med cap på 50 kr — omkostning per session er ubetydelig ved den fraktion af forespørgsler.

Mistral 7B bruges stadig til staging-generering (Workflow A del 1) — opgaven er tekstgenerering og berigelse, ikke tool calling. Mistral er hurtigere og tilstrækkelig til den opgave.

### Arkitektur-overblik

Systemet er opdelt i tre lag:

**Interface-lag** (Hermes built-in gateway): Hermes Agent (Nous Research) har en built-in Telegram gateway der kører som launchd service. Den håndterer Telegram-protokollen nativt — ingen n8n-bridge nødvendig. n8n Workflow D (Telegram Bridge) var planlagt men blev fravalgt da Hermes' gateway løste problemet med lavere kompleksitet.

**Agent-lag** (Hermes + MCP): Hermes fortolker brugerens intent og vælger tools. MCP-serveren eksponerer tre tools som Hermes kan kalde. Adskillelsen af agent og tools via MCP betyder at tools kan testes og udskiftes uafhængigt af agenten.

**Vidensbase** (Neo4j): Samme Neo4j-instans bruges til både vector RAG og graph RAG. Det er en bevidst arkitekturbeslutning — se begrundelse under implementering.

---

## Side 2–3 — Implementering

### Hvorfor Neo4j til både vector og graph?

Neo4j understøtter native vector-indeks (siden Neo4j 5.11) og graph-queries i samme database. Alternativet ville være en separat vector-database (Pinecone, Weaviate el.lign.) og en separat graph-database — to systemer at drifte, to forbindelser at vedligeholde, og ingen mulighed for at kombinere vector-resultater med graph-traversal i én query.

Med Neo4j kan man f.eks. finde de semantisk nærmeste chunks *og* tjekke om den pågældende plante er en companion til en given plante — i samme Cypher-query. Det er ikke udnyttet fuldt ud i den nuværende version, men arkitekturen muliggør det.

### Chunking-strategi: 500 tegn, 50 tegns overlap

Wikipedia-tekster chunkes i 500-tegns segmenter med 50 tegns overlap. Begrundelse:

- **500 tegn** er tilstrækkeligt til at indeholde meningsfuld kontekst om én egenskab (f.eks. dyrkningsforhold eller companion-relation) uden at blande for mange emner i samme embedding.
- **50 tegns overlap** sikrer at information ved chunk-grænser ikke går tabt. En sætning der krydser en grænse vil være repræsenteret i begge chunks.
- Kortere chunks (f.eks. 200 tegn) ville give for lidt kontekst per embedding. Længere chunks (f.eks. 1000 tegn) ville gøre embeddings for generelle og reducere præcisionen ved cosine similarity-søgning.

Resultat: 228 chunks, 153/153 planter dækket.

### Embeddings: nomic-embed-text

nomic-embed-text er valgt som embedding-model fordi den er multilingual og kører lokalt via Ollama. Modellen producerer 768-dimensionelle vektorer og understøtter dansk input — brugeren kan søge på "tomat" og ramme chunks der indeholder "tomato". Oversættelsen sker implicit i embedding-rummet, ikke via eksplicit oversættelse.

### Idempotens: MERGE frem for CREATE (Workflow A del 2)

Neo4j-writeren bruger MERGE på `name_en` som unik nøgle. Det betyder at Workflow A del 2 kan køres flere gange uden at oprette duplikate noder eller relationer. Det er afgørende fordi staging-datasættet opdateres manuelt (human-in-the-loop), og man skal kunne gen-importere uden at rydde databasen først.

### Human-in-the-loop: staging JSON

Workflow A del 1 genererer `staging_plants.json` med LLM-berigede felter (navne, jordbund, næringsstoffer, sædskifte). Denne fil gennemses manuelt inden Workflow A del 2 skriver til Neo4j. Begrundelsen er at LLM-genereret data ikke er perfekt — særligt felter som `follows_well_after` og `avoid_after` kan indeholde hallucineringer. Et manuelt review-trin (human-in-the-loop) fanger fejl inden de bliver til grafdata.

### n8n's rolle: to separate ansvarsområder

n8n bruges til to distinkte formål i det samlede system:

**Data-pipeline (Workflows A1, A2, B)**: Staging JSON-generering, Neo4j-skrivning og vector ingestion. Disse workflows er fra 2-ugers projektet og er uændrede.

**Workflow E — Season/Soil Filter**: Et webhook-workflow eksponeret som MCP tool. Modtager `season`, `soil_type` og `moisture` som parametre (med understøttelse af dansk input via et mapping-trin), genererer en dynamisk Cypher-query og returnerer egnede planter fra Neo4j.

Workflow E lever i n8n frem for direkte i MCP-serveren fordi mapping-logikken (dansk → engelsk, f.eks. "forår" → "spring", "lerjord" → "clay") er naturlig at vedligeholde i en visuel workflow. Det er nemt at udvide mappingen uden at ændre MCP-serverens kode.

### Kravdækning

| Krav | Dækkes af |
|------|-----------|
| Meningsfuld brug af MCP | MCP server med 3 tools |
| Meningsfuld brug af n8n | Workflow E (webhook) + data-pipeline (A1, A2, B) |
| Neo4j vector RAG | `vector_search` tool |
| Neo4j graph RAG | `graph_query` tool |
| Eksponere n8n workflow via MCP | Workflow E eksponeres som `season_soil_filter` |
| Brugerinteraktion via Telegram | Hermes built-in gateway |
| Studenteroprettet prompt/skill | AGENTS.md + `skills/markplan.md` |

### MCP smoke test — alle tre tools verificeret

Smoke test kørt 12. maj 2026 via direkte JSON-RPC kald mod MCP serveren (port 3000):

- **vector_search** ("tomat companion planting", limit 3): returnerede radish (0.79), parsnip (0.79), carrots (0.77) — semantisk søgning virker på tværs af dansk/engelsk input
- **graph_query** ("tomatoes"): returnerede companions (peppers, cabbage, asparagus...), antagonister (peas, corn, dill...) og sædskifte-relationer korrekt
- **season_soil_filter** (forår/ler): returnerede 53 planter via n8n Workflow E — dansk input mappes korrekt

Observation: `graph_query` med "tomat" (dansk) returnerer "ikke fundet" — databasen har "Tomater" som `name_da`, og søgningen matcher kun eksakt lowercase. "tomat" ≠ "Tomater". Hermes instrueres i system_prompt om at bruge engelske plantenavne til `graph_query`.

### Hermes model og tool-calling

Hermes Agent bruger gemini-2.5-flash via Google AI Studio (gratis tier). llama3.1 lokalt via Ollama testedes men hallucinererede og kaldte ikke MCP tools pålideligt — modellen er for lille til tool-calling i Hermes' protokol. Gemini 2.5 Flash kalder `graph_query` korrekt på 0.1s og svarer på dansk.

Systemprompten er i `AGENTS.md` i projektroden — Hermes indlæser dette automatisk fra arbejdsmappen. Instruktionerne specificerer hvornår hvert tool bruges og at svar altid skal være på dansk.

### Custom system prompt (`hermes/system_prompt.md` / `AGENTS.md`)

System prompten definerer agentens rolle og routing-strategi. `AGENTS.md` i projektroden indlæses automatisk af Hermes fra CWD; `hermes/system_prompt.md` er en identisk kopi til dokumentation.

Routing-tabel (centrale instruktioner):
- Companion-spørgsmål → `graph_query(context="companion")` → NEXT STEP → `vector_search`
- Dyrkning → `graph_query(context="cultivation")` → NEXT STEP → `vector_search`
- Markplan/sæson+jord → `season_soil_filter` → NEXT STEPS → `graph_query` × 3
- Åbne spørgsmål → `vector_search`

Vigtigste designlæring: kortere, direktive instruktioner virker bedre end lange forklaringer. AGENTS.md-instruktioner kan overrides af Geminis base model training — sekvenslogikken er derfor embeddet direkte i tool-resultater som `NEXT STEP — do not respond to user yet`, ikke udelukkende i system prompt.

Tool-beskrivelserne i `mcp-server/index.js` bruges aktivt af LLM'en til tool-valg — `graph_query` er markeret som "PRIMÆRT VALG" for companion/dyrkning, `season_soil_filter` for markplaner.

### Custom skill: `markplan` (`hermes/skills/markplan.md`)

Skillen er bibeholdt som eksaminationskrav (studenteroprettet skill). Den definerer en intenderet ræsonnerings-sekvens til markplanlægning, men i praksis styres sekvensen primært af `season_soil_filter`'s NEXT STEPS output — tool-resultater er mere autoritative end skill-instruktioner for multi-trin flows med Gemini.

Intenderet sekvens:
1. Afklar sæson og jordbundstype
2. Kald `season_soil_filter` — filtrer kandidatmængden
3. Kald `graph_query` for top-kandidater — hent companions og sædskifte
4. Kald `vector_search` — berig med dyrkningsbeskrivelser
5. Syntetiser — præsenter struktureret anbefaling

Skill og tool-resultater supplerer hinanden: skillen definerer intentionen og giver eksamensrelevant forklaring af ræsonnementet; NEXT STEPS i tool-resultater håndhæver rækkefølgen under kørsel.

---

## Side 4 — Brug af agenten i casen

Tre repræsentative brugerinteraktioner der demonstrerer systemets tre flows:

### Eksempel 1: Companion planting

**Bruger:** "hvad trives godt med tomater?"

**Tool-kald:** `graph_query(plant_name="tomato", context="companion")` → `vector_search(query="tomato grows well with beneficial neighbor plants")`

**Svar (dansk):** Tomater trives godt med broccoli (Neo4j graph). Derudover nævner dyrkningslitteraturen radise, salat og løgplanter (Alliums) som gavnlige naboplanter. Tomater er gode forgængere for passionsfrugt, agurk og californisk valmue.

**Observation:** Neo4j har kun broccoli som companion for tomat. `vector_search` supplerer med Wikipedia-baserede companions. Begge datakilder kombineres i svaret.

---

### Eksempel 2: Dyrkningsvejledning

**Bruger:** "hvordan dyrker jeg kål?"

**Tool-kald:** `graph_query(plant_name="cabbage", context="cultivation")` → `vector_search(query="how to grow cabbage cultivation")`

**Svar (dansk):** Kål (Brassica oleracea) er en toårig plante dyrket som etårig. Trives i køligere vejr med god sol. Gode naboer: bønner, selleri, bælgfrugter. Undgå vindruer. Sæskifte: følger godt efter bønner, ærter, majs, squash; undgå efter tomater, peberfrugter, salat.

**Observation:** Graph-data giver companions/rotation, vector-data giver dyrkningsforhold. Agenten spørger ikke "hvilken type kål?" — den klikker direkte til graph_query.

---

### Eksempel 3: Markplan

**Bruger:** "lav en markplan til forår med lerjord"

**Tool-kald:** `season_soil_filter(season="forår", soil_type="lerjord")` → `graph_query(plant_name="asparagus")` → `graph_query(plant_name="bush beans")` → `graph_query(plant_name="fava beans")`

**Svar (dansk):** Forår med lerjord: (1) Asparges — trives med tomater og persille. (2) Buskbønner — trives med jordbær og agurker. (3) Hestebønner — følger godt efter tomater, majs, squash.

**Observation:** `season_soil_filter`'s PRIORITY-array (`["Vegetable", "Herbs", ...]`) sikrer at grøntsager vælges. NEXT STEPS i tool-resultatet styrer de efterfølgende `graph_query`-kald automatisk.

---

## Side 5 — Reflection og fremtidigt arbejde

### Begrænsninger

*[Udfyld undervejs — noter begrænsninger du støder på under implementering og test]*

**Kendte begrænsninger fra design:**
- Systemet kører kun lokalt — ingen skalering eller tilgængelighed for andre brugere
- Llama 3.1 (8B) kan fejle på komplekse multi-step reasoning opgaver sammenlignet med større modeller
- Staging-data er genereret med LLM og ikke fagligt valideret af en agronom
- Wikipedia er primærkilden til vector-tekst — indhold varierer i kvalitet og dybde per plante

### Sikkerhed og akademisk integritet

*[Udfyld inden aflevering]*

*Overvej:*
- *Credentials håndtering (`.env`, ikke committet)*
- *Ingen brugerdata gemmes — Telegram-beskeder routes kun, ikke logges*
- *Brug af LLM til generering af staging-data — hvad er kilden, hvad er LLM-genereret?*
- *Akademisk integritet: hvad er dit eget arbejde vs. eksisterende datasæt?*

### Fremtidigt arbejde

Fra V2-idéer i README:
- `Pest`-node med `REPELS` og `ATTRACTS_BENEFICIALS`-relationer
- Edible-filter i Season/Soil tool
- ØKO-Portalen som dansk tekstkilde til vector-embeddings
- Offline-first app med selvhosted backend

*[Tilføj egne observationer fra projektet — hvad ville du gøre anderledes?]*
