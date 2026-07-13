// 学习进度与成就（localStorage 持久化）：看过的案例 + 决策题对错。
// 案例重编号迁移（v21，旧号 1/30/41/44/45/46/49/51/54 → 新号 1..9）：KEY 升 v2，旧进度按固定映射一次性迁移；
// 不在映射内的旧键（更早裁撤的幽灵号）直接丢弃，防「看过数 > 在册数」的徽章误发。
const KEY = 'pmkb-progress-v2';
const LEGACY_KEY = 'pmkb-progress';
const LEGACY_MAP: Record<string, string> = { '1': '1', '30': '2', '41': '3', '44': '4', '45': '5', '46': '6', '49': '7', '51': '8', '54': '9' };
type P = { viewed?: Record<string, 1>; quiz?: Record<string, boolean>; grill?: Record<string, boolean> };
function migrateLegacy() {
  try {
    if (localStorage.getItem(KEY) !== null || localStorage.getItem(LEGACY_KEY) === null) return;
    const old: P = JSON.parse(localStorage.getItem(LEGACY_KEY) || '{}');
    const remap = <T,>(o?: Record<string, T>) => { const r: Record<string, T> = {}; for (const [k, v] of Object.entries(o || {})) { const nk = LEGACY_MAP[k]; if (nk) r[nk] = v; } return r; };
    localStorage.setItem(KEY, JSON.stringify({ viewed: remap(old.viewed), quiz: remap(old.quiz) }));
  } catch { /* 旧值损坏按无进度处理 */ }
}
function load(): P { try { migrateLegacy(); return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } }
function save(o: P) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch { /* 隐私模式忽略 */ } }
export function markViewed(num: number | string) { const o = load(); o.viewed = o.viewed || {}; o.viewed[String(num)] = 1; save(o); }
export function markQuiz(num: number | string, correct: boolean) { const o = load(); o.quiz = o.quiz || {}; o.quiz[String(num)] = correct; save(o); }
export function markGrill(num: number | string, done: boolean) { const o = load(); o.grill = o.grill || {}; o.grill[String(num)] = done; save(o); } // v22：grill-me 追问通关
export function getProgress(total: number) {
  const o = load();
  const viewed = Object.keys(o.viewed || {}).length;
  const correct = Object.values(o.quiz || {}).filter(Boolean).length;
  const badges: { icon: string; label: string }[] = [];
  if (viewed >= 1) badges.push({ icon: 'rocket', label: '起步' });
  if (viewed >= total / 2) badges.push({ icon: 'flame', label: '过半' });
  if (viewed >= total) badges.push({ icon: 'trophy', label: '通览' });
  if (correct >= 5) badges.push({ icon: 'target', label: '决策达人' });
  return { viewed, correct, total, pct: total ? Math.round((viewed / total) * 100) : 0, badges };
}
