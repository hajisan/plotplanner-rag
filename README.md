# PlotPlanner — Markplanlægning RAG

> Et RAG-system der kombinerer vector- og graph-database i Neo4j til markplanlægning for regenerativt landbrug og andelsgårde. Systemet svarer på spørgsmål om companion planting og sædskifte via en AI agent tilgængelig over Telegram.

**Kursus**: AI Agenter og Automatisering — KEA 4. semester  
**Underviser**: Lasse Vogelsang  

---

## Arkitektur

```
Telegram
   │
   ▼
Hermes Gateway (launchd service)
   │
   ▼
Hermes Agent  ←── AGENTS.md (system prompt + markplan-sekvens)
   │
   └──► MCP Server (localhost:3000)
           ├── vector_search       ──► Neo4j (vector)
           ├── graph_query         ──► Neo4j (graf)
           └── season_soil_filter  ──► n8n Workflow E ──► Neo4j
```

---

## Teknisk stack

| Komponent | Teknologi |
|---|---|
| Agent platform | Hermes Agent (Nous Research) |
| LLM | gemini-2.5-flash via Google AI Studio |
| Workflow | n8n v2.14.2 |
| Graf + Vector DB | Neo4j Desktop |
| MCP server | Custom Node.js — eksponerer RAG som tools |
| Interface | Telegram (Hermes built-in gateway) |
| Embeddings | nomic-embed-text via Ollama (768 dim, multilingual) |
| Tekstgenerering (staging) | Mistral 7B via Ollama |

---

## Repo-struktur

```
/
├── AGENTS.md                                     # Hermes system prompt (auto-indlæst fra CWD)
├── workflows/
│   ├── workflow-a-del1-staging-generator.json   # Data pipeline
│   ├── workflow-a-del2-neo4j-writer.json         # Data pipeline
│   ├── workflow-b-vector-ingestion.json          # Data pipeline
│   ├── workflow-c-agent.json                     # Erstattet af Hermes + gateway
│   └── workflow-e-season-soil-filter.json        # MCP tool via n8n webhook
├── mcp-server/                                   # MCP server — eksponerer RAG som tools
│   ├── index.js
│   └── tools/
│       ├── vector_search.js
│       ├── graph_query.js
│       └── season_soil_filter.js
├── hermes/
│   ├── config.yaml                               # Dokumentation af Hermes-konfiguration
│   ├── system_prompt.md                          # Kopi af AGENTS.md til dokumentation
│   └── skills/
│       └── markplan.md                           # Markplan-sekvens skill
├── data/
│   └── staging_plants_v2.json
├── docs/
│   └── rapport.md
└── screenshots/
```

---

## Domæne og case

Markplanlægning til småskala- og regenerativt landbrug. Systemet kombinerer to typer viden:

**Graf (relationer)**: Hvilke planter trives ved siden af hinanden, hvilke følger godt efter hinanden, hvad optager og genopbygger næringsstoffer.

**Vector (semantisk)**: Beskrivende tekst om dyrkningsforhold og teknikker per plante. Søgning på dansk virker selvom kildedataen er på engelsk.

**Agentens rolle**: Erfaren markplanlægger der rådgiver andelsgårde og regenerative landmænd via Telegram.

---

## Datasæt — 104 planter

| Kilde | Brug | Licens |
|---|---|---|
| [alecsharpie/companion_planting_dataset](https://github.com/alecsharpie/companion_planting_dataset) | Companion planting — frugt, urter, blomster | MIT |
| [GenevieveMilliken/companion_plants](https://github.com/GenevieveMilliken/companion_plants) | Companion planting — grøntsager | MIT |
| [Wikidata SPARQL](https://query.wikidata.org/sparql) | Botaniske familier | Åben |
| [Wikipedia API](https://en.wikipedia.org/w/api.php) | Beskrivende tekst til vector embeddings | Åben |
| [RHS — Royal Horticultural Society](https://www.rhs.org.uk) | Soil type og moisture per plante | Manuelt |

---

## MCP tools

| Tool | Backend | Beskrivelse |
|---|---|---|
| `vector_search` | Neo4j direkte | Semantisk søgning på Chunk-noder (cosine similarity ≥ 0.7) |
| `graph_query` | Neo4j direkte | Companions, antagonister og sædskifte for en given plante |
| `season_soil_filter` | n8n Workflow E | Filtrerer planter på sæson + jordbund — understøtter dansk input |

---

## Workflows

**Workflow A del 1** — Staging JSON Generator  
Henter data fra to datasæt, beriger med Wikidata, Wikipedia og Ollama (Mistral). Output: `staging_plants.json` med 104 planter.

**Workflow A del 2** — Neo4j Writer  
Læser staging JSON og skriver planter og relationer til Neo4j med MERGE (idempotent).

**Workflow B** — Vector Ingestion  
Henter Wikipedia-tekst, chunker (500 tegn, 50 overlap) og genererer embeddings. 228 chunks, 104/104 planter dækket.

**Workflow E** — Season/Soil Filter (webhook)  
Eksponeret som MCP tool. Modtager dansk eller engelsk sæson + jordbundstype, mapper til Neo4j-værdier og returnerer egnede planter.

---

## Kørsel lokalt

```bash
# 1. Neo4j — start via Neo4j Desktop

# 2. Ollama (kun nødvendigt til re-ingestion)
ollama serve
ollama pull nomic-embed-text

# 3. n8n — importer workflows, aktiver Workflow E

# 4. MCP server
cd mcp-server && npm install && npm start

# 5. Hermes gateway (kører som launchd service efter setup)
hermes gateway run   # eller: hermes gateway start (baggrund)

# 6. Chat via Telegram — send besked til botten
```

**Første gang**: kør `hermes gateway setup` for at konfigurere Telegram bot token.

---

## Graf-skema

### Noder
`Plant`, `Family`, `Nutrient`, `Season`, `SoilType`, `Moisture`, `Chunk`

### Centrale relationer

| Relation | Antal | Beskrivelse |
|---|---|---|
| `FOLLOWS_WELL_AFTER` | 362 | God sædskifteforgænger |
| `GROWS_WELL_WITH` | 271 | Companion planting |
| `PREFERS_SOIL` | 329 | Foretrukken jordbundstype |
| `AVOID_AFTER` | 122 | Dårlig sædskifteforgænger |
| `GROWS_IN` | 198 | Dyrkningssæson |
| `ANTAGONIZES` | 56 | Hæmmer vækst |
| `HAS_CHUNK` | 228 | Vector tekst-chunks |
