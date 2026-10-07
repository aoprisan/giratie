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
    // The link is modelled at its real (OSM) route length, longer than drawn; Șaguna is one-way westbound (exit only).
    expect(s.rbs[1].west!.outLane.L).toBeGreaterThanOrEqual(195);
    expect(s.rbs[0].arms.find(a => a.name === 'Str. Andrei Șaguna')!.flow).toBe(0);
    for (const a of s.arms) {
      expect(a.inLane.endArm).toBe(a);
      expect(a.outLane.fromArm).toBe(a);
    }
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

  it('never overlaps vehicles in a ring', () => {
    const s = run(['signal', 'signal'], 3, 3000);
    const C = s.K.C;
    for (const rb of s.rbs) {
      const v = [...rb.veh].sort((a, b) => a.s - b.s);
      for (let i = 0; i < v.length; i++) {
        const ahead = v[(i + 1) % v.length];
        if (ahead === v[i]) continue;
        const gap = (((ahead.s - v[i].s) % C) + C) % C - ahead.len;
        expect(gap).toBeGreaterThan(-0.5);
      }
    }
  });
});
