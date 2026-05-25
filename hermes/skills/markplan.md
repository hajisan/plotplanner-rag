---
name: markplan
description: Lav en planteplan baseret på sæson og jordbundstype — sekvens med season_soil_filter, graph_query og vector_search
version: 1.0.0
author: PlotPlanner
metadata:
  hermes:
    tags: [agriculture, planting, companion-planting, crop-rotation, markplan]
requires_tools:
  - mcp_plotplanner_season_soil_filter
  - mcp_plotplanner_graph_query
  - mcp_plotplanner_vector_search
---

# Markplan-skill

Brug denne sekvens når brugeren beder om hjælp til at planlægge hvad der skal plantes — enten for en hel mark, et bed eller en sæson.

## Hvornår aktiveres skillen

Aktiver ved formuleringer som:
- "hvad kan jeg plante", "hvad skal jeg så", "lav en markplan"
- "hvad egner sig til min jord", "hvad planter jeg i [sæson]"
- "kan du hjælpe mig med at planlægge min have/mark"

## Sekvens

Gennemfør alle fem trin før du skriver noget til brugeren. Stil ingen spørgsmål undervejs.

**Trin 1 — Afklar betingelser**

Mangler sæson eller jordbundstype i brugerens besked, stil præcist ét spørgsmål og afvent svar. Har du begge oplysninger, gå direkte til trin 2.

**Trin 2 — Filtrer kandidater (intern)**

Kald `mcp_plotplanner_season_soil_filter`. Brug resultatet internt — vis det ikke til brugeren. Vælg 3-5 kandidater, prioritér grøntsager og urter.

**Trin 3 — Hent relationsdata (intern)**

Kald `mcp_plotplanner_graph_query` for hver af de 3-5 kandidater. Brug resultaterne til at finde gode companion-kombinationer.

**Trin 4 — Hent dyrkningsdetaljer (intern)**

Kald `mcp_plotplanner_vector_search` med en ENGELSK søgestreng.
Eksempler: `"spring vegetable cultivation"` · `"clay soil crops"` · `"companion planting vegetables"`

**Trin 5 — Skriv anbefaling på dansk**

Nu skriver du dit svar. Svar altid på dansk. Strukturér således:
- 3-5 anbefalede planter med én sætnings begrundelse
- Mindst én companion-kombination
- Ét konkret dyrkningsråd per plante

Svar kort og handlingsorienteret — ingen lange forklaringer.
