export type CapabilityId =
  | "logic"
  | "prompt"
  | "agent-skills"
  | "loop"
  | "architecture"
  | "engineering"
  | "business-cases";

export type CapabilityNode = {
  id: CapabilityId;
  order: number;
  eyebrow: string;
  title: string;
  question: string;
  outcome: string;
  points: readonly [string, string, string];
  resources: string;
  position: { x: number; y: number };
  tone: "cyan" | "blue" | "violet" | "orange";
};

export const COURSE_CAPABILITIES: readonly CapabilityNode[] = [
  {
    id: "logic",
    order: 1,
    eyebrow: "判断底座",
    title: "逻辑与证据",
    question: "这句话是事实、推断，还是准备采取的行动？",
    outcome: "能把结论拆回数据、口径和可核查的前提。",
    points: ["事实 / 推断 / 决定", "测量与样本边界", "反例与证伪"],
    resources: "第 1 章 · B001 / B004",
    position: { x: 12, y: 68 },
    tone: "cyan",
  },
  {
    id: "prompt",
    order: 2,
    eyebrow: "一次回答",
    title: "Prompt 工程",
    question: "怎样把一句愿望改成可执行、可比较、可验收的任务？",
    outcome: "能写出任务、上下文、约束、输出和检查组成的 Prompt。",
    points: ["任务与验收", "正例、反例与追问", "工具参数与回归样本"],
    resources: "P001—P008 · 18 个课堂实验",
    position: { x: 27, y: 48 },
    tone: "blue",
  },
  {
    id: "agent-skills",
    order: 3,
    eyebrow: "完成作品",
    title: "Agent + Skills",
    question: "模型什么时候该选工具，什么时候必须停下来？",
    outcome: "能把数据、文档、视觉、游戏和 3D 方法封装成可复用 Skill。",
    points: ["能力分诊", "Skill 合同与脚本", "作品检查与权限"],
    resources: "S001—S009 · CodeBuddy 实操",
    position: { x: 42, y: 67 },
    tone: "violet",
  },
  {
    id: "loop",
    order: 4,
    eyebrow: "多步推进",
    title: "Grill / Harness / Loop",
    question: "中间结果不合格时，系统怎样追问、修正、交接或停止？",
    outcome: "能设计有入口、检查点、失败分支和停止条件的工作回路。",
    points: ["必要追问", "工具与检查护栏", "恢复、交接与停止"],
    resources: "第 4 章 · L001—L003",
    position: { x: 54, y: 39 },
    tone: "orange",
  },
  {
    id: "architecture",
    order: 5,
    eyebrow: "系统骨架",
    title: "产品与系统架构",
    question: "怎样把角色、数据、状态、事件和权限装进同一个产品？",
    outcome: "能从业务决定推到 C4、DDD、事件、MCP 与 A2A 边界。",
    points: ["需求与质量属性", "领域、状态与事件", "MCP / A2A 协作"],
    resources: "第 5 章 · B007 / B010",
    position: { x: 69, y: 58 },
    tone: "blue",
  },
  {
    id: "engineering",
    order: 6,
    eyebrow: "可靠交付",
    title: "工程与验收",
    question: "怎样证明系统能运行、能恢复，也经得起下一次修改？",
    outcome: "能用 React、Next.js、测试、构建和浏览器回执完成交付。",
    points: ["React / Next.js", "测试与真实浏览器", "恢复、发布与复盘"],
    resources: "第 6 章 · 可执行证据",
    position: { x: 82, y: 34 },
    tone: "cyan",
  },
  {
    id: "business-cases",
    order: 7,
    eyebrow: "岗位实战",
    title: "综合业务案例",
    question: "面对真实岗位、真实数据和真实约束，下一步到底怎么做？",
    outcome: "能在零售、工业、医学等场景完成可解释、可追踪的业务决定。",
    points: ["24 个行业案例", "角色、状态与操作", "数据、截图与边界"],
    resources: "B001—B024 · 案例驾驶舱",
    position: { x: 89, y: 69 },
    tone: "orange",
  },
] as const;

export const CAPABILITY_STORAGE_KEY = "ai-product-course-lit-capabilities-v1";
