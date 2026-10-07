# Handoff notes – 7 Oct 2026 (Vissim layout)

Branch `claude/sharp-franklin-3jlvv6`. The map and network now follow the city's Vissim image ("Fluxuri simultane") at true scale:
- Every carriageway is a polyline traced from the image (`defs` in sim.ts, image px × 0.381 m/px); ring radius 16 m.
- Every signal in the image is modelled and drawn the way the image draws it (coloured stop bars, pedestrian blocks):
  8 stop lines per ring, 7 crossings including the two mid-block push-button crossings on Str. Andrei Șaguna.
- Two right-turn bypasses (Coposu → Șaguna, signalised with the Coposu entry; Dumbrăvii → V. Milea, unsignalised).
- Șaguna now feeds 250 veh/h into Ramada on its curved carriageway, as the image shows (OSM disagrees; see CLAUDE.md).

Mean of 6 seeds, 20 min, pair plan, 70 s cycle (trip s / veh/h): all give-way 59 / 1,786; Milea only fixed 356 / 1,026,
adaptive 142 / 1,424; both fixed 444 / 960, adaptive 202 / 1,598.

Then: two-lane rings and approaches, as the image draws them (details in CLAUDE.md). Mean of 6 seeds, same settings:
all give-way 55 / 1,728; Milea only fixed 119 / 1,610, adaptive 81 / 1,720; both fixed 248 / 1,508, adaptive 98 / 1,694.
Signals now come close to give-way on throughput, and adaptive Milea-only is barely slower; fixed-time is still clearly worse.

Then: lane-choice errors (`P.err`, "Drivers in the wrong lane" slider) to test the city's explanation of the 6 Oct queues
(details and numbers in CLAUDE.md). Result: 30% of drivers in the wrong lane add at most ~15% to trip times under signals and
nothing under give-way; fixed-time vs adaptive matters far more. The errant drivers are polite (they stop and wait), so this is a
lower bound on the harm.

Then: aggressive errors (`P.agg`, "Of those, forcing their way"): erring drivers cut across the ring at the last moment,
straddling both lanes for 3 s. They hurt most where signals are already saturated (both fixed at 125% demand: 383 s → 441–514 s,
throughput 1,363 → ~1,100), a little under adaptive control, not at all under give-way. No gridlock. Details in CLAUDE.md.

Then: no lane markings (`P.marked = false`, "Lane markings: none"); the user reports none on the roads. Adaptive signals lose
50–70% on trip time (both rings 123 → 169–193 s; at 125% demand 204 → ~300 s), fixed-time little, give-way almost nothing.
A first version locked a full ring for good (stagger behind stopped cars formed a circle); fixed, with a test.
A Legea 544/2001 request (marking plan, markings on 6 Oct, Vissim model, signal plans, counts) is drafted as a Claude doc.

Next: the city's real marking plan and signal plans once the 544 answer comes; a standoff model (both drivers stop) for forced
cuts; coordination between the two rings.

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

## Geometry verified against OpenStreetMap (7 Oct 2026, local session)
Ring ways 191137276 (morilor), 190921167 (ramada), 190919313 (milea); Overpass needs a User-Agent header or it returns 406.
- **Str. Andrei Șaguna is one-way westbound** (Ramada → Morilor, 686 m ring to ring). Eastbound traffic runs
  Alba Iulia → Str. Dealului → Str. Banatului → Bd. Victoriei → Ramada (874 m). That is the "Bd. Victoriei" arm the
  first session saw. Each link direction now has its own `len`.
- Ramada ↔ Milea is 195 m, not 260.
- Morilor: Alba Iulia and Turismului were swapped. Real order: link 343°, Alba Iulia 129°, Turismului 210°, Morilor 286°.
- Ramada: Coposu to the NE (315°), Emil Cioran to the SW (145°), so the old guess was right. Milea: Noica is two-way
  (entry via a short slip at 267°, exit at 294°).
- Each ring is rotated as a whole so its links lie on the drawn corridor (Ramada's links are 172° apart and are forced to 180°).
- Not adopted: OSM ring centrelines have an 11–15 m radius and 2 lanes; the model keeps `RR = 26` m and one lane.
  Shrinking the ring without adding the second lane would understate capacity further, so do both together (next step 1).

Results, mean of 6 seeds, 20 simulated minutes. "OSM" = verified geometry; "+ keep clear" adds the rule below.

| Scenario | Old: trip (s) / veh/h | OSM | OSM + keep clear |
|---|---|---|---|
| All give-way | 137 / 2,390 | 135 / 2,358 | 137 / 2,356 |
| Milea only, fixed | 383 / 1,260 | 370 / 1,282 | 404 / 1,262 |
| Milea only, adaptive | 329 / 1,634 | 350 / 1,830 | 343 / 1,676 |
| All three, fixed | 513 / 914 | 493 / 976 | 490 / 1,242 |
| All three, adaptive | 414 / 1,692 | 400 / 1,600 | 447 / 1,486 |

Give-way still wins by a wide margin, as the police found on 6 Oct.

### Gridlock across Piața Unirii (fixed)
With the 195 m link, the one-arm-at-a-time adaptive plan (`seq`), all three signalised, locked solid on every seed
(560 veh/h). Each ring filled with vehicles for the other ring's full link. `canEnter` now applies a keep-clear rule.
The test "does not gridlock two rings across the short Piața Unirii link" covers it and fails without the rule.
That scenario is now 878 veh/h. Side effects: fixed-time improves (fewer locks); adaptive drops a little because a
vehicle held by keep-clear sits on the detector and extends a green nobody can use. Adaptive still beats fixed on
5 of 6 seeds (trip time), so the test now compares the mean of seeds 1–3, not seed 1 alone.

### Ring radius experiment (not adopted)
Real radius on the current one-lane ring (pair, 3 seeds, all three signalised): fixed 1,304 / 980 / 904 veh/h and
adaptive 1,536 / 1,528 / 1,260 at RR 26 / 20 / 15 m; give-way about 2,320–2,370 throughout. A smaller ring widens the gap
in favour of give-way. Change RR together with the two-lane ring.

### Possible follow-up
Adaptive control could ignore detector presence when the held vehicle is blocked by keep-clear (gap-out instead).

## Signal positions from the city's Vissim model (7 Oct 2026)
Source: the "Fluxuri simultane" frame in sibiu100.ro's 6 Oct article (Ramada and Milea only). Signal bars read off the image:
- Each ring: 4 entry stop lines (one per arm, both lanes) + 4 ring stop lines just upstream of each entry, so 8 per ring.
  This matches the model's entry + ring signal structure.
- Pedestrian crossings sit tens of metres out on the external arms only, with vehicle bars for both directions. The model had
  them at every exit, 5.5 m from the ring. Now `xw` per arm (see `defs`); links have none. Morilor uses OSM crossing nodes.
- The city's total is 163 vehicle and pedestrian signals over the whole axis (Milea to Alba Iulia × Bielz). Per-ring head counts can't be read from the image.

Moving the crossings exposed a gridlock in `seq` adaptive: a bus stuck in a queue kept calling bus priority and starved
the link entries forever. Now only a moving bus calls. Mean of 6 seeds, 20 simulated minutes (trip s / veh/h):

| Scenario | Before | Real crossings |
|---|---|---|
| All give-way | 137 / 2,356 | 104 / 2,424 |
| Milea only, fixed | 404 / 1,262 | 429 / 1,296 |
| Milea only, adaptive | 343 / 1,676 | 293 / 1,846 |
| All three, fixed | 490 / 1,242 | 502 / 1,190 |
| All three, adaptive | 447 / 1,486 | 377 / 1,694 |
| All three, adaptive `seq` | 376 / 878 | 514 / 1,296 |

Give-way still wins clearly.

## Next modelling steps, by value
1. **Two-lane rings and approaches with lane choice.** The city blamed >80% of the 6 Oct queues on wrong lane
   choice and lane changes inside the rings. The Milea → Dumbrăvii entry now has two marked lanes. This is the biggest gap.
2. Intermediate signals on the links (Banatului etc., on the eastbound route): the project covers 17–18 signalised locations on the axis, and the
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
