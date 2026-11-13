# ¿Cómo vota el Congreso?

Roll-call votes in Argentina's Chamber of Deputies and Senate since 2024: how each bloc votes, and which members vote in dissent with their bloc. A switch at the top toggles the chamber (`#senado` in the URL opens the Senate).

```bash
npm install
npm run data   # refresh public/data.json from the API
npm test       # checks the bloc-position logic
npm run dev
```

## Data

[ArgentinaDatos](https://argentinadatos.com): `/v1/diputados/actas` + `/v1/diputados/diputados`, and `/v1/senado/actas` + `/v1/senado/senadores`, built from the official records of each chamber. `scripts/build-data.ts` normalizes both chambers, joins votes to members and precomputes everything into `public/diputados.json` and `public/senado.json`, so the site is static. The senate source repeats a few roll calls; duplicates are dropped by id.

## Seat chart

The chart at the top shows the 257 sitting deputies colored by their current bloc (the source has no data on the ticket each deputy was elected on). Blocs with fewer than 4 seats share the "Otros bloques" color, and every seat's tooltip names its deputy and bloc. The Frente de Izquierda blocs are merged because they ran as one front. The left-to-right order follows the usual left–right convention and is a hand-kept list (`ORDER` in `src/Chamber.tsx`), along with the colors.

## Method and limits

- **Bloc position** = the most common cast vote (yes / no / abstain) among the bloc's members who voted. Ties, and blocs with fewer than 2 votes cast, have no position.
- **Voting in dissent** ("vota en disidencia") = casting a vote different from that position. Absences don't count.
- **Senate blocs over time:** the senate source has each senator's current bloc but not when they joined it, and former senators have no bloc. Each bloc is assumed from 10 Dec 2025 (when the current composition took office) or the senator's own mandate start if later; earlier votes are "Sin dato". So dissent in the Senate covers the current period only, and a senator who switched blocs after that date is counted with their current bloc.
- **Deputies' blocs over time:** the source only records each deputy's *current* bloc and when they joined it. Before that date their bloc shows as "Sin dato" and is left out of the calculation (about 15% of individual votes). Without this, the December 2025 bloc reshuffle would look like mass dissent.
- Votes are matched to deputies by name (surname + first given name). Unmatched deputies are printed when you run `npm run data`.
- Coverage before 2024 is sparse in the source, so the site starts in 2024.
