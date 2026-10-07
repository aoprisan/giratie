// Headless scenario comparison: 20 simulated minutes per scenario (trip, wait, flow, score over the last 5 min).
// Args: seed, share of drivers in the wrong lane (0–1), demand (1 = 100%), mix (0 = identical cars).
import {createSim, mulberry32, type Ctrl, type Mode, type Plan} from '../src/sim';

const seed = Number(process.argv[2] ?? 1), err = Number(process.argv[3] ?? 0), demand = Number(process.argv[4] ?? 1), mix = process.argv[5] !== '0';
const scenarios: Mode[][] = [['classic', 'classic'], ['classic', 'signal'], ['signal', 'signal']];
for (const [ctrl, plan, cycle] of [['fixed', 'pair', 70], ['fixed', 'seq', 100], ['adaptive', 'pair', 70], ['adaptive', 'pair', 100], ['adaptive', 'seq', 100]] as [Ctrl, Plan, number][]) {
  for (const modes of scenarios) {
    const s = createSim({demand, cycle, ped: 120, plan, ctrl, err, mix}, mulberry32(seed));
    s.rbs.forEach((r, i) => r.mode = modes[i]);
    for (let i = 0; i < 12000; i++) s.step();
    const st = s.stats();
    console.log(ctrl, plan, cycle, modes.join(','), 'trip', st.trip.toFixed(0), 'wait', st.wait.toFixed(0), 'flow', st.flow.toFixed(0), 'offered', st.offered.toFixed(0), 'score', st.score, st.grade, 'stopped', st.stopped, 'backlog', st.backlog,
      st.per.map(p => p.queued + ':' + p.worst + '/' + p.ring).join(' | '));
  }
}
