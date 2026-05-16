# Roadmap — PlotPlanner Eksamensprojekt

**Deadline**: 26. maj 2026  
**Eksamen**: 4., 8. eller 10. juni 2026

---

## Obligatoriske tekniske krav

- [x] Neo4j vector RAG
- [x] Neo4j graph RAG
- [x] n8n workflows (A1, A2, B, C)
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
- [ ] Skriv `hermes/skills/markplan.md` — 5-trins ræsonnerings-sekvens *(eksaminationskrav)*
- [ ] Test systemet med reelle spørgsmål om companion planting
- [ ] Test `markplan`-skill end-to-end: sæson + jord → struktureret anbefaling
- [ ] Arkitekturdiagram færdigt
- [ ] System kører stabilt end-to-end
- [ ] Rapport — side 1: platform, arkitektur og modelreflection (inkl. Hermes vs. NanoClaw)
- [ ] Rapport — side 2-3: implementering (inkl. system_prompt + markplan skill med forklaring)
- [ ] Rapport — side 4: brug af agenten i casen
- [ ] Rapport — side 5: reflection, sikkerhed og fremtidigt arbejde

---

## Deadline — 24.–26. maj

Finpuds og aflever.

- [ ] Rapport korrekturlæst og max 5 sider
- [ ] CLAUDE.md opdateret og korrekt
- [ ] Repo ryddet op — ingen credentials, README korrekt
- [ ] System testet fra bunden (clean boot)
- [ ] Afleveret

---

## Eksamen — 4., 8. eller 10. juni

- [ ] Systemet kører lokalt på eksamensdagen
- [ ] Kan forklare valg af Hermes frem for NanoClaw
- [ ] Kan forklare hvad MCP løser i arkitekturen
- [ ] Kan forklare forskellen på vector og graph RAG
- [ ] Kan forklare chunking-strategi (500 tegn, 50 overlap)
- [ ] Kan demonstrere alle workflows kørende
