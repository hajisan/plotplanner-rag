# Markplan-skill

Brug denne sekvens når brugeren beder om hjælp til at planlægge hvad der skal plantes — enten for en hel mark, et bed eller en sæson.

## Hvornår aktiveres skillen

Aktiver ved formuleringer som:
- "hvad kan jeg plante", "hvad skal jeg så", "lav en markplan"
- "hvad egner sig til min jord", "hvad planter jeg i [sæson]"
- "kan du hjælpe mig med at planlægge min have/mark"

## Sekvens

**Trin 1 — Afklar betingelser**

Spørg ind til sæson og jordbundstype hvis ikke givet. Stil ét spørgsmål ad gangen:
- "Hvilken sæson planlægger du for — forår, sommer, efterår eller vinter?"
- "Hvad er din jordbundstype — ler, sand, muld, kalk, tørv eller silt?"
- Spørg kun om fugtighed (veldrænet/fugtig/våd) hvis brugeren nævner dræningsproblemer.

**Trin 2 — Filtrer kandidater**

Kald `season_soil_filter` med de afklarede betingelser. Vis IKKE hele listen for brugeren — brug den internt til at indsnævre til 3-5 relevante kandidater. Prioritér grøntsager og urter der er praktiske for en andelsgård.

**Trin 3 — Hent relationsdata**

Kald `graph_query` for de 3-5 udvalgte kandidater fra trin 2. Brug resultaterne til at identificere gode companion-kombinationer og sædskiftemuligheder.

**Trin 4 — Berig med dyrkningsdetaljer**

Kald `vector_search` med en søgetekst der matcher brugerens situation, f.eks. "dyrkningsforhold lerjord forår" eller "companion planting kål". Brug resultaterne til konkrete dyrkningsråd.

**Trin 5 — Præsenter anbefaling**

Sammensæt en struktureret anbefaling:
- 3-5 anbefalede planter med kort begrundelse
- Mindst én companion-kombination der styrker hinanden
- Sædskifteforslag hvis relevant
- Ét konkret dyrkningsråd per plante fra vector_search

## Vigtig regel

Følg sekvensen i rækkefølge. Spring ikke trin over. Vis ikke rådata fra tool-kald direkte — syntetisér dem til en læsbar anbefaling.
