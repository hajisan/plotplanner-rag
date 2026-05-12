import "dotenv/config";
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { vectorSearch, vectorSearchSchema } from "./tools/vector_search.js";
import { graphQuery, graphQuerySchema } from "./tools/graph_query.js";
import { seasonSoilFilter, seasonSoilFilterSchema } from "./tools/season_soil_filter.js";

const server = new McpServer({
  name: "plotplanner",
  version: "1.0.0",
});

server.tool(
  "vector_search",
  "Semantisk søgning i plantedata. Brug til åbne spørgsmål om dyrkningsforhold, egenskaber og teknikker.",
  vectorSearchSchema,
  async (args) => ({ content: [{ type: "text", text: await vectorSearch(args) }] })
);

server.tool(
  "graph_query",
  "Henter companion planting-relationer og sædskifte for én specifik plante fra grafdatabasen.",
  graphQuerySchema,
  async (args) => ({ content: [{ type: "text", text: await graphQuery(args) }] })
);

server.tool(
  "season_soil_filter",
  "Filtrerer planter på sæson, jordbundstype og fugtighed. Understøtter dansk og engelsk input. Returnerer liste af egnede planter.",
  seasonSoilFilterSchema,
  async (args) => ({ content: [{ type: "text", text: await seasonSoilFilter(args) }] })
);

const app = express();
app.use(express.json());

const transports = {};

app.get("/sse", async (_req, res) => {
  const transport = new SSEServerTransport("/messages", res);
  transports[transport.sessionId] = transport;
  res.on("close", () => delete transports[transport.sessionId]);
  await server.connect(transport);
});

app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId;
  const transport = transports[sessionId];
  if (!transport) {
    res.status(400).json({ error: "Ukendt session" });
    return;
  }
  await transport.handlePostMessage(req, res);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`PlotPlanner MCP server kører på port ${PORT}`);
});
