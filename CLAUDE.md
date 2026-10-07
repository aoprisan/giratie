# Girație

Browser traffic microsimulation of Sibiu's roundabouts. First slice: the three roundabouts on the
V. Milea – A. Șaguna – Șos. Alba Iulia corridor whose adaptive (Swarco) signals were switched on (and off again)
on 6 Oct 2026. Compares give-way ("flashing amber") against fixed-time and adaptive signal control.

Real intersections, as named by the city (2 Oct 2026), west to east:
- `morilor`: Șos. Alba Iulia × Str. Morilor × Str. Turismului.
- `ramada`: Piața Unirii × Bd. Corneliu Coposu × Str. Andrei Șaguna × Str. Emil Cioran ("Ramada").
- `milea`: Bd. Vasile Milea × Calea Dumbrăvii × Piața Unirii × Str. Constantin Noica ("blocul-plombă"; Noica runs under it).
Links: Șaguna ≈ 900 m, Piața Unirii ≈ 260 m (estimates; map services were unreachable, so angles are schematic).
Calibration point: ~3,000 vehicles 7–9 am at Milea × Dumbrăvii; the model gives ~1,750 veh/h entering at 100% demand.

## Layout
TypeScript, built with Vite into one self-contained HTML file (`vite-plugin-singlefile`).
- `src/sim.ts`  – pure simulation core, no DOM. `createSim(P, rng?)` returns `{rbs, lanes, arms, step, stats, t, K}`.
  `rng` defaults to `Math.random`; pass `mulberry32(seed)` for reproducible runs. Also importable from node.
- `src/ui.ts`   – canvas rendering, controls, readouts. Reads colours from CSS tokens.
- `src/main.ts` – entry point; `src/style.css` – CSS (light/dark tokens on `:root`); `index.html` – markup.
- `npm run build` – typechecks, then emits `dist/index.html`.
- `test/sim.test.ts` / `npm test` – vitest: network shape, determinism, throughput sanity, no ring overlap.
- `scripts/scenarios.ts` / `npm run scenarios [-- seed]` – 20 simulated minutes per scenario, prints trip time, throughput, queues.
- `.github/workflows/pages.yml` – test + build on every push/PR, deploy `dist/` to GitHub Pages from `main`.

## Model
- Network: roundabouts (`defs` in sim.ts) with arms at arbitrary angles; arms are either external (source + sink)
  or links to a neighbouring roundabout. Roundabouts are assumed to sit on a west–east line (routing uses `rb.east` / `rb.west`).
- Units: metres, seconds, m/s. `DT = 0.1 s`. Ring position `s` increases in the direction of travel
  (screen angle = `-s/RR`, right-hand traffic).
- Car following: IDM (`AM`, `BM`, `TH`), plus a hard clamp against overlapping the vehicle ahead.
- Give-way: enter when no ring vehicle is within `4 m + 1.9 s × its speed` upstream (vehicles exiting at this arm ignored).
- Signals (`sig()`): per arm an entry light, a ring stop line just upstream of the entry (red while the entry is green),
  and a pedestrian light on the exit (8 s window after the arm's green). Two plans: `pair` (corridor arms, then side arms)
  and `seq` (one arm at a time).
- Exit spillback: a vehicle held on an exit lane with its tail still in the ring blocks the ring (`over` in the ring step).
- Adaptive control (`P.ctrl = 'adaptive'`, `control()`): signal groups per plan (pair: corridor/side; seq: per arm).
  Min green 7 s, gap-out after 2.5 s without a vehicle within 30 m of the stop line, max green = group's share of
  `P.cycle`, skip groups with no vehicle within 60 m, rest on green without conflicting demand, bus within 120 m
  calls/extends its green, green ends early when the ring is half full. 4 s clearance. Ped windows only on demand.
- Links have a real length (`ArmDef.len`) longer than drawn; the UI scales lane positions by drawn/real length.
- `canEnter(a, len)` keeps the entrant's body (laid along the ring upstream of the entry) clear of ring vehicles;
  the ring stop line sits 6 m upstream of the entry so cars queued at it do not block a green entry.
- Ring cap in `canEnter`: no entry above 60% (signals) / 85% (give-way) ring occupancy. Without it the signalised ring
  fills completely and deadlocks permanently.

## Known simplifications (candidates for next work)
- One ring lane and one lane per approach; the real roundabouts have more. This understates signalised capacity.
- Per-arm flows (`flow`, veh/h) and signal timings are invented, scaled to the one published count. No real counts, no published phase plan.
- Schematic geometry; the Șaguna link is shortened. Vehicles queued past the map edge sit in `arm.backlog`.
- No lane changing or lane-choice errors (the city blamed >80% of the 6 Oct queues on them), no coordination
  offsets between roundabouts, no intermediate signals on Șaguna (e.g. Banatului).
- Bus tails are drawn along the ring while entering (visual only).

## Conventions
- Keep `sim.ts` DOM-free and deterministic given its `rng`; draw every random number through `rng`, never `Math.random`.
- `strict` TypeScript; run `npm run typecheck` and `npm test` before committing.
- Every colour is a CSS token defined on bare `:root` and redefined in the two dark blocks.
- Output must stay a single self-contained HTML file deployable to GitHub Pages.
