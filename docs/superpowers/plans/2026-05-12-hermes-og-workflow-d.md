# Hermes Agent + n8n Workflow D — Implementeringsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Konfigurér Hermes Agent med custom system prompt og markplan-skill, og byg n8n Workflow D der router Telegram-beskeder til Hermes og sender svaret retur.

**Architecture:** Hermes kører lokalt og kalder Llama 3.1 via Ollama. MCP-serveren (port 3000) eksponerer tre tools som Hermes kan kalde. n8n Workflow D modtager Telegram-webhooks, POSTer til Hermes' HTTP API og returnerer svaret via Telegram Send Message-noden. Hermes' system_prompt instruerer agenten i tool-strategi og dansk kommunikation; markplan-skillen definerer en fast ræsonnerings-sekvens til markplanlægning.

**Tech Stack:** Hermes Agent (Nous Research), Ollama (llama3.1), n8n v2.14.2, Telegram Bot API

**Forudsætninger:** MCP server kører på port 3000 (Plan A er gennemført). Neo4j og Ollama kører. Telegram Bot token er oprettet via BotFather.

---

## Filstruktur

```
hermes/
├── config.yaml             # Hermes konfiguration — Ollama, MCP, paths
├── system_prompt.md        # Agentens rolle, tool-strategi, tone
└── skills/
    └── markplan.md         # Fast sekvens til markplanlægning

workflows/
└── workflow-d-telegram-bridge.json   # n8n Telegram → Hermes → Telegram
```

---

## Task 1: Hermes config.yaml

**Files:**
- Create: `hermes/config.yaml`
- Create: `hermes/system_prompt.md` (tom placeholder — udfyldes i Task 2)
- Create: `hermes/skills/markplan.md` (tom placeholder — udfyldes i Task 3)

- [ ] **Verificér at Hermes er installeret**

```bash
hermes --version
```

Forventet output: versionsnummer. Hvis kommandoen ikke findes, installér Hermes jf. Nous Research dokumentation inden du fortsætter.

- [ ] **Opret mappestruktur**

```bash
mkdir -p hermes/skills
```

- [ ] **Skriv hermes/config.yaml**

Tilpas paths og ports hvis din installation afviger:

```yaml
llm:
  provider: ollama
  model: llama3.1
  base_url: http://localhost:11434

mcp:
  servers:
    - name: plotplanner
      url: http://localhost:3000/mcp

system_prompt: hermes/system_prompt.md
skills_dir: hermes/skills/

database:
  url: bolt://localhost:7687
  user: neo4j
  password: "${NEO4J_PASSWORD}"
```

> **OBS:** Hermes' config-format varierer mellem versioner. Verificér mod `hermes --help` eller dokumentationen at felterne matcher din version. Ret feltnavne hvis nødvendigt.

- [ ] **Opret tomme placeholder-filer**

```bash
echo "# System Prompt" > hermes/system_prompt.md
echo "# Markplan Skill" > hermes/skills/markplan.md
```

- [ ] **Start Hermes og verificér at den forbinder til Ollama og MCP**

```bash
hermes
```

Forventet: Hermes starter, forbinder til llama3.1 og registrerer de tre MCP tools (`vector_search`, `graph_query`, `season_soil_filter`). Stop med Ctrl+C.

- [ ] **Commit**

```bash
git add hermes/
git commit -m "feat(hermes): tilføj config.yaml og placeholder-filer"
```

---

## Task 2: system_prompt.md

**Files:**
- Modify: `hermes/system_prompt.md`

- [ ] **Skriv system_prompt.md**

Indholdet skal dække: rolle, tool-strategi (hvornår bruges hvilke tools), og tone. Erstat placeholder-indholdet fuldstændigt:

```markdown
Du er en erfaren markplanlægger der hjælper med regenerativt landbrug og andelsgårde. Du kommunikerer altid på dansk, også selvom kildedataen er på engelsk.

## Dine tools

**vector_search** — brug til åbne spørgsmål om dyrkningsforhold, egenskaber og teknikker. Eksempler: "hvad kræver spinat af jordbund?", "hvilke planter er gode som jorddækker?". Søg på dansk eller engelsk — begge virker.

**graph_query** — brug når brugeren spørger om én specifik plante og vil vide: hvad trives godt sammen med den, hvad den hæmmer, eller hvad der er gode/dårlige forgængere. Kræver det engelske plantenavn (f.eks. "tomatoes", ikke "tomat").

**season_soil_filter** — brug når brugeren vil vide hvilke planter der egner sig til bestemte betingelser (sæson, jordbund, fugtighed). Understøtter dansk input. Brug dette tool *før* graph_query når brugeren planlægger en hel mark — filtrer kandidatmængden ned først.

## Tool-strategi

- Et spørgsmål om én plante → `graph_query`
- Et åbent spørgsmål om dyrkning → `vector_search`
- Markplanlægning med betingelser → `season_soil_filter` + `graph_query` for top-kandidater + `vector_search` for detaljer
- Kombiner tools frit når spørgsmålet kræver det

## Tone og format

- Svar kort og handlingsorienteret — brugeren vil plante, ikke læse
- Brug planters danske navne i svar, men notér det engelske navn i parentes første gang
- Hvis du mangler information om sæson eller jordbund, spørg ind inden du kalder tools
```

- [ ] **Verificér at Hermes indlæser prompten**

```bash
hermes
```

Stil et simpelt spørgsmål: "hvad trives godt med tomater?" — Hermes skal kalde `graph_query` med "tomatoes" og svare på dansk. Stop med Ctrl+C.

- [ ] **Commit**

```bash
git add hermes/system_prompt.md
git commit -m "feat(hermes): skriv system_prompt med tool-strategi og dansk tone"
```

---

## Task 3: skills/markplan.md

**Files:**
- Modify: `hermes/skills/markplan.md`

- [ ] **Skriv markplan.md**

Skillen definerer en fast ræsonnerings-sekvens som Hermes følger når brugeren beder om en markplan:

```markdown
# Markplan-skill

Brug denne sekvens når brugeren beder om hjælp til at planlægge hvad der skal plantes — enten for en hel mark, et bed eller en sæson.

## Sekvens

1. **Afklar betingelser** — Spørg ind til sæson og jordbundstype hvis ikke givet. Spørg også om fugtighed hvis relevant. Stil ét spørgsmål ad gangen.

2. **Filtrer kandidater** — Kald `season_soil_filter` med de afklarede betingelser. Præsenter *ikke* hele listen for brugeren — brug den internt til at indsnævre.

3. **Hent relationsdata** — Kald `graph_query` for de 3-5 mest relevante kandidater fra trin 2. Prioritér planter brugeren allerede har nævnt, ellers prioritér grøntsager og urter der er lette at dyrke.

4. **Berig med dyrkningsbeskrivelser** — Kald `vector_search` med en søgetekst der matcher brugerens spørgsmål (f.eks. "dyrkningsforhold lerjord" eller "companion planting kål"). Brug resultaterne til at tilføje konkrete dyrkningsråd.

5. **Syntetisér og præsenter** — Sammensæt en anbefaling med:
   - 3-5 anbefalede planter med begrundelse
   - Companion-kombinationer der styrker hinanden
   - Sædskifteforslag hvis relevant
   - Ét konkret tip per plante baseret på vector_search-data

## Hvornår bruges skillen

Aktivér sekvensen ved formuleringer som: "hvad kan jeg plante", "hvad skal jeg så", "lav en markplan", "hvad egner sig til min jord", "hvad planter jeg i [sæson]".
```

- [ ] **Verificér at Hermes indlæser skillen**

```bash
hermes
```

Stil spørgsmålet: "hvad kan jeg plante i foråret på lerjord?" — Hermes skal følge sekvensen: kalde `season_soil_filter`, derefter `graph_query` for et par kandidater, derefter `vector_search`. Stop med Ctrl+C.

- [ ] **Justér prompten hvis Hermes afviger fra sekvensen**

Typiske justeringer:
- Hermes springer trin over → tilføj "Du SKAL følge sekvensen i rækkefølge" til indledningen
- Hermes præsenterer hele filterlisten → tilføj "Vis ikke `season_soil_filter`-listen direkte til brugeren"

- [ ] **Commit**

```bash
git add hermes/skills/markplan.md
git commit -m "feat(hermes): skriv markplan-skill med 5-trins ræsonnerings-sekvens"
```

---

## Task 4: Find Hermes' HTTP API

Workflow D skal POST'e til Hermes' API. Dette task kortlægger det korrekte endpoint-format.

- [ ] **Start Hermes og tjek hvilken port og endpoint den eksponerer**

```bash
hermes --help
# eller
hermes serve --help
```

Notér: hvilken port starter Hermes' HTTP server på? Hvad er endpoint-stien?

- [ ] **Test API-kaldet manuelt**

Erstat `PORT` og `ENDPOINT` med de fundne værdier:

```bash
curl -s -X POST http://localhost:PORT/ENDPOINT \
  -H "Content-Type: application/json" \
  -d '{"message": "hvad trives godt med tomater?"}' | head -c 500
```

Forventet output: Hermes' svar som JSON eller plain text.

- [ ] **Notér request- og response-format**

Skriv det ned her — bruges direkte i Workflow D:

```
Endpoint:   http://localhost:PORT/ENDPOINT
Method:     POST
Body:       { ... }   ← udfyld efter test
Response:   { ... }   ← udfyld efter test
```

---

## Task 5: n8n Workflow D — Telegram Bridge

**Files:**
- Create: `workflows/workflow-d-telegram-bridge.json` (eksporteres fra n8n)

**Forudsætning:** Task 4 er gennemført og Hermes' API-format er kendt.

- [ ] **Opret nyt workflow i n8n: "Workflow D — Telegram Bridge"**

- [ ] **Tilføj Webhook-node (Telegram trigger)**

Konfiguration:
- HTTP Method: `POST`
- Path: `telegram-bridge`
- Response Mode: `Using 'Respond to Webhook' Node`

Notér webhook-URL: `http://localhost:5678/webhook/telegram-bridge`

Telegram skal kende denne URL. Registrér den via:

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=<NGROK_ELLER_PUBLIC_URL>/webhook/telegram-bridge"
```

> Brug ngrok eller en tilsvarende tunnel hvis n8n ikke er offentligt tilgængeligt.

- [ ] **Tilføj Code-node: "Udtræk besked"**

Udtrækker `message.text` og `message.chat.id` fra Telegram webhook-payloaden:

```js
const body = $input.first().json.body;
const text = body.message?.text ?? '';
const chat_id = body.message?.chat?.id ?? '';
return [{ json: { text, chat_id } }];
```

- [ ] **Tilføj HTTP Request-node: "Send til Hermes"**

Konfiguration (tilpas til det fundne API-format fra Task 4):
- Method: `POST`
- URL: `http://localhost:PORT/ENDPOINT`
- Body Content Type: JSON
- Body: `={{ JSON.stringify({ "message": $json.text }) }}`

- [ ] **Tilføj Code-node: "Udtræk svar"**

Tilpas til Hermes' response-format:

```js
const response = $input.first().json;
// Tilpas feltet nedenfor til Hermes' faktiske response-struktur
const reply = response.response ?? response.message ?? response.content ?? JSON.stringify(response);
const chat_id = $('Udtræk besked').first().json.chat_id;
return [{ json: { reply, chat_id } }];
```

- [ ] **Tilføj Telegram-node: "Send svar"**

Konfiguration:
- Resource: `Message`
- Operation: `Send Message`
- Chat ID: `={{ $json.chat_id }}`
- Text: `={{ $json.reply }}`
- Credentials: Telegram Bot token

- [ ] **Tilføj Respond to Webhook-node**

- Respond With: `First Incoming Item`

- [ ] **Aktivér workflow og test manuelt**

Send en besked til din Telegram Bot. Forventet flow:
1. Telegram sender webhook til n8n
2. n8n POSTer til Hermes
3. Hermes kalder MCP tools og genererer svar
4. n8n sender svaret tilbage til Telegram

- [ ] **Eksportér og gem i repo**

```bash
git add workflows/workflow-d-telegram-bridge.json
git commit -m "feat(workflow-d): Telegram Bridge — router beskeder til Hermes og returnerer svar"
```

---

## Task 6: End-to-end test

- [ ] **Verificér hele kæden: Telegram → Hermes → MCP → Neo4j → Telegram**

Test med tre scenarier:

**Scenarie 1 — enkelt plante-spørgsmål (graph_query):**
Send via Telegram: "hvad trives godt med gulerødder?"
Forventet: Hermes kalder `graph_query("carrots")` og svarer på dansk med companions og sædskifte.

**Scenarie 2 — åbent dyrkningsspørgsmål (vector_search):**
Send via Telegram: "hvad kræver spinat af jord og vanding?"
Forventet: Hermes kalder `vector_search` og svarer med konkrete dyrkningsråd.

**Scenarie 3 — markplanlægning (markplan-skill):**
Send via Telegram: "hvad kan jeg plante i foråret på lerjord?"
Forventet: Hermes følger markplan-sekvensen — kalder `season_soil_filter`, derefter `graph_query` for top-kandidater, derefter `vector_search` — og præsenterer en struktureret anbefaling.

- [ ] **Tag screenshots til eksamen**

Dokumentér:
- Telegram-samtale der viser alle tre scenarier
- n8n eksekveringslog der viser Workflow D kører
- (Valgfrit) Hermes terminal-output der viser tool-kald

- [ ] **Opdatér rapport-noter med observationer**

Tilføj til `docs/rapport-noter.md`:
- Konkrete eksempler fra test (Side 4)
- Observationer om Hermes' tool-valg — fulgte den system_prompt-strategien?
- Eventuelle justeringer af system_prompt eller markplan-skill undervejs

- [ ] **Commit**

```bash
git add docs/rapport-noter.md hermes/
git commit -m "docs: tilføj end-to-end test-observationer til rapport-noter"
```

---

## Næste trin efter Plan B

Systemet er komplet. Forbered eksamen:

- Kør alle fem workflows igennem og verificér de starter fejlfrit
- Forbered svar på eksamensspørgsmålene i CLAUDE.md
- Skriv rapporten i `docs/rapport.md` (max 5 sider, aflevering 26. maj 2026)
