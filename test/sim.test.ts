import {describe, expect, it} from 'vitest';
import {createSim, mulberry32, type Ctrl, type Mode} from '../src/sim';

function run(modes: Mode[], seed = 1, steps = 6000, ctrl: Ctrl = 'adaptive') {
  const s = createSim({demand: 1, cycle: 70, ped: 120, plan: 'pair', ctrl}, mulberry32(seed));
  s.rbs.forEach((r, i) => r.mode = modes[i]);
  for (let i = 0; i < steps; i++) s.step();
  return s;
}

describe('createSim', () => {
  it('builds the corridor network', () => {
    const s = createSim({demand: 1, cycle: 70, ped: 120, plan: 'pair', ctrl: 'adaptive'});
    expect(s.rbs.map(r => r.key)).toEqual(['ramada', 'milea']);
    expect(s.arms).toHaveLength(8);
    // The link is modelled at its real (OSM) route length; Șaguna comes in on its curved carriageway, as in the city's model.
    expect(s.rbs[1].west!.outLane.L).toBeGreaterThanOrEqual(195);
    expect(s.rbs[0].arms.find(a => a.name === 'Str. Andrei Șaguna')!.flow).toBeGreaterThan(0);
    for (const a of s.arms) {
      expect(a.inLane.endArm).toBe(a);
      expect(a.outLane.fromArm).toBe(a);
    }
  });

  it('has every signal in the city\'s model', () => {
    const s = createSim({demand: 1, cycle: 70, ped: 120, plan: 'pair', ctrl: 'adaptive'});
    // Per ring: an entry stop line and a ring stop line for each of its four arms.
    for (const rb of s.rbs) expect(rb.arms.filter(a => a.inStop.side === 'in')).toHaveLength(4);
    // Seven crossings: Coposu, Cioran, two mid-block on Șaguna, Noica, V. Milea, Dumbrăvii.
    expect(s.crossings).toHaveLength(7);
    const sag = s.rbs[0].arms.find(a => a.name === 'Str. Andrei Șaguna')!;
    expect(sag.xs.map(x => x.mid)).toEqual([true, true]);
    expect(sag.xs.every(x => x.stops.map(st => st.lane).join() === sag.inL.join())).toBe(true);
    // Every lane in both directions stops at the other five; the Coposu bypass is held by the Coposu entry light.
    for (const x of s.crossings.filter(x => !x.mid)) expect(x.stops).toHaveLength(x.arm.inL.length + x.arm.outL.length);
    const cop = s.rbs[0].arms.find(a => a.name === 'Bd. Corneliu Coposu')!;
    expect(cop.inLane.slip!.lane.stops.map(st => st.side)).toEqual(['in']);
  });

  it('runs traffic over both bypasses and the mid-block crossings', () => {
    const s = createSim({demand: 1, cycle: 70, ped: 300, plan: 'pair', ctrl: 'adaptive'}, mulberry32(2));
    s.rbs.forEach(r => r.mode = 'signal');
    const slips = s.lanes.filter(l => l.merge), used = new Set<number>();
    const sag = s.rbs[0].arms.find(a => a.name === 'Str. Andrei Șaguna')!;
    let walks = 0;
    for (let i = 0; i < 6000; i++) {
      s.step();
      slips.forEach((l, k) => { if (l.veh.length) used.add(k); });
      for (const x of sag.xs) {
        if (x.walk) { walks++; expect(x.car).toBe('r'); }
      }
    }
    expect(used.size).toBe(2);
    expect(walks).toBeGreaterThan(0);
  });

  it('uses both ring lanes and both approach lanes, without overlaps', () => {
    const s = createSim({demand: 1, cycle: 70, ped: 120, plan: 'pair', ctrl: 'adaptive'}, mulberry32(4));
    s.rbs.forEach(r => r.mode = 'signal');
    const ringLanes = new Set<string>(), used = new Set<object>();
    for (let i = 0; i < 6000; i++) {
      s.step();
      for (const rb of s.rbs) for (const v of rb.veh) ringLanes.add(rb.key + v.ri);
      for (const l of s.lanes) {
        if (l.veh.length) used.add(l);
        for (let k = 1; k < l.veh.length; k++) expect(l.veh[k - 1].pos - l.veh[k - 1].len - l.veh[k].pos).toBeGreaterThan(-0.5);
      }
    }
    expect(ringLanes.size).toBe(4);
    // Every two-lane approach carries traffic in both lanes.
    for (const a of s.arms) if (a.inL.length === 2 && (a.flow || a.link >= 0)) expect(a.inL.every(l => used.has(l))).toBe(true);
  });

  it('puts a share of drivers in the wrong lane, who sort it out late or in the ring without gridlock', () => {
    const s = createSim({demand: 1, cycle: 70, ped: 120, plan: 'pair', ctrl: 'adaptive', err: 0.3}, mulberry32(6));
    s.rbs.forEach(r => r.mode = 'signal');
    let erring = 0, cutting = 0;
    for (let i = 0; i < 9000; i++) {
      s.step();
      for (const l of s.lanes) for (const v of l.veh) if (v.err === 1 && v.lane!.endArm && v.lane!.sib) erring++;
      for (const rb of s.rbs) for (const v of rb.veh) if (v.rw >= 0) cutting++;
    }
    expect(erring).toBeGreaterThan(0);
    expect(cutting).toBeGreaterThan(0);
    expect(s.stats().flow).toBeGreaterThan(1000);
    // Same seed and no errors: identical traffic demand, so the error draws do not shift other random numbers.
    const a = createSim({demand: 1, cycle: 70, ped: 120, plan: 'pair', ctrl: 'adaptive', err: 0}, mulberry32(6));
    const b = createSim({demand: 1, cycle: 70, ped: 120, plan: 'pair', ctrl: 'adaptive', err: 0.3}, mulberry32(6));
    for (let i = 0; i < 300; i++) { a.step(); b.step(); }
    expect(b.arms.map(x => x.inL.reduce((m, l) => m + l.veh.length, 0) + x.backlog.length))
      .toEqual(a.arms.map(x => x.inL.reduce((m, l) => m + l.veh.length, 0) + x.backlog.length));
  });

  it('lets aggressive wrong-lane drivers cut across the ring, blocking both lanes, without gridlock', () => {
    const s = createSim({demand: 1, cycle: 70, ped: 120, plan: 'pair', ctrl: 'adaptive', err: 0.3, agg: 1}, mulberry32(6));
    s.rbs.forEach(r => r.mode = 'signal');
    let straddling = 0, blocked = 0;
    for (let i = 0; i < 9000; i++) {
      s.step();
      for (const rb of s.rbs) for (const v of rb.veh) if (v.both > s.t) {
        straddling++;
        // Someone in the other lane is held up just behind it.
        if (rb.veh.some(o => o.ri !== v.ri && o.v < 0.5 && (((v.s - o.s) % s.K.C) + s.K.C) % s.K.C < v.len + 4)) blocked++;
      }
      // Aggressive drivers never stop on the approach to change lanes.
      for (const l of s.lanes) for (const v of l.veh) if (v.agg && v.err) expect(v.wait).toBe(-1);
    }
    expect(straddling).toBeGreaterThan(0);
    expect(blocked).toBeGreaterThan(0);
    expect(s.stats().flow).toBeGreaterThan(800);
  });

  it('without lane markings, sends drivers into either lane and still never locks a ring for good', () => {
    // No lane line: drivers stagger behind moving cars in the other ring lane. They used to stagger behind stopped ones
    // too, and a full ring then locked in one circle of cars each waiting for the next (fixed-time, both rings, ~30 min).
    const s = createSim({demand: 1, cycle: 70, ped: 120, plan: 'pair', ctrl: 'fixed', agg: 0.5, marked: false}, mulberry32(1));
    s.rbs.forEach(r => r.mode = 'signal');
    let wrong = 0, frozen = 0;
    for (let i = 0; i < 24000; i++) {
      s.step();
      for (const rb of s.rbs) for (const v of rb.veh) if (v.rw >= 0 || v.both > s.t) wrong++;
      if (i % 600 === 0) frozen = s.rbs.every(rb => rb.veh.length > 8 && rb.veh.every(v => v.v < 0.1)) ? frozen + 1 : 0;
      expect(frozen).toBeLessThan(5);
    }
    expect(wrong).toBeGreaterThan(0);
    expect(s.stats().flow).toBeGreaterThan(600);
  });

  it('is deterministic for a given seed', () => {
    expect(run(['classic', 'signal'], 7).stats()).toEqual(run(['classic', 'signal'], 7).stats());
  });

  for (const modes of [['classic', 'classic'], ['signal', 'signal']] as Mode[][]) {
    it(`moves traffic through the corridor (${modes.join(',')})`, () => {
      const st = run(modes).stats();
      expect(st.t).toBeCloseTo(600, 5);
      expect(st.flow).toBeGreaterThan(500);
      expect(st.trip).toBeGreaterThan(0);
    });
  }

  it('adaptive control never shows green to conflicting groups and beats fixed-time', () => {
    const s = createSim({demand: 1, cycle: 70, ped: 120, plan: 'pair', ctrl: 'adaptive'}, mulberry32(5));
    s.rbs.forEach(r => r.mode = 'signal');
    for (let i = 0; i < 4000; i++) {
      s.step();
      for (const rb of s.rbs) {
        const g = new Set(rb.arms.filter(a => a.sg!.entry === 'g').map(a => a.g));
        expect(g.size).toBeLessThanOrEqual(1);
      }
    }
    // Mean over seeds: on a single seed fixed-time can come out ahead.
    const all: Mode[] = ['signal', 'signal'];
    const mean = (ctrl: Ctrl) => [1, 2, 3].reduce((m, seed) => m + run(all, seed, 12000, ctrl).stats().trip, 0) / 3;
    expect(mean('adaptive')).toBeLessThan(mean('fixed'));
  });

  it('does not gridlock two rings across the short Piața Unirii link', () => {
    // One arm at a time used to lock Ramada and Milea for good: each ring full of traffic for the other's full link.
    const s = createSim({demand: 1, cycle: 100, ped: 120, plan: 'seq', ctrl: 'adaptive'}, mulberry32(3));
    s.rbs.forEach(r => r.mode = 'signal');
    for (let i = 0; i < 12000; i++) s.step();
    const [ramada, milea] = s.rbs;
    const locked = [ramada, milea].every(rb => rb.veh.length > 0 && rb.veh.every(v => v.v < 0.1)) &&
      [ramada.east!, milea.west!].every(a => a.outLane.veh.every(v => v.v < 0.1));
    expect(locked).toBe(false);
    expect(s.stats().flow).toBeGreaterThan(600);
  });

  it('never overlaps vehicles in a ring lane', () => {
    const s = run(['signal', 'signal'], 3, 3000);
    const C = s.K.C;
    for (const rb of s.rbs) for (const ri of [0, 1]) {
      const v = rb.veh.filter(o => o.ri === ri).sort((a, b) => a.s - b.s);
      for (let i = 0; i < v.length; i++) {
        const ahead = v[(i + 1) % v.length];
        if (ahead === v[i]) continue;
        const gap = (((ahead.s - v[i].s) % C) + C) % C - ahead.len;
        expect(gap).toBeGreaterThan(-0.5);
      }
    }
  });
});
