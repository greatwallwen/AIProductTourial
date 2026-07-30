import type { CaseDefinition } from "./contracts";
import { CASE_RULES, CASE_WORKSPACE_COPY } from "./case-rules";

const standardViews = [
  { id: "overview", label: "业务总览" },
  { id: "work", label: "处置工作台" },
  { id: "evidence", label: "证据记录" },
  { id: "audit", label: "审计回执" },
];

const flagshipViews = [...standardViews, { id: "recovery", label: "异常恢复" }];

function completeWorkflow(initialState: string, role: string, finalState: string) {
  return {
    initialState,
    commands: {
      request_evidence: { from: [initialState], to: "待补证", roles: [role] },
      resolve: { from: [initialState, "待补证"], to: finalState, roles: [role, "supervisor"] },
      reject: { from: [initialState, "待补证"], to: "已暂缓", roles: [role, "supervisor"] },
    },
  };
}

type Draft = Omit<
  CaseDefinition,
  "views" | "workflow" | "commandLabels" | "rules" | "workspace" | "aiEnabled"
> & {
  initialState?: string;
  finalState?: string;
};

const drafts: Draft[] = [
  { id: "01", slug: "retail-return-evidence", shortTitle: "跨境售后异常调查", title: "一张 8.17 万元取消单，缺的是哪张原单？", family: "commerce", tier: "flagship", industry: "跨境零售", scenario: "核对取消发票、原始订单与退款边界，在证据不足时阻止错误退款。", datasetFolder: "01-retail-return-evidence", datasetTarget: "UCI Online Retail II", objectLabel: "发票", featuredObjectId: "01-C496116-M", identityFields: ["invoice_id", "stock_code"], displayFields: [{ key: "invoice_id", label: "发票" }, { key: "description", label: "商品" }, { key: "line_amount_cny", label: "金额（元）" }, { key: "state", label: "状态" }], primaryRole: "analyst", initialState: "待核验", finalState: "人工复核待处理" },
  { id: "02", slug: "member-value-experiment", shortTitle: "会员优惠试投", title: "3,000 元预算，8 元券先发给谁？", family: "commerce", tier: "complete", industry: "电商增长", scenario: "用匿名浏览、加购和购买次数形成稳定的首批试投名单；真实投放前不展示转化提升。", datasetFolder: "02-member-value-experiment", datasetTarget: "Beibei 用户行为", objectLabel: "会员", featuredObjectId: "02-U00725", identityFields: ["user_id"], displayFields: [{ key: "user_id", label: "会员" }, { key: "engagement_score", label: "行为分" }, { key: "value_segment", label: "分层" }, { key: "state", label: "状态" }], primaryRole: "operator", initialState: "待入组", finalState: "首批名单已确认" },
  { id: "03", slug: "local-service-voc", shortTitle: "餐饮评论调查", title: "6,970 条餐饮评论，先把哪个问题查清？", family: "commerce", tier: "complete", industry: "本地生活", scenario: "从中文评论原话中选择支持样本和相反样本，再建立一项有负责人和判断条件的调查任务。", datasetFolder: "03-local-service-voc", datasetTarget: "美团 ASAP 中文评论", objectLabel: "评论", featuredObjectId: "03-17229", identityFields: ["id"], displayFields: [{ key: "id", label: "评论" }, { key: "star", label: "星级" }, { key: "review", label: "内容" }, { key: "state", label: "状态" }], primaryRole: "operator", initialState: "待研判", finalState: "已排入验证" },
  { id: "04", slug: "credit-human-review", shortTitle: "申请材料补正", title: "CR20260000001 收入证明缺失：谁补，谁复核？", family: "approval", tier: "complete", industry: "金融运营", scenario: "只为源记录中真实缺失的材料创建补正任务，回传后由不同身份完成第二次核对。", datasetFolder: "04-credit-human-review", datasetTarget: "中国场景确定性合成申请记录", objectLabel: "申请", featuredObjectId: "04-CR20260000001", identityFields: ["application_id"], displayFields: [{ key: "application_id", label: "申请" }, { key: "city_name", label: "城市" }, { key: "income_evidence_status", label: "收入材料" }, { key: "state", label: "状态" }], primaryRole: "reviewer", initialState: "待复核", finalState: "风险人工审查中" },
  { id: "05", slug: "hospital-flow-coordination", shortTitle: "转运晚到事件调和", title: "08:27 发生，09:09 才收到：这条更正怎么处理？", family: "approval", tier: "flagship", industry: "医院运营", scenario: "用业务发生时钟和系统接收时钟识别晚到更正，保留历史并由不同岗位完成调和会签。", datasetFolder: "05-hospital-flow-coordination", datasetTarget: "脱敏确定性合成运营事件", objectLabel: "转运事件", featuredObjectId: "05-TRN-0001-TRN-0001-06", identityFields: ["transport_id", "event_id"], displayFields: [{ key: "transport_id", label: "转运单" }, { key: "event_type", label: "事件" }, { key: "conflict_type", label: "冲突类型" }, { key: "state", label: "状态" }], primaryRole: "coordinator", initialState: "待会签", finalState: "交接已确认" },
  { id: "06", slug: "beijing-air-quality-audit", shortTitle: "历史数据摘录质检", title: "古城站 12:00 六项污染物全空：这条记录要不要纳入摘录？", family: "investigation", tier: "complete", industry: "公共数据", scenario: "核对历史公开数据切片中的六项污染物，完整记录锁定进摘录，缺项记录保留空值并注明不纳入原因。", datasetFolder: "06-beijing-air-quality-audit", datasetTarget: "UCI 北京多站点空气质量", objectLabel: "站点小时记录", featuredObjectId: "06-Gucheng-33541", identityFields: ["station", "No"], displayFields: [{ key: "station", label: "站点" }, { key: "PM2.5", label: "PM2.5" }, { key: "missing_pollutant_count", label: "缺测数" }, { key: "state", label: "状态" }], primaryRole: "auditor", initialState: "待质检", finalState: "已纳入摘录" },
  { id: "07", slug: "instant-retail-architecture", shortTitle: "即时履约架构评审", title: "请求更少，履约为什么反而最慢？", family: "commerce", tier: "complete", industry: "即时零售", scenario: "对齐 14 个日期窗口里的四域请求、延迟、发布、故障和恢复记录，先确认同窗现象，再决定继续观察、补观测或试一条事件契约。", datasetFolder: "07-instant-retail-architecture", datasetTarget: "公开订单基准与确定性中国运营记录", objectLabel: "架构评审窗口", featuredObjectId: "07-CN-FC-COURSE-01-2026-07-14", identityFields: ["facility_code", "scenario_date"], displayFields: [{ key: "facility_code", label: "场站" }, { key: "scenario_date", label: "日期窗口" }, { key: "fulfillment_p95_latency_ms", label: "履约 P95" }, { key: "state", label: "状态" }], primaryRole: "architect", initialState: "待评审", finalState: "模块化观察中" },
  { id: "08", slug: "aquaculture-event-response", shortTitle: "水质冲突现场取证单", title: "CN-AQ-02-038 数值冲突：谁取证，谁采信？", family: "investigation", tier: "complete", industry: "水产运营", scenario: "把系统记录、现场回传和主管采信拆成三个身份与三次动作；没有完整现场证据时只能等待，不能确认事件。", datasetFolder: "08-aquaculture-event-response", datasetTarget: "确定性中国水质运营事件", objectLabel: "水质冲突事件", featuredObjectId: "08-CN-AQ-02-038-CN-POND-02", identityFields: ["event_id", "region_id"], displayFields: [{ key: "event_id", label: "事件" }, { key: "region_id", label: "区域" }, { key: "evidence_status", label: "证据状态" }, { key: "state", label: "状态" }], primaryRole: "dispatcher", initialState: "待研判", finalState: "现场记录已采信" },
  { id: "09", slug: "metro-agentic-rag", shortTitle: "空压机遥测断档调查", title: "352 秒没有记录：现在能不能提交现场检查申请？", family: "investigation", tier: "flagship", industry: "轨道交通", scenario: "核对压力、油温、电流的真实断档前后值和本地资料；断档未解释时先补记录，连续窗口通过后才允许人工提交现场目视检查申请。", datasetFolder: "09-metro-agentic-rag", datasetTarget: "UCI MetroPT-3 固定历史切片", objectLabel: "遥测断档调查", featuredObjectId: "09-METROPT-20200418-GAP-01", identityFields: ["investigation_id"], displayFields: [{ key: "investigation_id", label: "调查" }, { key: "gap_seconds", label: "断档秒数" }, { key: "gap_start", label: "断档起点" }, { key: "state", label: "状态" }], primaryRole: "engineer", initialState: "待核对", finalState: "检查申请已提交" },
  { id: "10", slug: "telecom-complaint-orchestration", shortTitle: "通信请求恢复核查", title: "查询已经发出，响应没回来：现在能不能重试？", family: "approval", tier: "flagship", industry: "通信服务", scenario: "把本地登记、响应缺口、课程故障标签与外部效果分开核对；没有明确结果和证据时只能保持待核对。", datasetFolder: "10-telecom-complaint-orchestration", datasetTarget: "工信部公开汇总锚定的中国通信投诉合成运营记录", objectLabel: "恢复核查单", featuredObjectId: "10-CN-TEL-2025Q2-0008", identityFields: ["task_id"], displayFields: [{ key: "task_id", label: "任务" }, { key: "priority", label: "优先级" }, { key: "external_lookup_scenario", label: "课程故障标签" }, { key: "state", label: "状态" }], primaryRole: "coordinator", initialState: "执行中", finalState: "课程恢复核查已关闭" },
  { id: "11", slug: "model-release-multi-agent", shortTitle: "企业模型准入补测", title: "地区切片没有过线：先补测，再谈准入", family: "approval", tier: "flagship", industry: "模型治理", scenario: "逐项核对风险、公平和安全准入检查，缺少地区切片时先补测，不把本地核对线当成生产发布批准。", datasetFolder: "11-model-release-multi-agent", datasetTarget: "Qwen 公开材料与本地评测", objectLabel: "准入候选", featuredObjectId: "11-MODEL-ADMISSION-001-MODEL-GATE-2026-1", identityFields: ["candidate_id", "policy_version"], displayFields: [{ key: "candidate_id", label: "候选" }, { key: "policy_version", label: "政策" }, { key: "result", label: "阻断项" }, { key: "state", label: "状态" }], primaryRole: "release_manager", initialState: "待会签", finalState: "补测已确认" },
  { id: "12", slug: "vaccine-cold-chain", shortTitle: "县域冷链运输记录调查", title: "30 条记录里有 5 次越界，缺的交接证据怎么补？", family: "approval", tier: "complete", industry: "冷链运营", scenario: "沿真实时间带核对温度、设备与路线、交接三类记录；证据不全时等待补证，调查复核不产生产品结论。", datasetFolder: "12-vaccine-cold-chain", datasetTarget: "中国县域合成运输记录与公开热性能参考", objectLabel: "运输记录调查", featuredObjectId: "12-CCI-2026-001-CN-SC-PZ-01", identityFields: ["investigation_id", "route_id"], displayFields: [{ key: "investigation_id", label: "调查单" }, { key: "route_id", label: "路线" }, { key: "temperature_c", label: "峰值温度（℃）" }, { key: "state", label: "状态" }], primaryRole: "quality_reviewer", initialState: "待调查", finalState: "调查已复核" },
  { id: "13", slug: "auto-service-triage", shortTitle: "接车通话安全分流", title: "CN-AS-001 制动异响：客户回答够不够转技师？", family: "commerce", tier: "complete", industry: "汽车售后", scenario: "逐题记录客户回答，资料不足时请求补充；不能安全移动或无法确认时优先转技师复核。", datasetFolder: "13-auto-service-triage", datasetTarget: "汽车服务公开参考与中国场景合成进线", objectLabel: "服务进线", featuredObjectId: "13-CN-AS-001", identityFields: ["intake_id"], displayFields: [{ key: "intake_id", label: "进线" }, { key: "symptom_category", label: "症状分类" }, { key: "safety_review_required", label: "安全复核" }, { key: "state", label: "状态" }], primaryRole: "dispatcher", initialState: "待分流", finalState: "技师已接收" },
  { id: "14", slug: "flotation-impurity-review", shortTitle: "连续高硅事件调查", title: "FQ-0016 持续 39 小时：先核对哪三列浮选槽？", family: "industrial", tier: "complete", industry: "有色矿业", scenario: "以连续事件为调查对象，将完整 72 小时记录和事件表中的三、一、二号槽优先项随单保存；只安排人工核对，不判定根因，不自动调参。", datasetFolder: "14-flotation-impurity-review", datasetTarget: "公开浮选过程数据的小时聚合与课程规则事件", objectLabel: "连续高硅事件", featuredObjectId: "14-FQ-0016", identityFields: ["event_id"], displayFields: [{ key: "event_id", label: "事件" }, { key: "duration_hours", label: "持续时长" }, { key: "end_hour", label: "事件终点" }, { key: "state", label: "状态" }], primaryRole: "process_engineer", initialState: "待诊断", finalState: "核查已下发" },
  { id: "15", slug: "wafer-quality-review", shortTitle: "半导体生产记录复测", title: "生产观测 SECOM-0003 未通过：先复测，还是先查通道？", family: "industrial", tier: "flagship", industry: "半导体制造", scenario: "按质量标签、匿名信号和缺失情况隔离生产观测并申请复测；数据没有真实批次、设备或工序。", datasetFolder: "15-wafer-quality-review", datasetTarget: "UCI SECOM", objectLabel: "生产观测", featuredObjectId: "15-SECOM-0003", identityFields: ["wafer_id"], displayFields: [{ key: "wafer_id", label: "生产观测" }, { key: "quality_label", label: "质量标签" }, { key: "review_priority", label: "复核优先级" }, { key: "state", label: "状态" }], primaryRole: "quality_engineer", initialState: "待复核", finalState: "复测申请已确认" },
  { id: "16", slug: "wind-underperformance", shortTitle: "风机出力下偏核查", title: "风机 T007 连续七个运行日出现下偏标记：先补什么？", family: "industrial", tier: "complete", industry: "新能源", scenario: "把风速、功率和日级下偏标记放到同一窗口；补齐同群基线、限电和告警后再判断。", datasetFolder: "16-wind-underperformance", datasetTarget: "SDWPF 风电数据", objectLabel: "风机窗口", featuredObjectId: "16-7-1", identityFields: ["turbine_id", "day"], displayFields: [{ key: "turbine_id", label: "风机" }, { key: "day", label: "日期序号" }, { key: "underperformance_share", label: "日级下偏标记" }, { key: "state", label: "状态" }], primaryRole: "reliability_engineer", initialState: "待定位", finalState: "现场核查已提交" },
  { id: "17", slug: "cutter-health-review", shortTitle: "切刀波形复核", title: "BD-0003 三路波形都在：要不要列入排检候选？", family: "industrial", tier: "complete", industry: "包装制造", scenario: "对齐三路同步波形、共享游标与样本窗口，保存可复核的排检候选；不从偏差直接推断故障。", datasetFolder: "17-cutter-health-review", datasetTarget: "inIT-OWL 工业部件劣化数据", objectLabel: "设备会话", featuredObjectId: "17-BD-0003", identityFields: ["session_id"], displayFields: [{ key: "session_id", label: "会话" }, { key: "health_deviation_index", label: "健康偏差" }, { key: "rule_review_level", label: "复核等级" }, { key: "state", label: "状态" }], primaryRole: "maintenance_planner", initialState: "待复核", finalState: "排检候选已确认" },
  { id: "18", slug: "boiler-temperature-review", shortTitle: "主汽低温事件核查", title: "BT-0044 主汽低温持续 24 分钟：先查哪一段？", family: "industrial", tier: "complete", industry: "能源化工", scenario: "把事件温度、已接入资料和过程数据缺口冻结为当班检查单，不把来源区间当成厂方控制限。", datasetFolder: "18-boiler-temperature-review", datasetTarget: "工业锅炉运行时序数据", objectLabel: "主汽低温事件", featuredObjectId: "18-BT-0044", identityFields: ["event_id"], displayFields: [{ key: "event_id", label: "事件号" }, { key: "end_time", label: "事件结束" }, { key: "minimum_temperature", label: "最低温度" }, { key: "state", label: "状态" }], primaryRole: "process_engineer", initialState: "待定位", finalState: "检查已下发" },
  { id: "19", slug: "hydraulic-condition", shortTitle: "液压循环检查排序", title: "第 217 次测量循环：三项同级，谁先查？", family: "industrial", tier: "complete", industry: "流程工业", scenario: "核对四个部件状态，为三个同级重点部件排出人工检查顺序；数据没有真实液压站和部件资产号。", datasetFolder: "19-hydraulic-condition", datasetTarget: "UCI 液压系统状态监测", objectLabel: "测量循环", featuredObjectId: "19-217", identityFields: ["cycle_id"], displayFields: [{ key: "cycle_id", label: "测量循环" }, { key: "overall_severity_label", label: "总体严重度" }, { key: "affected_component_count", label: "受影响部件" }, { key: "state", label: "状态" }], primaryRole: "reliability_engineer", initialState: "待排序", finalState: "检查顺序已确认" },
  { id: "20", slug: "pv-loss-attribution", shortTitle: "光伏站端记录核查", title: "PV-08 在 2020-05-19 出现少发线索：站端先查什么？", family: "industrial", tier: "complete", industry: "新能源", scenario: "分开查看站日事实、派生线索和三类缺失资料，再登记站端核查任务。", datasetFolder: "20-pv-loss-attribution", datasetTarget: "中国新能源预测竞赛光伏数据", objectLabel: "电站日期", featuredObjectId: "20-8-2020-05-19", identityFields: ["station_id", "date"], displayFields: [{ key: "station_id", label: "电站" }, { key: "mean_efficiency_ratio", label: "归一化出力比" }, { key: "curtailment_suspected_share", label: "疑似限电记录占比" }, { key: "state", label: "状态" }], primaryRole: "performance_engineer", initialState: "待核查", finalState: "核查方向已确认" },
];

const flagshipIds = new Set(["01", "05", "09", "10", "11", "15"]);

type FlowStep = {
  id: string;
  label: string;
  from: string[];
  to: string;
  supervisor?: boolean;
  roles?: string[];
};

const caseFlows: Record<string, FlowStep[]> = {
  "01": [
    { id: "create_evidence_request", label: "创建原单补证任务", from: ["待核验"], to: "待补证" },
    { id: "submit_manual_review", label: "提交独立人工复核", from: ["待补证"], to: "人工复核待处理" },
    { id: "hold_refund", label: "暂缓退款", from: ["待核验", "待补证"], to: "退款已暂缓", supervisor: true },
  ],
  "02": [
    { id: "design_trial", label: "提交首批试投名单", from: ["待入组"], to: "试投待审" },
    { id: "start_trial", label: "确认首批名单", from: ["试投待审"], to: "首批名单已确认", supervisor: true },
    { id: "stop_trial", label: "退回名单调整", from: ["试投待审"], to: "名单待调整", supervisor: true },
  ],
  "03": [
    { id: "create_validation_task", label: "创建调查任务", from: ["待研判"], to: "待验证" },
    { id: "accept_backlog", label: "安排调查", from: ["待验证"], to: "已排入验证", supervisor: true },
    { id: "archive_signal", label: "暂不安排", from: ["待研判", "待验证"], to: "已归档", supervisor: true },
  ],
  "04": [
    { id: "request_material", label: "发起材料补正", from: ["待复核"], to: "待补正" },
    { id: "record_material_return", label: "记录材料回传", from: ["待补正"], to: "待补正" },
    { id: "start_human_review", label: "进入风险人工审查", from: ["待补正"], to: "风险人工审查中", supervisor: true },
    { id: "hold_application", label: "暂缓处理", from: ["待复核", "待补正"], to: "申请已暂缓", supervisor: true },
  ],
  "05": [
    { id: "nurse_confirm", label: "提交调和决定", from: ["待会签"], to: "待接收会签" },
    { id: "cosign_transfer", label: "完成接收会签", from: ["待接收会签"], to: "交接已确认", supervisor: true },
    { id: "escalate_conflict", label: "升级协调", from: ["待会签", "待接收会签"], to: "升级协调", supervisor: true },
    { id: "reopen_late_event", label: "晚到更正触发复核", from: ["交接已确认"], to: "待会签" },
  ],
  "06": [
    { id: "freeze_release_scope", label: "锁定数据摘录", from: ["待质检"], to: "待复核" },
    { id: "publish", label: "确认纳入摘录", from: ["待复核"], to: "已纳入摘录", supervisor: true },
    { id: "reject_release", label: "本批次不纳入", from: ["待质检", "待复核"], to: "本批次不纳入", supervisor: true },
  ],
  "07": [
    { id: "verify_evidence", label: "锁定评审窗口", from: ["待评审", "待补观测"], to: "架构评审中" },
    { id: "keep_modular_monolith", label: "继续模块化观察", from: ["架构评审中"], to: "模块化观察中", supervisor: true },
    { id: "request_observability_evidence", label: "请求补充观测", from: ["架构评审中"], to: "待补观测", supervisor: true },
    { id: "start_event_contract_pilot", label: "批准单事件试点", from: ["架构评审中"], to: "事件契约试点待执行", supervisor: true },
  ],
  "08": [
    { id: "dispatch_field_check", label: "派发现场取证", from: ["待研判", "等待现场证据"], to: "现场取证中" },
    { id: "submit_field_return", label: "提交现场回传", from: ["现场取证中"], to: "待主管采信", roles: ["field_operator"] },
    { id: "confirm_event", label: "采信现场记录", from: ["待主管采信"], to: "现场记录已采信", supervisor: true },
    { id: "hold_for_evidence", label: "暂缓等待证据", from: ["待研判", "现场取证中", "待主管采信"], to: "等待现场证据" },
  ],
  "09": [
    { id: "run_retrieval", label: "核对本地资料", from: ["待核对", "等待设备记录"], to: "资料已核对" },
    { id: "create_inspection_order", label: "提交现场目视检查申请", from: ["资料已核对"], to: "检查申请已提交", supervisor: true },
    { id: "hold_investigation", label: "请求补充设备记录", from: ["待核对", "资料已核对"], to: "等待设备记录" },
  ],
  "10": [
    { id: "start_lookup", label: "发起外部效果查询", from: ["执行中"], to: "外部效果待核对" },
    { id: "retry_idempotent", label: "记录外部核对结果", from: ["外部效果待核对"], to: "恢复记录待确认" },
    { id: "keep_pending", label: "保留待核对", from: ["外部效果待核对"], to: "外部效果待核对" },
    { id: "close_task", label: "关闭课程恢复核查", from: ["恢复记录待确认"], to: "课程恢复核查已关闭", supervisor: true },
  ],
  "11": [
    { id: "request_release_evidence", label: "发起地区切片补测", from: ["待会签"], to: "补测中" },
    { id: "approve_canary", label: "确认补测已完成", from: ["补测中"], to: "补测已确认", supervisor: true },
    { id: "reject_candidate", label: "拒绝发布候选", from: ["待会签", "待补证"], to: "候选已拒绝", supervisor: true },
  ],
  "12": [
    { id: "open_investigation", label: "启动运输记录调查", from: ["待调查", "等待补证"], to: "调查中" },
    { id: "quality_cosign", label: "完成调查复核", from: ["调查中"], to: "调查已复核", supervisor: true },
    { id: "hold_batch", label: "等待补证", from: ["待调查", "调查中"], to: "等待补证", supervisor: true },
  ],
  "13": [
    { id: "submit_triage", label: "转交技师安全复核", from: ["待分流", "待补充信息"], to: "技师复核已提交" },
    { id: "dispatch_rescue", label: "确认复核已接收", from: ["技师复核已提交"], to: "技师已接收", supervisor: true },
    { id: "request_details", label: "保存并请求补充", from: ["待分流"], to: "待补充信息" },
  ],
  "14": [
    { id: "submit_process_review", label: "提交工艺复核", from: ["待诊断"], to: "工艺复核中" },
    { id: "dispatch_instrument_check", label: "下发仪表核查", from: ["工艺复核中"], to: "核查已下发", supervisor: true },
    { id: "hold_adjustment", label: "禁止自动调参", from: ["待诊断", "工艺复核中"], to: "调参已阻断", supervisor: true },
  ],
  "15": [
    { id: "request_retest", label: "隔离记录并提交复测", from: ["待复核"], to: "复测申请已提交" },
    { id: "release_batch", label: "确认复测申请", from: ["复测申请已提交"], to: "复测申请已确认", supervisor: true },
    { id: "quarantine_batch", label: "继续隔离观察", from: ["待复核", "复测申请已提交"], to: "记录已隔离", supervisor: true },
  ],
  "16": [
    { id: "submit_field_check", label: "提交现场核查", from: ["待定位"], to: "现场核查中" },
    { id: "schedule_maintenance", label: "确认核查材料已收件", from: ["现场核查中"], to: "现场核查已提交", supervisor: true },
    { id: "hold_attribution", label: "请求补充同群数据", from: ["待定位", "现场核查中"], to: "等待同群数据", supervisor: true },
  ],
  "17": [
    { id: "schedule_night_inspection", label: "保存排检候选", from: ["待复核"], to: "排检候选待确认" },
    { id: "confirm_maintenance", label: "确认排检候选", from: ["排检候选待确认"], to: "排检候选已确认", supervisor: true },
    { id: "continue_monitoring", label: "继续采样观察", from: ["待复核"], to: "继续观察" },
  ],
  "18": [
    { id: "dispatch_shift_check", label: "提交当班排查", from: ["待定位"], to: "当班排查中" },
    { id: "confirm_segment", label: "确认优先检查段", from: ["当班排查中"], to: "检查已下发", supervisor: true },
    { id: "hold_control_change", label: "阻断自动调节", from: ["待定位", "当班排查中"], to: "自动调节已阻断", supervisor: true },
  ],
  "19": [
    { id: "submit_maintenance_review", label: "提交检查顺序", from: ["待排序"], to: "检查顺序待确认" },
    { id: "confirm_check_order", label: "确认检查顺序", from: ["检查顺序待确认"], to: "检查顺序已确认", supervisor: true },
    { id: "continue_sampling", label: "继续循环采样", from: ["待排序"], to: "继续采样" },
  ],
  "20": [
    { id: "submit_station_check", label: "提交站端核查", from: ["待核查"], to: "站端核查中" },
    { id: "confirm_attribution", label: "确认核查方向", from: ["站端核查中"], to: "核查方向已确认", supervisor: true },
    { id: "hold_control_change", label: "登记禁止控制变更", from: ["待核查", "站端核查中"], to: "禁止控制变更已登记", supervisor: true },
  ],
};

export const CASES: CaseDefinition[] = drafts.map((draft) => {
  const steps = caseFlows[draft.id];
  const rules = CASE_RULES[draft.id];
  const copy = CASE_WORKSPACE_COPY[draft.id];
  if (!steps || !rules || !copy) {
    throw new Error(`missing_case_contract:${draft.id}`);
  }
  const workflow = {
    initialState: draft.initialState ?? "待处理",
    commands: Object.fromEntries(
      steps.map((step) => [
        step.id,
        {
          from: step.from,
          to: step.to,
          roles: step.roles ?? (step.supervisor
            ? ["supervisor"]
            : [draft.primaryRole]),
        },
      ]),
    ),
  };
  return {
    ...draft,
    views: flagshipIds.has(draft.id) ? flagshipViews : standardViews,
    workflow,
    commandLabels: Object.fromEntries(steps.map((step) => [step.id, step.label])),
    rules,
    workspace: {
      ...copy,
      processSteps: steps.map((step) => ({
        label: step.label,
        states: [...step.from, step.to],
      })),
    },
    aiEnabled: flagshipIds.has(draft.id),
  };
});

export function getCaseDefinition(idOrSlug: string): CaseDefinition | undefined {
  const runtimeId = /^B\d{2}$/i.test(idOrSlug) ? idOrSlug.slice(1) : idOrSlug;
  return CASES.find(
    (item) =>
      item.id === runtimeId ||
      item.slug === runtimeId ||
      `${item.id}-${item.slug}` === runtimeId,
  );
}
