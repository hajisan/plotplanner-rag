import "dotenv/config";
import { randomUUID } from "crypto";
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const server = new McpServer({
  name: "plotplanner",
  version: "1.0.0",
});

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
