import type {
  CaseDecision,
  CaseMetric,
  CaseMetricSpec,
  CasePredicate,
  CaseRuleSet,
  CaseWorkspace,
} from "./contracts";

type WorkspaceCopy = Omit<CaseWorkspace, "processSteps">;
type CsvRow = Record<string, string>;

const eq = (field: string, value: string | number | boolean): CasePredicate => ({
  field,
  op: "eq",
  value,
});
const neq = (field: string, value: string | number | boolean): CasePredicate => ({
  field,
  op: "neq",
  value,
});
const gt = (field: string, value: number): CasePredicate => ({ field, op: "gt", value });
const gte = (field: string, value: number): CasePredicate => ({ field, op: "gte", value });
const lte = (field: string, value: number): CasePredicate => ({ field, op: "lte", value });
const empty = (field: string): CasePredicate => ({ field, op: "empty" });

const workspace = (
  queueEyebrow: string,
  queueTitle: string,
  decisionTitle: string,
  sortHint: string,
): WorkspaceCopy => ({ queueEyebrow, queueTitle, decisionTitle, sortHint });

export const CASE_WORKSPACE_COPY: Record<string, WorkspaceCopy> = {
  "B001": workspace("退款核验队列", "先看取消标记与人民币金额", "退款处置判断", "取消代理、金额、客户身份"),
  "B002": workspace("试投候选会员", "按价值与参与度安排小流量试投", "会员入组判断", "价值分层、参与度、购买次数"),
  "B003": workspace("差评研判队列", "按低星与具体服务问题排序", "问题优先级判断", "星级、服务分项、餐食分项"),
  "B004": workspace("申请复核队列", "先处理身份、收入与授权材料缺口", "人工复核判断", "身份核验、收入材料、授权状态"),
  "B005": workspace("转运交接队列", "先处理冲突、迟到和缺失会签", "交接状态判断", "冲突类型、事件时序、会签状态"),
  "B006": workspace("历史摘录质检队列", "先核六项污染物是否齐备", "本批次纳入判断", "缺测数、站点、源行"),
  "B007": workspace("履约窗口队列", "按晚高峰和订单复杂度排序", "容量评审判断", "到单分钟、商品数、订单量"),
  "B008": workspace("水质事件队列", "先处理高风险与设备离线记录", "现场响应判断", "风险级别、传感器、证据状态"),
  "B009": workspace("设备检索队列", "故障窗口优先进入证据核验", "检查单判断", "故障窗口、电机电流、维护许可"),
  "B010": workspace("投诉任务队列", "高优先级与丢失响应任务在前", "任务恢复判断", "优先级、外部调用场景、证据完整度"),
  "B011": workspace("准入检查队列", "未通过与缺切片证据项优先", "发布候选判断", "检查结果、证据状态、样本量"),
  "B012": workspace("冷链调查队列", "温度、交接和离线记录联合排序", "质量会签判断", "温度、交接、离线时长"),
  "B013": workspace("接车进线", "逐题记录客户回答，紧急情况先转技师", "接车分流", "客户回答、安全标记、技师接收"),
  "B014": workspace("连续高硅事件", "按事件持续时长和完整记录排序", "现场核对单", "事件时段、72 小时趋势、优先核对槽位、品质记录"),
  "B015": workspace("生产观测复测队列", "未通过观测与高优先级记录在前", "观测复测判断", "质量标签、复核优先级、复测条件"),
  "B016": workspace("风机下偏核查队列", "按日级下偏标记与数据覆盖排序", "现场核查判断", "日级下偏标记、有效风速、平均功率"),
  "B017": workspace("设备健康队列", "偏差高且证据可用的窗口优先", "夜班排检判断", "健康偏差、证据覆盖、复核等级"),
  "B018": workspace("温度偏差队列", "按偏离方向与持续时间排序", "当班排查判断", "温度状态、持续时间、完整度"),
  "B019": workspace("液压循环待排序", "按总体状态和受影响部件核对", "部件检查顺序", "严重度、稳定性、部件数"),
  "B020": workspace("光伏站端资料核查", "先分清日均事实、派生线索和缺失资料", "站端核查任务", "归一化出力比、疑似限电、温度降额线索"),
  "B021": workspace("上海周末候选点", "先排地理顺序，再算门票与时间", "两日路线确认", "区域、门票、热度、人工核验项"),
  "B022": workspace("历史调剂通知", "先看发布日期和来源路径", "回源核验清单", "年份、院校、专业、官方复核要求"),
  "B023": workspace("春节档影片池", "在影厅容量内比较片长与历史热度", "下一轮排片沙盘", "片长、历史票房、排片占比、黄金场"),
  "B024": workspace("门店补货候选", "销量节奏只能决定先核对谁", "补货任务确认", "门店、品类、销量速度、库存资料缺口"),
};

export const CASE_RULES: Record<string, CaseRuleSet> = {
  "B001": {
    metrics: [
      { id: "cancel-lines", label: "取消记录", note: "数据中标记为取消", field: "is_cancellation_proxy", aggregation: "count-where", where: [eq("is_cancellation_proxy", true)], format: "integer" },
      { id: "cancel-value", label: "取消涉及金额", note: "按人民币绝对值汇总", field: "line_amount_cny", aggregation: "sum", where: [eq("is_cancellation_proxy", true)], absolute: true, format: "currency-cny" },
      { id: "missing-customer", label: "客户号缺失", note: "无法直接关联客户身份", field: "customer_id", aggregation: "count-where", where: [empty("customer_id")], format: "integer" },
    ],
    decisions: [
      { level: "urgent", label: "先暂缓退款", reason: "取消记录金额较高，需先锁定原单和退款关系。", recommendedCommand: "hold_refund", when: [eq("is_cancellation_proxy", true), lte("line_amount_cny", -1000)], match: "all" },
      { level: "attention", label: "创建原单补证", reason: "记录带取消标记或缺少客户号，当前证据不足以直接放行。", recommendedCommand: "create_evidence_request", when: [eq("is_cancellation_proxy", true), empty("customer_id")], match: "any" },
    ],
    defaultDecision: { level: "normal", label: "核对原单关系", reason: "当前行未触发取消异常，仍需完成原单关联后再处置。", recommendedCommand: "create_evidence_request", sourceFields: ["is_cancellation_proxy", "invoice_id", "customer_id"] },
  },
  "B002": {
    metrics: [
      { id: "engagement", label: "平均参与度", note: "浏览、加购与购买综合分", field: "engagement_score", aggregation: "mean", format: "decimal" },
      { id: "core-members", label: "核心会员", note: "价值分层为核心", field: "value_segment", aggregation: "count-where", where: [eq("value_segment", "核心")], format: "integer" },
      { id: "purchases", label: "购买行为", note: "本地样本购买次数合计", field: "buy_count", aggregation: "sum", format: "integer" },
    ],
    decisions: [
      { level: "urgent", label: "优先进入小流量试投", reason: "核心会员且参与度高，适合作为首批验证对象。", recommendedCommand: "design_trial", when: [eq("value_segment", "核心"), gte("engagement_score", 125)], match: "all" },
      { level: "attention", label: "观察后入组", reason: "行为强度达到试验候选水平，但不宜直接扩大投放。", recommendedCommand: "design_trial", when: [gte("engagement_score", 105)] },
    ],
    defaultDecision: { level: "normal", label: "暂不扩大投放", reason: "当前行为强度较低，先保留为对照或观察样本。", recommendedCommand: "design_trial", sourceFields: ["value_segment", "engagement_score", "buy_count"] },
  },
  "B003": {
    metrics: [
      { id: "low-star", label: "低星评价", note: "一星或二星评价", field: "star", aggregation: "count-where", where: [lte("star", 2)], format: "integer" },
      { id: "service-negative", label: "服务负向", note: "排队、接待或时效明确负向", field: "Service#Queue", aggregation: "count-where", where: [eq("Service#Queue", -1), eq("Service#Hospitality", -1), eq("Service#Timely", -1)], match: "any", format: "integer" },
      { id: "food-negative", label: "餐食负向", note: "口味或推荐意愿明确负向", field: "Food#Taste", aggregation: "count-where", where: [eq("Food#Taste", -1), eq("Food#Recommend", -1)], match: "any", format: "integer" },
    ],
    decisions: [
      { level: "urgent", label: "优先创建验证单", reason: "低星评价同时出现明确服务或餐食负向信号。", recommendedCommand: "create_validation_task", when: [lte("star", 2), eq("Service#Hospitality", -1)], match: "all" },
      { level: "attention", label: "进入问题研判", reason: "评论存在低星或分项负向，应先验证是否具有代表性。", recommendedCommand: "create_validation_task", when: [lte("star", 2), eq("Food#Taste", -1), eq("Service#Queue", -1)], match: "any" },
    ],
    defaultDecision: { level: "normal", label: "归档为弱信号", reason: "当前评价没有形成明确的高优先问题组合。", recommendedCommand: "archive_signal", sourceFields: ["star", "Service#Queue", "Food#Taste"] },
  },
  "B004": {
    metrics: [
      { id: "income-missing", label: "收入材料缺失", note: "收入证明状态为缺失", field: "income_evidence_status", aggregation: "count-where", where: [eq("income_evidence_status", "missing")], format: "integer" },
      { id: "identity-pending", label: "身份待核验", note: "身份核验尚未完成", field: "identity_verification_status", aggregation: "count-where", where: [neq("identity_verification_status", "verified")], format: "integer" },
      { id: "consent-missing", label: "授权未确认", note: "数据使用授权尚未确认", field: "consent_status", aggregation: "count-where", where: [neq("consent_status", "confirmed")], format: "integer" },
    ],
    decisions: [
      { level: "urgent", label: "暂缓并核验身份授权", reason: "身份、授权或申请一致性尚未满足人工复核前提。", recommendedCommand: "hold_application", when: [neq("identity_verification_status", "verified"), neq("consent_status", "confirmed"), neq("application_consistency", "consistent")], match: "any" },
      { level: "attention", label: "请求补充收入材料", reason: "收入证明缺失，需要补齐后再进入独立人工复核。", recommendedCommand: "request_material", when: [eq("income_evidence_status", "missing")] },
    ],
    defaultDecision: { level: "normal", label: "材料状态无缺口", reason: "当前字段没有显示材料缺失，不创建补正任务；后续风险判断仍由人工完成。", recommendedCommand: "hold_application", sourceFields: ["identity_verification_status", "income_evidence_status", "consent_status"] },
  },
  "B005": {
    metrics: [
      { id: "conflicts", label: "状态冲突", note: "冲突类型不为“无”", field: "conflict_type", aggregation: "count-where", where: [neq("conflict_type", "none")], format: "integer" },
      { id: "late-events", label: "迟到事件", note: "事件被标记为迟到", field: "late_event", aggregation: "count-where", where: [eq("late_event", true)], format: "integer" },
      { id: "pending-cosign", label: "待会签事件", note: "接收会签尚未完成", field: "co_sign_status", aggregation: "count-where", where: [eq("co_sign_status", "pending")], format: "integer" },
    ],
    decisions: [
      { level: "urgent", label: "升级事件冲突", reason: "事件互斥、乱序或晚到后重开，需要人工选择调和方式。", recommendedCommand: "escalate_conflict", when: [eq("conflict_type", "mutually_exclusive"), eq("conflict_type", "out_of_order"), eq("conflict_type", "late_reopen")], match: "any" },
      { level: "attention", label: "核对交接记录", reason: "事件重复或会签记录缺失，应先核对来源和版本。", recommendedCommand: "nurse_confirm", when: [eq("conflict_type", "missing"), eq("conflict_type", "duplicate")], match: "any" },
      { level: "attention", label: "处理晚到事件", reason: "事件发生后较晚才进入系统，应保留原历史并追加调和记录。", recommendedCommand: "nurse_confirm", when: [eq("late_event", true)] },
    ],
    defaultDecision: { level: "normal", label: "进入接收会签", reason: "事件时序未见冲突，按既定转运流程核对接收方。", recommendedCommand: "nurse_confirm", sourceFields: ["conflict_type", "late_event", "co_sign_status"] },
  },
  "B006": {
    metrics: [
      { id: "missing", label: "缺测记录", note: "至少一个污染物缺测", field: "missing_pollutant_count", aggregation: "count-where", where: [gt("missing_pollutant_count", 0)], format: "integer" },
      { id: "pm25-peak", label: "PM2.5 峰值", note: "本地样本最大观测值", field: "PM2.5", aggregation: "max", format: "decimal" },
      { id: "stations", label: "涉及站点", note: "站点去重计数", field: "station", aggregation: "count-distinct", format: "integer" },
    ],
    decisions: [
      { level: "urgent", label: "本批次不纳入", reason: "至少一项污染物缺测，不能形成字段完整的数据摘录。", recommendedCommand: "reject_release", when: [gt("missing_pollutant_count", 0)] },
      { level: "attention", label: "核对完整原值", reason: "六项污染物均有原值，可以进入锁定与第二人复核。", recommendedCommand: "freeze_release_scope", when: [eq("missing_pollutant_count", 0)] },
    ],
    defaultDecision: { level: "normal", label: "核对数据摘录", reason: "先核对站点、时次、源行和六项污染物原值。", recommendedCommand: "freeze_release_scope", sourceFields: ["missing_pollutant_count", "station", "No"] },
  },
  "B007": {
    metrics: [
      { id: "review-windows", label: "评审窗口", note: "场站日期窗口数量", aggregation: "count", format: "integer" },
      { id: "fulfillment-p95", label: "履约 P95", note: "合成运营窗口延迟", field: "fulfillment_p95_latency_ms", aggregation: "max", format: "integer" },
      { id: "fulfillment-recovery", label: "履约恢复", note: "合成运营记录中的恢复分钟", field: "fulfillment_recovery_minutes", aggregation: "max", format: "integer" },
    ],
    decisions: [
      { level: "urgent", label: "核对发布与恢复同窗现象", reason: "履约延迟和恢复时长同时较高，但仍缺调用链和容量证据。", recommendedCommand: "verify_evidence", when: [gte("fulfillment_p95_latency_ms", 800), gte("fulfillment_recovery_minutes", 30)], match: "all" },
    ],
    defaultDecision: { level: "normal", label: "进入窗口评审", reason: "先核对四域记录，不据此直接拆分服务。", recommendedCommand: "verify_evidence", sourceFields: ["facility_code", "scenario_date"] },
  },
  "B008": {
    metrics: [
      { id: "high-risk", label: "高风险记录", note: "风险级别为高", field: "risk_level", aggregation: "count-where", where: [eq("risk_level", "high")], format: "integer" },
      { id: "offline", label: "设备离线", note: "传感器处于离线状态", field: "sensor_status", aggregation: "count-where", where: [eq("sensor_status", "offline")], format: "integer" },
      { id: "incomplete", label: "证据异常", note: "证据记录不完整或冲突", field: "evidence_status", aggregation: "count-where", where: [neq("evidence_status", "complete")], format: "integer" },
    ],
    decisions: [
      { level: "urgent", label: "暂缓并补现场证据", reason: "高风险记录同时存在传感器或证据异常，不能直接确认事件。", recommendedCommand: "hold_for_evidence", when: [eq("risk_level", "high"), neq("evidence_status", "complete")], match: "all" },
      { level: "attention", label: "派发现场核查", reason: "风险、离线或证据异常至少命中一项，需要现场确认。", recommendedCommand: "dispatch_field_check", when: [eq("risk_level", "high"), eq("sensor_status", "offline"), neq("evidence_status", "complete")], match: "any" },
    ],
    defaultDecision: { level: "normal", label: "进入常规记录核对", reason: "传感器在线且证据完整，仍按人工流程核对记录。", recommendedCommand: "dispatch_field_check", sourceFields: ["risk_level", "sensor_status", "evidence_status"] },
  },
  "B009": {
    metrics: [
      { id: "investigations", label: "断档调查", note: "固定调查对象数量", aggregation: "count", format: "integer" },
      { id: "gap-seconds", label: "最大断档", note: "相邻记录的真实时间差（秒）", field: "gap_seconds", aggregation: "max", format: "integer" },
      { id: "motor-after", label: "恢复后电流", note: "断档后首条电机电流", field: "motor_current_after", aggregation: "max", format: "decimal" },
    ],
    decisions: [
      { level: "urgent", label: "先补设备记录", reason: "相邻遥测记录相差 352 秒，状态变化过程不可见。", recommendedCommand: "hold_investigation", when: [gte("gap_seconds", 120)] },
    ],
    defaultDecision: { level: "normal", label: "核对连续窗口", reason: "连续性通过后，仍需本地资料与人工复核才能提交检查申请。", recommendedCommand: "run_retrieval", sourceFields: ["investigation_id", "gap_seconds"] },
  },
  "B010": {
    metrics: [
      { id: "high-priority", label: "高优先级任务", note: "优先级为高", field: "priority", aggregation: "count-where", where: [eq("priority", "高")], format: "integer" },
      { id: "lookups", label: "外部查证任务", note: "已进入外部调用场景", field: "external_lookup_scenario", aggregation: "count-where", where: [neq("external_lookup_scenario", "not_committed")], format: "integer" },
      { id: "incomplete", label: "证据不完整", note: "任务证据尚未齐全", field: "evidence_complete", aggregation: "count-where", where: [eq("evidence_complete", false)], format: "integer" },
    ],
    decisions: [
      { level: "urgent", label: "先查外部效果，禁止重放", reason: "课程故障标签提示响应未取得，但外部效果没有回执，必须先查询并留证。", recommendedCommand: "start_lookup", when: [eq("priority", "关注"), eq("external_lookup_scenario", "committed_response_lost")], match: "all" },
      { level: "attention", label: "保留未知并补核对证据", reason: "外部效果或证据仍不完整，不能把课程标签当成真实处理结果。", recommendedCommand: "start_lookup", when: [neq("external_lookup_scenario", "not_committed"), eq("evidence_complete", false)], match: "any" },
    ],
    defaultDecision: { level: "normal", label: "核对本地登记状态", reason: "当前课程标签为尚未提交，不应虚构外部效果或发起恢复重放。", recommendedCommand: "start_lookup", sourceFields: ["priority", "external_lookup_scenario", "evidence_complete"] },
  },
  "B011": {
    metrics: [
      { id: "failed-gates", label: "未通过检查项", note: "准入检查结果未通过", field: "result", aggregation: "count-where", where: [neq("result", "pass")], format: "integer" },
      { id: "evidence-gaps", label: "证据缺口", note: "准入检查证据尚未齐全", field: "evidence_status", aggregation: "count-where", where: [neq("evidence_status", "complete")], format: "integer" },
      { id: "min-sample", label: "最小样本量", note: "各类准入检查的样本量下限", field: "sample_size", aggregation: "min", format: "integer" },
    ],
    decisions: [
      { level: "urgent", label: "地区切片补测前不能确认", reason: "单项越线且切片材料缺失，八项通过不能覆盖这一阻断项。", recommendedCommand: "request_release_evidence", when: [neq("result", "pass"), neq("evidence_status", "complete")], match: "all" },
      { level: "attention", label: "补齐单项材料再会签", reason: "检查结果或证据状态需要补齐，不能写成生产发布批准。", recommendedCommand: "request_release_evidence", when: [neq("result", "pass"), neq("evidence_status", "complete")], match: "any" },
    ],
    defaultDecision: { level: "normal", label: "进入会签核对", reason: "当前准入检查通过且证据完整，仍由多角色完成准入会签。", recommendedCommand: "request_release_evidence", sourceFields: ["result", "evidence_status", "sample_size"] },
  },
  "B012": {
    metrics: [
      { id: "temperature-excursion", label: "温度异常", note: "温度高于 8℃", field: "temperature_c", aggregation: "count-where", where: [gt("temperature_c", 8)], format: "integer" },
      { id: "handoff-gap", label: "交接异常", note: "交接记录尚未完整", field: "handoff_status", aggregation: "count-where", where: [neq("handoff_status", "complete")], format: "integer" },
      { id: "offline-peak", label: "最长离线", note: "记录器离线分钟峰值", field: "offline_minutes", aggregation: "max", format: "integer" },
    ],
    decisions: [
      { level: "urgent", label: "等待补齐交接证据", reason: "温度越界并伴随交接缺口，只能保留运输记录调查，不能形成产品结论。", recommendedCommand: "hold_batch", when: [gt("temperature_c", 8), neq("handoff_status", "complete")], match: "all" },
      { level: "attention", label: "启动运输记录调查", reason: "温度、交接或离线记录至少一项异常，需要沿时间带核对证据。", recommendedCommand: "open_investigation", when: [gt("temperature_c", 8), neq("route_record_status", "complete"), gt("offline_minutes", 0)], match: "any" },
    ],
    defaultDecision: { level: "normal", label: "完成运输记录核对", reason: "当前记录没有异常，仍只确认记录完整性，不产生产品可用性结论。", recommendedCommand: "open_investigation", sourceFields: ["temperature_c", "handoff_status", "offline_minutes"] },
  },
  "B013": {
    metrics: [
      { id: "safety-review", label: "需要安全复核", note: "进线触发安全复核", field: "safety_review_required", aggregation: "count-where", where: [eq("safety_review_required", true)], format: "integer" },
      { id: "repair-blocked", label: "禁止自动维修", note: "未开放自动维修动作", field: "automatic_repair_allowed", aggregation: "count-where", where: [eq("automatic_repair_allowed", false)], format: "integer" },
      { id: "symptom-kinds", label: "症状类别", note: "症状类别去重计数", field: "symptom_category", aggregation: "count-distinct", format: "integer" },
    ],
    decisions: [
      { level: "urgent", label: "优先人工分流", reason: "症状触发安全复核，不能自动给出维修动作。", recommendedCommand: "submit_triage", when: [eq("safety_review_required", true)] },
      { level: "attention", label: "补充症状后再派发", reason: "自动维修被禁用，当前进线应由人工确认具体去向。", recommendedCommand: "request_details", when: [eq("automatic_repair_allowed", false)] },
    ],
    defaultDecision: { level: "normal", label: "进入常规人工分流", reason: "当前未触发安全复核，仍保留人工改派入口。", recommendedCommand: "submit_triage", sourceFields: ["safety_review_required", "symptom_category", "automatic_repair_allowed"] },
  },
  "B014": {
    metrics: [
      { id: "high-silica", label: "连续事件", note: "事件表中的高硅规则事件", field: "event_id", aggregation: "count-distinct", format: "integer" },
      { id: "consecutive", label: "最长持续时长", note: "事件表记录的持续小时", field: "duration_hours", aggregation: "max", format: "integer" },
      { id: "incomplete", label: "数据不完整", note: "完整度状态不是完整", field: "completeness_state", aggregation: "count-where", where: [neq("completeness_state", "完整")], format: "integer" },
    ],
    decisions: [
      { level: "urgent", label: "保持禁止自动调参", reason: "事件已持续三小时以上，当前记录只能用来安排人工核对。", recommendedCommand: "hold_adjustment", when: [gte("duration_hours", 3)] },
      { level: "attention", label: "提交工艺复核", reason: "事件持续时间、逐列记录和品质记录需要随单保存，再安排现场核对。", recommendedCommand: "submit_process_review", when: [gte("duration_hours", 1)] },
    ],
    defaultDecision: { level: "normal", label: "复核事件记录", reason: "先核对事件时段与逐列记录，不由页面生成根因或设定值。", recommendedCommand: "submit_process_review", sourceFields: ["event_id", "duration_hours", "completeness_state"] },
  },
  "B015": {
    metrics: [
      { id: "failed", label: "未通过观测", note: "质量标签未通过", field: "quality_label", aggregation: "count-where", where: [eq("quality_label", "fail")], format: "integer" },
      { id: "high-priority", label: "高优先级复核", note: "进入质量门复核", field: "review_priority", aggregation: "count-where", where: [eq("review_priority", "quality-gate-review")], format: "integer" },
      { id: "scrap-blocked", label: "禁止自动报废", note: "未开放自动报废动作", field: "automatic_scrap_allowed", aggregation: "count-where", where: [eq("automatic_scrap_allowed", false)], format: "integer" },
    ],
    decisions: [
      { level: "urgent", label: "隔离记录并提交复测", reason: "质量标签未通过且复核优先级高，先隔离该生产观测。", recommendedCommand: "quarantine_batch", when: [eq("quality_label", "fail"), eq("review_priority", "quality-gate-review")], match: "all" },
      { level: "attention", label: "提交生产观测复测", reason: "当前记录需要人工区分信号变化与测点漂移。", recommendedCommand: "request_retest", when: [eq("review_priority", "quality-gate-review")] },
    ],
    defaultDecision: { level: "normal", label: "执行常规复测抽查", reason: "质量标签通过，但仍不允许自动报废或自动放行。", recommendedCommand: "request_retest", sourceFields: ["quality_label", "review_priority", "automatic_scrap_allowed"] },
  },
  "B016": {
    metrics: [
      { id: "underperformance", label: "下偏标记占比", note: "日级下偏标记在运行日中的占比", field: "underperformance_share", aggregation: "mean", format: "percent" },
      { id: "wind-coverage", label: "有效风速覆盖", note: "有效风速记录 / 来源记录", field: "valid_wind_records", ratioDenominatorField: "source_records", aggregation: "mean", format: "percent" },
      { id: "mean-power", label: "平均有功功率", note: "各窗口平均有功功率", field: "mean_active_power", aggregation: "mean", format: "decimal" },
    ],
    decisions: [
      { level: "urgent", label: "优先提交现场核查", reason: "日级下偏标记集中且数据覆盖充分，应先补齐风况、限电、告警和维修记录。", recommendedCommand: "submit_field_check", when: [gte("underperformance_share", 0.3), gte("valid_wind_records", 130)], match: "all" },
      { level: "attention", label: "进入下偏核查", reason: "日级下偏标记已超过观察线，需要补齐外部运行材料。", recommendedCommand: "submit_field_check", when: [gte("underperformance_share", 0.1)] },
    ],
    defaultDecision: { level: "normal", label: "保留为运行对照", reason: "当前日级下偏标记较少，继续观察运行数据。", recommendedCommand: "hold_attribution", sourceFields: ["underperformance_share", "valid_wind_records", "mean_active_power"] },
  },
  "B017": {
    metrics: [
      { id: "health-peak", label: "健康偏差峰值", note: "health_deviation_index 最大值", field: "health_deviation_index", aggregation: "max", format: "decimal" },
      { id: "evidence-usable", label: "证据可用占比", note: "证据覆盖状态为可用", field: "evidence_coverage", aggregation: "count-where", where: [eq("evidence_coverage", "可用")], shareOfRows: true, format: "percent" },
      { id: "priority-review", label: "优先复核窗口", note: "规则复核等级为优先复核", field: "rule_review_level", aggregation: "count-where", where: [eq("rule_review_level", "优先复核")], format: "integer" },
    ],
    decisions: [
      { level: "urgent", label: "提交夜班排检", reason: "健康偏差较高且规则等级为优先复核，应安排最近可用窗口。", recommendedCommand: "schedule_night_inspection", when: [gte("health_deviation_index", 7), eq("rule_review_level", "优先复核")], match: "all" },
      { level: "attention", label: "进入排检候选", reason: "偏差或复核等级达到关注线，需要人工确认停机代价。", recommendedCommand: "schedule_night_inspection", when: [gte("health_deviation_index", 5), eq("rule_review_level", "关注")], match: "any" },
    ],
    defaultDecision: { level: "normal", label: "继续采样观察", reason: "当前偏差未达到排检线，保持连续采样。", recommendedCommand: "continue_monitoring", sourceFields: ["health_deviation_index", "evidence_coverage", "rule_review_level"] },
  },
  "B018": {
    metrics: [
      { id: "deviation", label: "偏离窗口", note: "温度状态不是区间内", field: "temperature_state", aggregation: "count-where", where: [neq("temperature_state", "区间内")], format: "integer" },
      { id: "consecutive", label: "最长连续偏离", note: "连续偏离分钟", field: "consecutive_deviation_minutes", aggregation: "max", format: "integer" },
      { id: "temperature-peak", label: "温度峰值", note: "主蒸汽温度最大值", field: "steam_temperature_max", aggregation: "max", format: "decimal" },
    ],
    decisions: [
      { level: "urgent", label: "阻断自动调节", reason: "温度连续偏离时间较长，不应在根因未明时自动改控制量。", recommendedCommand: "hold_control_change", when: [neq("temperature_state", "区间内"), gte("consecutive_deviation_minutes", 10)], match: "all" },
      { level: "attention", label: "提交当班排查", reason: "温度已偏离来源区间，需要追踪偏离方向和持续时间。", recommendedCommand: "dispatch_shift_check", when: [neq("temperature_state", "区间内")] },
    ],
    defaultDecision: { level: "normal", label: "保持常规监测", reason: "当前温度处于来源区间内，继续观察趋势。", recommendedCommand: "dispatch_shift_check", sourceFields: ["temperature_state", "consecutive_deviation_minutes", "steam_temperature_mean"] },
  },
  "B019": {
    metrics: [
      { id: "degraded", label: "退化周期", note: "总体严重度为退化", field: "overall_severity_label", aggregation: "count-where", where: [eq("overall_severity_label", "退化")], format: "integer" },
      { id: "unstable", label: "未稳定周期", note: "稳定性标签为未稳定", field: "stability_label", aggregation: "count-where", where: [eq("stability_label", "未稳定")], format: "integer" },
      { id: "components", label: "受影响部件峰值", note: "单周期受影响部件数", field: "affected_component_count", aggregation: "max", format: "integer" },
    ],
    decisions: [
      { level: "urgent", label: "优先提交检查顺序", reason: "总体状态退化且多个部件受影响，需要人工确定先查哪一项。", recommendedCommand: "submit_maintenance_review", when: [eq("overall_severity_label", "退化"), gte("affected_component_count", 3)], match: "all" },
      { level: "attention", label: "核对部件状态", reason: "循环未稳定或总体处于临界状态，应逐项核对部件记录。", recommendedCommand: "submit_maintenance_review", when: [eq("stability_label", "未稳定"), eq("overall_severity_label", "临界")], match: "any" },
    ],
    defaultDecision: { level: "normal", label: "继续循环采样", reason: "当前循环稳定且总体状态正常，保留为对照。", recommendedCommand: "continue_sampling", sourceFields: ["overall_severity_label", "stability_label", "affected_component_count"] },
  },
  "B020": {
    metrics: [
      { id: "efficiency", label: "平均归一化出力比", note: "课程归一化比值，不是物理效率", field: "mean_efficiency_ratio", aggregation: "mean", format: "decimal" },
      { id: "curtailment", label: "疑似限电记录占比", note: "满足课程规则的记录占比，尚未核实", field: "curtailment_suspected_share", aggregation: "mean", format: "percent" },
      { id: "derating", label: "平均温度降额线索", note: "课程计算的温度派生线索", field: "mean_temperature_derating_pct", aggregation: "mean", format: "percent" },
    ],
    decisions: [
      { level: "urgent", label: "登记禁止控制变更", reason: "归一化出力比偏低且疑似限电记录集中，资料补齐前不允许平台改变控制设定。", recommendedCommand: "hold_control_change", when: [lte("mean_efficiency_ratio", 0.65), gte("curtailment_suspected_share", 0.1)], match: "all" },
      { level: "attention", label: "提交站端核查", reason: "归一化出力、疑似限电或温度线索需要站端记录核对。", recommendedCommand: "submit_station_check", when: [lte("mean_efficiency_ratio", 0.8), gte("curtailment_suspected_share", 0.05), gte("mean_temperature_derating_pct", 0.03)], match: "any" },
    ],
    defaultDecision: { level: "normal", label: "保留为运行对照日", reason: "当前归一化出力与疑似限电线索未达到核查线。", recommendedCommand: "submit_station_check", sourceFields: ["mean_efficiency_ratio", "curtailment_suspected_share", "mean_temperature_derating_pct"] },
  },
  "B021": {
    metrics: [
      { id: "cities", label: "覆盖城市", note: "历史快照中的城市数量", field: "city_name", aggregation: "count-distinct", format: "integer" },
      { id: "free-poi", label: "免费候选点", note: "源数据标记为免费", field: "is_free", aggregation: "count-where", where: [eq("is_free", true)], format: "integer" },
      { id: "mean-price", label: "平均门票", note: "历史快照票价，不代表当日价格", field: "price_cny", aggregation: "mean", format: "currency-cny" },
    ],
    decisions: [
      { level: "attention", label: "先核对高价景点", reason: "单点历史票价较高，需在锁定路线前核对预约和当日价格。", recommendedCommand: "save_route_draft", when: [gte("price_cny", 250)] },
      { level: "attention", label: "核对预约后入线", reason: "历史热度较高，排入路线前要核对预约和交通时间。", recommendedCommand: "save_route_draft", when: [gte("sales_count", 10000)] },
    ],
    defaultDecision: { level: "normal", label: "加入路线候选", reason: "该点可以进入地理与时间排序，最终营业信息仍需现场核对。", recommendedCommand: "save_route_draft", sourceFields: ["city_name", "district", "price_cny", "longitude", "latitude"] },
  },
  "B022": {
    metrics: [
      { id: "schools", label: "涉及院校", note: "历史通知中的去重院校", field: "school_name", aggregation: "count-distinct", format: "integer" },
      { id: "historic", label: "历史快照", note: "不能直接作为当前招生信息", field: "freshness_status", aggregation: "count-where", where: [eq("freshness_status", "历史快照")], format: "integer" },
      { id: "official-check", label: "需官方核验", note: "进入清单后仍须回到官方来源", field: "official_verification_required", aggregation: "count-where", where: [eq("official_verification_required", true)], format: "integer" },
    ],
    decisions: [
      { level: "urgent", label: "只进入回源核验", reason: "这是一份历史快照，不能直接推断当前仍有调剂名额。", recommendedCommand: "create_verification_task", when: [eq("freshness_status", "历史快照")] },
    ],
    defaultDecision: { level: "attention", label: "核对来源和日期", reason: "先确认发布日期、来源路径和院校官方页面，再决定是否保留。", recommendedCommand: "create_verification_task", sourceFields: ["published_date", "source_relative_url", "official_verification_required"] },
  },
  "B023": {
    metrics: [
      { id: "box-office", label: "累计历史票房", note: "截至 2022-03-02 的历史快照", field: "cumulative_box_office_cny", aggregation: "sum", format: "currency-cny" },
      { id: "audience", label: "累计观影人次", note: "源数据历史累计值", field: "cumulative_audience", aggregation: "sum", format: "integer" },
      { id: "schedule-share", label: "平均历史排片占比（%）", note: "不是本影院当前排片", field: "latest_schedule_share_pct", aggregation: "mean", format: "decimal" },
    ],
    decisions: [
      { level: "attention", label: "进入黄金场模拟", reason: "历史排片占比和受众规模较高，可进入影厅容量沙盘比较。", recommendedCommand: "save_screening_draft", when: [gte("latest_schedule_share_pct", 20)] },
    ],
    defaultDecision: { level: "normal", label: "安排非黄金场比较", reason: "先比较片长、受众和影厅周转，不按总票房直接分配黄金场。", recommendedCommand: "save_screening_draft", sourceFields: ["runtime_minutes", "cumulative_audience", "latest_schedule_share_pct"] },
  },
  "B024": {
    metrics: [
      { id: "stores", label: "覆盖门店", note: "历史交易涉及门店", field: "store_id", aggregation: "count-distinct", format: "integer" },
      { id: "units", label: "历史销量", note: "交易记录中的销量合计，不是库存", field: "units", aggregation: "sum", format: "integer" },
      { id: "mean-price", label: "平均成交单价", note: "历史交易口径", field: "unit_price_cny", aggregation: "mean", format: "currency-cny" },
    ],
    decisions: [
      { level: "attention", label: "先核对库存资料", reason: "本单销量较高，只能提升核对优先级，不能直接生成补货量。", recommendedCommand: "create_inventory_check", when: [gte("units", 10)] },
    ],
    defaultDecision: { level: "normal", label: "进入门店品类聚合", reason: "单笔交易不足以决定补货，需与历史销量节奏和库存资料合并。", recommendedCommand: "create_inventory_check", sourceFields: ["store_id", "category_id", "units", "transaction_time"] },
  },
};

function normalized(value: unknown): string {
  return String(value ?? "").trim().toLocaleLowerCase("zh-CN");
}

function numeric(value: unknown): number {
  const parsed = Number(String(value ?? "").trim());
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function booleanValue(value: unknown): boolean | undefined {
  const text = normalized(value);
  if (["true", "1", "yes", "y", "是"].includes(text)) return true;
  if (["false", "0", "no", "n", "否"].includes(text)) return false;
  return undefined;
}

export function matchesPredicate(row: CsvRow, predicate: CasePredicate): boolean {
  const actual = row[predicate.field];
  switch (predicate.op) {
    case "eq":
      if (typeof predicate.value === "boolean") {
        return booleanValue(actual) === predicate.value;
      }
      return normalized(actual) === normalized(predicate.value);
    case "neq":
      return !matchesPredicate(row, { ...predicate, op: "eq" });
    case "in":
      return Array.isArray(predicate.value)
        ? predicate.value.some((item) => normalized(actual) === normalized(item))
        : false;
    case "empty":
      return normalized(actual) === "";
    case "not-empty":
      return normalized(actual) !== "";
    case "truthy":
      return booleanValue(actual) === true;
    case "falsy":
      return booleanValue(actual) === false;
    case "gt":
      return numeric(actual) > numeric(predicate.value);
    case "gte":
      return numeric(actual) >= numeric(predicate.value);
    case "lt":
      return numeric(actual) < numeric(predicate.value);
    case "lte":
      return numeric(actual) <= numeric(predicate.value);
  }
}

function matches(
  row: CsvRow,
  predicates: CasePredicate[] | undefined,
  mode: "all" | "any" = "all",
): boolean {
  if (!predicates?.length) return true;
  return mode === "any"
    ? predicates.some((predicate) => matchesPredicate(row, predicate))
    : predicates.every((predicate) => matchesPredicate(row, predicate));
}

function metricNumber(rows: CsvRow[], spec: CaseMetricSpec): number {
  const selected = rows.filter((row) => matches(row, spec.where, spec.match));
  if (spec.aggregation === "count" || spec.aggregation === "count-where") {
    const value = selected.length;
    return spec.shareOfRows && rows.length > 0 ? value / rows.length : value;
  }
  if (spec.aggregation === "count-distinct") {
    return new Set(selected.map((row) => normalized(row[spec.field ?? ""]))).size;
  }
  const values = selected
    .map((row) => {
      const numerator = numeric(row[spec.field ?? ""]);
      const denominator = spec.ratioDenominatorField
        ? numeric(row[spec.ratioDenominatorField])
        : 1;
      const value = numerator / denominator;
      return spec.absolute ? Math.abs(value) : value;
    })
    .filter(Number.isFinite);
  if (values.length === 0) return 0;
  if (spec.aggregation === "sum") return values.reduce((sum, value) => sum + value, 0);
  if (spec.aggregation === "mean") return values.reduce((sum, value) => sum + value, 0) / values.length;
  if (spec.aggregation === "max") return Math.max(...values);
  return Math.min(...values);
}

function formatMetric(value: number, format: CaseMetricSpec["format"]): string {
  if (format === "currency-cny") {
    return new Intl.NumberFormat("zh-CN", {
      style: "currency",
      currency: "CNY",
      maximumFractionDigits: 0,
    }).format(value);
  }
  if (format === "percent") {
    return new Intl.NumberFormat("zh-CN", {
      style: "percent",
      maximumFractionDigits: 1,
    }).format(value);
  }
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: format === "integer" ? 0 : 2,
  }).format(value);
}

export function computeCaseMetrics(rows: CsvRow[], rules: CaseRuleSet): CaseMetric[] {
  return rules.metrics.map((spec) => ({
    id: spec.id,
    label: spec.label,
    value: formatMetric(metricNumber(rows, spec), spec.format),
    note: spec.note,
  }));
}

export function decideCaseRow(row: CsvRow, rules: CaseRuleSet): CaseDecision {
  const matched = rules.decisions.find((rule) => matches(row, rule.when, rule.match));
  if (!matched) return rules.defaultDecision;
  return {
    level: matched.level,
    label: matched.label,
    reason: matched.reason,
    recommendedCommand: matched.recommendedCommand,
    sourceFields: [...new Set(matched.when.map((predicate) => predicate.field))],
  };
}
