# Handoff notes – 7 Oct 2026

Branch `ccr-ce00a6d3-e0wxzz`. See `CLAUDE.md` for the model itself; this file is what to pick up next.

## Done on this branch
- Network matches the arms the city named on 2 Oct 2026:
  - `morilor`: Șos. Alba Iulia × Str. Morilor × **Str. Turismului** (new arm).
  - `ramada`: Piața Unirii × Bd. C. Coposu × Str. A. Șaguna × **Str. Emil Cioran** (was "Bd. Victoriei").
  - `milea`: Bd. V. Milea × Calea Dumbrăvii × Piața Unirii × **Str. C. Noica**, the street under the "blocul-plombă" (the arm itself was mislabelled "Blocul-plombă").
- Links at estimated real length (Șaguna ~900 m, Piața Unirii ~260 m), drawn compressed and labelled.
- Milea flows trimmed: ~1,750 veh/h entering at 100% demand, against the published ~3,000 vehicles in 7–9 am.
- Adaptive (actuated) controller, `P.ctrl = 'adaptive'`, with a "Signal logic" selector in the UI. Details are in `CLAUDE.md`.
- Bug fix: an entrant could overlap ring vehicles queued at a red ring stop line. `canEnter(a, len)` now checks
  the entrant's length, and the ring stop line is 6 m upstream of the entry.

Results, mean of 6 seeds, 20 simulated minutes:

| Scenario | Trip (s) | Throughput (veh/h) |
|---|---|---|
| All give-way | 137 | 2,390 |
| Milea only, fixed | 383 | 1,260 |
| Milea only, adaptive | 329 | 1,634 |
| All three, fixed | 513 | 914 |
| All three, adaptive | 414 | 1,692 |

Give-way still wins, which matches the police verdict on 6 Oct. "Milea only" reproduces the reported queue back to Ramada.

## Not verified: do this first on a machine with map access
The cloud session could not reach openstreetmap.org, overpass-api.de or nominatim, so **arm angles are schematic and
link lengths are guesses**. To fix this:
1. Run an Overpass query for `way[junction=roundabout]` around Piața Unirii (≈45.79 N, 24.15 E) and along Șos. Alba Iulia.
2. For each roundabout, take the centroid, the ring diameter (the model uses `RR = 26` m) and the bearing of each arm.
   Convert bearings to screen angles (0 = east, 90 = south) and put them in `defs` in `src/sim.ts`.
3. Measure the centroid-to-centroid distances for `len` on the two links.
4. Check whether the Ramada arms really are Coposu to the north and Emil Cioran to the south. I am least sure of these.

## Next modelling steps, by value
1. **Two-lane rings and approaches with lane choice.** The city blamed >80% of the 6 Oct queues on wrong lane
   choice and lane changes inside the rings. The Milea → Dumbrăvii entry now has two marked lanes. This is the biggest gap.
2. Intermediate signals on Șaguna (Banatului etc.): the project covers 17–18 signalised locations on the axis, and the
   queue on 6 Oct ran ~1 km up Alba Iulia.
3. Coordination between roundabouts. The city says it will change "how flows are coordinated between intersections".
4. Special handling of the C. Noica entry and exit, which the city singled out for re-analysis.
5. Replace the invented per-arm flows if real counts are published (the system logs detector data).

## Sources
- City announcement (arms, start time): https://www.turnulsfatului.ro/2026/10/02/semafoarele-din-giratoiu-vor-fi-puse-in-functiune-de-marti-6-octombrie-anunt-oficial-de-la-primarie/
- New markings: https://www.turnulsfatului.ro/2026/10/05/noi-marcaje-rutiere-in-sensurile-giratorii-din-centrul-sibiului-marti-porneste-sistemul-inteligent-de-gestionare-a-traficului/
- Switched off: https://www.turnulsfatului.ro/2026/10/06/politia-opreste-semafoarele-din-giratorii-au-constatat-ca-traficul-ca-a-fost-mai-aglomerat-decat-inainte/
- Lane-choice errors >80%: https://www.turnulsfatului.ro/2026/10/07/semafoarele-din-giratoriile-sibiului-vor-fi-repornite-dupa-refacerea-marcajelor-rutiere-peste-80-din-deficiente-au-avut-drept-cauza-incadrarile-gresite/
- Recalibration and C. Noica: https://www.turnulsfatului.ro/2026/10/07/primaria-sibiu-despre-semaforizarea-adaptiva-concluzia-este-ca-sistemul-trebuie-recalibrat-strada-de-sub-blocul-plomba-punct-distinct-in-analiza-care-urmeaza/
- 3,000 vehicles in 2 h: https://mesageruldesibiu.ro/3-000-de-masini-in-doua-ore-intersectiile-din-sibiu-unde-vor-functiona-semafoarele-smart/
- How the system works (sensors, bus priority): https://www.turnulsfatului.ro/2025/09/01/noul-sistem-inteligent-de-trafic-explicat-pe-intelesul-tuturor-giratorii-semaforizate-peste-o-suta-de-semafoare-noi-si-mai-mult-de-170-de-senzori-222477
