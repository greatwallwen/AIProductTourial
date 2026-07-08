/** 章节示意图套件（Phase A richness）：用 diagram() 给 §2/§4/§5/§6/§99 补图，达到 §3 的视觉厚度。t=主题对象。 */
import { diagram, scatter, matrix } from './diagram.mjs';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';
const ROOT = resolve(import.meta.dirname, '..', '..');
const jj = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));

// §2：控制论反馈闭环（控制器→执行器→传感器→控制器）
function loopCybernetic(t) {
  return diagram({
    W: 940, H: 400, title: '§2 · Loop = 控制论反馈闭环（传感器就是设计本身）',
    caption: '控制器定目标、执行器动手、传感器给「差多少」的误差信号回流——三者成环才叫 Loop。先建传感器(evals/verify)，再谈自动化。',
    nodes: [
      { id: 'ctrl', x: 350, y: 74, w: 250, h: 74, color: t.accent, label: '控制器 · 开发者判断', sub: '定目标 / 改规格 / 把关' },
      { id: 'act', x: 660, y: 250, w: 250, h: 74, color: t.accent2, label: '执行器 · Agent', sub: '按指令生成 / 修复' },
      { id: 'sensor', x: 40, y: 250, w: 250, h: 74, color: t.warn, label: '传感器 · 验证 / evals', sub: '产出「差多少」误差信号' },
    ],
    edges: [
      { from: 'ctrl', to: 'act', label: '下发指令' },
      { from: 'act', to: 'sensor', label: '产物' },
      { from: 'sensor', to: 'ctrl', label: '误差信号回流', color: t.warn },
    ],
    legend: [{ label: '判断', color: t.accent }, { label: '执行', color: t.accent2 }, { label: '验证', color: t.warn }],
  }, t);
}

// §4：YAGNI 七段阶梯（装码前自上而下问一遍）+ 豁免
function yagniLadder(t) {
  const rungs = [
    ['① 真需要存在吗？', '不需要→跳过（YAGNI）'], ['② 代码库已有？', '有→复用，别重写'], ['③ 标准库能搞定？', '优先标准库'],
    ['④ 平台原生有？', '如 <input type="date"> 一行'], ['⑤ 已装依赖里有？', '别再引新库'], ['⑥ 一行能写完？', '能→就一行'], ['⑦ 才写最小可用', '最小实现，不镀金'],
  ];
  const nodes = rungs.map(([label, sub], i) => ({ id: 'r' + i, x: 50, y: 70 + i * 60, w: 380, h: 50, color: t.accent, label, sub }));
  nodes.push({ id: 'ex', x: 470, y: 210, w: 300, h: 150, color: t.bad, dashed: true, tag: '硬豁免', label: '绝不为简洁砍掉', sub: '输入校验 / 错误处理 / 安全 / 无障碍' });
  return diagram({
    W: 810, H: 500, title: '§4 · 装码前的 YAGNI 七段阶梯（反过度工程）',
    caption: '自上而下问一遍，能省则省——但「懒的是解决方案，不是对问题的理解」；右侧四项绝不许为简洁砍掉。',
    nodes, edges: rungs.slice(1).map((_, i) => ({ from: 'r' + i, to: 'r' + (i + 1) })),
  }, t);
}

// §5：AI slop 信号 vs 反制（两栏对比）
function aiSlop(t) {
  const bad = ['紫色渐变背景', 'Inter 字体铺满', '卡片里再套卡片', 'hero 上方药丸小标签', '「Not a tool. A platform.」三段文案'];
  const good = ['OKLCH 色彩空间', '结构化设计词汇表', '用间距 + 层级，不嵌套卡片', '指数衰减代替弹跳缓动', 'practice what you preach（官网自测）'];
  const nodes = [];
  bad.forEach((s, i) => nodes.push({ id: 'b' + i, x: 70, y: 110 + i * 64, w: 380, h: 48, color: t.bad, label: s }));
  good.forEach((s, i) => nodes.push({ id: 'g' + i, x: 530, y: 110 + i * 64, w: 380, h: 48, color: t.ok, label: s }));
  return diagram({
    W: 980, H: 470, title: '§5 · AI slop 反模式 vs 反制（给 AI 一套设计词汇表）',
    caption: '所有前端大模型啃过同一批素材 → 同一身审美肌肉记忆（左）；反制不是更长 prompt，而是结构化词汇表 + 纯规则检测（右，Impeccable）。',
    groups: [{ x: 40, y: 80, w: 440, h: 360, label: 'AI slop 廉价指纹', color: t.bad }, { x: 500, y: 80, w: 440, h: 360, label: '反制', color: t.ok }],
    nodes, edges: [],
  }, t);
}

// §6：L0→L3 上线分级阶梯（每级退出条件）
function l0l3Ladder(t) {
  const rungs = [
    ['L0 草稿', '退出：确认它到底该干什么', t.muted], ['L1 只报告', '退出：误报可接受、判断与我一致（≥1 周）', t.accent2],
    ['L2 辅助', '退出：连续 N 次对、我敢闭眼点同意', t.accent], ['L3 无人值守', '护栏：白名单+成本上限+急停+独立验收+日志', t.ok],
  ];
  const nodes = rungs.map(([label, sub, col], i) => ({ id: 'l' + i, x: 90 + i * 20, y: 320 - i * 74, w: 560, h: 62, color: col, label, sub }));
  return diagram({
    W: 760, H: 440, title: '§6 · Loop 上线分级 L0→L3（把 Loop 当交付管）',
    caption: '像自动驾驶分级放权，每级有明确「毕业考」才升级——拒绝跳级，跳级上线是事故温床。',
    nodes, edges: rungs.slice(1).map((_, i) => ({ from: 'l' + i, to: 'l' + (i + 1), label: '升级' })),
  }, t);
}

// §6：交付门禁看板（三绿 + 风险登记 + 签署）
function gateBoard(t) {
  return diagram({
    W: 940, H: 420, title: '§6 · 交付门禁看板（能不能发，靠可核对的关卡）',
    caption: '把「差不多了」变成一组可自动核对的关卡：三绿全通过是发布必要条件，高影响项仍需人工签署。',
    nodes: [
      { id: 'v', x: 50, y: 90, w: 230, h: 60, color: t.ok, label: 'verify（数百项）', sub: '真数据/诚信/镜头/结构' },
      { id: 'be', x: 50, y: 175, w: 230, h: 60, color: t.ok, label: '后端 node:test', sub: '端点契约断言' },
      { id: 'fe', x: 50, y: 260, w: 230, h: 60, color: t.ok, label: '前端 vitest', sub: '组件/纯逻辑' },
      { id: 'gate', x: 400, y: 175, w: 200, h: 70, color: t.accent, label: '发布门禁', sub: '三绿=必要条件' },
      { id: 'risk', x: 400, y: 300, w: 200, h: 60, color: t.warn, label: '风险登记', sub: '已知风险→自动检测' },
      { id: 'sign', x: 720, y: 175, w: 170, h: 70, color: t.accent2, tag: '人', label: '人工签署', sub: '高影响项' },
    ],
    edges: [
      { from: 'v', to: 'gate' }, { from: 'be', to: 'gate' }, { from: 'fe', to: 'gate' },
      { from: 'risk', to: 'gate', label: '兜底', dashed: true, color: t.warn }, { from: 'gate', to: 'sign', label: '绿灯→签署' },
    ],
  }, t);
}

// §99：结课回顾路径（一条主线串全书）
function journey(t) {
  const ms = [
    ['§1 认知', 'AI 底层'], ['§2 Loop', '操作模型脊柱'], ['§3 架构方法论', 'SDD/C4/DDD'], ['§4-5 规范·设计', '研发/产品底子'], ['§6 治理', '项目门禁'], ['15 案例', '真数据·可运行'], ['你的项目', '把方法用起来'],
  ];
  const nodes = ms.map(([label, sub], i) => ({ id: 'm' + i, x: 30 + i * 168, y: 130, w: 150, h: 74, color: i === ms.length - 1 ? t.ok : t.accent, label, sub }));
  return diagram({
    W: 1210, H: 300, title: '§99 · 结课回顾：一条主线串起全书（一个操作模型·三个镜头）',
    caption: '认知→Loop→架构方法论→规范/设计→治理→案例→你的项目；主脊 §1-§2 三镜头共读，其余按角色深读。',
    nodes, edges: ms.slice(1).map((_, i) => ({ from: 'm' + i, to: 'm' + (i + 1) })),
  }, t);
}

// §7：Skill Registry 生命周期（draft→reviewing→online→offline + scanner 门禁）
function skillLifecycle(t) {
  return diagram({
    W: 960, H: 360, title: '§7 · Skill Registry 生命周期（发布前扫，上线不可改）',
    caption: 'draft→reviewing→online→offline；skill-scanner「不过则不发布」；online 内容不可改，改需新建草稿。来源：Nacos Skill Registry（阿里巴巴）。',
    nodes: [
      { id: 'draft', x: 40, y: 96, w: 180, h: 70, color: t.muted, tag: '草稿', label: 'draft', sub: '可改·多人别并行' },
      { id: 'review', x: 275, y: 96, w: 180, h: 70, color: t.warn, tag: '审核', label: 'reviewing', sub: '过 scanner 才放行' },
      { id: 'online', x: 510, y: 96, w: 180, h: 70, color: t.ok, tag: '上线', label: 'online', sub: '内容不可改' },
      { id: 'offline', x: 745, y: 96, w: 175, h: 70, color: t.muted, tag: '下线', label: 'offline', sub: '不再使用' },
      { id: 'scan', x: 275, y: 232, w: 415, h: 66, color: t.bad, label: 'skill-scanner · 不过则不发布', sub: '提示注入 / 数据泄露 / 恶意代码' },
    ],
    edges: [
      { from: 'draft', to: 'review', label: '提交' }, { from: 'review', to: 'online', label: '过审' }, { from: 'online', to: 'offline', label: '退役' },
      { from: 'scan', to: 'review', label: '门禁', dashed: true, color: t.bad }, { from: 'online', to: 'draft', label: '改需新草稿', dashed: true, color: t.muted },
    ],
    legend: [{ label: '草稿/下线', color: t.muted }, { label: '审核', color: t.warn }, { label: '上线', color: t.ok }, { label: '扫描门禁', color: t.bad }],
  }, t);
}
// §7：Skill 分发（Registry → 多 Agent，一次创建团队共用）
function skillDistribution(t) {
  return diagram({
    W: 980, H: 380, title: '§7 · Skill 分发：一处治理，多 Agent 共用',
    caption: '团队/个人上传 → Registry 版本+审核+权限 → CLI/API 分发到各 Agent；个人多 Agent 也从同一处同步，不再散落各目录。',
    nodes: [
      { id: 'up', x: 50, y: 150, w: 170, h: 70, color: t.accent2, tag: '人', label: '团队 / 个人', sub: 'upload 草稿' },
      { id: 'reg', x: 380, y: 130, w: 220, h: 110, color: t.accent, label: '私有 Skill Registry', sub: '版本 · 审核 · RBAC · PUBLIC/PRIVATE' },
      { id: 'scan', x: 380, y: 290, w: 220, h: 56, color: t.bad, label: 'skill-scanner', sub: '发布前扫描' },
      { id: 'cc', x: 760, y: 60, w: 180, h: 56, color: t.ok, label: 'Claude Code', sub: 'skill-get / sync' },
      { id: 'cx', x: 760, y: 152, w: 180, h: 56, color: t.ok, label: 'Codex', sub: 'skill-get / sync' },
      { id: 'own', x: 760, y: 244, w: 180, h: 56, color: t.ok, label: '自建 Agent', sub: 'skill-get / sync' },
    ],
    edges: [
      { from: 'up', to: 'reg', label: 'upload' }, { from: 'scan', to: 'reg', label: '门禁', dashed: true, color: t.bad },
      { from: 'reg', to: 'cc', label: '分发' }, { from: 'reg', to: 'cx' }, { from: 'reg', to: 'own' },
    ],
    legend: [{ label: '上传者', color: t.accent2 }, { label: 'Registry', color: t.accent }, { label: 'Agent', color: t.ok }, { label: '扫描', color: t.bad }],
  }, t);
}

// §2.6：AI 驱动开发组合拳（治理→规格→纪律→自动化）+ 本书 dogfood 对应
function comboPipeline(t) {
  const st = [
    ['① 治理', 'GStack · 虚拟团队', t.accent2, '本书：三镜头 + §6 治理'],
    ['② 规格', 'OpenSpec · SDD', t.accent, '本书：§3 规格驱动'],
    ['③ 纪律', 'Superpowers · TDD', t.warn, '本书：§4 工程规范'],
    ['④ 自动化', 'Ralph · while 循环', t.ok, '本书：self-evolve(Ralph 实例)'],
  ];
  const w = 232, gap = 26, x0 = 30, y1 = 96, y2 = 250;
  const nodes = [], edges = [];
  st.forEach(([label, sub, col, book], i) => {
    const x = x0 + i * (w + gap);
    nodes.push({ id: 't' + i, x, y: y1, w, h: 74, color: col, label, sub });
    nodes.push({ id: 'b' + i, x, y: y2, w, h: 62, color: t.muted, label: book.split('：')[1], sub: 'dogfood' });
    edges.push({ from: 't' + i, to: 'b' + i, label: '本书对应', dashed: true, color: t.muted });
    if (i) edges.push({ from: 't' + (i - 1), to: 't' + i });
  });
  return diagram({
    W: x0 * 2 + 4 * w + 3 * gap, H: 380, title: '§2.6 · AI 驱动开发组合拳：治理 → 规格 → 纪律 → 自动化',
    caption: '让 AI 像守纪律的工程团队而非情绪化实习生。上排真实工具生态，下排本书 dogfood 对应物；Ralph=Geoffrey Huntley。',
    nodes, edges,
    legend: [{ label: '治理', color: t.accent2 }, { label: '规格', color: t.accent }, { label: '纪律', color: t.warn }, { label: '自动化', color: t.ok }],
  }, t);
}

// §2.6：CodeBuddy 模式 ↔ 本书概念（国产·当下可跑的组合拳落点；模式是脊柱、工具是实例）
function codebuddyMap(t) {
  const st = [
    ['Ask 对话', '技术问答 / 提示词', t.muted, '§2 提示词工程'],
    ['Craft 智能体', '多文件生成·重构·测试', t.accent2, '研发镜头 build/test Loop'],
    ['Plan 规划', '先列任务清单·再自主执行', t.accent, '§3 SDD 分解 + 组合拳自动化'],
    ['design-to-code', 'UI 设计一键转码', t.warn, '§5 设计系统'],
    ['MCP 连接', '国内首家支持 MCP', t.ok, '§1 MCP / §2 连接'],
  ];
  const w = 196, gap = 20, x0 = 28, y1 = 100, y2 = 256;
  const nodes = [], edges = [];
  st.forEach(([label, sub, col, book], i) => {
    const x = x0 + i * (w + gap);
    nodes.push({ id: 'm' + i, x, y: y1, w, h: 76, color: col, label, sub });
    nodes.push({ id: 'c' + i, x, y: y2, w, h: 64, color: t.muted, label: book, sub: '本书概念' });
    edges.push({ from: 'm' + i, to: 'c' + i, label: '对应', dashed: true, color: t.muted });
  });
  return diagram({
    W: x0 * 2 + 5 * w + 4 * gap, H: 392, title: 'CodeBuddy 模式 ↔ 本书概念（国产·当下可跑的落点）',
    caption: '腾讯云代码助手，三形态 IDE/CLI/插件。模式是脊柱，CodeBuddy 是中文读者当下能装能跑的实例（来源：腾讯/媒体）。',
    nodes, edges,
    legend: [{ label: '上排 · CodeBuddy 模式', color: t.accent }, { label: '下排 · 本书概念', color: t.muted }],
  }, t);
}


// —— v18-P4 数据驱动真值图（从 code/data 与仓库真值画，非示意） ——

// §2：评测鸿沟——语料覆盖 vs 检索命中（案例 49 真实值）
function evalGap(t) {
  const j = jj('code/data/case_49.json'); const base = jj('code/data/eval_baseline.json');
  const cov = j.kpis.find((k) => k.name === '覆盖达标数').value, n = j.kpis.find((k) => k.name === '评测问题数').value;
  const covPct = Math.round(cov / n * 1000) / 10, hit = base.score;
  const W = 640, H = 340, bw = 150;
  const bar = (x, v, col, lab) => `<rect x="${x}" y="${(280 - v * 2.2).toFixed(1)}" width="${bw}" height="${(v * 2.2).toFixed(1)}" rx="8" fill="${col}" opacity="0.85"/><text x="${x + bw / 2}" y="${(270 - v * 2.2).toFixed(1)}" font-size="20" font-weight="750" fill="${col}" text-anchor="middle">${v}%</text><text x="${x + bw / 2}" y="300" font-size="12" fill="${t.ink2}" text-anchor="middle">${lab}</text>`;
  return diagram({ W, H, title: '§2 · 评测鸿沟：语料「有」≠ 检索「中」（案例 49 实测）', caption: `金标 ${n} 题：覆盖达标 ${covPct}% vs hit@3 ${hit}%——差距=可驱动 Loop 的误差信号。数据实时取自 eval_baseline.json/case_49.json。`, nodes: [], edges: [] }, t).replace('</svg>', bar(120, covPct, t.ok, `语料覆盖达标 ${cov}/${n} 题`) + bar(370, hit, t.bad, '检索命中 hit@3') + '</svg>');
}

// §4：单文件 <800 行红线的真实证据（扫源码实数）
function locEvidence(t) {
  const files = [];
  const walk = (d) => { for (const e of readdirSync(join(ROOT, d))) { const p = join(d, e); if (statSync(join(ROOT, p)).isDirectory()) { if (!['node_modules', 'dist', 'data'].includes(e)) walk(p); } else if (['.mjs', '.ts', '.tsx'].includes(extname(e)) && !/test/.test(e)) files.push([p, readFileSync(join(ROOT, p), 'utf8').split('\n').length]); } };
  walk('code/tools'); walk('code/server'); walk('code/web/src');
  const top = files.sort((a, b) => b[1] - a[1]).slice(0, 9);
  const W = 720, H = 380, x0 = 210, bw = (v) => v / 800 * (W - x0 - 60);
  let g = `<line x1="${x0 + bw(800)}" y1="70" x2="${x0 + bw(800)}" y2="${H - 60}" stroke="${t.bad}" stroke-dasharray="5 3"/><text x="${x0 + bw(800)}" y="62" font-size="10" fill="${t.bad}" text-anchor="middle">800 行红线</text>`;
  top.forEach(([f, n], i) => { const y = 80 + i * 30; g += `<text x="${x0 - 8}" y="${y + 11}" font-size="9.5" fill="${t.ink2}" text-anchor="end">${f.replace(/^code\//, '')}</text><rect x="${x0}" y="${y}" width="${bw(n).toFixed(1)}" height="16" rx="5" fill="${n > 720 ? t.warn : t.accent}" opacity="0.85"/><text x="${(x0 + bw(n) + 6).toFixed(1)}" y="${y + 12}" font-size="10" fill="${t.ink}">${n}</text>`; });
  return diagram({ W, H, title: '§4 · 「单文件 <800 行」不是口号：全仓 Top9 真实行数', caption: '构建期实扫 code/（黄=逼近 720 预警线，critic big-file 探针盯守）——规范自己先过自己的门禁。', nodes: [], edges: [] }, t).replace('</svg>', g + '</svg>');
}

// 案例30：真实客户 vs 教学合成 R×F 双散点（双轨诚实的可视化）
function rfmDual(t) {
  const pick = (path, rc, fc, mod) => { const lines = readFileSync(join(ROOT, path), 'utf8').trim().split('\n'); const head = lines[0].split(','); const ri = head.indexOf(rc), fi = head.indexOf(fc); return lines.slice(1).filter((_, i) => i % mod === 0).slice(0, 120).map((l) => { const c = l.split(','); return { x: Number(c[ri]) || 0, y: Number(c[fi]) || 0 }; }); };
  const real = pick('dataset/reference_data_analysis/2b-real_rfm.csv', '最近购买天数', '购买次数', 13);
  const synth = pick('dataset/reference_data_analysis/2-air_data.csv', '最近乘机天数', '年飞行次数', 6);
  return scatter({ W: 720, H: 420, title: '案例 30 · 真实客户 vs 教学合成：R×F 双散点', caption: '绿=UCI 快照真实客户（长尾、噪）；黄=教学合成（分层清晰、埋点可控）——这就是「教学合成为何存在、为何必须标注」。', xLabel: 'R · 最近一次距今(天)', yLabel: 'F · 频次', series: [{ label: '真实(UCI 1665 客户抽样)', color: t.ok, points: real }, { label: '教学合成(800 会员抽样)', color: t.warn, points: synth }] }, t);
}

// §9：分布式四件套 → 多 Agent 同构（双排映射）
function distIso(t) {
  const st = [["远程调用", "RPC/gRPC", "工具调用 + MCP", t.accent], ["注册发现", "注册中心", "Skill Registry", t.accent2], ["容错", "熔断/重试", "停机规则+独立会话", t.warn], ["监控治理", "APM", "活体门禁+回归门", t.ok]];
  const w = 200, gap = 22, x0 = 30, nodes = [], edges = [];
  st.forEach(([prob, old, ai, col], i) => { const x = x0 + i * (w + gap);
    nodes.push({ id: 'o' + i, x, y: 90, w, h: 62, color: t.muted, label: old, sub: prob });
    nodes.push({ id: 'a' + i, x, y: 230, w, h: 62, color: col, label: ai, sub: '多 Agent 同构' });
    edges.push({ from: 'o' + i, to: 'a' + i, label: '同构', dashed: true, color: t.muted }); });
  return diagram({ W: x0 * 2 + 4 * w + 3 * gap, H: 350, title: '§9 · 分布式四件套的 AI 同构：老问题换宿主', caption: '上排=经典答案，下排=多 Agent 形态；每项在本书都有真实锚点（§1/§6/stop-rules//api/gates）。', nodes, edges }, t);
}

// §8：聚合根=一致性边界（defs 案例聚合的真实结构）
function aggregateRoot(t) {
  const defs = jj('code/tools/case_definitions.json');
  const c = defs.cases.find((x) => x.num === 30);
  const nodes = [
    { id: 'root', x: 320, y: 70, w: 300, h: 64, color: t.accent, label: `聚合根 · 案例 ${c.num}`, sub: 'case_definitions.json（唯一入口）' },
    { id: 'f', x: 40, y: 210, w: 200, h: 56, color: t.muted, label: `fields ×${c.fields.length}`, sub: '守卫: fields⊆表头' },
    { id: 'm', x: 260, y: 210, w: 200, h: 56, color: t.muted, label: `metricChain ×${c.metricChain.length}`, sub: '守卫: KPI 数一致' },
    { id: 'e', x: 480, y: 210, w: 200, h: 56, color: t.muted, label: `exceptionStates ×${c.exceptionStates.length}`, sub: '守卫: 异常可追踪' },
    { id: 's', x: 700, y: 210, w: 200, h: 56, color: t.muted, label: `skills ×${c.skills.length}`, sub: '守卫: 已注册' },
  ];
  const edges = ['f', 'm', 'e', 's'].map((id) => ({ from: 'root', to: id }));
  return diagram({ W: 940, H: 330, title: '§8 · 聚合根=一致性边界：案例聚合的真实结构', caption: '子对象只能经根修改（改 defs→重建）；verify 守卫=聚合不变量的机器化。数字为案例 30 实时读数。', nodes, edges }, t);
}

export function chapterFigures(t) {
  return {
    fig_loop_cybernetic: loopCybernetic(t), fig_yagni_ladder: yagniLadder(t), fig_ai_slop: aiSlop(t),
    fig_l0l3_ladder: l0l3Ladder(t), fig_gate_board: gateBoard(t), fig_journey: journey(t),
    fig_skill_lifecycle: skillLifecycle(t), fig_skill_distribution: skillDistribution(t), fig_combo_pipeline: comboPipeline(t),
    fig_codebuddy_map: codebuddyMap(t),
    fig_eval_gap: evalGap(t), fig_loc_evidence: locEvidence(t), fig_rfm_dual: rfmDual(t), fig_dist_iso: distIso(t), fig_aggregate_root: aggregateRoot(t),
  };
}
