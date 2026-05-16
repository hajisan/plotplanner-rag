# Arkitektur — PlotPlanner RAG

## Systemarkitektur (runtime)

```mermaid
flowchart TD
    Telegram["📱 Telegram"]

    subgraph hermes["Hermes Agent (Nous Research)"]
        GW["Gateway Service\n(launchd)"]
        AGENT["Agent\ngemini-2.5-flash"]
        AGENTS_MD["AGENTS.md\nsystem prompt + markplan-sekvens"]
    end

    subgraph mcp["MCP Server (localhost:3000)"]
        VS["vector_search"]
        GQ["graph_query"]
        SSF["season_soil_filter"]
    end

    subgraph neo4j["Neo4j Desktop (localhost:7687)"]
        VECTOR["Vector index\n228 Chunk-noder\nnomic-embed-text 768 dim"]
        GRAPH["Graf\n104 planter\n1.940+ relationer"]
    end

    N8N_E["n8n Workflow E\nSeason/Soil Filter webhook"]

    Telegram --> GW
    GW --> AGENT
    AGENTS_MD -.-> AGENT
    AGENT --> VS
    AGENT --> GQ
    AGENT --> SSF
    VS --> VECTOR
    GQ --> GRAPH
    SSF --> N8N_E
    N8N_E --> GRAPH
```

---

## Data-pipeline (ingestion)

```mermaid
flowchart LR
    DS1["alecsharpie\ncompanion dataset"]
    DS2["Genevieve\ncompanion dataset"]
    WD["Wikidata\nSPARQL"]
    WP["Wikipedia\nAPI"]
    OLLAMA_M["Ollama\nMistral 7B"]
    OLLAMA_E["Ollama\nnomic-embed-text"]

    subgraph n8n["n8n workflows"]
        A1["Workflow A del 1\nStaging Generator"]
        A2["Workflow A del 2\nNeo4j Writer"]
        B["Workflow B\nVector Ingestion"]
    end

    JSON["staging_plants.json\n104 planter"]

    subgraph neo4j["Neo4j"]
        PLANTS["Plant-noder\n+ relationer"]
        CHUNKS["Chunk-noder\n+ embeddings"]
    end

    DS1 --> A1
    DS2 --> A1
    WD --> A1
    OLLAMA_M --> A1
    A1 --> JSON
    JSON --> A2
    A2 --> PLANTS
    PLANTS --> B
    WP --> B
    OLLAMA_E --> B
    B --> CHUNKS
```

---

## Neo4j datamodel

```mermaid
graph LR
    P["Plant\nname_en, name_da\nname_latin, type"]
    F["Family"]
    S["Season\nspring/summer\nfall/winter"]
    ST["SoilType\nclay/sandy\nloamy/..."]
    M["Moisture\nwell-drained/..."]
    N["Nutrient\nN/P/K/Ca/Mg"]
    C["Chunk\ntext, embedding\n768 dim"]

    P -->|GROWS_WELL_WITH| P
    P -->|ANTAGONIZES| P
    P -->|FOLLOWS_WELL_AFTER| P
    P -->|AVOID_AFTER| P
    P -->|BELONGS_TO| F
    P -->|GROWS_IN| S
    P -->|PREFERS_SOIL| ST
    P -->|PREFERS_MOISTURE| M
    P -->|DEPLETES| N
    P -->|RESTORES| N
    P -->|HAS_CHUNK| C
```

---

## MCP tool-strategi

| Spørgsmål | Tool | Eksempel |
|-----------|------|---------|
| Specifik plante | `graph_query` | "hvad trives godt med tomater?" |
| Åbent dyrkningsspørgsmål | `vector_search` | "hvad kræver kål af jordbund?" |
| Hvad kan jeg plante | `season_soil_filter` | "hvad egner sig til lerjord om foråret?" |
| Markplan | Alle tre i sekvens | `season_soil_filter` → `graph_query` × 3-5 → `vector_search` |
