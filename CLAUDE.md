# Girație

Browser traffic microsimulation of Sibiu's roundabouts. First slice: the two Piața Unirii roundabouts whose
adaptive (Swarco) signals were switched on (and off again) on 6 Oct 2026, as shown in the city's Vissim model. Compares give-way ("flashing amber") against fixed-time and adaptive signal control.

Real intersections, west to east (the city named a third on 2 Oct 2026, Șos. Alba Iulia × Str. Morilor × Str. Turismului;
it is not in the Vissim image, so it is commented out in `defs`):
- `ramada`: Piața Unirii × Bd. Corneliu Coposu × Str. Andrei Șaguna × Str. Emil Cioran ("Ramada").
- `milea`: Bd. Vasile Milea × Calea Dumbrăvii × Piața Unirii × Str. Constantin Noica ("blocul-plombă"; Noica runs under it).
Geometry is traced from the city's Vissim image ("Fluxuri simultane", sibiu100.ro, 6 Oct 2026; 1920 × 1080 px, local copy was
`~/Downloads/Semaforizare-adaptiva-1.webp`) at `M` = 0.381 m/px (scale from the OSM ring centres, 7 Oct 2026): `defs` in sim.ts holds
image-pixel polylines for every carriageway, and the map frame is the image frame. Link: Ramada ↔ Milea 195 m.
Str. Andrei Șaguna: the Vissim model brings traffic in on the curved carriageway (two mid-block crossings) and out on the straight one,
so the arm has `flow` 250 and `out` 900 (the old Morilor arms' combined weight). OSM reads Șaguna as one-way westbound with eastbound
traffic via Bd. Victoriei; the model follows the city's image.
Calibration point: ~3,000 vehicles 7–9 am at Milea × Dumbrăvii; the model gives ~1,770 veh/h through the network at 100% demand (give-way).
Mean of 6 seeds, 20 min, pair plan, 70 s cycle (trip s / veh/h): all give-way 55 / 1,770; Milea only fixed 147 / 1,588, adaptive 71 / 1,744;
both fixed 234 / 1,474, adaptive 114 / 1,760. Trip times include the drive along the true-length approaches.
Lane-choice errors (`P.err`; 12 seeds, 30 min, mean of 5-min readings after 10 min; trip s / veh/h, 0% → 30% wrong lane):
give-way 57 / 1,835 → 57 / 1,841; Milea only fixed 152 / 1,676 → 165 / 1,643, adaptive 72 / 1,821 → 69 / 1,857; both fixed
284 / 1,419 → 294 / 1,394, adaptive 121 / 1,796 → 140 / 1,744. At 125% demand: both adaptive 226 → 234 s, both fixed 428 → 452 s.
So in this model wrong lanes cost at most ~15% of trip time under signals and nothing under give-way; the control type matters far more.
Aggressive errors (`P.agg` = 1, all erring drivers force across; same method; trip s / veh/h, 0% → 30% → 40% wrong lane):
give-way 56 / 1,862 → 56 / 1,851 → 57 / 1,848; Milea only fixed 161 / 1,665 → 199 / 1,577 → 179 / 1,579, adaptive 71 → 76 → 79 s;
both fixed 273 / 1,411 → 316 / 1,303 → 335 / 1,271, adaptive 121 / 1,836 → 142 / 1,758 → 139 / 1,756.
At 125% demand: both fixed 383 / 1,363 → 441 / 1,091 → 514 / 1,126; both adaptive 230 → 244 → 264 s; give-way unchanged (58–60 s).
Forcing hurts most where the signals are already saturated (fixed-time near capacity: +20–35% trip, −20% throughput), barely
under adaptive control, and not at all under give-way. Still no gridlock: it adds to a signal problem, it does not create one.
No lane markings (`P.marked = false`; 12 seeds, 30 min; painted → none, polite → none, 50% forcing; trip s / veh/h):
give-way 56 → 58 → 59 s; Milea only fixed 150 → 138 → 145 s, adaptive 71 → 121 → 105 s; both fixed 242 → 271 → 277 s,
adaptive 123 / 1,796 → 193 / 1,622 → 169 / 1,659. At 125% demand: give-way 59 → 65 → 66 s; Milea only adaptive 106 → 179 → 165 s;
both fixed 402 → 406 → 431 s; both adaptive 204 / 2,029 → 296 / 1,749 → 300 / 1,737.
Missing markings cost adaptive signals 50–70% on trip time (and ~15% throughput near capacity), fixed-time little (already
the bottleneck), give-way almost nothing. So they explain much of the 6 Oct trouble, but with markings painted the signals
are still 2× slower than give-way here (invented flows and timings).

## Layout
TypeScript, built with Vite into one self-contained HTML file (`vite-plugin-singlefile`).
- `src/sim.ts`  – pure simulation core, no DOM. `createSim(P, rng?)` returns `{rbs, lanes, arms, crossings, step, stats, t, K}`.
  `rng` defaults to `Math.random`; pass `mulberry32(seed)` for reproducible runs. Also importable from node.
- `src/ui.ts`   – canvas rendering, controls, readouts. Reads colours from CSS tokens.
- `src/main.ts` – entry point; `src/style.css` – CSS (light/dark tokens on `:root`); `index.html` – markup.
- `npm run build` – typechecks, then emits `dist/index.html`.
- `test/sim.test.ts` / `npm test` – vitest: network shape, every signal in the Vissim image, bypasses and mid-block crossings in use, both ring and approach lanes in use without overlaps, lane-choice errors (polite and forcing), no lane markings without gridlock,
  determinism, throughput sanity, no ring overlap.
- `scripts/scenarios.ts` / `npm run scenarios [-- seed [err]]` – 20 simulated minutes per scenario, prints trip time, throughput, queues.
- `.github/workflows/pages.yml` – test + build on every push/PR, deploy `dist/` to GitHub Pages from `main`.

## Model
- Network: roundabouts (`defs` in sim.ts); each arm has an entry carriageway `i` and an exit `o` (image px, direction of travel,
  `ni`/`no` lanes drawn); a link arm has only `o`, running to the next ring. Arms are either external (source + sink) or links.
  Roundabouts are assumed to sit on a west–east line (routing uses `rb.east` / `rb.west`).
- Lanes are polylines (`Lane.pts`, `cum`; helpers `along`, `offset`, `cumLen`). Every lane of a carriageway is simulated
  (`carriageway()`; `Arm.inL` / `outL`, rightmost first, `Lane.k`, `Lane.sib`; `inLane` / `outLane` = the rightmost). Lane k meets
  ring lane k (a one-lane carriageway the outer one); the rightmost lane's direction sets `sEntry` / `sExit`.
- Two-lane rings: `Vehicle.ri` 0 outer (radius `RR + LW/2`), 1 inner (`RR - LW/2`); positions `s` on the centreline, car following
  within a lane. Lane choice (`want()`): right lane for a turn under 100° round the ring or the bypass, left lane over 260°, else
  either (spawn picks the emptier lane, no change). Lane changes (`change()`) on approaches and links need gaps of 1.5 m ahead and
  1.5 m + 0.6 s behind, 0.5 m + 0.3 s over the last 40 m; a driver still in the wrong lane at the stop line stays in it.
- Lane-choice errors (`P.err`, 0–1, UI slider "Drivers in the wrong lane"): a driver who needs one lane (not straight on) takes the
  other at spawn, or skips the early change on a link (`Vehicle.err` 1). It notices `ERRD` = 30 m before the stop line, squeezes
  across if it can, else stops 3 m before the stop line holding up its lane, and gives up after `ERRW` = 10 s (`err` 2).
  The error draws always consume `rng`, so runs with and without errors see the same demand.
- Wrong ring lane (`Vehicle.rw`, any driver who entered from the wrong lane): cuts across to the other ring lane at the first gap
  (1 m ahead, 1 m + 0.5 s behind). One stuck in the outer lane that needs the inner stops 1 m before the first exit after its entry
  (`hs`), holding up the outer lane, for up to `ERRW` s; one stuck in the inner lane leaves from it, giving way as usual.
  The UI draws drivers still sorting out their lane in `--wrong`.
- Aggressive errors (`P.agg`, 0–1 share of erring drivers, slider "Of those, forcing their way"; `Vehicle.agg`): never stop on the
  approach (`err` 2 from the start), stay in the wrong ring lane, and force across at the last moment, from the inner lane in the
  last 8 m before the exit (not giving way), from the outer lane 3 m before the first exit after entry. While cutting across
  (`Vehicle.both`, `XT` = 3 s) the driver crawls at ≤ 4 m/s and counts as in both ring lanes, for followers, for the inner-exit
  yield and for `canEnter`, so whoever is behind in either lane stops. Drawn on the ring centreline. Forcing early (right after
  entry) did nothing: the entry gap rules leave room to change politely, so the cut is placed where it conflicts.
- No lane markings (`P.marked`, default painted; UI "Lane markings"; read each step): on two-lane approaches drivers take a
  random lane (`Pending.side`, always drawn from `rng`) and never change before the ring (`err` 2, also on links); a driver in
  the wrong ring lane sorts it out inside the ring (`rw`, polite or `P.agg` forcing; `P.err` does not apply). On the ring,
  drivers stay `STAG` = 2.5 m short of level with a MOVING car in the other lane (no side-by-side driving), but pull up beside
  a stopped one: staggering behind stopped cars locked a full ring in one circle of waiting cars. Entrants from either lane
  give way to both ring lanes. The UI hides lane dashes and adds "no lane markings" to the title.
- Ring lane conflicts: the outer lane yields to the outer lane, the inner lane (crossing the outer) to both (`canEnter(a, len, ex, k)`).
  Leaving from the inner lane gives way to outer-lane vehicles passing the exit (or taking the same one-lane exit); inner goes to
  the exit's left lane (`exitLane`). Exit spillback blocks only the ring lane the stuck vehicle came from.
- Units: metres, seconds, m/s. `DT = 0.1 s`. Ring centreline radius `RR = 16` m, lanes `LW = 3.4` m. Ring position `s` increases
  in the direction of travel (screen angle = `-s/RR`, right-hand traffic).
- Bypasses (`slip` on an `ArmDef`, `Lane.slip` / `Lane.merge`): Coposu → Șaguna at Ramada, Dumbrăvii → V. Milea at Milea. A vehicle
  whose exit is the bypass target leaves the entry lane at the split (ignoring stops and leaders beyond it) and joins the exit lane when
  `canMerge` finds a gap. The Coposu bypass has an `in` stop held by the Coposu entry light (the Vissim stop bar spans it).
- Car following: IDM (`AM`, `BM`, `TH`), plus a hard clamp against overlapping the vehicle ahead.
- Give-way: enter when no ring vehicle is within `4 m + 1.9 s × its speed` upstream (vehicles exiting at this arm ignored).
- Signals (`sig()`): per arm an entry light and a ring stop line 6 m upstream of the entry (red while the entry is green; vehicles
  leaving at that arm are exempt). Crossings (`Crossing`, `sim.crossings`, zebra ends from the image) hold the carriageways they cross
  (`Stop.side` `cross` inbound, `out` outbound). The arm's near crossing (`arm.xn`) shows red to traffic during its 8 s window after
  the arm's green. Mid-block crossings (`mid`: the two on Șaguna) run their own push-button cycle in `crossing()`: amber 3 s, all-red 1 s,
  walk 8 s, clearance 3 s, after at least 20 s of vehicle green (fixed-time: cycle − 15 s). Links have no crossing and no pedestrians.
  Two plans: `pair` (corridor arms, then side arms) and `seq` (one arm at a time).
- Exit spillback: a vehicle held on an exit lane with its tail still in the ring blocks the ring (`over` in the ring step).
- Adaptive control (`P.ctrl = 'adaptive'`, `control()`): signal groups per plan (pair: corridor/side; seq: per arm).
  Min green 7 s, gap-out after 2.5 s without a vehicle within 30 m of the stop line, max green = group's share of
  `P.cycle`, skip groups with no vehicle within 60 m, rest on green without conflicting demand, a moving bus within 120 m
  calls/extends its green (a bus standing in a queue does not, or it starves the other groups into gridlock), green ends early when the ring (both lanes) is half full. 4 s clearance. Ped windows only on demand.
- Links have a real length per direction (`ArmDef.len`, route leaving that arm), slightly longer than drawn; the UI compresses only the
  middle of a link lane (last 20 m at each end at true scale), so queues sit at the drawn stop line.
- Every signal in the Vissim image is modelled: per ring 4 entry stop lines (`ZD` = 8 m before the ring) and 4 ring stop lines;
  crossings (distance along the lane from the ring): Coposu 50 m, Cioran 19, V. Milea 70, Noica 15, Dumbrăvii 43, all both directions;
  Șaguna 142 and 284 m, inbound only, mid-block; plus the Coposu bypass stop line.
- The UI draws signals the way the Vissim image does (`bar()` in ui.ts): each stop line in the colour of its light across its carriageway,
  ring stop lines radially across the ring, pedestrian lights as blocks at both ends of each zebra (green = walk). Give-way: vehicle
  bars flash amber, pedestrian blocks dark. Label plates and the title bar copy the image; the title says what each ring runs.
- `canEnter(a, len)` keeps the entrant's body (laid along the ring upstream of the entry) clear of ring vehicles;
  the ring stop line sits 6 m upstream of the entry so cars queued at it do not block a green entry.
- Ring cap in `canEnter`: no entry above 60% (signals) / 85% (give-way) occupancy of both ring lanes. Without it the signalised ring
  fills completely and deadlocks permanently.
- Keep clear in `canEnter`: no entry towards a link whose queue (tail slower than 2 m/s) leaves no room for the entrant
  plus the ring vehicles already heading there. Without it Ramada and Milea gridlock for good across the 195 m link.

## Known simplifications (candidates for next work)
- No turbo lane dividers or lane-specific arrows from the real markings; lane choice is by turning angle. The user saw no
  markings on the roads; a Legea 544/2001 request for the marking plan, signal plans, Vissim model and counts has been drafted.
- Per-arm flows (`flow`, veh/h) and signal timings are invented, scaled to the one published count. No real counts, no published phase plan.
- Vehicles queued past the map edge sit in `arm.backlog`. The side street at Șaguna's first crossing is drawn (`STUBS` in ui.ts) without traffic.
- Lane-choice errors: no collisions or standoffs beyond the 3 s straddle; no unfamiliarity with new markings beyond the `P.err`
  share. No coordination
  offsets between roundabouts, no intermediate signals on the links (e.g. at Banatului on the eastbound route).
- Bus tails are drawn along the ring while entering (visual only).

## Conventions
- Keep `sim.ts` DOM-free and deterministic given its `rng`; draw every random number through `rng`, never `Math.random`.
- `strict` TypeScript; run `npm run typecheck` and `npm test` before committing.
- Every colour is a CSS token defined on bare `:root` and redefined in the two dark blocks.
- Output must stay a single self-contained HTML file deployable to GitHub Pages.
