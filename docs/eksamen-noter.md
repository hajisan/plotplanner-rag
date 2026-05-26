# Eksamen — noter og refleksioner

## Demo-spørgsmål der virker

Brug disse konkrete spørgsmål under eksamen — de er testet og rammer de rigtige tools:

| Spørgsmål | Tool |
|-----------|------|
| "hvad trives godt med tomater?" | `graph_query(companion)` → `vector_search` |
| "hvordan dyrker jeg kål?" | `graph_query(cultivation)` → `vector_search` |
| "hvad kan jeg plante om foråret på lerjord?" | `season_soil_filter` → `graph_query` × 3 |
| "lav en markplan til foråret med sandjord" | `season_soil_filter` → `graph_query` × 3 |

---

## Refleksion: spørgsmålsformulering og agentadfærd

Systemet fungerer bedst med direkte, specifikke spørgsmål der matcher mønstrene i AGENTS.md. Ved vage eller utypiske formuleringer falder agenten tilbage til generisk adfærd og bruger ikke MCP-tools som forventet.

**Hvad virker:**
- Spørgsmål med en konkret plante → `graph_query`
- Åbne dyrkningsspørgsmål med kontekst → `vector_search`
- Spørgsmål med sæson og/eller jordtype → `season_soil_filter`

**Hvad kan fejle:**
- Vage spørgsmål uden plante eller kontekst
- Samtaleagtige opfølgninger ("hvad med gulerødder så?")
- Spørgsmål der ikke klart peger på ét tool

**Refleksion til eksamen:**
Dette er ikke en svaghed der er unik for dette system — det kendetegner RAG-systemer generelt: kvaliteten af svaret afhænger af kvaliteten af forespørgslen (garbage in, garbage out). En produktionsklar løsning ville håndtere dette med bedre prompt engineering i AGENTS.md eller et forbehandlingslag der normaliserer brugerens input inden det sendes til agenten.

---

## Refleksion: LLM instruction-following og tool output-størrelse

Gemini 2.5 Flash følger ikke altid multi-trin autonome instruktioner i AGENTS.md — særligt stopper den op og viser mellemresultater når et tool returnerer en lang liste.

**Løsning:** `season_soil_filter` blev begrænset til at returnere top 10 spiselige planter (grøntsager og urter prioriteret) i stedet for alle 88 matches. Når tool-output er kortere, har agenten ikke noget at præsentere og fortsætter til næste trin.

**Refleksion til eksamen:**
Tool-output design er en del af prompt engineering. Et tool der returnerer for meget data kan bryde agentens adfærd ligeså effektivt som en dårlig system prompt. I produktionssystemer bør tools have veldefinerede output-grænser tilpasset LLM'ens kontekstvindue og beslutningslogik.

---

## Refleksion: Tool-result-driven sequencing

AGENTS.md-instruktioner kan overrides af Geminis base model training ved multi-trin flows. Løsning: sekvenslogikken embeddes i tool-resultater som `NEXT STEP — do not respond to user yet: ...`. Tool-resultater er autoritativ LLM-kontekst — de er direkte i kontekstvinduet og overskygges ikke af base model priors.

**Konsekvens til eksamen:** tools styrer sig selv. Det er en arkitekturisk beslutning, ikke en bug-fix. Systemets robusthed afhænger af tool-output design, ikke kun system prompt.

---

## Kendte quirks under demo

- Agenten viser intern "tænkning" mellem tool-kald ("Now, Peas:...") — det er Gemini-adfærd der ikke kan slås fra, men illustrerer agentic reasoning
- Lange markplan-svar splittes i to Telegram-beskeder (Telegrams beskedgrænse)
- Hermes sessions skal ryddes manuelt (`~/.hermes/sessions/`) hvis gateway skifter arbejdsmappe
- Agenten kalder somme tider `graph_query` × 5 i stedet for × 3 — det er fint, giver rigere svar
- Databasedækning er ujævn — tomat har kun broccoli som companion i Neo4j. `vector_search` supplerer med Wikipedia-baserede companions.
