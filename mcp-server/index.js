import "dotenv/config";
import { randomUUID } from "crypto";
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { vectorSearch, vectorSearchSchema } from "./tools/vector_search.js";
import { graphQuery, graphQuerySchema } from "./tools/graph_query.js";

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

const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => randomUUID(),
});

await server.connect(transport);

const app = express();
app.use(express.json());

app.all("/mcp", async (req, res) => {
  await transport.handleRequest(req, res, req.body);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`PlotPlanner MCP server kører på port ${PORT}`);
});
