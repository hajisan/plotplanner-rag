# Roadmap — PlotPlanner Eksamensprojekt

**Deadline**: 26. maj 2026  
**Eksamen**: 4., 8. eller 10. juni 2026

---

## Obligatoriske tekniske krav

- [x] Neo4j vector RAG
- [x] Neo4j graph RAG
- [x] n8n workflows (A1, A2, B, E)
- [x] MCP server opsat og kørende
- [x] MCP eksponerer mindst ét RAG-endpoint som tool
- [x] Hermes Agent forbundet til MCP server
- [x] Telegram-interface virker end-to-end

---

## Uge 20 — 12.–18. maj

Installer og forbind systemet.

- [x] Installer Hermes Agent lokalt
- [x] Afklar Hermes' API-interface (endpoint og request-format)
- [x] Hermes forbundet til gemini-2.5-flash via Google AI Studio
- [x] MCP server bygget (`vector_search`, `graph_query` → Neo4j direkte)
- [x] MCP tool `season_soil_filter` → kalder n8n Workflow E webhook
- [x] Telegram-interface konfigureret via Hermes built-in gateway (launchd service) — Workflow D ikke nødvendigt
- [x] n8n Workflow E bygget — Season/Soil Filter webhook (dansk input-mapping → Neo4j Cypher)
- [x] Hermes kalder MCP tools korrekt
- [x] Telegram virker end-to-end via Hermes Gateway → Hermes Agent → MCP

---

## Uge 21 — 19.–23. maj

Justér, test og skriv rapport.

- [x] Skriv `hermes/system_prompt.md` + `AGENTS.md` — rolle, tool-strategi, sprog, tone *(eksaminationskrav)*
- [x] Skriv `hermes/skills/markplan.md` — 5-trins ræsonnerings-sekvens *(eksaminationskrav)*
- [x] Test systemet med reelle spørgsmål om companion planting
- [x] Test `markplan`-skill end-to-end: sæson + jord → struktureret anbefaling
- [x] Arkitekturdiagram færdigt
- [x] System kører stabilt end-to-end
- [ ] Rapport — side 1: platform, arkitektur og modelreflection (inkl. Hermes vs. NanoClaw)
- [ ] Rapport — side 2-3: implementering (inkl. system_prompt + markplan skill med forklaring)
- [ ] Rapport — side 4: brug af agenten i casen
- [ ] Rapport — side 5: reflection, sikkerhed og fremtidigt arbejde

---

## Uge 21 — tekniske justeringer (efter rapport-deadline)

- [x] Live arkitektur-dashboard (`dashboard/`) — service-status, event feed, Neo4j stats
- [x] `start.sh` — starter n8n, MCP, dashboard, Hermes; åbner Telegram og browser
- [x] `plotplannerstart` / `plotplannerstop` aliases i .zshrc
- [x] Hermes launchd WorkingDirectory rettet → project dir (AGENTS.md loades nu korrekt)
- [x] Hermes sessions ryddet → frisk session med korrekt system prompt
- [x] Gemini billing aktiveret (cap 50 kr) — fri tier holdt ikke til demo
- [x] `season_soil_filter` begrænset til top 10 spiselige planter — forhindrer at agenten viser lang liste
- [x] AGENTS.md markplan-sekvens strammet — forbyder kommunikation før trin 5
- [x] `docs/eksamen-noter.md` oprettet med demo-spørgsmål og refleksioner
- [x] Tool-routing repareret — dyrkning via `graph_query(context="cultivation")`, ikke vector_search
- [x] NEXT STEP-instruktioner i tool-resultater ("do not respond yet") erstatter AGENTS.md multi-trin-logik
- [x] Tool-beskrivelser i `mcp-server/index.js` opdateret til at guide LLM-tool-valg direkte
- [x] `graph_query` NEXT STEP specificerer at begge datakilder (graph + vector) bruges i svar

---

## Deadline — 24.–26. maj

Finpuds og aflever.

- [ ] Rapport korrekturlæst og max 5 sider
- [x] CLAUDE.md opdateret og korrekt
- [x] Repo ryddet op — ingen credentials, README korrekt
- [x] System testet fra bunden (clean boot)
- [ ] Afleveret

---

## Eksamen — 4., 8. eller 10. juni

- [ ] Systemet kører lokalt på eksamensdagen
- [ ] Kan forklare valg af Hermes frem for NanoClaw
- [ ] Kan forklare hvad MCP løser i arkitekturen
- [ ] Kan forklare forskellen på vector og graph RAG
- [ ] Kan forklare chunking-strategi (500 tegn, 50 overlap)
- [ ] Kan demonstrere alle workflows kørende
