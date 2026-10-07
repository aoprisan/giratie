// Headless scenario comparison: 20 simulated minutes per scenario.
import {createSim, mulberry32, type Mode, type Plan} from '../src/sim';

const seed = Number(process.argv[2] ?? 1);
const scenarios: Mode[][] = [['classic', 'classic', 'classic'], ['classic', 'classic', 'signal'], ['signal', 'signal', 'signal']];
for (const [plan, cycle] of [['pair', 70], ['seq', 70], ['seq', 100], ['pair', 100]] as [Plan, number][]) {
  for (const modes of scenarios) {
    const s = createSim({demand: 1, cycle, ped: 120, plan}, mulberry32(seed));
    s.rbs.forEach((r, i) => r.mode = modes[i]);
    for (let i = 0; i < 12000; i++) s.step();
    const st = s.stats();
    console.log(plan, cycle, modes.join(','), 'trip', st.trip.toFixed(0), 'flow', st.flow.toFixed(0), 'stopped', st.stopped, 'backlog', st.backlog,
      st.per.map(p => p.queued + ':' + p.worst + '/' + p.ring).join(' | '));
  }
}
