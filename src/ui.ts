// Canvas rendering, controls and readouts. Colours come from CSS tokens on :root.
import {along, createSim, offset, type Ctrl, type Lane, type Light, type Mode, type Params, type Plan, type Pt, type Sim, type Vehicle} from './sim';

const COLOR_KEYS = ['ground', 'road', 'mark', 'island', 'car', 'stop', 'slow', 'go', 'ped', 'bus', 'wrong', 'ink', 'muted', 'line', 'accent', 'surface', 'lampoff', 'label', 'labelink', 'title'] as const;
type ColorKey = typeof COLOR_KEYS[number];

function $<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
}

export function start(): void {
  const P: Params = {demand: 1, cycle: 70, ped: 120, plan: 'pair', ctrl: 'adaptive', err: 0, agg: 0};
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let sim: Sim, speed = 2, paused = reduce, modes: Mode[] = ['classic', 'signal'];
  let hist: {t: number; v: number}[] = [], marks: number[] = [], lastHist = 0;
  const WARM = 240, BASE = 9 * 3600 + 56 * 60;
  function build(): void {
    sim = createSim(P);
    sim.rbs.forEach((r, i) => r.mode = modes[i]);
    for (let i = 0; i < WARM * 10; i++) sim.step();
    hist = []; marks = []; lastHist = sim.t;
  }
  build();
  const K = sim!.K, RR = K.RR, LW = K.LW, M = K.M;
  // The map frame is the city's Vissim image: 1920 × 1080 px at M m/px.
  const FW = 1920 * M, FH = 1080 * M;
  /** Radius of ring lane `ri` (0 outer, 1 inner); positions `s` are measured on the centreline. */
  const ringR = (ri: number) => RR + (ri ? -LW / 2 : LW / 2);
  const cv = $<HTMLCanvasElement>('map'), ctx = cv.getContext('2d')!, sp = $<HTMLCanvasElement>('spark'), sx = sp.getContext('2d')!;
  const col = {} as Record<ColorKey, string>;
  let sc = 1, dpr = 1, W = 0, H = 0;
  // Roads in the model with no simulated traffic: the side street joining Str. Andrei Șaguna at its first crossing.
  const STUBS: Pt[][] = [[[352, 573], [372, 575], [388, 590], [396, 615]]].map(q => q.map(([x, y]) => [x * M, y * M] as Pt));

  function cols(): void {
    const cs = getComputedStyle(document.documentElement);
    for (const k of COLOR_KEYS) col[k] = cs.getPropertyValue('--' + k).trim();
  }
  function size(): void {
    dpr = window.devicePixelRatio || 1;
    W = Math.max(cv.parentElement!.clientWidth, 820); sc = W / FW; H = Math.round(FH * sc);
    cv.style.height = H + 'px'; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const r = sp.getBoundingClientRect(); sp.width = Math.round(r.width * dpr); sp.height = Math.round(r.height * dpr);
  }
  function world(): void { ctx.setTransform(dpr * sc, 0, 0, dpr * sc, 0, 0); }
  function poly(pts: Pt[]): void { ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); }
  /** Carriageway centreline, from its rightmost lane. */
  const carriage = (l: Lane) => offset(l.pts, -(l.nl - 1) * LW / 2);
  /** Bar across lane `l` at `pos`, Vissim style: the stop line in the colour of its light. */
  function bar(l: Lane, pos: number, c: string): void {
    const p = along(l.pts, l.cum, drawn(l, pos)), nx = -p.dy, ny = p.dx, r = LW / 2 - 0.15, lft = r;
    ctx.strokeStyle = c; ctx.lineWidth = Math.max(1.1, 2 / sc); ctx.beginPath();
    ctx.moveTo(p.x + nx * r, p.y + ny * r); ctx.lineTo(p.x - nx * lft, p.y - ny * lft); ctx.stroke();
  }
  /** Drawn arc length for simulated position `p`: links longer than drawn are compressed in the middle only, the last
   *  END metres at each end keep true scale so queues sit at the drawn stop lines. */
  function drawn(l: Lane, p: number): number {
    const Ld = l.cum[l.cum.length - 1], END = 20;
    return l.L <= Ld + 0.01 ? p : p < END ? p : p > l.L - END ? Ld - (l.L - p) : END + (p - END) * (Ld - 2 * END) / (l.L - 2 * END);
  }
  /** A label box like the model's: white text on a dark plate, top-left at world (wx, wy). */
  function plate(s: string, wx: number, wy: number, extra = ''): void {
    const fs = Math.max(11, Math.min(22, 22 * W / 1920)), pad = fs * 0.45;
    ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = `400 ${fs}px Barlow, sans-serif`; ctx.textBaseline = 'middle';
    const w1 = ctx.measureText(s).width, w2 = extra ? ctx.measureText(' ' + extra).width : 0, X = wx * sc, Y = wy * sc, h = fs * 1.75;
    ctx.fillStyle = col.label; ctx.fillRect(X, Y, w1 + w2 + 2 * pad, h);
    ctx.fillStyle = col.labelink; ctx.fillText(s, X + pad, Y + h / 2);
    if (extra) { ctx.font = `600 ${fs}px Barlow, sans-serif`; ctx.fillStyle = col.stop; ctx.fillText(' ' + extra, X + pad + w1, Y + h / 2); }
    ctx.restore();
  }

  function draw(): void {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = col.ground; ctx.fillRect(0, 0, cv.width, cv.height); world();
    const blink = Math.floor(performance.now() / 500) % 2 === 0, amber = blink ? col.slow : col.lampoff;
    ctx.lineCap = 'butt'; ctx.lineJoin = 'round';
    // Road surface: every carriageway, then the rings over their ends.
    ctx.strokeStyle = col.road;
    for (const l of sim.lanes) if (l.k === 0) { ctx.lineWidth = l.nl * LW + 0.6; poly(carriage(l)); ctx.stroke(); }
    ctx.lineWidth = LW + 0.6; for (const s of STUBS) { poly(s); ctx.stroke(); }
    ctx.strokeStyle = col.mark; ctx.lineWidth = 0.25; ctx.setLineDash([3, 4.5]);
    for (const l of sim.lanes) if (l.nl > 1 && l.k === 0) { poly(offset(l.pts, -LW / 2)); ctx.stroke(); }
    ctx.setLineDash([]);
    for (const rb of sim.rbs) {
      ctx.beginPath(); ctx.arc(rb.x, rb.y, RR + 5.2, 0, 6.2832); ctx.fillStyle = col.road; ctx.fill();
      ctx.strokeStyle = col.mark; ctx.lineWidth = 0.25; ctx.setLineDash([3, 4.5]); ctx.beginPath(); ctx.arc(rb.x, rb.y, RR, 0, 6.2832); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(rb.x, rb.y, RR - 5.2, 0, 6.2832); ctx.fillStyle = col.island; ctx.fill();
    }
    // Zebras: stripes across the road, kerb to kerb.
    ctx.strokeStyle = col.mark; ctx.lineWidth = 3; ctx.setLineDash([0.5, 0.6]);
    for (const x of sim.crossings) { ctx.beginPath(); ctx.moveTo(x.ax, x.ay); ctx.lineTo(x.bx, x.by); ctx.stroke(); }
    ctx.setLineDash([]);
    // Signals where the model has them, drawn as the model draws them: each stop line in the colour of its light
    // (entry, ring, both sides of each crossing) and the pedestrian lights as blocks at the ends of the crossing.
    // Give-way: the vehicle lights flash amber, the pedestrian lights are dark.
    const light = (c: Light) => c === 'g' ? col.go : c === 'a' ? col.slow : c === 'r' ? col.stop : amber;
    for (const a of sim.arms) {
      const s = a.sg;
      for (const l of [...a.inL, ...(a.inLane.slip ? [a.inLane.slip.lane] : [])]) for (const st of l.stops) if (st.side === 'in') bar(l, st.pos, light(s ? s.entry : ''));
      const th = -a.sStop / RR, cs = Math.cos(th), sn = Math.sin(th), rb = a.rb;
      ctx.strokeStyle = s ? (s.ring ? col.stop : col.go) : amber; ctx.lineWidth = Math.max(1.1, 2 / sc);
      ctx.beginPath(); ctx.moveTo(rb.x + (RR - 5) * cs, rb.y + (RR - 5) * sn); ctx.lineTo(rb.x + (RR + 5) * cs, rb.y + (RR + 5) * sn); ctx.stroke();
    }
    for (const x of sim.crossings) {
      for (const st of x.stops) bar(st.lane, st.pos, light(x.car));
      const L = Math.hypot(x.bx - x.ax, x.by - x.ay), ux = (x.bx - x.ax) / L, uy = (x.by - x.ay) / L;
      ctx.fillStyle = x.car ? (x.walk ? col.go : col.stop) : col.lampoff;
      for (const [ex, ey, k] of [[x.ax, x.ay, -1], [x.bx, x.by, 1]]) {
        ctx.save(); ctx.translate(ex + ux * k * 1.6, ey + uy * k * 1.6); ctx.rotate(Math.atan2(uy, ux)); ctx.fillRect(-1.6, -1.8, 3.2, 3.6); ctx.restore();
      }
      for (const p of x.peds) {
        const f = (sim.t - p.t0) / 6.5; if (f < 0 || f > 1) continue;
        const g = p.dir > 0 ? f : 1 - f;
        dot(x.ax + (x.bx - x.ax) * g, x.ay + (x.by - x.ay) * g, 0.8, col.ped);
      }
      if (x.pedWait > 0) dot(x.ax - ux * 1.6, x.ay - uy * 1.6, 0.8, col.ped);
    }
    // Vehicles: a body 1.9 m wide (buses 2.5 m) along the lane, or along the ring.
    // Drivers in the wrong lane (still sorting it out) stand out in their own colour.
    const vc = (v: Vehicle) => v.err === 1 || v.rw >= 0 || v.both > sim.t ? col.wrong : v.bus ? col.bus : v.v < 0.5 ? col.stop : v.v < 4 ? col.slow : col.car;
    const vw = (v: Vehicle) => Math.max(v.bus ? 2.5 : 1.9, 2.2 / sc);
    for (const l of sim.lanes) for (const v of l.veh) {
      ctx.strokeStyle = vc(v); ctx.lineWidth = vw(v);
      const f = drawn(l, v.pos), r = drawn(l, Math.max(0, v.pos - v.len));
      ctx.beginPath(); const a = along(l.pts, l.cum, f); ctx.moveTo(a.x, a.y);
      for (let i = 1; i < l.pts.length - 1; i++) if (l.cum[i] < f && l.cum[i] > r) ctx.lineTo(l.pts[i][0], l.pts[i][1]);
      const b = along(l.pts, l.cum, r); ctx.lineTo(b.x, b.y); ctx.stroke();
      if (v.pos < v.len && l.fromArm) {
        // Tail still in the ring: draw it along the ring arc.
        const fa = l.fromArm, s1 = fa.sExit, s0 = s1 - (v.len - v.pos);
        ctx.beginPath(); ctx.arc(fa.rb.x, fa.rb.y, ringR(v.ri), -s1 / RR, -s0 / RR); ctx.stroke();
      }
    }
    for (const rb of sim.rbs) for (const v of rb.veh) {
      ctx.strokeStyle = vc(v); ctx.lineWidth = vw(v);
      // A driver cutting across straddles the two ring lanes.
      ctx.beginPath(); ctx.arc(rb.x, rb.y, v.both > sim.t ? RR : ringR(v.ri), -v.s / RR, -(v.s - v.len) / RR); ctx.stroke();
    }
    // Labels where the model puts them; "+N" = vehicles queued beyond the edge of the map.
    for (const a of sim.arms) if (a.lab && a.name) plate(a.name + (a.link >= 0 ? ` · ${a.len} m` : ''), a.lab[0], a.lab[1], a.backlog.length ? '+' + a.backlog.length : '');
    // Title bar, as on the model's frame: what each roundabout is running.
    const fs = Math.max(13, Math.min(28, 28 * W / 1920));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 0.72; ctx.fillStyle = col.title; ctx.fillRect(24 * M * sc, 18 * M * sc, 1872 * M * sc, 62 * M * sc); ctx.globalAlpha = 1;
    ctx.font = `700 ${fs}px Barlow, sans-serif`; ctx.textBaseline = 'middle'; ctx.fillStyle = col.labelink;
    const what = (i: number) => sim.rbs[i].mode === 'signal' ? (P.ctrl === 'adaptive' ? 'adaptive signals' : 'fixed-time signals') : 'flashing amber';
    ctx.fillText(`Ramada: ${what(0)} · Milea: ${what(1)}`, 34 * M * sc, 49 * M * sc);
  }
  function dot(x: number, y: number, r: number, c: string): void {
    ctx.beginPath(); ctx.arc(x, y, Math.max(r, 2.2 / sc), 0, 6.2832); ctx.fillStyle = c; ctx.fill();
  }

  function spark(): void {
    const w = sp.width, h = sp.height, pl = 34 * dpr, pb = 6 * dpr, pt = 14 * dpr, pr = 44 * dpr;
    sx.clearRect(0, 0, w, h);
    const N = 240, mx = Math.max(20, ...hist.map(p => p.v)), top = Math.ceil(mx / 20) * 20;
    const X = (i: number) => pl + (w - pl - pr) * (i / (N - 1)), Y = (v: number) => h - pb - (h - pb - pt) * (v / top);
    sx.font = `${11 * dpr}px Barlow, sans-serif`; sx.fillStyle = col.muted; sx.textAlign = 'right';
    sx.fillText(String(top), pl - 6 * dpr, pt + 4 * dpr); sx.fillText('0', pl - 6 * dpr, h - pb);
    sx.strokeStyle = col.line; sx.lineWidth = dpr; sx.beginPath();
    sx.moveTo(pl, Y(0)); sx.lineTo(w - pr, Y(0)); sx.moveTo(pl, Y(top)); sx.lineTo(w - pr, Y(top)); sx.stroke();
    if (!hist.length) return;
    const off = N - hist.length;
    sx.setLineDash([3 * dpr, 3 * dpr]); sx.strokeStyle = col.muted;
    for (const m of marks) {
      const i = hist.findIndex(p => p.t >= m); if (i < 0) continue;
      sx.beginPath(); sx.moveTo(X(i + off), pt); sx.lineTo(X(i + off), h - pb); sx.stroke();
    }
    sx.setLineDash([]);
    sx.beginPath(); hist.forEach((p, i) => { const x = X(i + off), y = Y(p.v); if (i) sx.lineTo(x, y); else sx.moveTo(x, y); });
    sx.strokeStyle = col.accent; sx.lineWidth = 2 * dpr; sx.stroke();
    sx.lineTo(X(N - 1), Y(0)); sx.lineTo(X(off), Y(0)); sx.closePath();
    sx.globalAlpha = 0.14; sx.fillStyle = col.accent; sx.fill(); sx.globalAlpha = 1;
    const last = hist[hist.length - 1];
    sx.beginPath(); sx.arc(X(N - 1), Y(last.v), 3.5 * dpr, 0, 6.2832); sx.fillStyle = col.accent; sx.fill();
    sx.textAlign = 'left'; sx.fillStyle = col.ink; sx.font = `600 ${13 * dpr}px Barlow, sans-serif`;
    sx.fillText(String(last.v), X(N - 1) + 8 * dpr, Y(last.v) + 4 * dpr);
  }

  const cards = $('cards');
  sim!.rbs.forEach((rb, i) => {
    const d = document.createElement('div'); d.className = 'card';
    d.innerHTML = `<h2>${rb.name}</h2><div class="seg" role="group" aria-label="Control at ${rb.name}"><button type="button" id="m${i}c">Give-way</button><button type="button" id="m${i}s">Signals</button></div>
  <span class="pill" id="p${i}"></span><dl><dt>Stopped on its approaches</dt><dd id="q${i}">0</dd><dt>Longest queue</dt><dd id="w${i}">–</dd><dt>Vehicles in the ring</dt><dd id="r${i}">0</dd><dt>Green now</dt><dd id="g${i}">–</dd></dl>`;
    cards.appendChild(d);
    $('m' + i + 'c').onclick = () => setModes(modes.map((m, j) => j === i ? 'classic' : m));
    $('m' + i + 's').onclick = () => setModes(modes.map((m, j) => j === i ? 'signal' : m));
  });
  const presets: Record<string, Mode[]> = {
    'sc-before': ['classic', 'classic'],
    'sc-oct6': ['classic', 'signal'],
    'sc-full': ['signal', 'signal'],
  };
  function setModes(m: Mode[]): void { modes = m; sim.rbs.forEach((r, i) => r.mode = m[i]); marks.push(sim.t); syncUI(); }
  function syncUI(): void {
    modes.forEach((m, i) => {
      $('m' + i + 'c').setAttribute('aria-pressed', String(m === 'classic'));
      $('m' + i + 's').setAttribute('aria-pressed', String(m === 'signal'));
      const p = $('p' + i); p.textContent = m === 'signal' ? 'Signals on' : 'Flashing amber'; p.className = 'pill ' + (m === 'signal' ? 'sig' : 'amber');
    });
    for (const k in presets) $(k).setAttribute('aria-pressed', String(presets[k].join() === modes.join()));
  }
  for (const k in presets) $(k).onclick = () => setModes(presets[k].slice());
  const pause = $('pause');
  pause.onclick = () => { paused = !paused; pause.textContent = paused ? 'Play' : 'Pause'; };
  pause.textContent = paused ? 'Play' : 'Pause';
  $('reset').onclick = () => { build(); readouts(); };
  const speedEl = $<HTMLSelectElement>('speed');
  speedEl.onchange = () => speed = +speedEl.value;
  function bind(id: string, fn: (v: number) => void, fmt: (v: number) => string): void {
    const el = $<HTMLInputElement>(id), o = $(id + '-o');
    const f = () => { fn(+el.value); o.textContent = fmt(+el.value); };
    el.oninput = () => { f(); marks.push(sim.t); };
    f();
  }
  bind('demand', v => P.demand = v / 100, v => v + '%');
  bind('cycle', v => P.cycle = v, v => v + ' s');
  bind('ped', v => P.ped = v, v => v + ' / h');
  bind('err', v => P.err = v / 100, v => v + '%');
  bind('agg', v => P.agg = v / 100, v => v + '%');
  const planEl = $<HTMLSelectElement>('plan');
  planEl.onchange = () => { P.plan = planEl.value as Plan; marks.push(sim.t); };
  P.plan = planEl.value as Plan;
  const ctrlEl = $<HTMLSelectElement>('ctrl');
  ctrlEl.onchange = () => { P.ctrl = ctrlEl.value as Ctrl; marks.push(sim.t); };
  P.ctrl = ctrlEl.value as Ctrl;

  const p2 = (n: number) => String(n).padStart(2, '0');
  function readouts(): void {
    const s = sim.stats(), T = Math.floor(BASE + s.t);
    $('clock').textContent = p2(Math.floor(T / 3600) % 24) + ':' + p2(Math.floor(T / 60) % 60) + ':' + p2(T % 60);
    $('t-trip').textContent = s.trip ? Math.floor(s.trip / 60) + ':' + p2(Math.round(s.trip % 60)) : '–';
    $('t-flow').textContent = String(Math.round(s.flow / 10) * 10);
    $('t-stop').textContent = String(s.stopped); $('t-back').textContent = String(s.backlog);
    s.per.forEach((p, i) => {
      $('q' + i).textContent = String(p.queued);
      $('w' + i).textContent = p.worstN ? p.worst + ' · ' + p.worstN : '–';
      $('r' + i).textContent = String(p.ring);
      $('g' + i).textContent = modes[i] === 'signal' ? p.green || 'all red' : '–';
    });
    if (s.t - lastHist >= 5 || !hist.length) { lastHist = s.t; hist.push({t: s.t, v: s.stopped + s.backlog}); if (hist.length > 240) hist.shift(); }
    spark();
  }

  let prev = performance.now(), acc = 0, lastUI = 0, lastCol = 0;
  function frame(now: number): void {
    const dt = Math.min(0.1, (now - prev) / 1000); prev = now;
    if (now - lastCol > 1000) { cols(); lastCol = now; }
    if (!paused) {
      acc += dt * speed;
      let n = Math.min(Math.floor(acc / K.DT), 40);
      acc -= n * K.DT; if (acc > 1) acc = 0;
      while (n-- > 0) sim.step();
    }
    draw();
    if (now - lastUI > 400) { readouts(); lastUI = now; }
    requestAnimationFrame(frame);
  }
  cols(); size(); syncUI(); readouts(); draw();
  window.addEventListener('resize', () => { size(); draw(); spark(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => draw());
  requestAnimationFrame(frame);
}
