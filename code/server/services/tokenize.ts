// 真实规则分词（教学用，近似 Tokenizer）：英文按词、中文按常见二字词/单字、标点独立；给确定性 Token ID + 量化换算。
const COMMON = ['今天', '天气', '怎么', '老师', '讲座', '产品', '经理', '数字', '数据', '系统', '分析', '模型', '上下', '知识', '智能', '架构', '设计', '经营', '运营'];
export interface Tok { text: string; id: number; kind: string; }
function hashId(s: string): number { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) % 100000; }
export function tokenize(text: string): { tokens: Tok[]; count: number; chars: number; ratio: number } {
  const s = String(text || ''); const toks: Tok[] = []; let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/[a-zA-Z0-9]/.test(ch)) { let j = i; while (j < s.length && /[a-zA-Z0-9]/.test(s[j])) j++; const w = s.slice(i, j); toks.push({ text: w, id: hashId(w), kind: 'word' }); i = j; }
    else if (/[一-龥]/.test(ch)) { const two = s.slice(i, i + 2); if (two.length === 2 && COMMON.includes(two)) { toks.push({ text: two, id: hashId(two), kind: 'cjk2' }); i += 2; } else { toks.push({ text: ch, id: hashId(ch), kind: 'cjk' }); i++; } }
    else if (/\s/.test(ch)) { i++; }
    else { toks.push({ text: ch, id: hashId(ch), kind: 'punct' }); i++; }
  }
  const chars = [...s.replace(/\s/g, '')].length;
  return { tokens: toks, count: toks.length, chars, ratio: toks.length ? Number((chars / toks.length).toFixed(2)) : 0 };
}
