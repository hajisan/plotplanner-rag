# CLAUDE.md — PlotPlanner Eksamensprojekt

## Projekt
PlotPlanner er et RAG-system til markplanlægning for regenerativt landbrug og andelsgårde. Systemet kombinerer vector- og graph-RAG i Neo4j til at besvare spørgsmål om companion planting og sædskifte via en AI agent.

Projektet bygger videre på et 2-ugers projekt fra AI Agenter og Automatisering, 4. semester, KEA. Eksamensprojektet tilføjer Hermes Agent og MCP ovenpå det eksisterende fundament.

---

## Stack

| Komponent | Teknologi |
|-----------|-----------|
| Agent platform | Hermes Agent (Nous Research) |
| Workflow | n8n v2.14.2 |
| Graf + Vector DB | Neo4j Desktop |
| LLM / Agent | gemini-2.5-flash via Google AI Studio |
| Tekstgenerering (staging) | Mistral 7B via Ollama |
| Embeddings | nomic-embed-text (768 dim, multilingual) |
| Interface | Telegram |
| MCP server | Custom — eksponerer RAG-endpoints som tools |

---

## Repo-struktur

```
/
├── CLAUDE.md
├── workflows/
│   ├── workflow-a-del1-staging-generator.json   # Data pipeline (2-ugers projekt)
│   ├── workflow-a-del2-neo4j-writer.json         # Data pipeline (2-ugers projekt)
│   ├── workflow-b-vector-ingestion.json          # Data pipeline (2-ugers projekt)
│   ├── workflow-c-agent.json                     # Erstattet af Hermes + gateway
│   └── workflow-e-season-soil-filter.json        # Eksamensprojekt — webhook til MCP tool
├── mcp-server/                                   # Eksamensprojekt — eksponerer RAG som MCP tools
├── hermes/
│   ├── config.yaml                               # Hermes konfiguration
│   ├── system_prompt.md                          # Custom system prompt (eksaminationskrav)
│   └── skills/
│       └── markplan.md                           # Custom skill (eksaminationskrav)
├── screenshots/
├── data/
│   └── staging_plants_v2.json
├── docs/
│   ├── rapport.md                                # Eksamensprojekt rapport (max 5 sider)
│   └── superpowers/specs/                        # Designdokumenter
└── README.md
```

---

## Workflows

### Data-pipeline (fra 2-ugers projekt — uændrede)

**Workflow A del 1** — Staging JSON Generator
Henter data fra to companion planting datasæt, beriger med Wikidata, Wikipedia og Ollama (Mistral), og outputter `staging_plants.json` med 153 planter.

**Workflow A del 2** — Neo4j Writer
Læser staging JSON og skriver planter og relationer til Neo4j med MERGE (idempotent).

**Workflow B** — Vector Ingestion
Henter Wikipedia-tekst per plante, chunker (500 tegn, 50 tegns overlap) og genererer embeddings med nomic-embed-text. 228 chunks, 153/153 planter dækket.

### Eksamensprojekt-workflows (nye)

**Telegram-interface** — Hermes built-in gateway
Hermes Agent har en built-in Telegram gateway der kører som launchd service (`hermes gateway run`). Erstatter Workflow C's Chat Trigger + AI Agent direkte — ingen n8n-bridge nødvendig. Workflow D blev fravalgt fordi Hermes håndterer Telegram nativt med lavere kompleksitet.

**Workflow E** — Season/Soil Filter (webhook)
Webhook-workflow eksponeret som MCP tool. Modtager `season`, `soil_type`, `moisture` (dansk eller engelsk input), mapper til engelske Neo4j-værdier, og returnerer liste af egnede planter via dynamisk Cypher-query.

---

## Neo4j datamodel

### Noder
`Plant`, `Family`, `Nutrient`, `Season`, `SoilType`, `Moisture`, `Chunk`

### Centrale relationer
| Relation | Beskrivelse |
|----------|-------------|
| `GROWS_WELL_WITH` | Companion planting |
| `ANTAGONIZES` | Hæmmer vækst |
| `FOLLOWS_WELL_AFTER` | God sædskifteforgænger |
| `AVOID_AFTER` | Dårlig sædskifteforgænger |
| `DEPLETES` / `RESTORES` | Næringsstofhåndtering |
| `HAS_CHUNK` | Kobling til vector-chunks |

---

## MCP tools

| Tool | Backend | Beskrivelse |
|------|---------|-------------|
| `vector_search` | Neo4j direkte | Semantisk søgning på Chunk-noder via cosine similarity (threshold 0.7) |
| `graph_query` | Neo4j direkte | Henter companions, antagonister og sædskifte-relationer for en given plante |
| `season_soil_filter` | n8n Workflow E | Filtrerer planter på sæson, jordbundstype og moisture — understøtter dansk input |

---

## Arkitektur

```
Telegram
   │
   ▼
Hermes Gateway (launchd service)
   │
   ▼
Hermes Agent (gemini-2.5-flash via Google AI Studio)
   ├── AGENTS.md                  ← system prompt (læses automatisk fra CWD)
   ├── hermes/system_prompt.md    ← kopi til dokumentation
   ├── hermes/skills/markplan.md  ← custom skill
   │
   └──► MCP Server (localhost:3000)
           ├── vector_search       ──► Neo4j direkte
           ├── graph_query         ──► Neo4j direkte
           └── season_soil_filter  ──► n8n Workflow E ──► Neo4j
```

**n8n's rolle**: Kompleks domænetransformation eksponeret som MCP tool (Workflow E) og data-pipeline (A1, A2, B) ved ingestion. Telegram-interfacet håndteres af Hermes' built-in gateway.

## Hermes konfiguration

**Model**: gemini-2.5-flash via Google AI Studio (gratis tier). llama3.1 lokalt via Ollama testedes men var for svag til tool-calling.

**AGENTS.md** (projektroden) — Hermes indlæser automatisk fra arbejdsmappen (CWD). Definerer agentens rolle, tool-strategi og tone:
- Rolle: erfaren markplanlægger til regenerativt landbrug
- Routing-tabel: companion/dyrkning → `graph_query` med `context`-parameter, markplan → `season_soil_filter`, åbent → `vector_search`
- Kommunikerer altid på dansk

**hermes/system_prompt.md** — Identisk kopi til dokumentation og eksaminationsreference. Sync med: `cp AGENTS.md hermes/system_prompt.md`

**skills/markplan.md** — Fast ræsonnerings-sekvens til markplaner (eksaminationskrav). I praksis styres sekvensen af NEXT STEPS i tool-resultater.

**Tool-beskrivelser i `mcp-server/index.js`** — bruges aktivt af LLM'en til tool-valg. `graph_query` er markeret som "PRIMÆRT VALG" for companion/dyrkning, `season_soil_filter` for markplaner. Disse beskrivelser er del af tool-schema og er mere pålidelige end AGENTS.md-routing for Gemini.

**NEXT STEP-instruktioner i tool-resultater** — primær mekanisme til multi-trin flows. Mønsteret `NEXT STEP — do not respond to user yet: Call X, then write Danish response` er mere autoritativt end system prompt-instruktioner fordi tool-resultater er direkte i LLM'ens kontekstvindue.

**Hermes config** lever i `~/.hermes/config.yaml` (ikke i repo). `hermes/config.yaml` i projektet er dokumentation af de valgte indstillinger.

---

## Kørsel lokalt

```bash
# Neo4j — start via Neo4j Desktop

# Ollama
ollama serve
ollama pull llama3.1
ollama pull nomic-embed-text

# n8n — importer workflows fra /workflows/
# Aktiver Workflow E (Season/Soil Filter webhook)

# MCP server
cd mcp-server && npm install && npm start

# Hermes
hermes
```

Hermes config i `hermes/config.yaml` peger på:
- Ollama: `localhost:11434`
- MCP server: `localhost:3000`
- Neo4j: `localhost:7687`
- System prompt: `hermes/system_prompt.md`
- Skills: `hermes/skills/`

---

## Eksamen

**Format**: Mundtlig eksamen — systemet køres lokalt under præsentationen
**Workflows der præsenteres**: A del 1, A del 2, B, E (+ MCP server og Hermes gateway)
**Rapport**: Max 5 sider, afleveringsfrist 26. maj 2026
**Datoer**: 4., 8. eller 10. juni 2026

Forbered svar på:
- Hvorfor Neo4j til både graf og vector?
- Hvad er forskellen på vector search og graph query, og hvornår bruges hvilken?
- Hvorfor MERGE og ikke CREATE i Workflow A del 2?
- Hvad er chunk-størrelse og overlap, og hvorfor de valgte værdier?
- Hvordan understøtter systemet dansk søgning med engelske kildedata?
- Hvorfor human-in-the-loop på staging JSON inden Neo4j-skrivning?
- Hvorfor Hermes frem for NanoClaw — og hvad betyder model-agnostisk i praksis?
- Hvad er MCP, og hvad løser det i denne arkitektur?

---

## Arbejdsstil

- Dansk eller engelsk efter kontekst — blandet er fint
- Forklar kode når det er relevant
- Peg på huller i implementeringen ift. eksaminationskrav
- Rapporten skrives i `docs/rapport.md` — ret kun ved direkte fejl, behold eget sprog
- Credentials holdes i `.env` og må ikke committes
