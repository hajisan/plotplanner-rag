import "dotenv/config";
import { randomUUID } from "crypto";
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
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

const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => randomUUID(),
});

await server.connect(transport);

const app = express();
app.use(express.json());

app.all("/mcp", async (req, res) => {
  // Hermes sender ikke Accept: text/event-stream — tilføj det så StreamableHTTP-transporten accepterer kaldet
  if (!req.headers.accept?.includes("text/event-stream")) {
    req.headers.accept = "application/json, text/event-stream";
  }
  await transport.handleRequest(req, res, req.body);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`PlotPlanner MCP server kører på port ${PORT}`);
});
