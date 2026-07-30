export type CaseTourRuntime = {
  state: string;
  actorRole: string;
  completedCommands?: string[];
};

export type CaseTourGate =
  | { kind: "state"; anyOf: string[] }
  | { kind: "role"; equals: string }
  | { kind: "command"; anyOf: string[] };

export type CaseTourStep = {
  id: string;
  element: string;
  title: string;
  description: string;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  gate?: CaseTourGate;
};

export type CaseTourDefinition = {
  caseId: string;
  featuredObjectId: string;
  title: string;
  steps: CaseTourStep[];
};

type StandardTourSeed = {
  caseId: string;
  featuredObjectId: string;
  title: string;
  contextTitle: string;
  context: string;
  factsTitle: string;
  facts: string;
  primaryTitle: string;
  primaryAction: string;
  primaryState: string;
  handoff: string;
  supervisorTitle: string;
  supervisorAction: string;
  finalState: string;
  result: string;
};

function selector(caseId: string, anchor: "context" | "workspace" | "result"): string {
  return '[data-tour~="case-' + caseId + '-' + anchor + '"]';
}

function standardTour(seed: StandardTourSeed): CaseTourDefinition {
  const workspace = selector(seed.caseId, "workspace");
  return {
    caseId: seed.caseId,
    featuredObjectId: seed.featuredObjectId,
    title: seed.title,
    steps: [
      {
        id: "case-context",
        element: selector(seed.caseId, "context"),
        title: seed.contextTitle,
        description: seed.context,
        side: "bottom",
        align: "start",
      },
      {
        id: "read-facts",
        element: workspace,
        title: seed.factsTitle,
        description: seed.facts,
        side: "top",
        align: "start",
      },
      {
        id: "primary-action",
        element: workspace,
        title: seed.primaryTitle,
        description: seed.primaryAction,
        side: "left",
        align: "end",
        gate: { kind: "state", anyOf: [seed.primaryState] },
      },
      {
        id: "handoff-role",
        element: workspace + ' [aria-label="当前操作角色"]',
        title: "换一个岗位接手",
        description: seed.handoff,
        side: "bottom",
        align: "end",
        gate: { kind: "role", equals: "supervisor" },
      },
      {
        id: "supervisor-action",
        element: workspace,
        title: seed.supervisorTitle,
        description: seed.supervisorAction,
        side: "left",
        align: "end",
        gate: { kind: "state", anyOf: [seed.finalState] },
      },
      {
        id: "saved-result",
        element: selector(seed.caseId, "result"),
        title: "结果已经写回业务对象",
        description: seed.result,
        side: "bottom",
        align: "end",
      },
    ],
  };
}

const standardSeeds: StandardTourSeed[] = [
  {
    caseId: "02",
    featuredObjectId: "02-U00725",
    title: "会员优惠试投",
    contextTitle: "先看预算，不先猜转化率",
    context: "固定演示会员 U00725 属于首批候选池。任务是在 3,000 元预算内形成可复现的 8 元券试投名单。",
    factsTitle: "浏览、加购、购买要放在一起看",
    facts: "页面把匿名行为分、价值分层和候选名单放在同一工作区；这些字段只能决定试投入组，不能冒充真实增量。",
    primaryTitle: "把试投方案变成一张名单",
    primaryAction: "填写试投假设、处理组比例、指标、观察周期和停损线，确认预算后点击“提交首批试投名单”。",
    primaryState: "试投待审",
    handoff: "把“当前操作角色”切换为业务主管。主管只审核已经保存的名单、预算和停损条件。",
    supervisorTitle: "主管确认首批名单",
    supervisorAction: "核对处理组与对照组没有重叠，再点击“确认首批名单”；不要填写任何虚构的投放结果。",
    finalState: "首批名单已确认",
    result: "名单、预算和分组种子已经保存；页面仍不宣称转化提升，因为真实投放尚未发生。",
  },
  {
    caseId: "03",
    featuredObjectId: "03-17229",
    title: "餐饮评论调查",
    contextTitle: "从一条原话进入问题",
    context: "评论 17229 只是样本入口。目标不是自动总结 6,970 条评论，而是把一个顾客体验信号变成可验证的调查。",
    factsTitle: "同时保留支持样本和反例",
    facts: "先选研究主题，再各选至少一条支持评论和相反评论；只有正例没有反例，研究问题很容易变成自我证明。",
    primaryTitle: "创建一项能被推翻的调查",
    primaryAction: "写成问题句，填写研究方法、样本量、观察窗口和通过条件，然后点击“创建调查任务”。",
    primaryState: "待验证",
    handoff: "切换为业务主管。主管看到的是评论原文、反例和调查条件，不是模型生成的结论。",
    supervisorTitle: "把调查排进真实工作",
    supervisorAction: "核对负责人、样本量和成功条件后点击“安排调查”。证据不足时应暂不安排，而不是硬给结论。",
    finalState: "已排入验证",
    result: "评论信号已经成为有负责人、有反例、有判断条件的调查任务。",
  },
  {
    caseId: "05",
    featuredObjectId: "05-TRN-0001-TRN-0001-06",
    title: "转运晚到事件调和",
    contextTitle: "先分清发生时间和接收时间",
    context: "TRN-0001 的更正 08:27 已发生，09:09 才进入系统。晚到不等于错误，也不能覆盖已经发生的历史。",
    factsTitle: "一条转运有两只时钟",
    facts: "沿时间线核对业务发生时钟、系统接收时钟、床位申请和流程令牌，确认这条更正属于同一转运单。",
    primaryTitle: "由发出方提交调和决定",
    primaryAction: "选择权威运营状态，填写调和依据与发出方确认人，点击“提交调和决定”。",
    primaryState: "待接收会签",
    handoff: "切换为接收方主管。接收会签人必须与发出方确认人不同，历史事件仍然保留。",
    supervisorTitle: "接收方完成第二次会签",
    supervisorAction: "填写接收方会签意见并点击“完成接收会签”；有冲突就升级协调，不要覆盖原记录。",
    finalState: "交接已确认",
    result: "更正、原事件和双人会签同时留存，交接状态才被确认。",
  },
  {
    caseId: "07",
    featuredObjectId: "07-CN-FC-COURSE-01-2026-07-14",
    title: "即时履约架构评审",
    contextTitle: "请求少不代表履约一定快",
    context: "这个日期窗口里请求量下降，履约 P95 却升高。先锁定同一场站、同一天的事实，再讨论架构。",
    factsTitle: "四个业务域必须对齐到同一窗口",
    facts: "核对订单、库存、履约、通知四域的请求、延迟、发布、故障和恢复记录，避免拿不同日期的指标拼结论。",
    primaryTitle: "保存一份最小 ADR",
    primaryAction: "选择至少两项事实、两项约束和两项风险，写下可验证假设，点击“锁定评审窗口”。",
    primaryState: "架构评审中",
    handoff: "切换为架构评审主管。主管可以继续模块化观察、补观测，或批准一条最小事件契约试点。",
    supervisorTitle: "先选择最小可逆路径",
    supervisorAction: "本演示选择“继续模块化观察”；填写签署说明后提交，不因一次慢窗口立即拆微服务。",
    finalState: "模块化观察中",
    result: "架构决定绑定了同窗事实、约束和风险，后续可以用新数据推翻或升级。",
  },
  {
    caseId: "09",
    featuredObjectId: "09-METROPT-20200418-GAP-01",
    title: "空压机遥测断档调查",
    contextTitle: "352 秒空白不能当成设备故障",
    context: "固定调查窗口有 352 秒没有遥测。任务是解释断档并决定是否申请现场目视检查，不是远程诊断设备。",
    factsTitle: "同时看断档前后值和本地资料",
    facts: "核对压力、油温、电流在断档前后的连续窗口，并区分支持资料与边界资料。",
    primaryTitle: "先把检索问题问清楚",
    primaryAction: "填写调查问题，运行本地资料核对，分别选择支持引用和限制引用，然后保存核对结果。",
    primaryState: "资料已核对",
    handoff: "切换为检修主管。主管只能基于已保存的资料核对任务申请现场目视检查。",
    supervisorTitle: "提交人工检查申请",
    supervisorAction: "完成三项安全检查，确认动作仍是“现场目视检查”，点击“提交现场目视检查申请”。",
    finalState: "检查申请已提交",
    result: "系统保存的是带引用的检查申请，不是对空压机故障原因的自动判定。",
  },
  {
    caseId: "11",
    featuredObjectId: "11-MODEL-ADMISSION-001-MODEL-GATE-2026-1",
    title: "企业模型准入补测",
    contextTitle: "一项地区切片不过线就不能跳过",
    context: "候选模型的总体分数不是准入通行证；地区切片缺失时，风险、公平、安全三类检查都不能被总分覆盖。",
    factsTitle: "把门槛、样本和政策版本锁在一起",
    facts: "核对候选编号、政策版本、三类检查和原评测样本量，避免用新结果回答旧政策。",
    primaryTitle: "发起同口径地区补测",
    primaryAction: "填写补测数据版本、地区切片、样本量和负责人，点击“发起地区切片补测”。",
    primaryState: "补测中",
    handoff: "补测记录完成后切换为准入主管；评审人必须与任务创建人分离。",
    supervisorTitle: "逐项签署后再确认",
    supervisorAction: "确认补测达到当前门槛并完成三类独立签署，然后点击“确认补测已完成”。",
    finalState: "补测已确认",
    result: "页面确认的是本地补测完成，不等同于生产发布批准。",
  },
  {
    caseId: "12",
    featuredObjectId: "12-CCI-2026-001-CN-SC-PZ-01",
    title: "县域冷链运输记录调查",
    contextTitle: "先看运输时间带，不先下质量结论",
    context: "这条县域路线有 30 条温度记录和 5 次越界。调查只核对记录链，不能替代产品质量判断。",
    factsTitle: "温度、设备、路线和交接要成套",
    facts: "沿真实时间带选中权威事件，核对峰值、设备记录、路线记录和交接记录，缺项要明确标出。",
    primaryTitle: "冻结一张运输调查单",
    primaryAction: "选择调查事件和冻结范围，填写负责人、调查窗口与说明，点击“启动运输记录调查”。",
    primaryState: "调查中",
    handoff: "切换为质量主管。若交接证据仍缺失，应选择等待补证，不能直接完成复核。",
    supervisorTitle: "证据齐全后完成复核",
    supervisorAction: "确认补录证据已核验，填写复核意见，点击“完成调查复核”。",
    finalState: "调查已复核",
    result: "运输记录调查已经闭合；页面没有把越界次数写成产品质量结论。",
  },
  {
    caseId: "13",
    featuredObjectId: "13-CN-AS-001",
    title: "接车通话安全分流",
    contextTitle: "制动异响先问能不能安全移动",
    context: "CN-AS-001 是一次服务进线，不是诊断工单。接车专员先确认车辆状态和安全边界，再决定交给哪个技师组。",
    factsTitle: "四个问题决定是否能继续分流",
    facts: "逐题记录异响时机、制动脚感、警示灯和是否可安全移动；没有回答就请求补充。",
    primaryTitle: "写清楚交接，不替技师下结论",
    primaryAction: "完成安全核对，选择技师组与响应时间，填写交接说明后点击“转交技师安全复核”。",
    primaryState: "技师复核已提交",
    handoff: "切换为技师主管。主管接收的是客户原话和安全核对，不是自动诊断结果。",
    supervisorTitle: "确认技师组已经接收",
    supervisorAction: "填写接收范围和下一步核对说明，点击“确认复核已接收”。",
    finalState: "技师已接收",
    result: "接车信息完成了岗位交接；车辆故障原因仍由后续人工检视确认。",
  },
  {
    caseId: "14",
    featuredObjectId: "14-FQ-0016",
    title: "连续高硅事件调查",
    contextTitle: "39 小时事件比一个高点更重要",
    context: "FQ-0016 是连续高硅事件。页面固定 72 小时窗口，避免只截取一个异常点解释整个过程。",
    factsTitle: "趋势和三列浮选槽一起看",
    facts: "先核对连续趋势、事件终点和三、一、二号槽的风量与液位，所有优先项来自数据规则而非根因判断。",
    primaryTitle: "提交一张工艺复核单",
    primaryAction: "选择时间窗、三列槽体、核查方向、负责人和日期，填写说明后点击“提交工艺复核”。",
    primaryState: "工艺复核中",
    handoff: "切换为生产主管。主管看到的是待核查假设和完整窗口，不能直接修改运行参数。",
    supervisorTitle: "下发仪表核查",
    supervisorAction: "填写主管意见并点击“下发仪表核查”；若有人要求自动调参，应选择阻断。",
    finalState: "核查已下发",
    result: "工艺事件已转为人工核查任务，根因和调参决定仍未被系统擅自生成。",
  },
  {
    caseId: "15",
    featuredObjectId: "15-SECOM-0003",
    title: "半导体生产记录复测",
    contextTitle: "SECOM-0003 是匿名观测，不是真实批次",
    context: "公开数据只有匿名信号、质量标签和缺失值。页面不得虚构设备、工序或晶圆批次。",
    factsTitle: "先定位缺失通道，再设计复测",
    facts: "核对质量标签、复核优先级、匿名信号原值和缺失状态，选择要复测的开放通道。",
    primaryTitle: "隔离记录并提交复测",
    primaryAction: "填写复测协议、通道、负责人和证据编号，点击“隔离记录并提交复测”。",
    primaryState: "复测申请已提交",
    handoff: "切换为质量主管。主管确认的是复测申请的完整性，不是对生产批次放行。",
    supervisorTitle: "确认复测申请",
    supervisorAction: "填写独立复核意见并点击“确认复测申请”。如仍需观察，应继续隔离记录。",
    finalState: "复测申请已确认",
    result: "匿名生产观测获得了可追溯的复测任务，页面没有编造制造现场事实。",
  },
  {
    caseId: "16",
    featuredObjectId: "16-7-1",
    title: "风机出力下偏核查",
    contextTitle: "连续七天的标记仍不是故障结论",
    context: "风机 T007 连续七个运行日出现下偏标记。先补同群基线、限电和告警，再谈原因。",
    factsTitle: "把风速、功率和日级标记对齐",
    facts: "核对同一风机同一天的风速、功率和下偏占比，并记录当前缺失的同群数据。",
    primaryTitle: "提交现场核查请求",
    primaryAction: "选择核查项、负责人和日期，写清为什么需要现场材料，点击“提交现场核查”。",
    primaryState: "现场核查中",
    handoff: "切换为可靠性主管。主管只确认材料收件和核查范围，不把下偏标记改写成故障。",
    supervisorTitle: "确认核查材料已收件",
    supervisorAction: "核对回传材料与原请求一致，填写主管意见后点击“确认核查材料已收件”。",
    finalState: "现场核查已提交",
    result: "七日下偏线索已经形成现场核查记录，归因仍等待同群、限电和告警资料。",
  },
  {
    caseId: "17",
    featuredObjectId: "17-BD-0003",
    title: "切刀波形复核",
    contextTitle: "三路波形必须共用同一个游标",
    context: "BD-0003 的三路同步波形都在。任务是保存可复核的排检候选，不从一个偏差指数直接推断故障。",
    factsTitle: "在同一采样窗口核对三路原始值",
    facts: "移动共享游标，确认三路信号来自同一时刻，并记录窗口、偏差等级和观察理由。",
    primaryTitle: "保存排检候选",
    primaryAction: "填写排检窗口、检查项、负责人和理由，点击“保存排检候选”。",
    primaryState: "排检候选待确认",
    handoff: "切换为维护主管。主管核对的是同一游标和同一窗口下的记录。",
    supervisorTitle: "确认进入排检候选",
    supervisorAction: "填写确认说明并点击“确认排检候选”；证据不足时继续采样观察。",
    finalState: "排检候选已确认",
    result: "三路同步波形被保存为可复核候选，页面没有把候选写成已确诊故障。",
  },
  {
    caseId: "19",
    featuredObjectId: "19-217",
    title: "液压循环检查排序",
    contextTitle: "三项同级时，排序本身就是决策",
    context: "第 217 次测量循环里三个部件处于同级重点。任务是给人工检查排顺序，不是给设备下故障诊断。",
    factsTitle: "四个部件状态要同窗核对",
    facts: "查看冷却器、阀、泵和蓄能器在同一循环的状态，把同级项的先后理由写清。",
    primaryTitle: "提交检查顺序",
    primaryAction: "拖排或选择三个重点部件的顺序，填写负责人、时间和理由，点击“提交检查顺序”。",
    primaryState: "检查顺序待确认",
    handoff: "切换为可靠性主管。主管确认顺序和理由，不修改原始循环数据。",
    supervisorTitle: "确认现场检查顺序",
    supervisorAction: "填写主管意见并点击“确认检查顺序”；无法区分时可继续循环采样。",
    finalState: "检查顺序已确认",
    result: "同级重点部件获得了可执行的人工检查先后，原始状态值保持不变。",
  },
  {
    caseId: "20",
    featuredObjectId: "20-8-2020-05-19",
    title: "光伏站端记录核查",
    contextTitle: "少发线索不等于限电结论",
    context: "PV-08 在 2020-05-19 出现少发线索。页面分开显示站日事实、派生标记和缺失资料。",
    factsTitle: "先列出三类站端资料缺口",
    facts: "核对归一化出力、疑似限电记录占比，以及气象、逆变器和调度记录是否缺失。",
    primaryTitle: "登记站端核查任务",
    primaryAction: "选择核查方向和所需资料，填写负责人、日期与说明，点击“提交站端核查”。",
    primaryState: "站端核查中",
    handoff: "切换为性能主管。主管确认的是核查方向，不是少发原因，也不能直接变更控制策略。",
    supervisorTitle: "确认核查方向",
    supervisorAction: "填写主管意见并点击“确认核查方向”；如有人要求远程调参，应登记禁止控制变更。",
    finalState: "核查方向已确认",
    result: "站日线索已经进入可追溯的站端核查，少发归因仍等待缺失资料。",
  },
];

const case01Tour: CaseTourDefinition = {
  caseId: "01",
  featuredObjectId: "01-C496116-M",
  title: "跨境售后异常调查",
  steps: [
    { id: "case-context", element: selector("01", "context"), title: "先锁定这张 8.17 万元取消单", description: "C496116-M 金额很大，但退款前缺少可追溯的原始订单。高金额是调查优先级，不是退款理由。", side: "bottom", align: "start" },
    { id: "read-facts", element: selector("01", "workspace"), title: "把取消单、候选原单和付款记录对齐", description: "核对发票号、商品、交易方向、时间和人民币金额；候选不成立时要明确记录“没有可匹配原单”。", side: "top", align: "start" },
    { id: "request-evidence", element: selector("01", "workspace"), title: "创建原单补证任务", description: "选择候选原单和补证清单，填写负责人、期限与理由，点击“创建原单补证任务”。", side: "left", align: "end", gate: { kind: "state", anyOf: ["待补证"] } },
    { id: "submit-review", element: selector("01", "workspace"), title: "证据齐备后提交独立复核", description: "逐项登记回传材料，确认它们绑定当前取消单与候选原单，再点击“提交独立人工复核”。", side: "left", align: "end", gate: { kind: "state", anyOf: ["人工复核待处理"] } },
    { id: "handoff-role", element: selector("01", "workspace") + ' [aria-label="当前操作角色"]', title: "主管只接手已经保存的复核包", description: "切换为业务主管，核对金额、原单关系和回传材料；不要改写分析员已经提交的证据。", side: "bottom", align: "end", gate: { kind: "role", equals: "supervisor" } },
    { id: "saved-result", element: selector("01", "result"), title: "退款仍未被自动执行", description: "对象进入人工复核待处理，证据包和操作记录都已保存；系统没有因金额大而自动退款或拒绝。", side: "bottom", align: "end" },
  ],
};

const case04Tour: CaseTourDefinition = {
  caseId: "04",
  featuredObjectId: "04-CR20260000001",
  title: "申请材料补正",
  steps: [
    { id: "case-context", element: selector("04", "context"), title: "只补源记录里真实缺失的材料", description: "CR20260000001 缺少收入证明。页面不得顺手索取身份证、住址等未登记材料。", side: "bottom", align: "start" },
    { id: "read-facts", element: selector("04", "workspace"), title: "先核对城市、申请号和材料状态", description: "材料清单来自确定性合成记录；所有输入都避免个人可识别信息。", side: "top", align: "start" },
    { id: "request-material", element: selector("04", "workspace"), title: "发起一项最小补正", description: "勾选真实缺失项，填写补正说明、负责人和期限，点击“发起材料补正”。", side: "left", align: "end", gate: { kind: "state", anyOf: ["待补正"] } },
    { id: "record-return", element: selector("04", "workspace"), title: "把回传材料绑定到当前申请", description: "填写不含个人信息的来源说明和回传记录编号，点击“记录材料回传”。", side: "left", align: "end", gate: { kind: "command", anyOf: ["record_material_return"] } },
    { id: "handoff-role", element: selector("04", "workspace") + ' [aria-label="当前操作角色"]', title: "第二身份完成风险复核", description: "切换为风险主管；回传人与复核人分离，主管只能处理已经登记的材料。", side: "bottom", align: "end", gate: { kind: "role", equals: "supervisor" } },
    { id: "supervisor-action", element: selector("04", "workspace"), title: "进入风险人工审查", description: "核对补正项全部回传，填写复核意见，点击“进入风险人工审查”。", side: "left", align: "end", gate: { kind: "state", anyOf: ["风险人工审查中"] } },
    { id: "saved-result", element: selector("04", "result"), title: "补正完成不等于授信通过", description: "申请只进入风险人工审查；系统没有生成信用结论。", side: "bottom", align: "end" },
  ],
};

const case06Tour: CaseTourDefinition = {
  caseId: "06",
  featuredObjectId: "06-Gucheng-33541",
  title: "历史数据摘录质检",
  steps: [
    { id: "case-context", element: selector("06", "context"), title: "古城站 12:00 的六项污染物全空", description: "固定记录来自公开历史数据。空值必须保留为空，不能用均值或相邻时次偷偷补齐。", side: "bottom", align: "start" },
    { id: "read-facts", element: selector("06", "workspace"), title: "逐列确认缺测事实", description: "核对 PM2.5、PM10、SO2、NO2、CO、O3 六项字段和站点、时次、来源行号。", side: "top", align: "start" },
    { id: "decision-boundary", element: selector("06", "workspace"), title: "这条记录不能锁进完整摘录", description: "完整记录可以锁定后发布；六项全空的记录应注明缺项并选择本批次不纳入。", side: "left", align: "start" },
    { id: "handoff-role", element: selector("06", "workspace") + ' [aria-label="当前操作角色"]', title: "由质检主管确认排除", description: "切换为质检主管，保留空值与原因，不删除源记录。", side: "bottom", align: "end", gate: { kind: "role", equals: "supervisor" } },
    { id: "supervisor-action", element: selector("06", "workspace"), title: "确认本批次不纳入", description: "填写不纳入原因并点击“本批次不纳入”。", side: "left", align: "end", gate: { kind: "state", anyOf: ["本批次不纳入"] } },
    { id: "saved-result", element: selector("06", "result"), title: "空值和排除理由同时留下", description: "记录没有进入完整摘录，但源数据、缺测列和质检决定都可追溯。", side: "bottom", align: "end" },
  ],
};

const case08Tour: CaseTourDefinition = {
  caseId: "08",
  featuredObjectId: "08-CN-AQ-02-038-CN-POND-02",
  title: "水质冲突现场取证单",
  steps: [
    { id: "case-context", element: selector("08", "context"), title: "系统读数和现场记录发生冲突", description: "CN-AQ-02-038 需要三次岗位交接：调度派单、现场回传、主管采信。", side: "bottom", align: "start" },
    { id: "read-facts", element: selector("08", "workspace"), title: "先写清要现场核对什么", description: "核对区域、冲突字段和证据缺口，要求现场读数、采集时间和照片资产号。", side: "top", align: "start" },
    { id: "dispatch-field", element: selector("08", "workspace"), title: "调度员派发现场取证", description: "填写现场任务和证据要求，点击“派发现场取证”。", side: "left", align: "end", gate: { kind: "state", anyOf: ["现场取证中"] } },
    { id: "field-role", element: selector("08", "workspace") + ' [aria-label="当前操作角色"]', title: "切换为现场人员", description: "把当前角色切换为现场操作员；现场人员只能回传，不负责采信。", side: "bottom", align: "end", gate: { kind: "role", equals: "field_operator" } },
    { id: "field-return", element: selector("08", "workspace"), title: "回传真实现场记录", description: "填写采集人、时间、照片资产号和四项读数，点击“提交现场回传”。", side: "left", align: "end", gate: { kind: "state", anyOf: ["待主管采信"] } },
    { id: "supervisor-role", element: selector("08", "workspace") + ' [aria-label="当前操作角色"]', title: "再交给主管采信", description: "切换为业务主管；主管核对冲突是否被现场证据解释。", side: "bottom", align: "end", gate: { kind: "role", equals: "supervisor" } },
    { id: "confirm-event", element: selector("08", "workspace"), title: "采信现场记录", description: "确认读数和照片编号匹配当前事件，填写意见，点击“采信现场记录”。", side: "left", align: "end", gate: { kind: "state", anyOf: ["现场记录已采信"] } },
    { id: "saved-result", element: selector("08", "result"), title: "三次动作各自留痕", description: "派单、回传和采信由不同角色完成；系统没有跳过现场证据直接确认事件。", side: "bottom", align: "end" },
  ],
};

const case10Tour: CaseTourDefinition = {
  caseId: "10",
  featuredObjectId: "10-CN-TEL-2025Q2-0008",
  title: "通信请求恢复核查",
  steps: [
    { id: "case-context", element: selector("10", "context"), title: "请求发出不等于外部效果已发生", description: "本地任务有幂等键，但外部响应缺失。课程故障标签和真实外部结果必须分开记录。", side: "bottom", align: "start" },
    { id: "read-facts", element: selector("10", "workspace"), title: "先核对本地关联键和查询目标", description: "确认任务号、优先级、课程故障标签和外部效果核对目标，不用一次超时推断成功或失败。", side: "top", align: "start" },
    { id: "start-lookup", element: selector("10", "workspace"), title: "发起外部效果查询", description: "保持同一业务幂等键，选择核对目标，点击“发起外部效果查询”。", side: "left", align: "end", gate: { kind: "state", anyOf: ["外部效果待核对"] } },
    { id: "record-result", element: selector("10", "workspace"), title: "有明确回执才记录结果", description: "选择已生效或未生效，填写摘要和证据编号，点击“记录外部核对结果”；仍未知就保留待核对。", side: "left", align: "end", gate: { kind: "state", anyOf: ["恢复记录待确认"] } },
    { id: "handoff-role", element: selector("10", "workspace") + ' [aria-label="当前操作角色"]', title: "主管核对恢复记录", description: "切换为恢复主管，确认创建人与关闭人分离。", side: "bottom", align: "end", gate: { kind: "role", equals: "supervisor" } },
    { id: "close-task", element: selector("10", "workspace"), title: "关闭课程恢复核查", description: "核对外部结果、证据编号和幂等键后点击“关闭课程恢复核查”。", side: "left", align: "end", gate: { kind: "state", anyOf: ["课程恢复核查已关闭"] } },
    { id: "saved-result", element: selector("10", "result"), title: "本地记录与外部效果没有混为一谈", description: "任务关闭基于明确回执；未知结果不会被重试按钮伪装成成功。", side: "bottom", align: "end" },
  ],
};

const case18Tour: CaseTourDefinition = {
  caseId: "18",
  featuredObjectId: "18-BT-0044",
  title: "主汽低温事件核查",
  steps: [
    { id: "event-context", element: '[data-tour~="b18-context"]', title: "先确认是哪一次事件", description: "BT-0044 连续偏离 25 分钟。这里先锁定事件窗口，不把来源区间当成厂方控制限。", side: "bottom", align: "start" },
    { id: "process-scene", element: '[data-tour~="b18-scene"]', title: "沿工艺链找资料缺口", description: "温度链路已知，但减温水阀位、流量和分段温度尚未接入。现场图负责定位，不替代测点记录。", side: "right", align: "start" },
    { id: "temperature-window", element: '[data-tour~="b18-trend"]', title: "核对完整的分钟窗口", description: "曲线保留事件内 25 个连续分钟点。先确认数据窗口完整，再决定优先检查哪一段。", side: "top", align: "center" },
    { id: "investigation-plan", element: '[data-tour~="b18-investigation"]', title: "形成一张可执行排查单", description: "选择一个优先检查段，勾选待补资料，填写负责人和排查理由，然后提交当班排查。", side: "left", align: "start" },
    { id: "dispatch-task", element: '[data-tour~="b18-dispatch"]', title: "提交后才进入下一步", description: "完成表单并点击“提交当班排查”。系统保存任务、证据编号和对象版本后，导览会自动继续。", side: "left", align: "end", gate: { kind: "state", anyOf: ["当班排查中"] } },
    { id: "handoff-role", element: '[data-tour~="b18-role"]', title: "把任务交给运行主管", description: "将当前角色切换为运行主管。主管看到的是已锁定的检查段，不能偷偷改写当班工程师的选择。", side: "bottom", align: "end", gate: { kind: "role", equals: "supervisor" } },
    { id: "supervisor-decision", element: '[data-tour~="b18-supervisor-action"]', title: "主管确认人工检查", description: "填写主管意见并确认优先检查段。这里下发的是人工检查，不是自动调节指令。", side: "left", align: "end", gate: { kind: "state", anyOf: ["检查已下发"] } },
    { id: "saved-result", element: '[data-tour~="b18-result"]', title: "业务闭环已经落盘", description: "事件已从待定位推进到检查已下发。退出导览后结果仍保留；重新演示只恢复 BT-0044。", side: "bottom", align: "end" },
  ],
};

const allTours = [
  ...standardSeeds.map(standardTour),
  case01Tour,
  case04Tour,
  case06Tour,
  case08Tour,
  case10Tour,
  case18Tour,
];

const tours = new Map(allTours.map((tour) => [tour.caseId, tour]));

export function getCaseTourDefinition(caseId: string): CaseTourDefinition | undefined {
  return tours.get(caseId);
}

export function getAllCaseTourDefinitions(): CaseTourDefinition[] {
  return [...tours.values()].sort((left, right) => left.caseId.localeCompare(right.caseId));
}

export function isTourGateSatisfied(
  gate: CaseTourGate | undefined,
  runtime: CaseTourRuntime,
): boolean {
  if (!gate) return true;
  if (gate.kind === "state") return gate.anyOf.includes(runtime.state);
  if (gate.kind === "role") return runtime.actorRole === gate.equals;
  return gate.anyOf.some((command) => runtime.completedCommands?.includes(command));
}
