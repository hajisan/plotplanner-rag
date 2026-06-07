// MCP-serverens indgang — registrerer tools og eksponerer dem over HTTP
import "dotenv/config";
import { randomUUID } from "crypto";
import express from "express";
import cors from "cors";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { vectorSearch, vectorSearchSchema } from "./tools/vector_search.js";
import { graphQuery, graphQuerySchema } from "./tools/graph_query.js";
import { seasonSoilFilter, seasonSoilFilterSchema } from "./tools/season_soil_filter.js";

// Kaldes én gang per ny forbindelse — ikke globalt — så klienter ikke deler tilstand.
// Tool-beskrivelserne herinde bruges aktivt af LLM'en til at beslutte hvilket tool den kalder.
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

// Holder styr på aktive Streamable HTTP-sessioner — én entry per forbundet klient
const sessions = new Map();

const app = express();
app.use(cors());
app.use(express.json());

// Streamable HTTP-transport — nyeste MCP-protokol, brugt af moderne klienter.
// Første kald uden session-ID opretter en ny session; efterfølgende kald medsender ID'et
// så serveren kan finde den rigtige forbindelse i sessions-Map'en.
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


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`PlotPlanner MCP server kører på port ${PORT}`);
}).on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} er allerede i brug — er serveren allerede startet?`);
  } else {
    console.error("Serverfejl:", err.message);
  }
  process.exit(1);
});
