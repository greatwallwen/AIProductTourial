// 学习进度与成就（localStorage 持久化）：看过的案例 + 决策题对错。
const KEY = 'pmkb-progress';
type P = { viewed?: Record<string, 1>; quiz?: Record<string, boolean> };
function load(): P { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } }
function save(o: P) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch { /* 隐私模式忽略 */ } }
export function markViewed(num: number | string) { const o = load(); o.viewed = o.viewed || {}; o.viewed[String(num)] = 1; save(o); }
export function markQuiz(num: number | string, correct: boolean) { const o = load(); o.quiz = o.quiz || {}; o.quiz[String(num)] = correct; save(o); }
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
