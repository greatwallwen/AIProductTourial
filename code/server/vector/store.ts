import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
/** 纯 JS 真实向量库：TF-IDF + 余弦检索（RAG 案例后端，无第三方依赖）。 */
interface Doc { id: string; text: string; tf: Map<string, number>; }
function tokenize(s: string): string[] {
  const en = (s.toLowerCase().match(/[a-z0-9]{2,}/g) || []);
  const cj = (s.match(/[一-龥]/g) || []);
  const bi: string[] = []; for (let i = 0; i < cj.length - 1; i++) bi.push(cj[i] + cj[i + 1]); // 中文二元组
  return [...en, ...bi];
}
export class VectorStore {
  private docs: Doc[] = [];
  private idf = new Map<string, number>();
  add(id: string, text: string): void {
    const tf = new Map<string, number>();
    for (const t of tokenize(text)) tf.set(t, (tf.get(t) || 0) + 1);
    this.docs.push({ id, text, tf });
  }
  /** 从目录加载语料（前 limit 篇 md 作 RAG 语料） */
  loadDir(dir: string, limit = 80): number {
    const walk = (d: string): string[] => readdirSync(d).flatMap((e) => {
      const p = join(d, e); return statSync(p).isDirectory() ? walk(p) : (e.endsWith('.md') ? [p] : []);
    });
    for (const f of walk(dir).slice(0, limit)) this.add(f.split('/').slice(-2).join('/'), readFileSync(f, 'utf8').slice(0, 4000));
    this.build(); return this.docs.length;
  }
  private build(): void {
    const n = this.docs.length;
    const df = new Map<string, number>();
    for (const d of this.docs) for (const t of d.tf.keys()) df.set(t, (df.get(t) || 0) + 1);
    for (const [t, c] of df) this.idf.set(t, Math.log(1 + n / c));
  }
  private vec(tf: Map<string, number>): Map<string, number> {
    const v = new Map<string, number>();
    for (const [t, c] of tf) v.set(t, c * (this.idf.get(t) || Math.log(1 + this.docs.length)));
    return v;
  }
  private cos(a: Map<string, number>, b: Map<string, number>): number {
    let dot = 0, na = 0, nb = 0;
    for (const [, x] of a) na += x * x; for (const [, y] of b) nb += y * y;
    for (const [t, x] of a) { const y = b.get(t); if (y) dot += x * y; }
    return na && nb ? dot / Math.sqrt(na * nb) : 0;
  }
  /** 两阶段 RAG：先 cosine 粗召回 top-N，再「cosine×词项覆盖」精排 top-k（模拟 Cross-Encoder 重排）。 */
  search(query: string, k = 3, recallN = 10) {
    const qtf = new Map<string, number>(); for (const t of tokenize(query)) qtf.set(t, (qtf.get(t) || 0) + 1);
    const qv = this.vec(qtf); const qterms = [...qtf.keys()];
    // 召回：全库粗排（成本低、覆盖广）
    const recall = this.docs.map((d) => {
      const overlap = qterms.length ? qterms.filter((t) => d.tf.has(t)).length / qterms.length : 0;
      return { id: d.id, cosine: Number(this.cos(qv, this.vec(d.tf)).toFixed(4)), overlap: Number(overlap.toFixed(3)), snippet: d.text.replace(/\s+/g, ' ').slice(0, 120) };
    }).sort((a, b) => b.cosine - a.cosine).slice(0, recallN);
    // 重排：精排（成本高、精度高）→ 锁定最相关 top-k
    const reranked = recall.map((r) => ({ ...r, rerank: Number((r.cosine * (0.5 + 0.5 * r.overlap)).toFixed(4)) }))
      .sort((a, b) => b.rerank - a.rerank).slice(0, k);
    return { query, corpus: this.docs.length, recallN, k, recall, reranked };
  }
  get size(): number { return this.docs.length; }
}
