// Canvas rendering, controls and readouts. Colours come from CSS tokens on :root.
import {createSim, type Ctrl, type Mode, type Params, type Plan, type Sim, type Vehicle} from './sim';

const COLOR_KEYS = ['ground', 'road', 'mark', 'island', 'car', 'stop', 'slow', 'go', 'ped', 'bus', 'ink', 'muted', 'line', 'accent', 'surface', 'head', 'lampoff'] as const;
type ColorKey = typeof COLOR_KEYS[number];

function $<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
}

export function start(): void {
  const P: Params = {demand: 1, cycle: 70, ped: 120, plan: 'pair', ctrl: 'adaptive'};
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
  const K = sim!.K, RR = K.RR, LW = K.LW, PAD = 16;
  const minX = -(RR + K.ARM + PAD), maxX = Math.max(...sim!.rbs.map(r => r.x)) + RR + K.ARM + PAD, minY = -(RR + K.ARM + PAD), maxY = RR + K.ARM + PAD;
  const cv = $<HTMLCanvasElement>('map'), ctx = cv.getContext('2d')!, sp = $<HTMLCanvasElement>('spark'), sx = sp.getContext('2d')!;
  const col = {} as Record<ColorKey, string>;
  let sc = 1, dpr = 1, W = 0, H = 0;

  function cols(): void {
    const cs = getComputedStyle(document.documentElement);
    for (const k of COLOR_KEYS) col[k] = cs.getPropertyValue('--' + k).trim();
  }
  function size(): void {
    dpr = window.devicePixelRatio || 1;
    W = Math.max(cv.parentElement!.clientWidth, 820); sc = W / (maxX - minX); H = Math.round((maxY - minY) * sc);
    cv.style.height = H + 'px'; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const r = sp.getBoundingClientRect(); sp.width = Math.round(r.width * dpr); sp.height = Math.round(r.height * dpr);
  }
  function world(): void { ctx.setTransform(dpr * sc, 0, 0, dpr * sc, -minX * sc * dpr, -minY * sc * dpr); }
  function txt(s: string, wx: number, wy: number, align: CanvasTextAlign, c: string, font?: string, dy = 0): void {
    ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = font || '500 12px Barlow, sans-serif'; ctx.textAlign = align; ctx.fillStyle = c;
    ctx.fillText(s, (wx - minX) * sc, (wy - minY) * sc + dy); ctx.restore();
  }
  /** Text along a road at angle `ang` through (wx, wy), kept upright, `off` px beside it, screen-upper side if negative. */
  function roadTxt(s: string, wx: number, wy: number, ang: number, c: string, font: string, off: number): void {
    const up = Math.cos(ang) < 0 ? ang + Math.PI : ang;
    ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.translate((wx - minX) * sc, (wy - minY) * sc); ctx.rotate(up);
    ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = off < 0 ? 'bottom' : 'top'; ctx.fillStyle = c;
    ctx.fillText(s, 0, off); ctx.restore();
  }
  function dot(x: number, y: number, r: number, c: string): void {
    ctx.beginPath(); ctx.arc(x, y, Math.max(r, 2.6 / sc), 0, 6.2832); ctx.fillStyle = c; ctx.fill();
  }

  /** A signal head drawn in screen pixels: lamps stacked from (wx, wy) along world direction (dx, dy); '' = lamp off. */
  function head(wx: number, wy: number, dx: number, dy: number, lamps: string[]): void {
    const R = 1.5, PITCH = 3.6, X = (wx - minX) * sc, Y = (wy - minY) * sc, len = lamps.length * PITCH + 1.2;
    ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.translate(X, Y); ctx.rotate(Math.atan2(dy, dx));
    ctx.fillStyle = col.head; ctx.beginPath(); ctx.roundRect(-0.6, -2.4, len, 4.8, 1.4); ctx.fill();
    lamps.forEach((c, i) => {
      ctx.beginPath(); ctx.arc(PITCH * (i + 0.5), 0, R, 0, 6.2832); ctx.fillStyle = c || col.lampoff; ctx.fill();
    });
    ctx.restore();
  }

  /** Heads on one kerb (side 1 = inbound, -1 = outbound), lamps stacked away from the road, each near its stop line
   *  at distance `u` from the ring centre, nudged outward so the housings never overlap at this zoom. */
  function kerbHeads(cx: number, cy: number, ux: number, uy: number, px: number, py: number, side: number, hs: {u: number; lamps: string[]}[]): void {
    const gap = 5.6 / sc, k = side * (LW + 2.6);
    let last = -Infinity;
    for (const h of hs.sort((p, q) => p.u - q.u)) {
      const u = Math.max(h.u, last + gap); last = u;
      head(cx + ux * u + px * k, cy + uy * u + py * k, px * side, py * side, h.lamps);
    }
  }

  function draw(): void {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = col.ground; ctx.fillRect(0, 0, cv.width, cv.height); world();
    const fd = RR + K.ARM, blink = Math.floor(performance.now() / 500) % 2 === 0;
    ctx.lineCap = 'butt';
    for (const rb of sim.rbs) for (const a of rb.arms) {
      ctx.strokeStyle = col.road; ctx.lineWidth = 2 * LW + 4; ctx.beginPath(); ctx.moveTo(rb.x + a.ux * (RR - 1), rb.y + a.uy * (RR - 1));
      const far = a.link < 0 ? fd + PAD : (Math.abs(sim.rbs[a.link].x - rb.x) / 2 + 1);
      ctx.lineTo(rb.x + a.ux * far, rb.y + a.uy * far); ctx.stroke();
    }
    for (const rb of sim.rbs) { dot(rb.x, rb.y, RR + 4, col.road); dot(rb.x, rb.y, RR - 4, col.island); }
    ctx.strokeStyle = col.mark;
    for (const rb of sim.rbs) for (const a of rb.arms) {
      ctx.lineWidth = 0.35; ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.moveTo(rb.x + a.ux * (RR + 12), rb.y + a.uy * (RR + 12));
      const far = a.link < 0 ? fd + PAD : (Math.abs(sim.rbs[a.link].x - rb.x) / 2);
      ctx.lineTo(rb.x + a.ux * far, rb.y + a.uy * far); ctx.stroke(); ctx.setLineDash([]);
      // Stop lines where the sim holds traffic: entry lane 10 m before the ring, ring lane at `sStop`, and both
      // sides of the pedestrian crossing (`xw` from the ring centreline; link arms have none).
      const r0 = RR * Math.cos(K.DEL), su = r0 + K.ZD, xc = r0 + a.xw, th = -a.sStop / RR, cs = Math.cos(th), sn = Math.sin(th);
      const P = (u: number, k: number): [number, number] => [rb.x + a.ux * u + a.px * k, rb.y + a.uy * u + a.py * k];
      const line = (u: number, k0: number, k1: number) => { ctx.beginPath(); ctx.moveTo(...P(u, k0)); ctx.lineTo(...P(u, k1)); ctx.stroke(); };
      ctx.lineWidth = 0.9;
      if (a.xw) for (let k = -4.4; k <= 4.5; k += 2.2) { ctx.beginPath(); ctx.moveTo(...P(xc - 1.5, k)); ctx.lineTo(...P(xc + 1.5, k)); ctx.stroke(); }
      // Signals: solid stop lines. Give-way: dashed give-way line at the entry, crossing unsignalised.
      ctx.lineWidth = 0.8; ctx.setLineDash(a.sg ? [] : [1, 0.9]); line(su, 0.3, 2 * LW - 0.6); ctx.setLineDash([]);
      if (a.sg) {
        ctx.beginPath(); ctx.moveTo(rb.x + (RR - 3.6) * cs, rb.y + (RR - 3.6) * sn); ctx.lineTo(rb.x + (RR + 3.6) * cs, rb.y + (RR + 3.6) * sn); ctx.stroke();
        if (a.xw) { line(xc + 2.5, 0.3, 2 * LW - 0.6); line(xc - 2.5, -0.3, -(2 * LW - 0.6)); }
      }
      // Signal heads where they stand: ring head on the central island at the ring stop line; on the kerbs the entry
      // head at its stop line and the crossing's vehicle and pedestrian heads. Give-way: vehicle heads flash amber.
      const amb = !a.sg && blink, e = a.sg ? a.sg.entry : '', ring = a.sg ? (a.sg.ring ? 'r' : 'g') : '';
      const ped = !!a.sg && a.sg.ped, car3 = (red: boolean, green: boolean) => [red ? col.stop : '', amb ? col.slow : '', green ? col.go : ''];
      head(rb.x + (RR - 5.5) * cs, rb.y + (RR - 5.5) * sn, -cs, -sn, car3(ring === 'r', ring === 'g'));
      const pedHead = [a.sg && !ped ? col.stop : '', ped ? col.go : ''];
      kerbHeads(rb.x, rb.y, a.ux, a.uy, a.px, a.py, 1, [
        {u: su, lamps: [e === 'r' ? col.stop : '', e === 'a' || amb ? col.slow : '', e === 'g' ? col.go : '']},
        ...(a.xw ? [{u: xc - 1, lamps: pedHead}, {u: xc + 3, lamps: car3(ped, !!a.sg && !ped)}] : [])]);
      if (a.xw) kerbHeads(rb.x, rb.y, a.ux, a.uy, a.px, a.py, -1, [{u: xc - 3, lamps: car3(ped, !!a.sg && !ped)}, {u: xc + 1, lamps: pedHead}]);
      for (const p of a.peds) {
        const f = (sim.t - p.t0) / 6.5; if (f < 0 || f > 1) continue;
        dot(...P(xc, (p.dir > 0 ? f : 1 - f) * 18 - 9), 1.1, col.ped);
      }
      if (a.pedWait > 0) dot(...P(xc, 10.5), 1.1, col.ped);
    }
    const vw = Math.max(2.3, 2.2 / sc);
    const vc = (v: Vehicle) => v.bus ? col.bus : v.v < 0.5 ? col.stop : v.v < 4 ? col.slow : col.car;
    for (const l of sim.lanes) {
      // Links longer than drawn (Șaguna, Piața Unirii) are compressed in the middle only: the last END metres at
      // each end keep true scale, so queues sit at the drawn stop line and exit crossing.
      const Ld = Math.hypot(l.bx - l.ax, l.by - l.ay), ux = (l.bx - l.ax) / Ld, uy = (l.by - l.ay) / Ld, END = 20;
      const map = (p: number) => l.L <= Ld + 0.01 ? p : p < END ? p : p > l.L - END ? Ld - (l.L - p) : END + (p - END) * (Ld - 2 * END) / (l.L - 2 * END);
      for (const v of l.veh) {
        ctx.strokeStyle = vc(v); ctx.lineWidth = v.bus ? vw + 0.5 : vw;
        const f = map(v.pos), r = map(Math.max(0, v.pos - v.len));
        ctx.beginPath(); ctx.moveTo(l.ax + ux * f, l.ay + uy * f); ctx.lineTo(l.ax + ux * r, l.ay + uy * r); ctx.stroke();
        if (v.pos < v.len && l.fromArm) {
          // Tail still in the ring: draw it along the ring arc.
          const a = l.fromArm, s1 = a.sExit, s0 = s1 - (v.len - v.pos);
          ctx.beginPath(); ctx.arc(a.rb.x, a.rb.y, RR, -s1 / RR, -s0 / RR); ctx.stroke();
        }
      }
    }
    for (const rb of sim.rbs) for (const v of rb.veh) {
      ctx.strokeStyle = vc(v); ctx.lineWidth = v.bus ? vw + 0.5 : vw;
      ctx.beginPath(); ctx.arc(rb.x, rb.y, RR, -v.s / RR, -(v.s - v.len) / RR); ctx.stroke();
    }
    const f1 = '500 12px Barlow, sans-serif', f2 = '600 13px "Barlow Condensed", sans-serif';
    for (const rb of sim.rbs) {
      txt(rb.name.toUpperCase(), rb.x + rb.nameAt[0], rb.y + rb.nameAt[1], 'right', col.ink, f2);
      for (const a of rb.arms) {
        if (!a.name) continue;
        const n = a.backlog.length;
        // Links run one direction per side: eastbound labelled below the road, westbound above.
        if (a.link >= 0) { txt(a.name + (a.len ? ` · ${a.len} m` : ''), rb.x + (sim.rbs[a.link].x - rb.x) / 2, rb.y + (a.link > rb.idx ? 17 : -11), 'center', col.muted, f1); continue; }
        if (Math.abs(a.ux) > 0.7) {
          // Near-horizontal arms: label along the road, centred in the longest stretch clear of signal heads.
          ctx.font = f1; const half = ctx.measureText(a.name).width / sc / 2 + 3, r0 = RR * Math.cos(K.DEL);
          const busy = [[0, r0 + K.ZD + 14], ...(a.xw ? [[r0 + a.xw - 9, r0 + a.xw + 9]] : []), [r0 + K.ARM - 4, Infinity]].sort((p, q) => p[0] - q[0]);
          let u = RR + K.ARM * 0.62, best = -1;
          for (let i = 1; i < busy.length; i++) {
            const lo = busy[i - 1][1], hi = busy[i][0];
            if (hi - lo > best) { best = hi - lo; u = Math.max(lo + half, (lo + hi) / 2); }
          }
          // No stretch long enough: set the label out beyond the heads on the kerb.
          const off = (LW + 3) * sc + (best < 2 * half ? 13 : 0);
          roadTxt(a.name, rb.x + a.ux * u, rb.y + a.uy * u, a.ang, col.muted, f1, -off);
          if (n) roadTxt('+' + n, rb.x + a.ux * u, rb.y + a.uy * u, a.ang, col.stop, f2, off);
        } else {
          const x = rb.x + a.ux * (RR + K.ARM * 0.72) + 10, y = rb.y + a.uy * (RR + K.ARM * 0.72);
          txt(a.name, x, y, 'left', col.muted, f1); if (n) txt('+' + n, x, y, 'left', col.stop, f2, 15);
        }
      }
    }
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
