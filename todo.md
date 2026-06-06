# Todo — oprydning før eksamen

## mcp-server/index.js
- [ ] Slet `/mcp` endpoint og tilhørende `sessions` Map (linje 34-69) — bruges ikke af Hermes, kun fremtidssikring

## mcp-server/stdio.js
- [ ] Slet filen — bruges ikke af Hermes, kun relevant for klienter som Claude Desktop

## mcp-server/package.json
- [ ] Tilføj `cors` som eksplicit dependency — pakken bruges i index.js men mangler i package.json

## mcp-server/lib/neo4j.js
- [ ] Tilføj opstartcheck på Neo4j-forbindelsen — driveren er lazy og fejler først når et tool kaldes, ikke ved serverstart
