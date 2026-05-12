# Design: n8n's rolle i eksamensprojektet

**Dato**: 2026-05-12  
**Projekt**: PlotPlanner RAG — eksamensprojekt  
**Status**: Godkendt

---

## Kontekst

PlotPlanner bygger videre på et 2-ugers projekt (Workflows A1, A2, B, C). Eksamensprojektet tilføjer Hermes Agent og MCP server. n8n's rolle i det nye lag skal afklares og implementeres.

Krav fra LEARNING_GOALS.md:
- Alle fire teknologier bruges meningsfuldt: MCP, n8n, Neo4j vector RAG, Neo4j graph RAG
- Eksponere mindst ét n8n workflow eller RAG via MCP server
- Brugerinteraktion via Telegram
- Mindst ét studenteroprettet prompt eller skill (evalueringskrav)

---

## Valgt tilgang: Tilgang B

n8n beholder Telegram-interfacet og eksponerer ét webhook-workflow via MCP. MCP-tools til vector og graph search kalder Neo4j direkte.

**Fravalgte alternativer:**
- *Tilgang A (n8n kun Telegram-bridge, MCP → Neo4j direkte)*: n8n's eksamensprojekt-rolle ville være tynd — kun interface uden meningsfuld ny funktionalitet.
- *Tilgang C (alle MCP-tools via n8n webhooks)*: Overkompleks. Tilføjer latency og fejlpunkter uden reel merværdi.

---

## Arkitektur

```
Telegram
   │
   ▼
n8n Workflow D — Telegram Bridge
   │  POST til Hermes API
   ▼
Hermes Agent (Llama 3.1 via Ollama)
   ├── hermes/system_prompt.md    ← custom, forklaret til eksamen
   ├── hermes/skills/markplan.md  ← custom skill, forklaret til eksamen
   │
   └──► MCP Server (localhost:3000)
           ├── vector_search       ──► Neo4j direkte (cosine similarity)
           ├── graph_query         ──► Neo4j direkte (relations-query)
           └── season_soil_filter  ──► n8n Workflow E (webhook) ──► Neo4j
```

**Eksisterende workflows (data-pipeline — uændrede):**
- Workflow A del 1: staging JSON-generator
- Workflow A del 2: Neo4j writer
- Workflow B: vector ingestion

---

## Komponenter

### n8n Workflow D — Telegram Bridge

**Trigger**: Telegram-besked (webhook eller Telegram-node)  
**Flow**:
1. Modtag besked fra Telegram
2. HTTP Request POST til Hermes API med besked-tekst
3. Modtag svar fra Hermes
4. Send svar tilbage til Telegram

**Ansvar**: Interface-lag. n8n håndterer Telegram-protokollen og message routing.

### n8n Workflow E — Season/Soil Filter (webhook)

**Trigger**: Webhook-kald fra MCP server  
**Input**: `{ season, soil_type, moisture }` — dansk eller engelsk  
**Flow**:
1. Modtag webhook-kald
2. Code-node: map dansk input til engelske Neo4j-værdier (forår→spring, lerjord→clay osv.)
3. HTTP Request til Neo4j med dynamisk Cypher-query
4. Return: liste af egnede planter

**Ansvar**: Kompleks transformation med domæne-specifik mapping. Lever naturligt i n8n — visuel workflow, mapping-logik er nemt at udvide.

**Eksponering**: MCP tool `season_soil_filter` kalder denne webhook.

### MCP Server

**Tools**:

| Tool | Backend | Beskrivelse |
|------|---------|-------------|
| `vector_search` | Neo4j direkte | Semantisk søgning på Chunk-noder via cosine similarity (threshold 0.7) |
| `graph_query` | Neo4j direkte | Henter companions, antagonister og sædskifte-relationer for en plante |
| `season_soil_filter` | n8n Workflow E | Filtrerer planter på sæson, jordbundstype og moisture med dansk input-support |

### Hermes system prompt (`hermes/system_prompt.md`)

Definerer agentens identitet og ræsonnerings-strategi:

- **Rolle**: Erfaren markplanlægger til regenerativt landbrug og andelsgårde
- **Tool-strategi** (eksplicit instrueret):
  - `vector_search` → åbne spørgsmål om dyrkningsforhold, egenskaber, teknikker
  - `graph_query` → specifikke planter: companions, antagonister, sædskifte
  - `season_soil_filter` → "hvad kan jeg plante nu/her?" med betingelser
- **Multi-tool**: ved komplekse spørgsmål kombineres tools — agenten syntetiserer, ikke bare lister
- **Sprog**: kommunikerer altid på dansk uanset at kildedataen er på engelsk
- **Tone**: faglig men tilgængelig, kortfattet og handlingsorienteret

### Hermes skill — `markplan` (`hermes/skills/markplan.md`)

Aktiveres når brugeren beder om en samlet markplan eller planteanbefalinger. Definerer en fast ræsonnerings-sekvens:

1. **Identificer betingelser** — afklar sæson og jordbundstype hvis ikke givet
2. **Kald `season_soil_filter`** — find egnede planter til betingelserne
3. **Kald `graph_query`** for top-kandidater — hent companions og sædskifte
4. **Kald `vector_search`** — berig med dyrkningsbeskrivelser
5. **Syntetiser** — præsenter struktureret anbefaling med begrundelse

**Eksamensformål**: Skillens sekvens forklares eksplicit til eksamen — hvert trin begrundes. Demonstrerer forståelse af prompt engineering og tool orchestration.

---

## Kravdækning

| Krav | Dækkes af |
|------|-----------|
| Meningsfuld brug af MCP | MCP server med 3 tools |
| Meningsfuld brug af n8n | Workflow D (Telegram) + Workflow E (webhook) |
| Neo4j vector RAG | `vector_search` tool |
| Neo4j graph RAG | `graph_query` tool |
| Eksponere n8n workflow via MCP | Workflow E eksponeres som `season_soil_filter` |
| Brugerinteraktion via Telegram | Workflow D |
| Studenteroprettet prompt/skill | system_prompt.md + skills/markplan.md |

---

## Åbne spørgsmål

- Hermes' API-interface (endpoint, request-format) afklares ved installation
- n8n Workflow C erstattes af Workflow D — Telegram Trigger og HTTP Request til Hermes erstatter Chat Trigger og AI Agent-noden
