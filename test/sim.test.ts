import {describe, expect, it} from 'vitest';
import {createSim, mulberry32, type Mode} from '../src/sim';

function run(modes: Mode[], seed = 1, steps = 6000) {
  const s = createSim({demand: 1, cycle: 70, ped: 120, plan: 'pair'}, mulberry32(seed));
  s.rbs.forEach((r, i) => r.mode = modes[i]);
  for (let i = 0; i < steps; i++) s.step();
  return s;
}

describe('createSim', () => {
  it('builds the corridor network', () => {
    const s = createSim({demand: 1, cycle: 70, ped: 120, plan: 'pair'});
    expect(s.rbs.map(r => r.key)).toEqual(['morilor', 'ramada', 'milea']);
    expect(s.arms).toHaveLength(11);
    for (const a of s.arms) {
      expect(a.inLane.endArm).toBe(a);
      expect(a.outLane.fromArm).toBe(a);
    }
  });

  it('is deterministic for a given seed', () => {
    expect(run(['classic', 'classic', 'signal'], 7).stats()).toEqual(run(['classic', 'classic', 'signal'], 7).stats());
  });

  for (const modes of [['classic', 'classic', 'classic'], ['signal', 'signal', 'signal']] as Mode[][]) {
    it(`moves traffic through the corridor (${modes.join(',')})`, () => {
      const st = run(modes).stats();
      expect(st.t).toBeCloseTo(600, 5);
      expect(st.flow).toBeGreaterThan(500);
      expect(st.trip).toBeGreaterThan(0);
    });
  }

  it('never overlaps vehicles in a ring', () => {
    const s = run(['signal', 'signal', 'signal'], 3, 3000);
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
