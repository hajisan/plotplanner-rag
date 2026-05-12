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

### Valg af LLM: Llama 3.1

Llama 3.1 bruges som agent-LLM. Valgt fordi:
- Tool calling-understøttelse, som er nødvendig for at Hermes kan kalde MCP tools
- Kører lokalt via Ollama uden GPU-krav der er urealistiske på dev-maskine
- Stærk generel forståelse af domænetekster på trods af 8B parameterstørrelse

Mistral 7B bruges til staging-generering (Workflow A del 1) frem for Llama 3.1, fordi opgaven er tekstgenerering og berigelse — ikke tool calling. Mistral er hurtigere og tilstrækkelig til den opgave.

*[Tilføj: eventuelt observation fra test — hvordan klarede Llama 3.1 sig med tool-valg i praksis?]*

### Arkitektur-overblik

Systemet er opdelt i tre lag:

**Interface-lag** (n8n Workflow D): Modtager Telegram-beskeder og router til Hermes. n8n er valgt til dette lag fordi det håndterer Telegram-protokollen og giver visuel kontrol over message flow uden at det kræver kode.

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

Resultat: 228 chunks, 104/104 planter dækket.

### Embeddings: nomic-embed-text

nomic-embed-text er valgt som embedding-model fordi den er multilingual og kører lokalt via Ollama. Modellen producerer 768-dimensionelle vektorer og understøtter dansk input — brugeren kan søge på "tomat" og ramme chunks der indeholder "tomato". Oversættelsen sker implicit i embedding-rummet, ikke via eksplicit oversættelse.

### Idempotens: MERGE frem for CREATE (Workflow A del 2)

Neo4j-writeren bruger MERGE på `name_en` som unik nøgle. Det betyder at Workflow A del 2 kan køres flere gange uden at oprette duplikate noder eller relationer. Det er afgørende fordi staging-datasættet opdateres manuelt (human-in-the-loop), og man skal kunne gen-importere uden at rydde databasen først.

### Human-in-the-loop: staging JSON

Workflow A del 1 genererer `staging_plants.json` med LLM-berigede felter (navne, jordbund, næringsstoffer, sædskifte). Denne fil gennemses manuelt inden Workflow A del 2 skriver til Neo4j. Begrundelsen er at LLM-genereret data ikke er perfekt — særligt felter som `follows_well_after` og `avoid_after` kan indeholde hallucineringer. Et manuelt review-trin (human-in-the-loop) fanger fejl inden de bliver til grafdata.

### n8n's rolle: to separate ansvarsområder

n8n bruges til to distinkte formål i det samlede system:

**Workflow D — Telegram Bridge**: Modtager beskeder fra Telegram via webhook, sender dem til Hermes' API, og returnerer Hermes' svar til Telegram. n8n håndterer Telegram-protokollen og giver visuel kontrol over message routing.

**Workflow E — Season/Soil Filter**: Et webhook-workflow eksponeret som MCP tool. Modtager `season`, `soil_type` og `moisture` som parametre (med understøttelse af dansk input via et mapping-trin), genererer en dynamisk Cypher-query og returnerer egnede planter fra Neo4j.

Workflow E lever i n8n frem for direkte i MCP-serveren fordi mapping-logikken (dansk → engelsk, f.eks. "forår" → "spring", "lerjord" → "clay") er naturlig at vedligeholde i en visuel workflow. Det er nemt at udvide mappingen uden at ændre MCP-serverens kode.

### Custom system prompt (`hermes/system_prompt.md`)

*[Udfyld når system_prompt.md er skrevet — beskriv de konkrete valg: hvilke instruktioner er med, og hvorfor. Hvad forsøgte du og hvad virkede ikke?]*

Designprincipper der guides af:
- Eksplicit tool-strategi: agenten instrueres i *hvornår* hvert tool er relevant frem for at lade den gætte
- Dansk kommunikation: agenten kommunikerer altid på dansk selvom kildedataen er på engelsk
- Kortfattethed: handlingsorienterede svar frem for lange forklaringer

### Custom skill: `markplan` (`hermes/skills/markplan.md`)

*[Udfyld når markplan.md er skrevet og testet — beskriv den konkrete sekvens og hvad der begrundede rækkefølgen]*

Skillen definerer en fast ræsonnerings-sekvens til markplanlægning:
1. Afklar sæson og jordbundstype (spørg ind hvis ikke givet)
2. Kald `season_soil_filter` — find egnede planter til betingelserne
3. Kald `graph_query` for top-kandidater — hent companions og sædskifte
4. Kald `vector_search` — berig med dyrkningsbeskrivelser
5. Syntetiser — præsenter struktureret anbefaling med begrundelse

Rækkefølgen er valgt fordi filtrering på betingelser (trin 2) indsnævrer kandidatmængden inden de dyrere graph- og vector-kald (trin 3-4). Det er en bevidst optimering.

---

## Side 4 — Brug af agenten i casen

*[Udfyld med konkrete eksempler fra test — 2-3 brugerinteraktioner der viser systemet i brug]*

*Forslag til hvad der skal med:*
- *Et eksempel med `vector_search`: åbent spørgsmål om en plante*
- *Et eksempel med `graph_query`: "hvad trives godt sammen med tomater?"*
- *Et eksempel med `markplan`-skill: "hvad kan jeg plante i foråret på lerjord?"*
- *Evt. et eksempel hvor agenten kombinerer to tools*

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
