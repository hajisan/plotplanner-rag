# Eksamen — noter og refleksioner

## Demo-spørgsmål der virker

Brug disse konkrete spørgsmål under eksamen — de er testet og rammer de rigtige tools:

| Spørgsmål | Tool |
|-----------|------|
| "hvad trives godt med tomater?" | `graph_query` |
| "hvad kræver kål af jordbund?" | `vector_search` |
| "hvad kan jeg plante om foråret på lerjord?" | `season_soil_filter` |
| "lav en markplan til foråret med sandjord" | fuld 5-trins sekvens |

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
