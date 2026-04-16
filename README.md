# PlotPlanner — Markplanlægning RAG

> Et RAG-system der kombinerer vector- og graph-database i Neo4j til markplanlægning for regenerativt landbrug og andelsgårde. Systemet svarer på spørgsmål om companion planting og sædskifte via en AI agent i n8n. Projektet er også fundament for et fremtidigt produkt.

**Kursus**: AI Agenter og Automatisering — KEA 4. semester  
**Underviser**: Lasse Vogelsang  
**Opgavebeskrivelse**: https://vogelsang.github.io/AI-Agenter-F2026-public/projects/two-week-project.html

---

## Indhold

```
/
├── workflows/
│   ├── workflow-a-del1-staging-generator.json
│   ├── workflow-a-del2-neo4j-writer.json
│   ├── workflow-b-vector-ingestion.json
│   └── workflow-c-agent.json
├── screenshots/
│   ├── workflow-a-del1.png
│   ├── workflow-a-del2.png
│   ├── workflow-b.png
│   ├── workflow-c.png
│   ├── neo4j-relations-overview.png
│   ├── neo4j-tomatoes-graph.png
│   └── neo4j-plant-types.png
├── data/
│   └── staging_plants_v2.json
└── README.md
```

---

## Domæne og case

Markplanlægning til småskala- og regenerativt landbrug. Systemet kombinerer to typer viden:

**Graf (relationer)**: Hvilke planter trives ved siden af hinanden, hvilke planter bør følge efter hinanden på en mark, hvad optager og genopbygger næringsstoffer i jorden.

**Vector (semantisk)**: Rig beskrivende tekst om dyrkningsforhold, egenskaber og teknikker per plante. Brugeren kan søge på dansk selvom kildedataen er på engelsk.

**Agentens rolle**: Erfaren markplanlægger der rådgiver andelsgårde og regenerative landmænd.

### Fremtidigt produkt

Dette projekt bygger fundamentet — vidensbase og retrieval-lag — til et markplanlægningsprogram. Selve applikationen (UI, brugerkonti, markdata) er et separat lag der bygges ovenpå. Målplatform: iOS og Android, med selvhosted backend så data ikke forlader virksomheden.

---

## Teknisk stack

| Komponent | Teknologi | Note |
|---|---|---|
| Workflow | n8n v2.14.2 | Lokalt |
| Graf + Vector DB | Neo4j Desktop | Samme instans til begge |
| LLM / Agent | Llama 3.1 via Ollama | Tool calling |
| Tekstgenerering | Mistral 7B via Ollama | Staging-generering |
| Embeddings | nomic-embed-text via Ollama | 768 dim, multilingual |

---

## Datasæt

### Plantedata — 104 planter

| Felt | Beskrivelse | Kilde |
|---|---|---|
| `name_en` | Engelsk navn | alecsharpie / Genevieve |
| `name_da` | Dansk navn | Manuelt kurateret |
| `name_latin` | Latinsk navn | alecsharpie / Genevieve |
| `type` | Fruit / Vegetable / Herbs / Flowers / Other | alecsharpie |
| `edible` | Boolean — er planten spiselig | Manuelt kurateret |
| `prefers_soil` | Soil types fra RHS | Manuelt kurateret via RHS |
| `prefers_moisture` | Moisture preference fra RHS | Manuelt kurateret via RHS |
| `depletes` | Næringsstoffer planten forbruger | Ollama (Mistral) |
| `restores` | Næringsstoffer planten genopbygger | Ollama (Mistral) |
| `grows_in` | Sæsoner | Ollama (Mistral) |
| `helps` | Companion planting — hjælper | alecsharpie / Genevieve |
| `helped_by` | Companion planting — hjælpes af | alecsharpie / Genevieve |
| `avoid` | Antagonister | alecsharpie / Genevieve |
| `follows_well_after` | Sædskifte — god forgænger | Ollama (Mistral) |
| `avoid_after` | Sædskifte — dårlig forgænger | Ollama (Mistral) |

### Datakilder

| Kilde | Brug | Licens |
|---|---|---|
| [alecsharpie/companion_planting_dataset](https://github.com/alecsharpie/companion_planting_dataset) | Companion planting — frugt, urter, blomster | MIT |
| [GenevieveMilliken/companion_plants](https://github.com/GenevieveMilliken/companion_plants) | Companion planting — grøntsager | MIT |
| [Wikidata SPARQL](https://query.wikidata.org/sparql) | Botaniske familier | Åben |
| [Wikipedia API](https://en.wikipedia.org/w/api.php) | Beskrivende tekst til vector embeddings | Åben |
| [RHS — Royal Horticultural Society](https://www.rhs.org.uk) | Soil type og moisture per plante | Manuelt |

---

## Graf-skema

### Noder

| Node | Attributter | Beskrivelse |
|---|---|---|
| `Plant` | name_en, name_da, name_latin, type, edible, source | Kerneobjektet |
| `Family` | name | Botanisk plantefamilie |
| `Nutrient` | name | Næringsstoffer — N, P, K, Ca, Mg |
| `Season` | name | spring, summer, fall, winter |
| `SoilType` | name | sandy, loamy, clay, chalky, peaty, silty |
| `Moisture` | name | well-drained, moist but well-drained, poorly drained |
| `Chunk` | text, index, embedding | Wikipedia-tekst til vector search |

### Relationer

| Relation | Fra → Til | Antal | Beskrivelse |
|---|---|---|---|
| `FOLLOWS_WELL_AFTER` | Plant → Plant | 362 | God sædskifteforgænger |
| `GROWS_WELL_WITH` | Plant → Plant | 271 | Companion planting — gavner hinanden |
| `PREFERS_SOIL` | Plant → SoilType | 329 | Foretrukken jordbundstype |
| `AVOID_AFTER` | Plant → Plant | 122 | Dårlig sædskifteforgænger |
| `GROWS_IN` | Plant → Season | 198 | Dyrkningssæson |
| `DEPLETES` | Plant → Nutrient | 140 | Forbruger næringsstof |
| `PREFERS_MOISTURE` | Plant → Moisture | 138 | Fugtpræference |
| `BELONGS_TO` | Plant → Family | 75 | Botanisk familie |
| `ANTAGONIZES` | Plant → Plant | 56 | Hæmmer vækst |
| `RESTORES` | Plant → Nutrient | 21 | Genopbygger næringsstof |
| `HAS_CHUNK` | Plant → Chunk | 228 | Vector tekst-chunks |

---

## Workflows

### Workflow A del 1 — Staging JSON Generator

Genererer et kurateret staging JSON-datasæt fra to companion planting datasæt.

**Flow**: HTTP Request (alecsharpie) + HTTP Request (Genevieve) → Code (merge og parse) → Wikidata SPARQL (familier) → Ollama Mistral (LLM-berigelse) → Write Binary File

**LLM-genererede felter**: `name_da`, `prefers_soil`, `depletes`, `restores`, `grows_in`, `follows_well_after`, `avoid_after`

**Køretid**: ca. 45-60 minutter (Wikidata rate limiting: 2000ms interval)

**Output**: `staging_plants.json` — 104 planter

### Workflow A del 2 — Neo4j Writer

Læser staging JSON og skriver alle planter og relationer til Neo4j med MERGE (idempotent).

**Flow**: Manual Trigger → Read Binary File → Code (parse JSON) → Code (Cypher + HTTP til Neo4j)

**Cypher**: MERGE på `name_en` — kører sikkert flere gange uden dubletter

### Workflow B — Vector Ingestion

Henter Wikipedia-tekst per plante, chunker og genererer embeddings med Ollama.

**Flow**: Manual Trigger → HTTP Request (Neo4j — hent planter) → Split In Batches → HTTP Request (Wikipedia) → Code (chunk tekst) → IF (needs_fallback) → Ollama (embeddings) → HTTP Request (Neo4j — gem chunk)

**Chunking**: 500 tegn, 50 tegns overlap  
**Embeddings**: nomic-embed-text, 768 dimensioner  
**Fallback**: name_latin → name_en → nameMap (larkspur→Delphinium etc.)  
**Resultat**: 228 chunks, 104/104 planter dækket

### Workflow C — AI Agent

Chat-interface til markplanlægning med tre specialiserede tools.

**Flow**: Chat Trigger → AI Agent (Llama 3.1) + Simple Memory → [Tool: Vector Search | Tool: Graph Query | Tool: Season/Soil Filter] → Chat output

**Tools**:

**Neo4j Vector Search** — semantisk søgning på Wikipedia-chunks via cosine similarity (threshold 0.7). Bruges til åbne spørgsmål om dyrkningsforhold og plantebeskrivelser.

**Neo4j Graph Query** — henter companion planting relationer og sædskifte for en specifik plante. Input: engelsk plantenavn. Output: strukturerede relationer fra grafen.

**Neo4j Season Soil Filter** — dynamisk Cypher der filtrerer planter på sæson, jordbundstype og moisture. Understøtter dansk input (lerjord→clay, forår→spring etc.). Output: liste af passende planter.

---

## Opsætning

### Krav

- n8n (lokalt eller selvhosted)
- Neo4j Desktop
- Ollama med modellerne: `llama3.1`, `mistral`, `nomic-embed-text`

### Neo4j constraints

```cypher
CREATE CONSTRAINT plant_name IF NOT EXISTS FOR (p:Plant) REQUIRE p.name_en IS UNIQUE;
CREATE CONSTRAINT family_name IF NOT EXISTS FOR (f:Family) REQUIRE f.name IS UNIQUE;
CREATE CONSTRAINT soil_type IF NOT EXISTS FOR (s:SoilType) REQUIRE s.name IS UNIQUE;
CREATE CONSTRAINT nutrient_name IF NOT EXISTS FOR (n:Nutrient) REQUIRE n.name IS UNIQUE;
CREATE CONSTRAINT season_name IF NOT EXISTS FOR (s:Season) REQUIRE s.name IS UNIQUE;
CREATE CONSTRAINT moisture_name IF NOT EXISTS FOR (m:Moisture) REQUIRE m.name IS UNIQUE;
```

### Kørsel

1. Kør Workflow A del 1 (genererer `staging_plants.json`)
2. Kør Workflow A del 2 (skriver til Neo4j)
3. Kør Workflow B (genererer vector embeddings)
4. Start Workflow C (chat med agenten)

---

## Læringsmål dækning

Dette projekt dækker følgende læringsmål fra kurset:

- **Viden**: Viden om workflows og AI agenter, kendskab til sekventiel vs. parallel arkitektur, LLM-valg til forskellige opgaver
- **Færdigheder**: Oprette workflows til automatisering, prompt engineering, oprette og instruere AI agent, oprette og bruge RAGs og vector databaser i workflows
- **Kompetencer**: Vælge LLM til brug i automatisering, vurdere brug af forskellige elementer i et workflow, gennemføre projekt med workflow og opsætning af AI agenter

Projektet tæller som fire workflows til mundtlig eksamen (A del 1, A del 2, B, C).

---

## Eksamensperspektiv

Forbered svar på:

- Hvorfor Neo4j til både graf og vector?
- Hvorfor MERGE og ikke CREATE i Workflow A del 2?
- Hvad er chunk-størrelse og overlap, og hvorfor de valgte værdier?
- Hvordan understøtter systemet dansk søgning med engelske kildedata?
- Hvad er forskellen på vector search og graph query, og hvornår bruges hvilken?
- Hvorfor human-in-the-loop på staging JSON inden Neo4j-skrivning?
- Hvorfor RHS som kilde til soil og moisture frem for LLM-generering?

---

## V2 idéer

- `Pest`-node med `REPELS` og `ATTRACTS_BENEFICIALS`-relationer
- Edible-filter i Season/Soil tool — kun vis spiselige planter
- USDA CSV-download til soil preferences (ingen API tilgængelig)
- ØKO-Portalen som dansk tekstkilde til vector-embeddings
- Offline-first app med synkronisering mod selvhosted backend
