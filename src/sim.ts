// Pure simulation core: no DOM, deterministic given `rng`. Loadable from node.

export type Mode = 'classic' | 'signal';
export type Plan = 'pair' | 'seq';
/** `fixed`: fixed-time plan. `adaptive`: detector-actuated greens with bus priority, like the Swarco system. */
export type Ctrl = 'fixed' | 'adaptive';
/** A point in metres (world) or pixels of the city's Vissim image (`defs`). Screen axes: x east, y south. */
export type Pt = [number, number];
/** Vehicle light: green, amber, red, or '' = unsignalised (give-way, flashing amber). */
export type Light = 'g' | 'a' | 'r' | '';

export interface Params {
  demand: number;
  cycle: number;
  ped: number;
  plan: Plan;
  ctrl: Ctrl;
  /** Share of drivers (0–1) who pick the wrong lane on a two-lane approach and only notice near the stop line. */
  err?: number;
  /** Share of those (0–1) who force their way instead: they notice only in the ring and cut across it, blocking both lanes. */
  agg?: number;
}

export interface Signal {
  entry: 'g' | 'a' | 'r';
  ring: boolean;
  ped: boolean;
}

export interface Ped {
  t0: number;
  dir: 1 | -1;
}

export interface Pending {
  t: number;
  dest: Arm;
  bus: boolean;
  err: boolean;
  agg: boolean;
}

export interface Vehicle {
  pos: number;
  v: number;
  len: number;
  bus: boolean;
  t0: number;
  dest: Arm;
  lane: Lane | null;
  rb: Roundabout | null;
  s: number;
  exit: Arm | null;
  step: number;
  /** Ring lane: 0 outer, 1 inner. Kept after leaving the ring. */
  ri: number;
  /** Lane-choice error on the current approach: 0 none, 1 in the wrong lane and not yet aware, 2 gave up changing. */
  err: number;
  /** Erring driver: when it stopped to wait for a gap, or -1. */
  wait: number;
  /** In the ring: the ring lane it should be in after entering from the wrong one (-1 = fine), and where a driver
   *  stuck in the outer lane stops to get into the inner one (just before the first exit after its entry). */
  rw: number;
  hs: number;
  /** Forces its way when in the wrong lane (`P.agg`). */
  agg: boolean;
  /** Cutting across the ring: straddles both ring lanes until this time. */
  both: number;
}

export interface Stop {
  pos: number;
  arm: Arm;
  /** `in`: entry stop line. `cross`: inbound side of a pedestrian crossing. `out`: outbound side of a crossing. */
  side: 'in' | 'cross' | 'out';
  lane: Lane;
  x: Crossing | null;
}

export interface Lane {
  /** Centreline of the simulated lane in the direction of travel (metres); `cum` = arc length at each point. */
  pts: Pt[];
  cum: number[];
  /** Lanes in this carriageway, and which this is (0 = rightmost); `sib` = the other lane of a two-lane carriageway. */
  nl: number;
  k: number;
  sib: Lane | null;
  /** Simulated length; links are longer than drawn. */
  L: number;
  veh: Vehicle[];
  stops: Stop[];
  endArm: Arm | null;
  fromArm: Arm | null;
  src: Arm | null;
  sink: Arm | null;
  /** Right-turn bypass leaving this lane at `at` for `to` (vehicles exiting there skip the ring). */
  slip: {at: number; to: Arm; lane: Lane} | null;
  /** Bypass lane: joins `lane` at `pos` at its end. */
  merge: {lane: Lane; pos: number} | null;
}

/** Signalised pedestrian crossing. Near the ring it runs with its arm's signal group; mid-block (`mid`) it has
 *  its own push-button controller. */
export interface Crossing {
  arm: Arm;
  /** Kerb-to-kerb ends in metres; pedestrians walk from a to b (dir 1) or back. */
  ax: number;
  ay: number;
  bx: number;
  by: number;
  mid: boolean;
  stops: Stop[];
  /** Give-way: pedestrians on the zebra until this time. */
  pedUntil: number;
  pedWait: number;
  /** Adaptive control: this crossing's window is open until this time. */
  pedOpen: number;
  peds: Ped[];
  /** Mid-block controller: 0 vehicle green, 1 amber, 2 all-red, 3 walk, 4 clearance; `ph0` = phase start. */
  ph: number;
  ph0: number;
  car: Light;
  walk: boolean;
}

export interface Arm {
  rb: Roundabout;
  idx: number;
  name: string | null;
  /** Label box, top-left corner in metres (from the Vissim image). */
  lab: Pt | null;
  flow: number;
  out: number;
  g: number;
  link: number;
  sEntry: number;
  sExit: number;
  sStop: number;
  len: number;
  xs: Crossing[];
  /** The crossing timed with this arm's signal group, if any. */
  xn: Crossing | null;
  backlog: Pending[];
  sg: Signal | null;
  /** Entry and exit lanes, rightmost first; `inLane` / `outLane` = the rightmost. */
  inL: Lane[];
  outL: Lane[];
  inLane: Lane;
  outLane: Lane;
  inStop: Stop;
  w: number;
  f0: number;
  fd: number;
}

export interface Roundabout {
  key: string;
  name: string;
  x: number;
  y: number;
  idx: number;
  mode: Mode;
  veh: Vehicle[];
  arms: Arm[];
  east?: Arm;
  west?: Arm;
  ctl: Ctl;
}

/** Adaptive controller state for one roundabout. Groups follow the plan: `pair` = corridor / side arms, `seq` = one arm each. */
export interface Ctl {
  on: boolean;
  cur: number;
  next: number;
  start: number;
  /** Time the current group's clearance (amber + all-red) began, or -1 while it is green. */
  clr: number;
  /** Last time a vehicle was over a detector of the green group. */
  seen: number;
}

export interface RbStats {
  queued: number;
  worst: string;
  worstN: number;
  ring: number;
  ringStopped: number;
  green: string;
}

export interface Stats {
  t: number;
  trip: number;
  flow: number;
  stopped: number;
  backlog: number;
  total: number;
  per: RbStats[];
}

export interface Constants {
  /** Ring centreline radius; the outer ring lane runs at RR + LW/2, the inner at RR - LW/2. */
  RR: number;
  /** Lane width. */
  LW: number;
  C: number;
  /** Entry stop line, metres before the ring. */
  ZD: number;
  DT: number;
  /** Metres per pixel of the Vissim image; the map frame is its 1920 × 1080 px. */
  M: number;
}

export interface Sim {
  rbs: Roundabout[];
  lanes: Lane[];
  arms: Arm[];
  crossings: Crossing[];
  step(): void;
  stats(): Stats;
  readonly t: number;
  K: Constants;
}

interface XDef {
  /** Kerb-to-kerb ends of the zebra, image px. */
  p: [number, number, number, number];
  /** Carriageways it crosses (default both). */
  on?: 'in' | 'out';
  mid?: boolean;
}

interface ArmDef {
  name?: string;
  flow?: number;
  out?: number;
  g?: number;
  link?: number;
  len?: number;
  /** Carriageway centrelines in image px, in the direction of travel: `i` towards the ring, `o` away from it
   *  (a link's `o` runs to the next ring). `ni`/`no`: lanes drawn (default 1). */
  i?: Pt[];
  o: Pt[];
  ni?: number;
  no?: number;
  xs?: XDef[];
  /** Right-turn bypass to arm `to`, image px from where it leaves this arm's entry to where it joins `to`'s exit.
   *  `stop`: where the arm's entry light also holds the bypass. */
  slip?: {to: number; p: Pt[]; stop?: Pt};
  lab?: Pt;
}

interface RbDef {
  key: string;
  name: string;
  c: Pt;
  arms: ArmDef[];
}

// Geometry traced from the city's Vissim model ("Fluxuri simultane", sibiu100.ro, 6 Oct 2026), a 1920 × 1080 px
// image at M m/px (scale from the OSM ring centres, 7 Oct 2026). The image is turned so the Piața Unirii link
// runs left to right. Arms are listed in the order the city named them on 2 Oct 2026.
// Each arm has its own entry and exit carriageways as the model draws them; where they share a road they run
// side by side. Two right-turn bypasses: Coposu → Șaguna at Ramada (held by the Coposu entry light, as the model
// draws its stop line across it), Calea Dumbrăvii → V. Milea at Milea (unsignalised).
// Str. Andrei Șaguna: the model brings traffic in on the curved carriageway (two signalised crossings, mid-block)
// and takes it out on the straight one, which the model cuts short, as it does a stub beside Calea Dumbrăvii.
// `len` is the ring-to-ring route length of a link in the direction leaving the arm.
const M = 0.381;
const defs: RbDef[] = [
  // Șos. Alba Iulia × Str. Morilor × Str. Turismului: named by the city but not in its Vissim model, so left out.
  {key: 'ramada', name: 'Piața Unirii · Ramada', c: [781, 512], arms: [
    {link: 1, name: 'Piața Unirii', len: 195, no: 2, lab: [905, 385],
      o: [[826, 534], [900, 536], [1100, 538], [1250, 539], [1300, 541]]},
    {name: 'Bd. Corneliu Coposu', flow: 280, g: 1, ni: 2, no: 2, lab: [485, 135],
      i: [[754, 10], [755, 380], [752, 420], [756, 455]], o: [[786, 462], [784, 420], [773, 380], [771, 10]],
      xs: [{p: [746, 354, 786, 354]}],
      slip: {to: 2, p: [[749, 395], [744, 430], [738, 460], [728, 482], [712, 493], [690, 497]], stop: [741, 453]}},
    {name: 'Str. Andrei Șaguna', flow: 250, out: 900, g: 0, ni: 2, no: 2, lab: [100, 510],
      i: [[0, 1000], [150, 975], [300, 955], [330, 948], [355, 930], [372, 900], [380, 850], [382, 800], [388, 740],
        [393, 700], [399, 640], [410, 612], [420, 585], [450, 553], [500, 537], [600, 534], [700, 536], [725, 537]],
      o: [[735, 496], [700, 496], [620, 499], [560, 509], [505, 521]],
      xs: [{p: [390, 613, 428, 612], on: 'in', mid: true}, {p: [316, 936, 321, 962], on: 'in', mid: true}]},
    {name: 'Str. Emil Cioran', flow: 300, g: 1, lab: [495, 750],
      i: [[777, 842], [778, 700], [785, 640], [788, 600], [791, 565]], o: [[762, 560], [758, 600], [758, 640], [764, 700], [766, 842]],
      xs: [{p: [755, 594, 800, 596]}]}]},
  {key: 'milea', name: 'V. Milea · Dumbrăvii (blocul-plombă)', c: [1346, 525], arms: [
    {name: 'Bd. Vasile Milea', flow: 470, g: 0, ni: 2, no: 2, lab: [1450, 325],
      i: [[1851, 274], [1556, 433], [1500, 462], [1450, 481], [1398, 496]], o: [[1394, 522], [1450, 503], [1530, 468], [1566, 449], [1859, 290]],
      xs: [{p: [1537, 430, 1562, 462]}]},
    {name: 'Str. Constantin Noica', flow: 120, g: 1, lab: [1170, 165],
      i: [[1348, 228], [1336, 280], [1321, 350], [1308, 400], [1301, 440], [1296, 470], [1297, 490]],
      o: [[1306, 488], [1304, 470], [1309, 440], [1316, 400], [1329, 350], [1344, 280], [1356, 228]],
      xs: [{p: [1288, 477, 1309, 476]}]},
    {link: 0, name: 'Piața Unirii', len: 195, no: 2,
      o: [[1296, 503], [1250, 498], [1100, 499], [1000, 500], [900, 499], [836, 497]]},
    {name: 'Calea Dumbrăvii', flow: 420, g: 1, ni: 2, lab: [1405, 665],
      i: [[1812, 833], [1630, 707], [1520, 630], [1480, 603], [1450, 584], [1420, 563], [1398, 549]],
      o: [[1352, 567], [1382, 580], [1412, 598], [1440, 613], [1475, 628], [1512, 641], [1622, 718], [1804, 844]],
      xs: [{p: [1480, 590, 1454, 630]}],
      slip: {to: 0, p: [[1452, 586], [1440, 562], [1437, 540], [1444, 522], [1460, 505], [1478, 491]]}}]},
];

/** Mulberry32: small seedable PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Cumulative arc length at each point of a polyline. */
export function cumLen(pts: Pt[]): number[] {
  const c = [0];
  for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return c;
}

/** Point and unit direction at arc length `d` along a polyline (clamped to its ends). */
export function along(pts: Pt[], cum: number[], d: number): {x: number; y: number; dx: number; dy: number} {
  let i = 1;
  while (i < pts.length - 1 && cum[i] < d) i++;
  const [ax, ay] = pts[i - 1], [bx, by] = pts[i], seg = cum[i] - cum[i - 1] || 1, f = Math.min(1, Math.max(0, (d - cum[i - 1]) / seg));
  return {x: ax + (bx - ax) * f, y: ay + (by - ay) * f, dx: (bx - ax) / seg, dy: (by - ay) / seg};
}

/** Polyline shifted `d` to the right of its direction of travel (negative = left). */
export function offset(pts: Pt[], d: number): Pt[] {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [p[0] - (b[1] - a[1]) / l * d, p[1] + (b[0] - a[0]) / l * d];
  });
}

/** Arc length of the point of a polyline nearest to (x, y). */
function project(pts: Pt[], cum: number[], x: number, y: number): number {
  let best = Infinity, at = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
    const f = Math.min(1, Math.max(0, ((x - ax) * dx + (y - ay) * dy) / l2)), qx = ax + dx * f - x, qy = ay + dy * f - y;
    if (qx * qx + qy * qy < best) { best = qx * qx + qy * qy; at = cum[i - 1] + f * Math.sqrt(l2); }
  }
  return at;
}

export function createSim(P: Params, rng: () => number = Math.random): Sim {
  const RR = 16, LW = 3.4, C = Math.PI * 2 * RR, ZD = 8, DT = 0.1;
  const mod = (a: number, n: number) => ((a % n) + n) % n;
  let t = 0, n = 0;
  const lanes: Lane[] = [], crossings: Crossing[] = [], done: {t: number; tt: number}[] = [];
  const W = (q: Pt[]): Pt[] => q.map(([x, y]) => [x * M, y * M]);
  const rbs: Roundabout[] = defs.map((d, i) => ({key: d.key, name: d.name, x: d.c[0] * M, y: d.c[1] * M, idx: i, mode: 'classic', veh: [], arms: [],
    ctl: {on: false, cur: 0, next: 0, start: 0, clr: -1, seen: 0}}));
  const sAt = (rb: Roundabout, p: Pt) => mod(-Math.atan2(p[1] - rb.y, p[0] - rb.x) * RR, C);
  /** Radius of ring lane `k` (0 outer, 1 inner). */
  const ringR = (k: number) => RR + (k ? -LW / 2 : LW / 2);
  function mk(pts: Pt[], nl: number, k = 0): Lane {
    const cum = cumLen(pts);
    const l: Lane = {pts, cum, nl, k, sib: null, L: cum[cum.length - 1], veh: [], stops: [], endArm: null, fromArm: null, src: null, sink: null, slip: null, merge: null};
    lanes.push(l);
    return l;
  }
  /** The `nl` lanes of a carriageway (centreline `q`, image px), rightmost first. Lane k meets ring lane k (a one-lane
   *  carriageway the outer one) where the rightmost lane points: at its end (`toRb`) and/or its start (`fromRb`). */
  function carriageway(q: Pt[], nl: number, fromRb: Roundabout | null, toRb: Roundabout | null): Lane[] {
    const c = W(q), r0 = offset(c, (nl - 1) * LW / 2);
    const ang = (rb: Roundabout, p: Pt) => Math.atan2(p[1] - rb.y, p[0] - rb.x);
    const a0 = fromRb && ang(fromRb, r0[0]), a1 = toRb && ang(toRb, r0[r0.length - 1]);
    const ls: Lane[] = [];
    for (let k = 0; k < nl; k++) {
      const pts = offset(c, (nl - 1) * LW / 2 - k * LW);
      if (fromRb) pts.unshift([fromRb.x + ringR(k) * Math.cos(a0!), fromRb.y + ringR(k) * Math.sin(a0!)]);
      if (toRb) pts.push([toRb.x + ringR(k) * Math.cos(a1!), toRb.y + ringR(k) * Math.sin(a1!)]);
      ls.push(mk(pts, nl, k));
    }
    if (nl === 2) { ls[0].sib = ls[1]; ls[1].sib = ls[0]; }
    return ls;
  }
  rbs.forEach((rb, i) => {
    defs[i].arms.forEach((d, k) => {
      // Lanes, stops and phase weights are filled in below.
      rb.arms.push({rb, idx: k, name: d.name ?? null, lab: d.lab ? [d.lab[0] * M, d.lab[1] * M] : null, flow: d.flow ?? 0, out: d.out ?? d.flow ?? 0,
        g: d.g ?? 0, link: d.link ?? -1, sEntry: 0, sExit: 0, sStop: 0, len: d.len ?? 0, xs: [], xn: null, backlog: [], sg: null, w: 0, f0: 0, fd: 0} as unknown as Arm);
    });
    rb.arms.forEach(a => { if (a.link > rb.idx) rb.east = a; if (a.link >= 0 && a.link < rb.idx) rb.west = a; });
  });
  rbs.forEach((rb, i) => rb.arms.forEach((a, k) => {
    const d = defs[i].arms[k];
    if (a.link >= 0) {
      const nb = rbs[a.link];
      a.outL = carriageway(d.o, d.no ?? 1, rb, nb);
      // Real length; the UI compresses the middle of the drawn link.
      for (const l of a.outL) l.L = Math.max(l.L, a.len);
      nb.arms.find(b => b.link === rb.idx)!.inL = a.outL;
    } else {
      a.inL = carriageway(d.i!, d.ni ?? 1, null, rb); a.inL.forEach(l => l.src = a);
      a.outL = carriageway(d.o, d.no ?? 1, rb, null); a.outL.forEach(l => l.sink = a);
    }
  }));
  const arms: Arm[] = [];
  rbs.forEach(rb => rb.arms.forEach(a => arms.push(a)));
  arms.forEach(a => {
    const rb = a.rb, d = defs[rb.idx].arms[a.idx];
    a.inLane = a.inL[0]; a.outLane = a.outL[0];
    a.inL.forEach(l => l.endArm = a); a.outL.forEach(l => l.fromArm = a);
    a.sEntry = sAt(rb, a.inLane.pts[a.inLane.pts.length - 1]); a.sExit = sAt(rb, a.outLane.pts[0]);
    // Ring stop line 6 m upstream of the entry, so cars queued at it do not block a green entry.
    a.sStop = mod(a.sEntry - 6, C);
    for (const l of a.inL) l.stops.push({pos: l.L - ZD, arm: a, side: 'in', lane: l, x: null});
    a.inStop = a.inLane.stops[0];
    for (const xd of d.xs ?? []) {
      const [ax, ay, bx, by] = xd.p.map(v => v * M);
      const x: Crossing = {arm: a, ax, ay, bx, by, mid: !!xd.mid, stops: [], pedUntil: -1, pedWait: 0, pedOpen: -1, peds: [], ph: 0, ph0: 0, car: '', walk: false};
      // A 4 m zebra: traffic holds just upstream of it, in both directions unless it crosses one carriageway only.
      const mx = (ax + bx) / 2, my = (ay + by) / 2;
      for (const [l, side] of [...a.inL.map(l => [l, 'cross']), ...a.outL.map(l => [l, 'out'])] as [Lane, 'cross' | 'out'][]) {
        if (xd.on && xd.on !== (side === 'cross' ? 'in' : 'out')) continue;
        const st: Stop = {pos: Math.max(0.5, project(l.pts, l.cum, mx, my) - 2.5), arm: a, side, lane: l, x};
        l.stops.push(st); x.stops.push(st);
      }
      a.xs.push(x); crossings.push(x);
      if (!x.mid && !a.xn) a.xn = x;
    }
  });
  arms.forEach(a => {
    const d = defs[a.rb.idx].arms[a.idx];
    if (!d.slip) return;
    const to = a.rb.arms[d.slip.to], l = mk(W(d.slip.p), 1), [sx, sy] = l.pts[0], [ex, ey] = l.pts[l.pts.length - 1];
    a.inLane.slip = {at: project(a.inLane.pts, a.inLane.cum, sx, sy), to, lane: l};
    l.merge = {lane: to.outLane, pos: project(to.outLane.pts, to.outLane.cum, ex, ey)};
    if (d.slip.stop) l.stops.push({pos: project(l.pts, l.cum, d.slip.stop[0] * M, d.slip.stop[1] * M), arm: a, side: 'in', lane: l, x: null});
  });
  const sinks = arms.filter(a => a.link < 0);
  rbs.forEach(rb => {
    let tot = 0; rb.arms.forEach(a => { a.w = a.g ? 2 : 3; tot += a.w; });
    let c = 0; rb.arms.forEach(a => { a.f0 = c / tot; a.fd = a.w / tot; c += a.w; });
  });

  // Adaptive control. Detectors sit in each approach lane (DET m before the stop line) and the controller
  // extends a green while they keep seeing traffic, up to the group's share of the cycle, then moves on
  // to the next group that has demand. A bus approaching (BUSD m) holds or calls its green.
  const GMIN = 7, GAP = 2.5, DET = 30, CALL = 60, BUSD = 120, CLR = 4;
  const nGroups = (rb: Roundabout) => P.plan === 'seq' ? rb.arms.length : 2;
  const grp = (a: Arm) => P.plan === 'seq' ? a.idx : a.g;
  const pedWait = (a: Arm) => a.xn ? a.xn.pedWait : 0;
  function gmax(rb: Roundabout, gi: number): number {
    if (P.plan === 'seq') return Math.max(GMIN, rb.arms[gi].fd * P.cycle - CLR);
    return Math.max(GMIN, P.cycle * (gi ? 0.45 : 0.55) - CLR);
  }
  /** Any vehicle within `d` of the end of `a`'s approach? `bus`: only a moving bus counts as a priority call; a bus
   *  standing in a queue it cannot clear would otherwise call its green forever and starve the other groups. */
  function near(a: Arm, d: number, bus = false): boolean {
    for (const l of a.inL) for (const v of l.veh) if (l.L - v.pos < d && (!bus || (v.bus && v.v > 1))) return true;
    return false;
  }
  function control(rb: Roundabout): void {
    const c = rb.ctl, n = nGroups(rb);
    if (rb.mode !== 'signal' || P.ctrl !== 'adaptive') { c.on = false; return; }
    if (!c.on) { c.on = true; c.cur = 0; c.start = t; c.clr = -1; c.seen = t; }
    c.cur %= n;
    if (c.clr >= 0) {
      if (t - c.clr < CLR) return;
      for (const a of rb.arms) if (grp(a) === c.cur && a.xn && a.xn.pedWait > 0) a.xn.pedOpen = t + 8;
      c.cur = c.next % n; c.start = t; c.clr = -1; c.seen = t;
      return;
    }
    const mine = rb.arms.filter(a => grp(a) === c.cur), g = t - c.start;
    if (mine.some(a => near(a, DET))) c.seen = t;
    const busHere = mine.some(a => near(a, BUSD, true));
    let nx = -1, busNx = -1;
    for (let k = 1; k < n; k++) {
      const j = (c.cur + k) % n, arms = rb.arms.filter(a => grp(a) === j);
      if (nx < 0 && arms.some(a => near(a, CALL))) nx = j;
      if (busNx < 0 && arms.some(a => near(a, BUSD, true))) busNx = j;
    }
    if (busNx >= 0 && !busHere) nx = busNx;
    // No conflicting demand: rest on green, except to give waiting pedestrians their window.
    if (nx < 0) { if (g >= gmax(rb, c.cur) && mine.some(a => pedWait(a) > 0)) nx = (c.cur + 1) % n; else return; }
    let occ = 0; for (const o of rb.veh) occ += o.len + 2;
    const end = g >= gmax(rb, c.cur) + (busHere ? 10 : 0) ||
      (g >= GMIN && (busNx >= 0 && !busHere || occ > C || (t - c.seen > GAP && !busHere)));
    if (end) { c.clr = t; c.next = nx; }
  }

  function sig(a: Arm): Signal | null {
    if (a.rb.mode !== 'signal') return null;
    const c = a.rb.ctl;
    if (c.on) {
      const ped = !!a.xn && t < a.xn.pedOpen;
      if (grp(a) !== c.cur) return {entry: 'r', ring: false, ped};
      if (c.clr < 0) return {entry: 'g', ring: true, ped};
      const e = t - c.clr;
      return {entry: e < 2 ? 'a' : 'r', ring: e < 3, ped};
    }
    const T = P.cycle;
    let st: number, dur: number;
    if (P.plan === 'seq') { st = a.f0 * T; dur = a.fd * T; } else { const dA = T * 0.55; st = a.g ? dA : 0; dur = a.g ? T - dA : dA; }
    const tt = mod(t - st, T);
    return {entry: tt < dur - 4 ? 'g' : tt < dur - 2 ? 'a' : 'r', ring: tt < dur - 1, ped: tt >= dur && tt < dur + 8};
  }
  /** Lights at a crossing. Near the ring: red for traffic during the arm's pedestrian window. Mid-block: a push button
   *  calls amber (3 s), all-red (1 s), walk (8 s), clearance (3 s), after at least MIDG s of vehicle green. */
  function crossing(x: Crossing): void {
    if (x.arm.rb.mode !== 'signal') { x.car = ''; x.walk = false; x.ph = 0; return; }
    if (!x.mid) { const s = x.arm.sg!; x.walk = s.ped; x.car = s.ped ? 'r' : 'g'; return; }
    const e = t - x.ph0, MIDG = P.ctrl === 'fixed' ? Math.max(20, P.cycle - 15) : 20;
    const go = (p: number) => { x.ph = p; x.ph0 = t; };
    if (x.ph === 0 ? x.pedWait > 0 && e >= MIDG : e >= [0, 3, 1, 8, 3][x.ph]) go((x.ph + 1) % 5);
    x.car = x.ph === 0 ? 'g' : x.ph === 1 ? 'a' : 'r'; x.walk = x.ph === 3;
  }
  function stopBlocked(st: Stop): boolean {
    if (st.side === 'in') { const s = st.arm.sg; return !!s && s.entry !== 'g'; }
    const x = st.x!;
    return x.car ? x.car !== 'g' : t < x.pedUntil;
  }
  function pickDest(a: Arm): Arm {
    let tot = 0; for (const s of sinks) if (s !== a) tot += s.out;
    let r = rng() * tot;
    for (const s of sinks) { if (s === a) continue; r -= s.out; if (r <= 0) return s; }
    return sinks[0];
  }
  function exitFor(rb: Roundabout, dest: Arm): Arm {
    return dest.rb === rb ? dest : (dest.rb.idx > rb.idx ? rb.east! : rb.west!);
  }
  /** The lane a vehicle for `dest` needs on approach lane `l`: 0 (right) to turn right or for the bypass, 1 (left) to
   *  turn left (more than 260° round the ring), -1 = either (straight on). One-lane approaches: their lane. */
  function want(dest: Arm, l: Lane): number {
    const a = l.endArm!; if (!l.sib) return l.k;
    const ex = exitFor(a.rb, dest), turn = mod(ex.sExit - a.sEntry, C) / C * 360;
    if (a.inLane.slip && ex === a.inLane.slip.to) return 0;
    return turn < 100 ? 0 : turn > 260 ? 1 : -1;
  }
  /** The exit lane a vehicle in ring lane `ri` takes at `ex`: outer to the right lane, inner to the left one if there is one. */
  const exitLane = (ex: Arm, ri: number) => ex.outL[Math.min(ri, ex.outL.length - 1)];
  /** May a vehicle of length `len` enter ring lane `k` from `a` now? Its body is laid along the ring upstream of the entry.
   *  The outer lane yields to the outer lane; the inner lane crosses the outer one, so it yields to both. */
  function canEnter(a: Arm, len: number, ex: Arm, k: number): boolean {
    const rb = a.rb, strict = !(a.sg && a.sg.ring);
    let occ = 6.5; for (const o of rb.veh) occ += o.len + 2;
    if (occ > 2 * C * (rb.mode === 'signal' ? 0.6 : 0.85)) return false;
    // Keep clear: do not enter towards a link that has no room for this vehicle and the ring vehicles already
    // heading there. Without it two rings on a short link can each fill with traffic for the other and lock for good.
    if (ex.link >= 0) {
      const ol = exitLane(ex, k), tl = ol.veh[ol.veh.length - 1];
      if (tl && tl.v < 2) {
        let need = len + 2; for (const o of rb.veh) if (o.exit === ex && exitLane(ex, o.ri) === ol) need += o.len + 2;
        if (tl.pos - tl.len < need) return false;
      }
    }
    for (const o of rb.veh) {
      const ri = o.both > t ? k : o.ri;
      if (ri !== k && !(k === 1 && ri === 0)) continue;
      const d = mod(o.s - a.sEntry, C);
      if (ri === k ? d - o.len < 2.5 : d - o.len < 0.5) return false;
      const du = C - d;
      if (ri === k && o.exit !== a && du < len + 0.5) return false;
      if (strict) { if (o.exit !== a && du < 4 + o.v * 1.9) return false; }
      else if (du < 0.3 || (o.v > 2 && du < 3 + o.v)) return false;
    }
    return true;
  }
  /** Move `v` from `l` to the other lane of its carriageway if the gap there allows (`forced`: squeezing in). */
  function change(v: Vehicle, l: Lane, forced: boolean): boolean {
    const tl = l.sib!, p = v.pos * tl.L / l.L;
    if (p > tl.L - 3) return false;
    let k = tl.veh.findIndex(o => o.pos < p); if (k < 0) k = tl.veh.length;
    const ld = k > 0 ? tl.veh[k - 1] : null, fl = k < tl.veh.length ? tl.veh[k] : null, g0 = forced ? 0.5 : 1.5;
    if (ld && ld.pos - ld.len - p < g0) return false;
    if (fl && p - v.len - fl.pos < g0 + fl.v * (forced ? 0.3 : 0.6)) return false;
    l.veh.splice(l.veh.indexOf(v), 1); tl.veh.splice(k, 0, v); v.lane = tl; v.pos = p;
    return true;
  }
  /** May a vehicle leaving a bypass join `m.lane` at `m.pos` now? */
  function canMerge(m: {lane: Lane; pos: number}, v: Vehicle): boolean {
    for (const o of m.lane.veh) {
      if (o.pos >= m.pos) { if (o.pos - o.len < m.pos + 1) return false; }
      else if (m.pos - v.len - o.pos < 2 + o.v * 1.2) return false;
    }
    return true;
  }
  const ERRD = 30, ERRW = 10, XT = 3;
  // Intelligent Driver Model.
  const AM = 1.8, BM = 2.5, TH = 1.1, SQ = 2 * Math.sqrt(AM * BM);
  function term(v: number, gap: number, dv: number, s0: number): number {
    const ss = s0 + Math.max(0, v * TH + v * dv / SQ); const r = ss / Math.max(gap, 0.1); return r * r;
  }
  function advance(v: Vehicle, v0: number, inter: number, hard: number): number {
    let acc = AM * (1 - Math.pow(v.v / v0, 4) - inter); if (acc < -8) acc = -8;
    v.v = Math.max(0, v.v + acc * DT);
    let ds = v.v * DT;
    if (ds > hard - 0.3) { ds = Math.max(0, hard - 0.3); v.v = Math.min(v.v, ds / DT); }
    return ds;
  }

  function step(): void {
    t += DT; n++;
    for (const rb of rbs) control(rb);
    for (const a of arms) a.sg = sig(a);
    for (const x of crossings) {
      crossing(x);
      if (rng() < P.ped / 3600 * DT) {
        if (x.car) x.pedWait++;
        else { x.pedUntil = t + 6.5; x.peds.push({t0: t, dir: rng() < .5 ? 1 : -1}); }
      }
      if (x.walk && x.pedWait > 0) {
        for (let k = 0; k < Math.min(x.pedWait, 6); k++) x.peds.push({t0: t + k * 0.25, dir: k % 2 ? 1 : -1});
        x.pedWait = 0;
      }
      while (x.peds.length && x.peds[0].t0 < t - 7.5) x.peds.shift();
    }
    for (const a of arms) {
      if (a.link < 0 && a.flow) {
        if (rng() < a.flow * P.demand / 3600 * DT) { const dest = pickDest(a); a.backlog.push({t, dest, bus: rng() < 0.035, err: rng() < (P.err ?? 0), agg: rng() < (P.agg ?? 0)}); }
        if (a.backlog.length) {
          // Straight on: the lane with fewer vehicles. A share `P.err` of drivers who need one lane take the other.
          const b = a.backlog[0], w = want(b.dest, a.inLane), wrong = b.err && w >= 0 && !!a.inLane.sib;
          const l = a.inL[w >= 0 ? (wrong ? 1 - w : w) : a.inL[1].veh.length < a.inL[0].veh.length ? 1 : 0], tl = l.veh[l.veh.length - 1];
          if (!tl || tl.pos - tl.len > 7) {
            a.backlog.shift();
            l.veh.push({pos: 0, v: tl ? Math.min(11, tl.v + 2) : 11, len: b.bus ? 17 : 4.5, bus: b.bus, t0: b.t, dest: b.dest, lane: l, rb: null, s: 0, exit: null, step: n,
              ri: 0, err: wrong ? (b.agg ? 2 : 1) : 0, wait: -1, rw: -1, hs: 0, agg: b.agg, both: -1});
          }
        }
      }
    }
    for (const rb of rbs) {
      for (const v of rb.veh.slice()) {
        if (v.step === n) continue; v.step = n;
        const ex = v.exit!, dEx = mod(ex.sExit - v.s, C);
        let inter = 0, hard = Infinity;
        // Entered in the wrong lane: cut across to the other ring lane at the first gap. A driver in the outer lane who
        // needs the inner one stops before the next exit to wait for it, holding up the outer lane, for up to ERRW s.
        if (v.rw >= 0 && v.agg) {
          // Aggressive: no early change. It forces across at the last moment, straddling both lanes for XT s, and whoever
          // is behind in either lane has to stop: from the inner lane in the last 8 m before its exit (not giving way),
          // from the outer lane just before the first exit after its entry.
          const dh = mod(v.hs - 1 - v.s, C);
          if (v.ri === 1 ? dEx < 8 : dh < 3 && dh < dEx) { v.ri = v.rw; v.rw = -1; v.both = t + XT; }
          else if (v.ri === 0 && dh >= dEx) v.rw = -1;
        } else if (v.rw >= 0) {
          let ok = true;
          for (const o of rb.veh) {
            if (o.ri !== v.rw) continue;
            if (mod(o.s - v.s, C) - o.len < 1 || mod(v.s - o.s, C) - v.len < 1 + o.v * 0.5) { ok = false; break; }
          }
          if (ok) { v.ri = v.rw; v.rw = -1; v.wait = -1; }
          else if (v.ri === 0) {
            const dh = mod(v.hs - 1 - v.s, C);
            if (dh < dEx) {
              if (v.v < 0.5 && dh < 2) { if (v.wait < 0) v.wait = t; else if (t - v.wait > ERRW) v.rw = -1; }
              if (v.rw >= 0) { inter = Math.max(inter, term(v.v, dh, v.v, 0.3)); hard = Math.min(hard, dh + 0.3); }
            } else v.rw = -1;
          }
        }
        for (const o of rb.veh) {
          if (o === v || (o.ri !== v.ri && !(o.both > t))) continue;
          const gap = mod(o.s - v.s, C) - o.len;
          if (gap < dEx) { inter = Math.max(inter, term(v.v, gap, v.v - o.v, 2)); hard = Math.min(hard, gap); }
        }
        // Leaving from the inner lane crosses the outer one: give way to outer-lane traffic passing (or taking the same
        // single exit lane) at this exit.
        if (v.ri === 1 && dEx < 15) {
          for (const o of rb.veh) {
            if ((o.ri !== 0 && !(o.both > t)) || o === v || (o.exit === ex && ex.outL.length > 1)) continue;
            if (mod(ex.sExit - o.s, C) < 3 + o.v * 1.5 || mod(o.s - ex.sExit, C) < o.len + 0.5) {
              inter = Math.max(inter, term(v.v, dEx, v.v, 0.6)); hard = Math.min(hard, dEx); break;
            }
          }
        }
        const ol = exitLane(ex, v.ri), tail = ol.veh[ol.veh.length - 1];
        if (tail) { const gap = dEx + tail.pos - tail.len; inter = Math.max(inter, term(v.v, gap, v.v - tail.v, 2)); hard = Math.min(hard, gap); }
        for (const st of ol.stops) if (stopBlocked(st)) inter = Math.max(inter, term(v.v, dEx + st.pos, v.v, 0.6));
        for (const a of rb.arms) {
          // Ring stop lines; a vehicle leaving at that arm has turned off before it.
          if (a !== ex && a.sg && a.sg.ring) { const d = mod(a.sStop - v.s, C); if (d < dEx) inter = Math.max(inter, term(v.v, d, v.v, 0.6)); }
          if (a !== ex) {
            // Exit spillback: a vehicle on another exit lane whose tail is still in this ring lane blocks it.
            for (const xl of a.outL) {
            const tl = xl.veh[xl.veh.length - 1];
            if (tl && tl.ri === v.ri) {
              const over = tl.len - tl.pos;
              if (over > 0) {
                const dx = mod(a.sExit - v.s, C);
                if (dx < dEx) { const gap = dx - over; inter = Math.max(inter, term(v.v, gap, v.v - tl.v, 2)); hard = Math.min(hard, gap); }
              }
            }
            }
          }
        }
        const ds = advance(v, v.both > t ? 4 : 7.5, inter, hard);
        if (ds >= dEx) {
          rb.veh.splice(rb.veh.indexOf(v), 1); v.rb = null; v.lane = ol; v.pos = ds - dEx; ol.veh.push(v);
          // Onto a link: a share `P.err` of drivers do not change lanes early for the next ring.
          if (rng() < (P.err ?? 0) && ol.endArm && ol.sib) v.err = v.agg ? 2 : 1;
        }
        else v.s = mod(v.s + ds, C);
      }
    }
    for (const l of lanes) {
      const arr = l.veh.slice();
      for (let i = 0; i < arr.length; i++) {
        const v = arr[i];
        if (v.step === n) continue; v.step = n;
        // Lane change towards the lane needed at the ring ahead, squeezing in over the last 40 m. A driver who has not
        // made it by the stop line stays in the wrong lane (from the inner ring lane it can still leave anywhere).
        // A driver with a lane-choice error (`err` 1) only notices ERRD m before the stop line, then stops there for a gap,
        // holding up its lane, and gives up after ERRW s.
        const wl = l.endArm && l.sib ? want(v.dest, l) : -1;
        let hold = -1;
        if (wl >= 0 && wl !== l.k && v.pos < l.L - ZD) {
          if (v.err !== 1) { if (v.err === 0 && change(v, l, v.pos > l.L - ZD - 40)) continue; }
          else if (l.L - ZD - v.pos < ERRD) {
            if (change(v, l, true)) { v.err = 0; v.wait = -1; continue; }
            if (v.v < 0.5 && l.L - ZD - v.pos < 6) { if (v.wait < 0) v.wait = t; else if (t - v.wait > ERRW) v.err = 2; }
            if (v.err === 1) hold = l.L - ZD - 3;
          }
        }
        // Bound for this lane's bypass and not yet at its start: only what lies before the split matters.
        const slip = l.slip && v.pos < l.slip.at && exitFor(l.endArm!.rb, v.dest) === l.slip.to ? l.slip : null;
        let inter = 0, hard = Infinity;
        const ix = l.veh.indexOf(v);
        if (ix > 0) {
          const ld = l.veh[ix - 1];
          if (!(slip && ld.pos - ld.len > slip.at)) { const gap = ld.pos - ld.len - v.pos; inter = term(v.v, gap, v.v - ld.v, 2); hard = gap; }
        }
        for (const st of l.stops) if (st.pos > v.pos - 0.2 && !(slip && st.pos > slip.at) && stopBlocked(st)) inter = Math.max(inter, term(v.v, st.pos - v.pos, v.v, 0.6));
        if (hold > v.pos - 0.2) { inter = Math.max(inter, term(v.v, hold - v.pos, v.v, 0.5)); hard = Math.min(hard, hold - v.pos + 0.3); }
        const d = l.L - v.pos;
        let enter = false, v0 = l.merge ? 8 : 12.5;
        if (l.endArm) {
          v0 = 7.5 + 5 * Math.min(1, Math.max(0, (d - 10) / 50));
          if (slip) v0 = 12.5;
          else if (l.veh[0] === v && d < 45) {
            enter = canEnter(l.endArm, v.len, exitFor(l.endArm.rb, v.dest), l.k);
            if (!enter) { inter = Math.max(inter, term(v.v, d, v.v, 0.8)); hard = Math.min(hard, d + 0.25); }
          } else if (l.veh[0] !== v) hard = Math.min(hard, d + 0.25);
        } else if (l.merge && l.veh[0] === v && d < 30) {
          enter = canMerge(l.merge, v);
          if (!enter) { inter = Math.max(inter, term(v.v, d, v.v, 0.8)); hard = Math.min(hard, d + 0.25); }
        }
        v.pos += advance(v, v0, inter, hard);
        if (slip && v.pos >= slip.at) {
          l.veh.splice(l.veh.indexOf(v), 1); v.lane = slip.lane; v.pos -= slip.at; slip.lane.veh.push(v);
        } else if (v.pos >= l.L) {
          if (l.endArm) {
            if (enter && l.veh[0] === v) {
              l.veh.shift();
              const a = l.endArm, rb = a.rb;
              v.lane = null; v.rb = rb; v.ri = l.k; v.err = 0; v.wait = -1;
              v.rw = wl >= 0 && wl !== l.k ? wl : -1;
              v.hs = rb.arms.reduce((m, e) => Math.min(m, mod(e.sExit - a.sEntry, C)), C) + a.sEntry;
              v.s = mod(a.sEntry + v.pos - l.L, C); v.exit = exitFor(rb, v.dest); rb.veh.push(v);
            } else v.pos = l.L - 0.05;
          } else if (l.merge) {
            if (enter && l.veh[0] === v) {
              l.veh.shift();
              const m = l.merge, k = m.lane.veh.findIndex(o => o.pos < m.pos);
              v.lane = m.lane; v.pos = m.pos; m.lane.veh.splice(k < 0 ? m.lane.veh.length : k, 0, v);
            } else v.pos = l.L - 0.05;
          } else { l.veh.splice(l.veh.indexOf(v), 1); v.lane = null; done.push({t, tt: t - v.t0}); }
        }
      }
    }
  }

  function stats(): Stats {
    while (done.length && done[0].t < t - 300) done.shift();
    let sum = 0; for (const d of done) sum += d.tt;
    let stopped = 0, backlog = 0, total = 0;
    const per: RbStats[] = [];
    for (const rb of rbs) {
      let q = 0, wn = 0, wname = '';
      for (const a of rb.arms) {
        let c = a.backlog.length; backlog += a.backlog.length;
        for (const l of [...a.inL, ...(a.inLane.slip ? [a.inLane.slip.lane] : [])]) for (const v of l.veh) { total++; if (v.v < 1) { c++; stopped++; } }
        if (a.link < 0) for (const l of a.outL) for (const v of l.veh) { total++; if (v.v < 1) stopped++; }
        q += c;
        if (c > wn) { wn = c; wname = a.name || a.inLane.fromArm!.name || ''; }
      }
      let rs = 0; for (const v of rb.veh) { total++; if (v.v < 1) { stopped++; rs++; } }
      const green = rb.mode === 'signal' ? rb.arms.filter(a => a.sg && a.sg.entry === 'g').map(a => a.name || a.inLane.fromArm!.name || '').join(' + ') : '';
      per.push({queued: q, worst: wname, worstN: wn, ring: rb.veh.length, ringStopped: rs, green});
    }
    return {t, trip: done.length ? sum / done.length : 0, flow: done.length / Math.min(300, Math.max(t, 1)) * 3600, stopped, backlog, total, per};
  }

  return {rbs, lanes, arms, crossings, step, stats, get t() { return t; }, K: {RR, LW, C, ZD, DT, M}};
}
