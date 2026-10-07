// Pure simulation core: no DOM, deterministic given `rng`. Loadable from node.

export type Mode = 'classic' | 'signal';
export type Plan = 'pair' | 'seq';
/** `fixed`: fixed-time plan. `adaptive`: detector-actuated greens with bus priority, like the Swarco system. */
export type Ctrl = 'fixed' | 'adaptive';

export interface Params {
  demand: number;
  cycle: number;
  ped: number;
  plan: Plan;
  ctrl: Ctrl;
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
}

export interface Stop {
  pos: number;
  arm: Arm;
  side: 'in' | 'out';
}

export interface Lane {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  L: number;
  veh: Vehicle[];
  stops: Stop[];
  endArm: Arm | null;
  fromArm: Arm | null;
  src: Arm | null;
  sink: Arm | null;
}

export interface Arm {
  rb: Roundabout;
  idx: number;
  ang: number;
  ux: number;
  uy: number;
  px: number;
  py: number;
  name: string | null;
  flow: number;
  g: number;
  link: number;
  sEntry: number;
  sExit: number;
  sStop: number;
  ex: number;
  ey: number;
  xx: number;
  xy: number;
  pedUntil: number;
  pedWait: number;
  /** Signals: the exit crossing's pedestrian window is open until this time (adaptive control). */
  pedOpen: number;
  len: number;
  peds: Ped[];
  backlog: Pending[];
  sg: Signal | null;
  inLane: Lane;
  outLane: Lane;
  inStop: Stop;
  outStop: Stop;
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
  RR: number;
  LW: number;
  DEL: number;
  C: number;
  ZD: number;
  ARM: number;
  DT: number;
}

export interface Sim {
  rbs: Roundabout[];
  lanes: Lane[];
  arms: Arm[];
  step(): void;
  stats(): Stats;
  readonly t: number;
  K: Constants;
}

interface ArmDef {
  a: number;
  name?: string;
  flow?: number;
  g?: number;
  link?: number;
  len?: number;
}

interface RbDef {
  key: string;
  name: string;
  x: number;
  y: number;
  arms: ArmDef[];
}

// Arms are listed in the order the city named them on 2 Oct 2026. Screen angles: 0 = east, 90 = south.
// Link lengths (`len`, metres) are estimates; links are drawn compressed.
const defs: RbDef[] = [
  {key: 'morilor', name: 'Alba Iulia · Morilor · Turismului', x: 0, y: 0, arms: [
    {a: 0, link: 1, name: 'Str. Andrei Șaguna', len: 900}, {a: 270, name: 'Str. Morilor', flow: 220, g: 1},
    {a: 180, name: 'Șos. Alba Iulia', flow: 520, g: 0}, {a: 95, name: 'Str. Turismului', flow: 160, g: 1}]},
  {key: 'ramada', name: 'Piața Unirii · Ramada', x: 280, y: 0, arms: [
    {a: 0, link: 2, name: 'Piața Unirii', len: 260}, {a: 270, name: 'Bd. C. Coposu', flow: 280, g: 1}, {a: 180, link: 0, len: 900},
    {a: 108, name: 'Str. Emil Cioran', flow: 300, g: 1}]},
  {key: 'milea', name: 'V. Milea · Dumbrăvii (blocul-plombă)', x: 500, y: 0, arms: [
    {a: 0, name: 'Bd. Vasile Milea', flow: 470, g: 0}, {a: 270, name: 'Str. C. Noica', flow: 120, g: 1}, {a: 180, link: 1, len: 260},
    {a: 82, name: 'Calea Dumbrăvii', flow: 420, g: 1}]},
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

export function createSim(P: Params, rng: () => number = Math.random): Sim {
  const TAU = Math.PI * 2, RR = 26, LW = 3.2, DEL = Math.asin(LW / RR), C = TAU * RR, ZD = 10, ARM = 110, DT = 0.1;
  const mod = (a: number, n: number) => ((a % n) + n) % n;
  let t = 0, n = 0;
  const lanes: Lane[] = [], done: {t: number; tt: number}[] = [];
  const rbs: Roundabout[] = defs.map((d, i) => ({key: d.key, name: d.name, x: d.x, y: d.y, idx: i, mode: 'classic', veh: [], arms: [],
    ctl: {on: false, cur: 0, next: 0, start: 0, clr: -1, seen: 0}}));
  rbs.forEach((rb, i) => {
    defs[i].arms.forEach((d, k) => {
      const ang = d.a * Math.PI / 180, ux = Math.cos(ang), uy = Math.sin(ang);
      const sEntry = mod(-(ang - DEL) * RR, C);
      // Lanes, stops and phase weights are filled in below.
      rb.arms.push({rb, idx: k, ang, ux, uy, px: uy, py: -ux, name: d.name ?? null, flow: d.flow ?? 0, g: d.g ?? 0, link: d.link ?? -1,
        sEntry, sExit: mod(-(ang + DEL) * RR, C), sStop: mod(sEntry - 6, C),
        ex: rb.x + RR * Math.cos(ang - DEL), ey: rb.y + RR * Math.sin(ang - DEL), xx: rb.x + RR * Math.cos(ang + DEL), xy: rb.y + RR * Math.sin(ang + DEL),
        pedUntil: -1, pedWait: 0, pedOpen: -1, len: d.len ?? 0, peds: [], backlog: [], sg: null, w: 0, f0: 0, fd: 0} as unknown as Arm);
    });
    rb.arms.forEach(a => { if (a.link > rb.idx) rb.east = a; if (a.link >= 0 && a.link < rb.idx) rb.west = a; });
  });
  function mk(ax: number, ay: number, bx: number, by: number): Lane {
    const l: Lane = {ax, ay, bx, by, L: Math.hypot(bx - ax, by - ay), veh: [], stops: [], endArm: null, fromArm: null, src: null, sink: null};
    lanes.push(l);
    return l;
  }
  const fd = RR * Math.cos(DEL) + ARM;
  rbs.forEach(rb => rb.arms.forEach(a => {
    if (a.link < 0) {
      a.inLane = mk(rb.x + a.ux * fd + a.px * LW, rb.y + a.uy * fd + a.py * LW, a.ex, a.ey); a.inLane.src = a;
      a.outLane = mk(a.xx, a.xy, rb.x + a.ux * fd - a.px * LW, rb.y + a.uy * fd - a.py * LW); a.outLane.sink = a;
    } else {
      const o = rbs[a.link].arms.find(b => b.link === rb.idx)!;
      const l = mk(a.xx, a.xy, o.ex, o.ey); a.outLane = l; o.inLane = l;
      // Real length; the UI draws the link compressed between the two rings.
      l.L = Math.max(l.L, a.len);
    }
  }));
  const arms: Arm[] = [];
  rbs.forEach(rb => rb.arms.forEach(a => arms.push(a)));
  arms.forEach(a => {
    a.inLane.endArm = a; a.outLane.fromArm = a;
    a.inStop = {pos: a.inLane.L - ZD, arm: a, side: 'in'}; a.inLane.stops.push(a.inStop);
    a.outStop = {pos: 5.5, arm: a, side: 'out'}; a.outLane.stops.push(a.outStop);
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
  function gmax(rb: Roundabout, gi: number): number {
    if (P.plan === 'seq') return Math.max(GMIN, rb.arms[gi].fd * P.cycle - CLR);
    return Math.max(GMIN, P.cycle * (gi ? 0.45 : 0.55) - CLR);
  }
  function near(a: Arm, d: number, bus = false): boolean {
    const l = a.inLane;
    for (const v of l.veh) if (l.L - v.pos < d && (!bus || v.bus)) return true;
    return false;
  }
  function control(rb: Roundabout): void {
    const c = rb.ctl, n = nGroups(rb);
    if (rb.mode !== 'signal' || P.ctrl !== 'adaptive') { c.on = false; return; }
    if (!c.on) { c.on = true; c.cur = 0; c.start = t; c.clr = -1; c.seen = t; }
    c.cur %= n;
    if (c.clr >= 0) {
      if (t - c.clr < CLR) return;
      for (const a of rb.arms) if (grp(a) === c.cur && a.pedWait > 0) a.pedOpen = t + 8;
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
    if (nx < 0) { if (g >= gmax(rb, c.cur) && mine.some(a => a.pedWait > 0)) nx = (c.cur + 1) % n; else return; }
    let occ = 0; for (const o of rb.veh) occ += o.len + 2;
    const end = g >= gmax(rb, c.cur) + (busHere ? 10 : 0) ||
      (g >= GMIN && (busNx >= 0 && !busHere || occ > C * 0.5 || (t - c.seen > GAP && !busHere)));
    if (end) { c.clr = t; c.next = nx; }
  }

  function sig(a: Arm): Signal | null {
    if (a.rb.mode !== 'signal') return null;
    const c = a.rb.ctl;
    if (c.on) {
      const ped = t < a.pedOpen;
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
  function stopBlocked(st: Stop): boolean {
    const a = st.arm, s = a.sg;
    if (s) return st.side === 'in' ? s.entry !== 'g' : s.ped;
    return t < a.pedUntil;
  }
  function pickDest(a: Arm): Arm {
    let tot = 0; for (const s of sinks) if (s !== a) tot += s.flow;
    let r = rng() * tot;
    for (const s of sinks) { if (s === a) continue; r -= s.flow; if (r <= 0) return s; }
    return sinks[0];
  }
  function exitFor(rb: Roundabout, dest: Arm): Arm {
    return dest.rb === rb ? dest : (dest.rb.idx > rb.idx ? rb.east! : rb.west!);
  }
  /** May a vehicle of length `len` enter the ring from `a` now? Its body is laid along the ring upstream of the entry. */
  function canEnter(a: Arm, len: number): boolean {
    const rb = a.rb, strict = !(a.sg && a.sg.ring);
    let occ = 6.5; for (const o of rb.veh) occ += o.len + 2;
    if (occ > C * (rb.mode === 'signal' ? 0.6 : 0.85)) return false;
    for (const o of rb.veh) {
      const d = mod(o.s - a.sEntry, C); if (d - o.len < 2.5) return false;
      const du = C - d;
      if (o.exit !== a && du < len + 0.5) return false;
      if (strict) { if (o.exit !== a && du < 4 + o.v * 1.9) return false; }
      else if (du < 0.3 || (o.v > 2 && du < 3 + o.v)) return false;
    }
    return true;
  }
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
    for (const a of arms) {
      a.sg = sig(a);
      if (rng() < P.ped / 3600 * DT) {
        if (a.sg) a.pedWait++;
        else { a.pedUntil = t + 6.5; a.peds.push({t0: t, dir: rng() < .5 ? 1 : -1}); }
      }
      if (a.sg && a.sg.ped && a.pedWait > 0) {
        for (let k = 0; k < Math.min(a.pedWait, 6); k++) a.peds.push({t0: t + k * 0.25, dir: k % 2 ? 1 : -1});
        a.pedWait = 0;
      }
      while (a.peds.length && a.peds[0].t0 < t - 7.5) a.peds.shift();
      if (a.link < 0) {
        if (rng() < a.flow * P.demand / 3600 * DT) a.backlog.push({t, dest: pickDest(a)});
        if (a.backlog.length) {
          const l = a.inLane, tl = l.veh[l.veh.length - 1];
          if (!tl || tl.pos - tl.len > 7) {
            const b = a.backlog.shift()!, bus = rng() < 0.035;
            l.veh.push({pos: 0, v: tl ? Math.min(11, tl.v + 2) : 11, len: bus ? 17 : 4.5, bus, t0: b.t, dest: b.dest, lane: l, rb: null, s: 0, exit: null, step: n});
          }
        }
      }
    }
    for (const rb of rbs) {
      for (const v of rb.veh.slice()) {
        if (v.step === n) continue; v.step = n;
        const ex = v.exit!, dEx = mod(ex.sExit - v.s, C);
        let inter = 0, hard = Infinity;
        for (const o of rb.veh) {
          if (o === v) continue;
          const gap = mod(o.s - v.s, C) - o.len;
          if (gap < dEx) { inter = Math.max(inter, term(v.v, gap, v.v - o.v, 2)); hard = Math.min(hard, gap); }
        }
        const ol = ex.outLane, tail = ol.veh[ol.veh.length - 1];
        if (tail) { const gap = dEx + tail.pos - tail.len; inter = Math.max(inter, term(v.v, gap, v.v - tail.v, 2)); hard = Math.min(hard, gap); }
        if (stopBlocked(ex.outStop)) inter = Math.max(inter, term(v.v, dEx + ex.outStop.pos, v.v, 0.6));
        for (const a of rb.arms) {
          if (a.sg && a.sg.ring) { const d = mod(a.sStop - v.s, C); if (d < dEx) inter = Math.max(inter, term(v.v, d, v.v, 0.6)); }
          if (a !== ex) {
            // Exit spillback: a vehicle on another exit lane whose tail is still in the ring blocks it.
            const tl = a.outLane.veh[a.outLane.veh.length - 1];
            if (tl) {
              const over = tl.len - tl.pos;
              if (over > 0) {
                const dx = mod(a.sExit - v.s, C);
                if (dx < dEx) { const gap = dx - over; inter = Math.max(inter, term(v.v, gap, v.v - tl.v, 2)); hard = Math.min(hard, gap); }
              }
            }
          }
        }
        const ds = advance(v, 7.5, inter, hard);
        if (ds >= dEx) { rb.veh.splice(rb.veh.indexOf(v), 1); v.rb = null; v.lane = ol; v.pos = ds - dEx; ol.veh.push(v); }
        else v.s = mod(v.s + ds, C);
      }
    }
    for (const l of lanes) {
      const arr = l.veh.slice();
      for (let i = 0; i < arr.length; i++) {
        const v = arr[i];
        if (v.step === n) continue; v.step = n;
        let inter = 0, hard = Infinity;
        if (i > 0) { const ld = arr[i - 1]; if (ld.lane === l) { const gap = ld.pos - ld.len - v.pos; inter = term(v.v, gap, v.v - ld.v, 2); hard = gap; } }
        for (const st of l.stops) if (st.pos > v.pos - 0.2 && stopBlocked(st)) inter = Math.max(inter, term(v.v, st.pos - v.pos, v.v, 0.6));
        const d = l.L - v.pos;
        let enter = false, v0 = 12.5;
        if (l.endArm) {
          v0 = 7.5 + 5 * Math.min(1, Math.max(0, (d - 10) / 50));
          if (l.veh[0] === v && d < 45) {
            enter = canEnter(l.endArm, v.len);
            if (!enter) { inter = Math.max(inter, term(v.v, d, v.v, 0.8)); hard = Math.min(hard, d + 0.25); }
          } else if (l.veh[0] !== v) hard = Math.min(hard, d + 0.25);
        }
        v.pos += advance(v, v0, inter, hard);
        if (v.pos >= l.L) {
          if (l.endArm) {
            if (enter && l.veh[0] === v) {
              l.veh.shift();
              const a = l.endArm, rb = a.rb;
              v.lane = null; v.rb = rb; v.s = mod(a.sEntry + v.pos - l.L, C); v.exit = exitFor(rb, v.dest); rb.veh.push(v);
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
        for (const v of a.inLane.veh) { total++; if (v.v < 1) { c++; stopped++; } }
        if (a.link < 0) for (const v of a.outLane.veh) { total++; if (v.v < 1) stopped++; }
        q += c;
        if (c > wn) { wn = c; wname = a.name || a.inLane.fromArm!.name || ''; }
      }
      let rs = 0; for (const v of rb.veh) { total++; if (v.v < 1) { stopped++; rs++; } }
      const green = rb.mode === 'signal' ? rb.arms.filter(a => a.sg && a.sg.entry === 'g').map(a => a.name || a.inLane.fromArm!.name || '').join(' + ') : '';
      per.push({queued: q, worst: wname, worstN: wn, ring: rb.veh.length, ringStopped: rs, green});
    }
    return {t, trip: done.length ? sum / done.length : 0, flow: done.length / Math.min(300, Math.max(t, 1)) * 3600, stopped, backlog, total, per};
  }

  return {rbs, lanes, arms, step, stats, get t() { return t; }, K: {RR, LW, DEL, C, ZD, ARM, DT}};
}
