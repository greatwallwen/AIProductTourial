/** 架构图套件（dogfood：本平台真实子系统）——用 diagram()/sequence() 渲染 C4 / DDD / 部署 / 数据流 / SDD 流水线。
 *  坐标显式、确定性；t = 主题对象。返回 { id: svg }，由 build_docs 写入 outputs/.../svg/。*/
import { diagram, sequence } from './diagram.mjs';

// ① SDD 规格驱动流水线（八步，标出人在关口 + 门禁）
function sddPipeline(t) {
  const steps = [
    ['宪法', 'rules/ 约束'], ['规格', 'spec.md 真源'], ['澄清', '消歧·人把关'], ['架构设计', 'C4 / DDD / ADR'],
    ['任务分解', 'tasks.md 原子'], ['实现', '逐任务 Loop'], ['门禁', 'verify / evals'], ['演进', '触发表·回流'],
  ];
  const w = 138, h = 66, gap = 18, x0 = 22, y = 110;
  const ICONS = ['book-marked', 'book-open', 'search', 'layers', 'list-checks', 'wrench', 'check-circle', 'rotate-ccw'];
  const nodes = steps.map(([label, sub], i) => ({
    id: 's' + i, x: x0 + i * (w + gap), y, w, h, label, sub, icon: ICONS[i],
    color: i === 2 ? t.warn : i === 6 ? t.ok : t.accent,
    tag: i === 2 ? '人' : i === 6 ? '门禁' : '',
  }));
  const edges = steps.slice(1).map((_, i) => ({ from: 's' + i, to: 's' + (i + 1) }));
  edges.push({ from: 's7', to: 's1', label: '生产反馈→改规格', dashed: true, color: t.muted });
  return diagram({
    W: 22 * 2 + 8 * w + 7 * gap, H: 300, title: 'SDD 规格驱动开发流水线（一次中大型建造的八步）',
    caption: '规格=唯一真源；澄清与门禁是人/机把关；末步生产反馈回流改规格（接 §2 Loop、§6 三绿门禁）。来源：GitHub Spec Kit。',
    nodes, edges,
    legend: [{ label: '常规步骤', color: t.accent }, { label: '人在关口', color: t.warn }, { label: '自动门禁', color: t.ok }],
  }, t);
}

// ② C4 Level-1 系统上下文（本平台 + 用户 + 外部）
function c4Context(t) {
  return diagram({
    W: 900, H: 420, title: 'C4 · 系统上下文（Context）：本平台与谁交互',
    caption: '最外层：系统 + 使用者 + 外部依赖。先看清边界，再往里拆。来源：C4 模型（Simon Brown）。',
    nodes: [
      { id: 'user', x: 60, y: 170, w: 180, h: 76, tag: '人', icon: 'user', color: t.accent2, label: '学习者', sub: '研发 / 产品 / 项目' },
      { id: 'sys', x: 340, y: 150, w: 220, h: 110, icon: 'box', color: t.accent, label: 'AI 一体化知识库平台', sub: '真数据·可运行·自校验' },
      { id: 'data', x: 660, y: 70, w: 190, h: 76, tag: '外部', icon: 'package', dashed: true, color: t.ink2, label: '公开数据集', sub: 'UCI / CMS / US DOT' },
      { id: 'ai', x: 660, y: 190, w: 190, h: 76, tag: '外部', icon: 'cpu', dashed: true, color: t.ink2, label: 'AI 编程工具', sub: '任一 Agent 工具' },
      { id: 'br', x: 660, y: 300, w: 190, h: 64, tag: '外部', icon: 'globe', dashed: true, color: t.ink2, label: '浏览器', sub: '大屏 / 实验室' },
    ],
    edges: [
      { from: 'user', to: 'sys', label: '学习·跑·改' },
      { from: 'sys', to: 'data', label: '装载真实数据', dashed: true },
      { from: 'sys', to: 'ai', label: '按规格驱动', dashed: true },
      { from: 'sys', to: 'br', label: 'HTTP 托管' },
    ],
  }, t);
}

// ③ C4 Level-2 容器（本平台内部真实子系统 + 依赖）
function c4Container(t) {
  return diagram({
    W: 1000, H: 600, title: 'C4 · 容器（Container）：单 Node 服务内的真实子系统',
    caption: 'web→api→services→db/vector 是真实调用链；verify 是只读校验器（Loop 的 checker）；数据集构建期装载。',
    groups: [{ x: 56, y: 66, w: 690, h: 476, label: 'AI 一体化知识库平台 · 单 Fastify + node:sqlite 服务', color: t.accent }],
    nodes: [
      { id: 'user', x: 800, y: 96, w: 150, h: 60, tag: '人', icon: 'user', color: t.accent2, label: '学习者', sub: '浏览器' },
      { id: 'ds', x: 792, y: 452, w: 170, h: 70, tag: '外部', icon: 'package', dashed: true, color: t.ink2, label: '公开数据集', sub: 'UCI / CMS / DOT' },
      { id: 'web', x: 96, y: 106, w: 300, h: 66, tag: '容器', icon: 'layers', label: 'web · React SPA', sub: '#/case/NN 大屏 + 实验室' },
      { id: 'verify', x: 430, y: 106, w: 296, h: 66, tag: '容器', icon: 'check-circle', color: t.warn, label: 'verify · 校验器(checker)', sub: '数百项门禁 · 只读' },
      { id: 'api', x: 96, y: 232, w: 300, h: 66, tag: '容器', icon: 'server', label: 'api · Fastify routes', sub: '/api/* 契约 · OpenAPI 自动生成' },
      { id: 'svc', x: 96, y: 358, w: 300, h: 66, tag: '容器', icon: 'workflow', label: 'services · 业务服务', sub: 'cases / rfm / hospital / dispatch…' },
      { id: 'db', x: 430, y: 358, w: 140, h: 66, tag: '存储', icon: 'database', color: t.ok, label: 'db · node:sqlite', sub: '真 SQL 聚合' },
      { id: 'vec', x: 588, y: 358, w: 138, h: 66, tag: '存储', icon: 'search', color: t.ok, label: 'vector · TF-IDF', sub: 'RAG 召回+重排' },
    ],
    edges: [
      { from: 'user', to: 'web', label: 'HTTP' },
      { from: 'web', to: 'api', label: '/api/*' },
      { from: 'api', to: 'svc', label: '调用' },
      { from: 'svc', to: 'db', label: 'SQL' },
      { from: 'svc', to: 'vec', label: '检索' },
      { from: 'ds', to: 'db', label: '构建期装载', dashed: true },
      { from: 'verify', to: 'svc', label: '门禁·只读', dashed: true, color: t.warn },
    ],
    legend: [{ label: '容器', color: t.accent }, { label: '存储', color: t.ok }, { label: '校验/门禁', color: t.warn }, { label: '外部', color: t.ink2 }],
  }, t);
}

// ④ C4 Level-3 组件（api 容器内部）
function c4Component(t) {
  return diagram({
    W: 940, H: 440, title: 'C4 · 组件（Component）：api 容器内部',
    caption: '放大一个容器看内部组件与依赖。routes 只收发 HTTP、services 只写业务（§3.3 分层边界）。',
    groups: [{ x: 40, y: 66, w: 860, h: 340, label: 'api 容器（code/server）', color: t.accent }],
    nodes: [
      { id: 'routes', x: 70, y: 110, w: 250, h: 70, tag: '组件', icon: 'network', label: 'routes/api.ts', sub: '只收发 HTTP · 不写业务' },
      { id: 'cases', x: 360, y: 110, w: 250, h: 70, tag: '组件', icon: 'workflow', label: 'services/cases.ts', sub: 'caseData · 预计算读取' },
      { id: 'biz', x: 650, y: 110, w: 220, h: 70, tag: '组件', icon: 'workflow', label: '业务服务', sub: 'rfm / hospital / dispatch / retail' },
      { id: 'store', x: 360, y: 250, w: 250, h: 70, tag: '组件', icon: 'search', label: 'vector/store.ts', sub: '两阶段召回→重排' },
      { id: 'openapi', x: 650, y: 250, w: 220, h: 70, tag: '组件', icon: 'clipboard-list', color: t.warn, label: 'openapi 契约', sub: '/api/openapi.json 自动生成' },
    ],
    edges: [
      { from: 'routes', to: 'cases', label: '路由→服务' },
      { from: 'cases', to: 'biz', label: '分派' },
      { from: 'biz', to: 'store', label: 'RAG' },
      { from: 'routes', to: 'openapi', label: 'schema 生成', dashed: true, color: t.warn },
    ],
  }, t);
}

// ⑤ DDD 限界上下文地图（本平台按业务域划分）
function dddContext(t) {
  return diagram({
    W: 980, H: 520, title: 'DDD · 限界上下文地图：按业务域划边界',
    caption: '每个上下文有自己的通用语言与模型；上游→下游用契约对接（§3.4）。来源：领域驱动设计（Eric Evans）。',
    nodes: [
      { id: 'ingest', x: 60, y: 100, w: 220, h: 84, icon: 'package', color: t.accent2, label: '采集接入 上下文', sub: 'CSV / 快照 → 归一化' },
      { id: 'govern', x: 380, y: 100, w: 220, h: 84, icon: 'book-marked', color: t.accent2, label: '数据治理 上下文', sub: 'metricSpec · 异常列 · 真源' },
      { id: 'insight', x: 700, y: 100, w: 220, h: 84, icon: 'trending-up', color: t.accent, label: '指标洞察 上下文', sub: 'KPI 真算 · 队列 · 图表' },
      { id: 'rag', x: 60, y: 300, w: 220, h: 84, icon: 'search', color: t.accent, label: '检索(RAG) 上下文', sub: '向量库 · 召回 · 重排' },
      { id: 'decide', x: 380, y: 300, w: 220, h: 84, icon: 'target', color: t.ok, label: '经营决策 上下文', sub: '方案 · 责任 · 验收' },
      { id: 'govn', x: 700, y: 300, w: 220, h: 84, icon: 'check-circle', color: t.warn, label: '交付治理 上下文', sub: 'L0-L3 · 门禁 · 风险登记' },
    ],
    edges: [
      { from: 'ingest', to: 'govern', label: '上游→下游' },
      { from: 'govern', to: 'insight', label: '契约' },
      { from: 'insight', to: 'decide', label: '喂决策' },
      { from: 'rag', to: 'decide', label: '证据' },
      { from: 'decide', to: 'govn', label: '交付' },
      { from: 'govn', to: 'insight', label: '门禁反馈', dashed: true, color: t.warn },
    ],
    legend: [{ label: '接入/治理', color: t.accent2 }, { label: '洞察/检索', color: t.accent }, { label: '决策', color: t.ok }, { label: '治理', color: t.warn }],
  }, t);
}

// ⑥ 部署视图（单服务真实拓扑，对齐 §3.6「画真实机房」）
function deployment(t) {
  return diagram({
    W: 900, H: 420, title: '部署视图：一条命令、一个进程（真实拓扑）',
    caption: '画的是约束表里那个真实、有预算的环境，不是 PPT 理想拓扑。生产可演进为 PG + 独立向量服务（见演进触发表）。',
    groups: [{ x: 60, y: 80, w: 500, h: 300, label: '一台机器 · Node ≥ 22 进程（bash code/run.sh）', color: t.accent, dashed: true }],
    nodes: [
      { id: 'fastify', x: 100, y: 130, w: 420, h: 60, tag: '进程', icon: 'server', label: 'Fastify 服务（:5200）', sub: '托管 web/dist + 全部 /api' },
      { id: 'sqlite', x: 100, y: 230, w: 200, h: 60, tag: '文件', icon: 'database', color: t.ok, label: 'node:sqlite', sub: '进程内 · 零外部 DB' },
      { id: 'files', x: 330, y: 230, w: 190, h: 60, tag: '文件', icon: 'package', color: t.ok, label: 'dataset/ 快照', sub: '构建期装载' },
      { id: 'browser', x: 640, y: 200, w: 190, h: 66, tag: '客户端', icon: 'globe', color: t.accent2, label: '浏览器', sub: '#/case/NN' },
    ],
    edges: [
      { from: 'browser', to: 'fastify', label: 'HTTP :5200', bidir: true },
      { from: 'fastify', to: 'sqlite', label: '查询' },
      { from: 'fastify', to: 'files', label: '读取' },
    ],
  }, t);
}

// ⑦ 请求时序 / 数据流（一条真实链路）
function reqSequence(t) {
  return sequence({
    W: 940, H: 360, title: '数据流 / 时序：一次案例大屏请求（真实链路）',
    caption: '从点击到渲染的真实往返：前端→api→服务→sqlite→回。每一跳都有明确契约（§3.4）。',
    actors: [
      { id: 'br', x: 110, w: 150, label: '浏览器', color: t.accent2 },
      { id: 'api', x: 380, w: 150, label: 'api routes', color: t.accent },
      { id: 'svc', x: 640, w: 150, label: 'cases 服务', color: t.accent },
      { id: 'db', x: 860, w: 120, label: 'sqlite', color: t.ok },
    ],
    messages: [
      { from: 'br', to: 'api', label: 'GET /api/case/30/data', y: 130 },
      { from: 'api', to: 'svc', label: 'caseData(30)', y: 165 },
      { from: 'svc', to: 'db', label: '真 SQL 聚合', y: 200 },
      { from: 'db', to: 'svc', label: '分层结果', y: 235, ret: true },
      { from: 'svc', to: 'api', label: 'KPI/队列/图表', y: 270, ret: true },
      { from: 'api', to: 'br', label: '200 · JSON（契约）', y: 305, ret: true },
    ],
  }, t);
}

// ⑧ 领域旗舰：零售数字化中台（中大型信息系统）——C4 容器，每个容器就是本书一个案例子系统
function midPlatform(t) {
  return diagram({
    W: 1040, H: 560, title: '领域走查 · 零售数字化中台（中大型信息系统的 C4 容器）',
    caption: '每个容器就是本书的一个案例——一个中大型系统 = 许多案例子系统按方法论编排起来。真实数据：UCI Online Retail II。',
    groups: [{ x: 56, y: 66, w: 928, h: 460, label: '零售数字化中台 · 采集→治理→洞察→决策 数据价值闭环', color: t.accent }],
    nodes: [
      { id: 'ingest', x: 88, y: 110, w: 210, h: 66, tag: '容器', icon: 'package', color: t.accent2, label: '采集接入', sub: 'Online Retail II 装载' },
      { id: 'govern', x: 330, y: 110, w: 210, h: 66, tag: '容器', icon: 'book-marked', color: t.accent2, label: '数据治理', sub: 'metricSpec · 异常列真源' },
      { id: 'metrics', x: 572, y: 110, w: 210, h: 66, tag: '容器', icon: 'trending-up', label: '指标洞察', sub: '案例 01 / 02 / 03' },
      { id: 'decide', x: 814, y: 110, w: 200, h: 66, tag: '容器', icon: 'target', color: t.ok, label: '经营决策', sub: '案例 03 闭环' },
      { id: 'rag', x: 330, y: 240, w: 210, h: 66, tag: '容器', icon: 'search', label: 'RAG 检索', sub: '案例 04 · 证据召回' },
      { id: 'gate', x: 572, y: 240, w: 210, h: 66, tag: '门禁', icon: 'check-circle', color: t.warn, label: '交付门禁', sub: '案例 08 / verify 三绿' },
      { id: 'base', x: 88, y: 370, w: 210, h: 66, tag: '底座', icon: 'database', label: '关系库底座', sub: '案例 05 · node:sqlite/PG' },
      { id: 'viz', x: 330, y: 370, w: 210, h: 66, tag: '底座', icon: 'zap', label: '事件总线底座', sub: '案例 09 · 事件流重放' },
    ],
    edges: [
      { from: 'ingest', to: 'govern' }, { from: 'govern', to: 'metrics' }, { from: 'metrics', to: 'decide' },
      { from: 'rag', to: 'decide', label: '证据' }, { from: 'base', to: 'metrics', label: '支撑' },
      { from: 'viz', to: 'metrics', label: '事件流', dashed: true }, { from: 'gate', to: 'decide', label: '门禁', dashed: true, color: t.warn },
    ],
    legend: [{ label: '接入/治理', color: t.accent2 }, { label: '容器', color: t.accent }, { label: '决策', color: t.ok }, { label: '门禁', color: t.warn }],
  }, t);
}

// 案例 06 真实子系统依赖图（数据来自 build_case_data 扫 import 得到的真实 deps）——分层单向，标注循环依赖
export function subsystemDeps(edges, cycles, t) {
  const DESC = { routes: 'HTTP 层·不写业务', services: '业务层·真算', data: 'CSV 解析', db: 'node:sqlite', vector: '向量库·RAG' };
  const ICON = { routes: 'network', services: 'workflow', data: 'database', db: 'database', vector: 'search' };
  const layer = { routes: 0, services: 1, data: 2, db: 2, vector: 2 };
  const subs = [...new Set(edges.flatMap((e) => [e.from, e.to]))];
  const rows = [[], [], []]; for (const s of subs) rows[layer[s] ?? 1].push(s);
  const W = 900, rowY = [86, 214, 342], nw = 196, nh = 62, nodes = [];
  rows.forEach((row, ri) => { const n = row.length || 1; const gap = (W - 60 - row.length * nw) / (row.length + 1); row.forEach((s, i) => nodes.push({ id: s, x: 30 + gap + i * (nw + gap), y: rowY[ri], w: nw, h: nh, tag: ['接口', '业务', '存储/数据'][ri], icon: ICON[s], color: [t.accent2, t.accent, t.ok][ri], label: 'code/server/' + s, sub: DESC[s] || '' })); });
  return diagram({
    W, H: 450, title: '案例 06 · 后端子系统真实依赖（C4 容器 · dogfood）',
    caption: `扫 code/server 真实 import 得 ${edges.length} 条依赖边；循环依赖 ${cycles} 处（适应度函数守护：分层单向依赖）。`,
    nodes, edges: edges.map((e) => ({ from: e.from, to: e.to })),
    legend: [{ label: '接口', color: t.accent2 }, { label: '业务', color: t.accent }, { label: '存储/数据', color: t.ok }],
  }, t);
}

export function archFigures(t) {
  return {
    fig_midplatform: midPlatform(t),
    fig_sdd_pipeline: sddPipeline(t),
    fig_c4_context: c4Context(t),
    fig_c4_container: c4Container(t),
    fig_c4_component: c4Component(t),
    fig_ddd_context: dddContext(t),
    fig_deployment: deployment(t),
    fig_req_sequence: reqSequence(t),
  };
}
