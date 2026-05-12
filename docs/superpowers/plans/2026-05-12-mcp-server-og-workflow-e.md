# MCP Server + n8n Workflow E — Implementeringsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Byg MCP server med tre tools og n8n Workflow E (season_soil_filter webhook), så Hermes kan kalde dem som tools.

**Architecture:** MCP server i Node.js på port 3000 med SSE transport. `vector_search` og `graph_query` kalder Neo4j direkte via neo4j-driver. `season_soil_filter` kalder n8n Workflow E via HTTP webhook. Workflow E håndterer dansk input-mapping og returnerer matchende planter fra Neo4j's HTTP API.

**Tech Stack:** Node.js 18+, @modelcontextprotocol/sdk, neo4j-driver, express, zod, n8n

**Forudsætninger:** Neo4j Desktop kører lokalt med PlotPlanner-data indlæst (Workflow A+B kørt). Ollama kører med `llama3.1` og `nomic-embed-text` tilgængelige. n8n kører lokalt.

---

## Filstruktur

```
mcp-server/
├── package.json
├── .env.example
├── index.js                    # Server bootstrap, tool-registrering, SSE transport
├── tools/
│   ├── vector_search.js        # Embed query → Neo4j cosine similarity
│   ├── graph_query.js          # Neo4j relations-query for én plante
│   └── season_soil_filter.js   # HTTP POST til n8n Workflow E webhook
└── lib/
    ├── neo4j.js                # Neo4j driver singleton
    └── ollama.js               # Embedding via Ollama HTTP API
```

---

## Task 1: Project scaffold

**Files:**
- Create: `mcp-server/package.json`
- Create: `mcp-server/.env.example`
- Create: `mcp-server/index.js`

- [ ] **Opret mappestruktur**

```bash
mkdir -p mcp-server/tools mcp-server/lib
```

- [ ] **Skriv package.json**

```json
{
  "name": "plotplanner-mcp-server",
  "version": "1.0.0",
  "type": "module",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "node --watch index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "express": "^4.18.0",
    "neo4j-driver": "^5.0.0",
    "zod": "^3.22.0",
    "dotenv": "^16.0.0"
  }
}
```

- [ ] **Installer dependencies**

```bash
cd mcp-server && npm install
```

Forventet output: `added N packages` uden fejl.

- [ ] **Skriv .env.example**

```
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_password
OLLAMA_URL=http://localhost:11434
N8N_WEBHOOK_URL=http://localhost:5678/webhook/season-soil-filter
```

- [ ] **Kopiér til .env og udfyld med rigtige værdier**

```bash
cp mcp-server/.env.example mcp-server/.env
# Udfyld NEO4J_PASSWORD med din Neo4j Desktop-adgangskode
```

- [ ] **Skriv index.js — tom server der starter og lytter**

```js
import "dotenv/config";
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

const server = new McpServer({
  name: "plotplanner",
  version: "1.0.0",
});

const app = express();
app.use(express.json());

// Én transport-instans pr. SSE-forbindelse — gemt så /messages kan bruge den
let activeTransport = null;

app.get("/sse", async (req, res) => {
  const transport = new SSEServerTransport("/messages", res);
  activeTransport = transport;
  await server.connect(transport);
});

app.post("/messages", async (req, res) => {
  if (!activeTransport) {
    res.status(400).json({ error: "Ingen aktiv SSE-forbindelse" });
    return;
  }
  await activeTransport.handlePostMessage(req, res);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`PlotPlanner MCP server kører på port ${PORT}`);
});
```

- [ ] **Verificér serveren starter**

```bash
cd mcp-server && npm start
```

Forventet output: `PlotPlanner MCP server kører på port 3000`  
Stop med Ctrl+C.

- [ ] **Tilføj .env til .gitignore**

```bash
echo "mcp-server/.env" >> .gitignore
echo "mcp-server/node_modules/" >> .gitignore
```

- [ ] **Commit**

```bash
git add mcp-server/ .gitignore
git commit -m "feat: MCP server scaffold med tom server og SSE transport"
```

---

## Task 2: Neo4j connection helper

**Files:**
- Create: `mcp-server/lib/neo4j.js`

- [ ] **Skriv lib/neo4j.js**

```js
import neo4j from "neo4j-driver";

const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
);

export async function runQuery(cypher, params = {}) {
  const session = driver.session({ database: "neo4j" });
  try {
    const result = await session.run(cypher, params);
    return result.records.map((r) => r.toObject());
  } finally {
    await session.close();
  }
}

export default driver;
```

- [ ] **Verificér forbindelsen mod Neo4j**

Opret en midlertidig testfil:

```bash
cat > mcp-server/test-neo4j.js << 'EOF'
import "dotenv/config";
import { runQuery } from "./lib/neo4j.js";

const result = await runQuery("MATCH (p:Plant) RETURN p.name_en LIMIT 3");
console.log("Neo4j forbundet. Eksempelplanter:", result);
process.exit(0);
EOF
node mcp-server/test-neo4j.js
```

Forventet output: tre plantenavne fra databasen, f.eks. `[ { 'p.name_en': 'Tomato' }, ... ]`  
Slet testfilen bagefter: `rm mcp-server/test-neo4j.js`

- [ ] **Commit**

```bash
git add mcp-server/lib/neo4j.js
git commit -m "feat: Neo4j driver singleton med runQuery helper"
```

---

## Task 3: Ollama embedding helper

**Files:**
- Create: `mcp-server/lib/ollama.js`

- [ ] **Skriv lib/ollama.js**

```js
export async function embed(text) {
  const response = await fetch(`${process.env.OLLAMA_URL}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "nomic-embed-text", prompt: text }),
  });

  if (!response.ok) {
    throw new Error(`Ollama embedding fejlede: ${response.status}`);
  }

  const data = await response.json();
  return data.embedding; // float[] med 768 dimensioner
}
```

- [ ] **Verificér embedding mod Ollama**

```bash
cat > mcp-server/test-ollama.js << 'EOF'
import "dotenv/config";
import { embed } from "./lib/ollama.js";

const vec = await embed("tomat companion plants");
console.log(`Embedding OK. Dimensioner: ${vec.length}`);
process.exit(0);
EOF
node mcp-server/test-ollama.js
```

Forventet output: `Embedding OK. Dimensioner: 768`  
Slet testfilen: `rm mcp-server/test-ollama.js`

- [ ] **Commit**

```bash
git add mcp-server/lib/ollama.js
git commit -m "feat: Ollama embedding helper til nomic-embed-text"
```

---

## Task 4: vector_search tool

**Files:**
- Create: `mcp-server/tools/vector_search.js`
- Modify: `mcp-server/index.js`

Forudsætning: Neo4j skal have et vector-indeks på `Chunk.embedding`. Kør dette i Neo4j Browser hvis det ikke allerede eksisterer:

```cypher
CREATE VECTOR INDEX plant_chunks IF NOT EXISTS
FOR (c:Chunk) ON (c.embedding)
OPTIONS { indexConfig: { `vector.dimensions`: 768, `vector.similarity_function`: 'cosine' } }
```

- [ ] **Skriv tools/vector_search.js**

```js
import { z } from "zod";
import { embed } from "../lib/ollama.js";
import { runQuery } from "../lib/neo4j.js";

export const vectorSearchSchema = {
  query: z.string().describe("Søgetekst på dansk eller engelsk"),
  limit: z.number().int().min(1).max(10).default(5).optional(),
};

export async function vectorSearch({ query, limit = 5 }) {
  const embedding = await embed(query);

  const cypher = `
    CALL db.index.vector.queryNodes('plant_chunks', $limit, $embedding)
    YIELD node AS chunk, score
    WHERE score >= 0.7
    MATCH (p:Plant)-[:HAS_CHUNK]->(chunk)
    RETURN chunk.text AS text,
           p.name_en AS plant_en,
           p.name_da AS plant_da,
           score
    ORDER BY score DESC
  `;

  const records = await runQuery(cypher, {
    embedding,
    limit: limit,
  });

  if (records.length === 0) {
    return "Ingen resultater fundet over tærskel 0.7. Prøv en anden søgetekst.";
  }

  return records
    .map(
      (r) =>
        `**${r.plant_en} (${r.plant_da})** [score: ${Number(r.score).toFixed(2)}]\n${r.text}`
    )
    .join("\n\n---\n\n");
}
```

- [ ] **Registrér tool i index.js**

Tilføj efter `const server = new McpServer(...)`:

```js
import { vectorSearch, vectorSearchSchema } from "./tools/vector_search.js";
import { z } from "zod";

server.tool(
  "vector_search",
  "Semantisk søgning i plantedata. Brug til åbne spørgsmål om dyrkningsforhold, egenskaber og teknikker.",
  vectorSearchSchema,
  async (args) => ({
    content: [{ type: "text", text: await vectorSearch(args) }],
  })
);
```

- [ ] **Verificér tool manuelt**

```bash
cat > mcp-server/test-vector.js << 'EOF'
import "dotenv/config";
import { vectorSearch } from "./tools/vector_search.js";

const result = await vectorSearch({ query: "tomat dyrkningsforhold" });
console.log(result);
process.exit(0);
EOF
node mcp-server/test-vector.js
```

Forventet output: 1-5 tekst-chunks om tomat med score over 0.7.  
Slet testfilen: `rm mcp-server/test-vector.js`

- [ ] **Commit**

```bash
git add mcp-server/tools/vector_search.js mcp-server/index.js
git commit -m "feat: vector_search MCP tool med Ollama embedding og Neo4j cosine similarity"
```

---

## Task 5: graph_query tool

**Files:**
- Create: `mcp-server/tools/graph_query.js`
- Modify: `mcp-server/index.js`

- [ ] **Skriv tools/graph_query.js**

```js
import { z } from "zod";
import { runQuery } from "../lib/neo4j.js";

export const graphQuerySchema = {
  plant_name: z
    .string()
    .describe("Plantenavn på engelsk eller dansk, f.eks. 'Tomato' eller 'Tomat'"),
};

export async function graphQuery({ plant_name }) {
  const cypher = `
    MATCH (p:Plant)
    WHERE toLower(p.name_en) = toLower($name)
       OR toLower(p.name_da) = toLower($name)
    OPTIONAL MATCH (p)-[:GROWS_WELL_WITH]->(companion:Plant)
    OPTIONAL MATCH (p)-[:ANTAGONIZES]->(antagonist:Plant)
    OPTIONAL MATCH (p)-[:FOLLOWS_WELL_AFTER]->(follows:Plant)
    OPTIONAL MATCH (p)-[:AVOID_AFTER]->(avoid:Plant)
    OPTIONAL MATCH (predecessor:Plant)-[:FOLLOWS_WELL_AFTER]->(p)
    RETURN p.name_en AS name_en,
           p.name_da AS name_da,
           p.type AS type,
           collect(DISTINCT companion.name_en) AS grows_well_with,
           collect(DISTINCT antagonist.name_en) AS antagonizes,
           collect(DISTINCT follows.name_en) AS follows_well_after,
           collect(DISTINCT avoid.name_en) AS avoid_after,
           collect(DISTINCT predecessor.name_en) AS good_predecessor_for
  `;

  const records = await runQuery(cypher, { name: plant_name });

  if (records.length === 0) {
    return `Planten "${plant_name}" blev ikke fundet i databasen. Prøv det engelske navn.`;
  }

  const r = records[0];
  const lines = [
    `**${r.name_en} (${r.name_da})** — ${r.type}`,
    "",
    `**Trives godt med:** ${r.grows_well_with.length ? r.grows_well_with.join(", ") : "ingen data"}`,
    `**Hæmmer:** ${r.antagonizes.length ? r.antagonizes.join(", ") : "ingen data"}`,
    `**Følger godt efter:** ${r.follows_well_after.length ? r.follows_well_after.join(", ") : "ingen data"}`,
    `**Undgå efter:** ${r.avoid_after.length ? r.avoid_after.join(", ") : "ingen data"}`,
    `**God forgænger for:** ${r.good_predecessor_for.length ? r.good_predecessor_for.join(", ") : "ingen data"}`,
  ];

  return lines.join("\n");
}
```

- [ ] **Registrér tool i index.js**

Tilføj efter vector_search-registreringen:

```js
import { graphQuery, graphQuerySchema } from "./tools/graph_query.js";

server.tool(
  "graph_query",
  "Henter companion planting-relationer og sædskifte for én specifik plante fra grafdatabasen.",
  graphQuerySchema,
  async (args) => ({
    content: [{ type: "text", text: await graphQuery(args) }],
  })
);
```

- [ ] **Verificér tool manuelt**

```bash
cat > mcp-server/test-graph.js << 'EOF'
import "dotenv/config";
import { graphQuery } from "./tools/graph_query.js";

const result = await graphQuery({ plant_name: "Tomato" });
console.log(result);
process.exit(0);
EOF
node mcp-server/test-graph.js
```

Forventet output: Tomat med companions, antagonister og sædskifte-data.  
Slet testfilen: `rm mcp-server/test-graph.js`

- [ ] **Commit**

```bash
git add mcp-server/tools/graph_query.js mcp-server/index.js
git commit -m "feat: graph_query MCP tool med Neo4j relations-query"
```

---

## Task 6: n8n Workflow E — Season/Soil Filter webhook

Dette task foregår i n8n GUI. Resultatet eksporteres som JSON til `workflows/`.

- [ ] **Åbn n8n og opret nyt workflow navngivet "Workflow E — Season/Soil Filter"**

- [ ] **Tilføj Webhook-node (trigger)**

Konfiguration:
- HTTP Method: `POST`
- Path: `season-soil-filter`
- Response Mode: `Using 'Respond to Webhook' Node`

Notér webhook-URL — den bruges i `.env` som `N8N_WEBHOOK_URL`. Den ser typisk sådan ud: `http://localhost:5678/webhook/season-soil-filter`

- [ ] **Tilføj Code-node: "Map input til Neo4j-værdier"**

Type: JavaScript. Kode:

```js
const mapping = {
  season: {
    'forår': 'spring', 'spring': 'spring',
    'sommer': 'summer', 'summer': 'summer',
    'efterår': 'fall', 'fall': 'fall', 'autumn': 'fall',
    'vinter': 'winter', 'winter': 'winter',
  },
  soil_type: {
    'sand': 'sandy', 'sandet': 'sandy', 'sandy': 'sandy',
    'ler': 'clay', 'lerjord': 'clay', 'clay': 'clay',
    'muld': 'loamy', 'muldjord': 'loamy', 'loamy': 'loamy',
    'kalk': 'chalky', 'kalkjord': 'chalky', 'chalky': 'chalky',
    'tørv': 'peaty', 'tørvejord': 'peaty', 'peaty': 'peaty',
    'silt': 'silty', 'siltjord': 'silty', 'silty': 'silty',
  },
  moisture: {
    'veldrænet': 'well-drained', 'well-drained': 'well-drained',
    'fugtig': 'moist but well-drained', 'moist but well-drained': 'moist but well-drained',
    'våd': 'poorly drained', 'poorly drained': 'poorly drained',
  },
};

const body = $input.first().json.body;

const season = mapping.season[(body.season || '').toLowerCase()] ?? '';
const soil_type = mapping.soil_type[(body.soil_type || '').toLowerCase()] ?? '';
const moisture = mapping.moisture[(body.moisture || '').toLowerCase()] ?? '';

return [{ json: { season, soil_type, moisture } }];
```

- [ ] **Tilføj HTTP Request-node: "Query Neo4j"**

Konfiguration:
- Method: `POST`
- URL: `http://localhost:7474/db/neo4j/tx/commit`
- Authentication: Basic Auth (Neo4j brugernavn + adgangskode)
- Content Type: `JSON`
- Body:

```json
{
  "statements": [
    {
      "statement": "MATCH (p:Plant) WHERE ($season = '' OR (p)-[:GROWS_IN]->(:Season {name: $season})) AND ($soil_type = '' OR (p)-[:PREFERS_SOIL]->(:SoilType {name: $soil_type})) AND ($moisture = '' OR (p)-[:PREFERS_MOISTURE]->(:Moisture {name: $moisture})) RETURN p.name_en AS name_en, p.name_da AS name_da, p.type AS type, p.edible AS edible ORDER BY p.name_en",
      "parameters": {
        "season": "={{ $json.season }}",
        "soil_type": "={{ $json.soil_type }}",
        "moisture": "={{ $json.moisture }}"
      }
    }
  ]
}
```

- [ ] **Tilføj Code-node: "Formater svar"**

```js
const data = $input.first().json;
const rows = data.results?.[0]?.data ?? [];

if (rows.length === 0) {
  return [{ json: { plants: [], message: "Ingen planter matcher de givne betingelser." } }];
}

const plants = rows.map(row => ({
  name_en: row.row[0],
  name_da: row.row[1],
  type: row.row[2],
  edible: row.row[3],
}));

return [{ json: { plants, count: plants.length } }];
```

- [ ] **Tilføj Respond to Webhook-node**

Konfiguration:
- Respond With: `First Incoming Item's Data`

- [ ] **Aktiver workflow og test med curl**

```bash
curl -X POST http://localhost:5678/webhook/season-soil-filter \
  -H "Content-Type: application/json" \
  -d '{"season": "forår", "soil_type": "lerjord"}'
```

Forventet output: JSON med liste af planter der trives om foråret i lerjord.

Test med dansk input der mapper direkte:

```bash
curl -X POST http://localhost:5678/webhook/season-soil-filter \
  -H "Content-Type: application/json" \
  -d '{"season": "spring", "soil_type": "clay"}'
```

Forventet output: Samme plantelist som ovenfor.

Test med tomt input (ingen filter):

```bash
curl -X POST http://localhost:5678/webhook/season-soil-filter \
  -H "Content-Type: application/json" \
  -d '{}'
```

Forventet output: Alle 104 planter.

- [ ] **Eksportér workflow fra n8n og gem i repo**

I n8n: Settings → Download → gem som `workflows/workflow-e-season-soil-filter.json`

```bash
git add workflows/workflow-e-season-soil-filter.json
git commit -m "feat: n8n Workflow E — Season/Soil Filter webhook med dansk input-mapping"
```

---

## Task 7: season_soil_filter MCP tool

**Files:**
- Create: `mcp-server/tools/season_soil_filter.js`
- Modify: `mcp-server/index.js`

- [ ] **Opdatér .env med webhook-URL fra Workflow E**

```
N8N_WEBHOOK_URL=http://localhost:5678/webhook/season-soil-filter
```

- [ ] **Skriv tools/season_soil_filter.js**

```js
import { z } from "zod";

export const seasonSoilFilterSchema = {
  season: z
    .string()
    .optional()
    .describe("Sæson på dansk eller engelsk: forår/spring, sommer/summer, efterår/fall, vinter/winter"),
  soil_type: z
    .string()
    .optional()
    .describe("Jordbundstype på dansk eller engelsk: lerjord/clay, sandjord/sandy, muldjord/loamy, kalkjord/chalky, tørvejord/peaty, siltjord/silty"),
  moisture: z
    .string()
    .optional()
    .describe("Fugtpræference: veldrænet/well-drained, fugtig/moist but well-drained, våd/poorly drained"),
};

export async function seasonSoilFilter({ season = "", soil_type = "", moisture = "" }) {
  const response = await fetch(process.env.N8N_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ season, soil_type, moisture }),
  });

  if (!response.ok) {
    throw new Error(`n8n webhook fejlede: ${response.status}`);
  }

  const data = await response.json();

  if (!data.plants || data.plants.length === 0) {
    return data.message ?? "Ingen planter matcher de givne betingelser.";
  }

  const lines = [
    `**${data.count} planter matcher betingelserne:**`,
    "",
    ...data.plants.map(
      (p) => `- ${p.name_en} (${p.name_da}) — ${p.type}${p.edible ? ", spiselig" : ""}`
    ),
  ];

  return lines.join("\n");
}
```

- [ ] **Registrér tool i index.js**

```js
import { seasonSoilFilter, seasonSoilFilterSchema } from "./tools/season_soil_filter.js";

server.tool(
  "season_soil_filter",
  "Filtrerer planter på sæson, jordbundstype og fugtpræference. Understøtter dansk input.",
  seasonSoilFilterSchema,
  async (args) => ({
    content: [{ type: "text", text: await seasonSoilFilter(args) }],
  })
);
```

- [ ] **Verificér tool end-to-end (MCP → n8n → Neo4j)**

```bash
cat > mcp-server/test-filter.js << 'EOF'
import "dotenv/config";
import { seasonSoilFilter } from "./tools/season_soil_filter.js";

const result = await seasonSoilFilter({ season: "forår", soil_type: "lerjord" });
console.log(result);
process.exit(0);
EOF
node mcp-server/test-filter.js
```

Forventet output: Liste af planter der matcher forår + lerjord.  
Slet testfilen: `rm mcp-server/test-filter.js`

- [ ] **Commit**

```bash
git add mcp-server/tools/season_soil_filter.js mcp-server/index.js mcp-server/.env.example
git commit -m "feat: season_soil_filter MCP tool der kalder n8n Workflow E webhook"
```

---

## Task 8: Smoke test — alle tre tools via kørende server

- [ ] **Start MCP serveren**

```bash
cd mcp-server && npm start
```

- [ ] **Test at serveren svarer på SSE-endpoint**

```bash
curl -N http://localhost:3000/sse
```

Forventet output: SSE-stream åbnes (du ser headers og forbindelsen holdes åben). Stop med Ctrl+C.

- [ ] **Notér at tool-tests allerede er verificeret i Tasks 4, 5 og 7**

Alle tre tools er testet direkte. MCP-serveren er klar til at Hermes forbindes.

- [ ] **Commit — final state**

```bash
git add mcp-server/
git commit -m "feat: MCP server komplet med vector_search, graph_query og season_soil_filter"
```

---

## Næste plan

Når MCP serveren er verificeret: **installer Hermes** og undersøg dens API (endpoint-format og autentificering). Det informerer Plan B:

- `docs/superpowers/plans/YYYY-MM-DD-hermes-og-workflow-d.md`
  - Hermes konfiguration (`config.yaml`, `system_prompt.md`, `skills/markplan.md`)
  - n8n Workflow D (Telegram Bridge → Hermes API)
  - End-to-end test: Telegram → Workflow D → Hermes → MCP → Neo4j
