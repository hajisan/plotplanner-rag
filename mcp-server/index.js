import "dotenv/config";
import { randomUUID } from "crypto";
import express from "express";
import cors from "cors";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { vectorSearch, vectorSearchSchema } from "./tools/vector_search.js";
import { graphQuery, graphQuerySchema } from "./tools/graph_query.js";
import { seasonSoilFilter, seasonSoilFilterSchema } from "./tools/season_soil_filter.js";

function createServer() {
  const server = new McpServer({ name: "plotplanner", version: "1.0.0" });

  server.tool("vector_search",
    "Semantisk søgning i plantedata. Brug KUN til åbne spørgsmål UDEN navngivet plante, eller som næste skridt efter graph_query.",
    vectorSearchSchema,
    async (args) => ({ content: [{ type: "text", text: await vectorSearch(args) }] })
  );
  server.tool("graph_query",
    "PRIMÆRT VALG for companion og dyrkning. Kald dette tool FØRST når brugeren nævner en specifik plante — hvad trives godt med X, hvad hæmmer X, hvordan dyrker jeg X. Brug context='companion' eller context='cultivation'.",
    graphQuerySchema,
    async (args) => ({ content: [{ type: "text", text: await graphQuery(args) }] })
  );
  server.tool("season_soil_filter",
    "PRIMÆRT VALG for markplaner. Kald dette tool FØRST når brugeren nævner sæson og/eller jordbundstype.",
    seasonSoilFilterSchema,
    async (args) => ({ content: [{ type: "text", text: await seasonSoilFilter(args) }] })
  );

  return server;
}

const sessions = new Map();

const app = express();
app.use(cors());
app.use(express.json());

app.all("/mcp", async (req, res) => {
  if (!req.headers.accept?.includes("text/event-stream")) {
    req.headers.accept = "application/json, text/event-stream";
  }

  const sessionId = req.headers["mcp-session-id"];

  if (!sessionId) {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => sessions.set(id, transport),
    });
    transport.onclose = () => {
      for (const [id, t] of sessions) {
        if (t === transport) { sessions.delete(id); break; }
      }
    };
    const server = createServer();
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    return;
  }

  const transport = sessions.get(sessionId);
  if (!transport) {
    res.status(404).json({ error: "Session ikke fundet" });
    return;
  }
  await transport.handleRequest(req, res, req.body);
});

const sseTransports = new Map();

app.get("/sse", async (req, res) => {
  const transport = new SSEServerTransport("/messages", res);
  sseTransports.set(transport.sessionId, transport);
  transport.onclose = () => sseTransports.delete(transport.sessionId);
  const server = createServer();
  await server.connect(transport);
});

app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId;
  const transport = sseTransports.get(sessionId);
  if (!transport) {
    res.status(404).json({ error: "Session ikke fundet" });
    return;
  }
  await transport.handlePostMessage(req, res, req.body);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`PlotPlanner MCP server kører på port ${PORT}`);
});
