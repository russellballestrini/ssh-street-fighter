import { STAGES } from '../game/stage-set.js';
const counts: Record<string, number> = {};
for (let i = 0; i < 12; i++) { const s = STAGES.pick(); counts[s] = (counts[s] ?? 0) + 1; }
console.log('picks:', JSON.stringify(counts), 'available:', STAGES.ids().join(','));
