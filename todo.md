# Todo — oprydning før eksamen

## mcp-server/index.js
- [ ] Slet `/sse` endpoint og tilhørende `sseTransports` Map — Hermes bruger `/mcp` (Streamable HTTP), ikke SSE

## mcp-server/stdio.js
- [ ] Slet filen — bruges ikke af Hermes, kun relevant for klienter som Claude Desktop

## mcp-server/package.json
- [ ] Tilføj `cors` som eksplicit dependency — pakken bruges i index.js men mangler i package.json

## hermes/config.yaml
- [ ] Fjern `database:` sektionen — Hermes taler ikke direkte med Neo4j, al databaseadgang går via MCP-serveren. Sektionen er misvisende dokumentation.

## hermes/skills/markplan.md vs mcp-server/tools/season_soil_filter.js
- [ ] Afklar om markplan-skillen skal aktiveres eller om NEXT STEP i season_soil_filter.js er tilstrækkelig

**Baggrund:** `markplan.md` indlæses ikke af Hermes (`external_dirs: []` i ~/.hermes/config.yaml). Flowet drives i praksis af NEXT STEP-direktiverne i `season_soil_filter.js`.

**Forskelle:**
- `markplan.md` har et afklaringstrin (spørger brugeren hvis sæson/jord mangler) — `season_soil_filter.js` springer det over
- `markplan.md` vælger 3-5 kandidater — `season_soil_filter.js` er hardcodet til top 3
- `markplan.md` inkluderer eksplicit `vector_search` som trin 4 — `season_soil_filter.js` gør det ikke

**Muligheder:**
1. Tilføj `vector_search`-trin til NEXT STEP i `season_soil_filter.js` så det matcher `markplan.md`
2. Konfigurér Hermes til at indlæse skillen ved at tilføje `external_dirs` i `~/.hermes/config.yaml`
3. Slet `markplan.md` da NEXT STEP-mønsteret er mere pålideligt og allerede virker

## mcp-server/lib/neo4j.js
- [ ] Tilføj opstartcheck på Neo4j-forbindelsen — driveren er lazy og fejler først når et tool kaldes, ikke ved serverstart
