# Todo — oprydning før eksamen

## mcp-server/index.js
- [ ] Slet `/sse` endpoint og tilhørende `sseTransports` Map — Hermes bruger `/mcp` (Streamable HTTP), ikke SSE

## mcp-server/stdio.js
- [ ] Slet filen — bruges ikke af Hermes, kun relevant for klienter som Claude Desktop

## mcp-server/package.json
- [ ] Tilføj `cors` som eksplicit dependency — pakken bruges i index.js men mangler i package.json

## hermes/config.yaml
- [ ] Fjern `database:` sektionen — Hermes taler ikke direkte med Neo4j, al databaseadgang går via MCP-serveren. Sektionen er misvisende dokumentation.

## mcp-server/lib/neo4j.js
- [ ] Tilføj opstartcheck på Neo4j-forbindelsen — driveren er lazy og fejler først når et tool kaldes, ikke ved serverstart
