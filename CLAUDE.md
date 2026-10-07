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
Calibration point: ~3,000 vehicles 7–9 am at Milea × Dumbrăvii; the model gives ~1,730 veh/h through the network at 100% demand (give-way).
Mean of 6 seeds, 20 min, pair plan, 70 s cycle (trip s / veh/h): all give-way 55 / 1,728; Milea only fixed 119 / 1,610, adaptive 81 / 1,720;
both fixed 248 / 1,508, adaptive 98 / 1,694. Trip times include the drive along the true-length approaches.

## Layout
TypeScript, built with Vite into one self-contained HTML file (`vite-plugin-singlefile`).
- `src/sim.ts`  – pure simulation core, no DOM. `createSim(P, rng?)` returns `{rbs, lanes, arms, crossings, step, stats, t, K}`.
  `rng` defaults to `Math.random`; pass `mulberry32(seed)` for reproducible runs. Also importable from node.
- `src/ui.ts`   – canvas rendering, controls, readouts. Reads colours from CSS tokens.
- `src/main.ts` – entry point; `src/style.css` – CSS (light/dark tokens on `:root`); `index.html` – markup.
- `npm run build` – typechecks, then emits `dist/index.html`.
- `test/sim.test.ts` / `npm test` – vitest: network shape, every signal in the Vissim image, bypasses and mid-block crossings in use, both ring and approach lanes in use without overlaps,
  determinism, throughput sanity, no ring overlap.
- `scripts/scenarios.ts` / `npm run scenarios [-- seed]` – 20 simulated minutes per scenario, prints trip time, throughput, queues.
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
- No turbo lane dividers or lane-specific arrows from the real markings; lane choice is by turning angle.
- Per-arm flows (`flow`, veh/h) and signal timings are invented, scaled to the one published count. No real counts, no published phase plan.
- Vehicles queued past the map edge sit in `arm.backlog`. The side street at Șaguna's first crossing is drawn (`STUBS` in ui.ts) without traffic.
- No deliberate lane-choice errors (the city blamed >80% of the 6 Oct queues on them; only drivers who fail to change in time), no coordination
  offsets between roundabouts, no intermediate signals on the links (e.g. at Banatului on the eastbound route).
- Bus tails are drawn along the ring while entering (visual only).

## Conventions
- Keep `sim.ts` DOM-free and deterministic given its `rng`; draw every random number through `rng`, never `Math.random`.
- `strict` TypeScript; run `npm run typecheck` and `npm test` before committing.
- Every colour is a CSS token defined on bare `:root` and redefined in the two dark blocks.
- Output must stay a single self-contained HTML file deployable to GitHub Pages.
