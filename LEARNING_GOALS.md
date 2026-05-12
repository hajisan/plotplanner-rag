# Læringsmål og eksamensprojekt

**Kursus**: AI Agenter og Automatisering — KEA 4. semester  
**Underviser**: Lasse Vogelsang (lavo@ek.dk)  
**Kursusside**: https://vogelsang.github.io/AI-Agenter-F2026-public/

---

## Læringsmål

### Viden
- Ved hvad de forskellige LLMer er gode til
- Viden om workflows og AI agenter
- Kendskab til forskellige arkitekturer (sekventiel vs. parallel)

### Færdigheder
- Kan oprette workflows til automatisk udførsel af arbejds- og andre processer
- Bruge prompt engineering til at instruere agenter
- Oprette og instruere en AI Agent til at udføre en del af en arbejdsproces
- Kan teste og optimere workflows med AI agenter
- Oprette og bruge RAGs og vector databaser i workflows

### Kompetencer
- Vælge LLMer til brug i automatisering
- Kunne vurdere brug af forskellige elementer i et workflow
- Gennemføre projekt med workflow og opsætning af AI agenter

---

## Eksamensprojekt

### Formål
Design, byg og evaluer et AI agent-system for en selvvalgt case. Systemet skal være et fungerende prototype — ikke en sandbox eller toy demo. Det skal testes og vise at det virker i den valgte case.

**Projekttype**: Individuelt

### Tekniske krav
Alle fire skal bruges som meningsfulde dele af systemet:

- MCP
- n8n
- Neo4j til vector RAG
- Neo4j til graph RAG

### Funktionelle krav
Systemet skal:
- understøtte en klart defineret use case
- bruge Neo4j vector RAG til semantisk søgning i corpus
- bruge Neo4j graph RAG til at repræsentere og bruge relationer mellem koncepter
- eksponere mindst ét n8n workflow eller RAG via en MCP server som agenten kan kalde som tool
- understøtte brugerinteraktion via et fornuftigt interface (Telegram, Discord, email el. lign.)

### Valgt platform
Hermes Agent (Nous Research) — model-agnostisk, understøtter lokale Ollama-modeller

### Valgt case
Companion planting og markplanlægning til regenerativt landbrug og andelsgårde — bygger videre på PlotPlanner (2-ugers projekt, afleveret april 2026).

---

## Evalueringskriterier

Projektet vurderes på:

- Klarhed af use casen
- Kvalitet af kravstillingen
- Kvalitet af arkitekturen og begrundelse for modelvalg
- Kvalitet af det studenteroprettede prompt eller skill
- Meningsfuld brug af MCP
- Meningsfuld brug af n8n
- Meningsfuld brug af vector RAG
- Meningsfuld brug af graph RAG
- Kvalitet af det demonstrerede system til mundtlig eksamen
- Reflection over begrænsninger, sikkerhed og akademisk integritet
- Samlet kvalitet af prototype og rapport

---

## Rapport

Max 5 sider. Foreslået struktur:

- **Side 1** — valg af agent platform og arkitektur, herunder reflection over modelstørrelse, kapabiliteter og cost
- **Side 2–3** — implementering (inkl. mindst ét prompt eller skill lavet af dig selv med forklaring af designvalg)
- **Side 4** — brug af agenten i casen
- **Side 5** — reflection og fremtidigt arbejde

**Afleveringsfrist**: 26. maj 2026 (eget mål — eksamen starter 4. juni)

---

## Mundtlig eksamen

**Datoer**: 4., 8. og 10. juni 2026  
**Varighed**: Max 30 minutter (10 min præsentation, 10–15 min spørgsmål, 5 min karakter og feedback)

Til eksamen skal du præsentere og demonstrere systemet — vis casen, arkitekturen, implementeringen og hvordan systemet virker i praksis.

### Forbered svar på
- Hvorfor Hermes frem for NanoClaw — og hvad betyder model-agnostisk i praksis?
- Hvad er MCP, og hvad løser det i denne arkitektur?
- Hvorfor Neo4j til både vector og graph?
- Hvad er forskellen på vector search og graph query, og hvornår bruges hvilken?
- Hvad er chunk-størrelse og overlap, og hvorfor de valgte værdier?
- Hvordan understøtter systemet dansk søgning med engelske kildedata?
- Hvorfor MERGE og ikke CREATE i Workflow A del 2?
- Hvad er begrænsningerne i systemet, og hvad ville du gøre anderledes?
