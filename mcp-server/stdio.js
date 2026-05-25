import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { vectorSearch, vectorSearchSchema } from "./tools/vector_search.js";
import { graphQuery, graphQuerySchema } from "./tools/graph_query.js";
import { seasonSoilFilter, seasonSoilFilterSchema } from "./tools/season_soil_filter.js";

const server = new McpServer({ name: "plotplanner", version: "1.0.0" });

server.tool("vector_search",
  "Semantisk søgning i plantedata. Brug til åbne spørgsmål om dyrkningsforhold, egenskaber og teknikker.",
  vectorSearchSchema,
  async (args) => ({ content: [{ type: "text", text: await vectorSearch(args) }] })
);
server.tool("graph_query",
  "Henter companion planting-relationer og sædskifte for én specifik plante fra grafdatabasen.",
  graphQuerySchema,
  async (args) => ({ content: [{ type: "text", text: await graphQuery(args) }] })
);
server.tool("season_soil_filter",
  "Filtrerer planter på sæson, jordbundstype og fugtighed. Understøtter dansk og engelsk input. Returnerer liste af egnede planter.",
  seasonSoilFilterSchema,
  async (args) => ({ content: [{ type: "text", text: await seasonSoilFilter(args) }] })
);

const transport = new StdioServerTransport();
await server.connect(transport);
