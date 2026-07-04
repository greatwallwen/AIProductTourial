// 前端数据访问层：一律 live fetch 后端（一服务托管前端+API）。
export interface IndexCase { num: number; title: string; industry: string; phase: string; saasType: string; highImpact?: boolean; rp?: string; }
export interface IndexData { projectName: string; cases: IndexCase[]; }
async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return r.json() as Promise<T>;
}
export const fetchIndex = () => getJson<IndexData>('/api/index');
export const fetchCaseData = (num: string) => getJson<any>(`/api/case/${num}/data`);
