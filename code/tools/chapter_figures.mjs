/** 章节示意图套件（Phase A richness）：用 diagram() 给 §2/§4/§5/§6/§99 补图，达到 §3 的视觉厚度。t=主题对象。 */
import { diagram } from './diagram.mjs';

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

export function chapterFigures(t) {
  return {
    fig_loop_cybernetic: loopCybernetic(t), fig_yagni_ladder: yagniLadder(t), fig_ai_slop: aiSlop(t),
    fig_l0l3_ladder: l0l3Ladder(t), fig_gate_board: gateBoard(t), fig_journey: journey(t),
  };
}
