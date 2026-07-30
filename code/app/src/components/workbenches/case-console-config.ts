export type ConsoleValueFormat =
  | "text"
  | "integer"
  | "decimal"
  | "currency"
  | "currencyFen"
  | "temperature"
  | "percent"
  | "basisPoints";

export type ConsoleSignal = {
  key: string;
  label: string;
  format?: ConsoleValueFormat;
  unit?: string;
};

export type CaseConsoleConfig = {
  sceneAria: string;
  title: string;
  subject: string;
  decisionQuestion: string;
  sceneAlt: string;
  sceneAsset: string;
  sequenceTitle: string;
  sequenceKind: "time" | "records" | "process";
  timeField?: string;
  plotField?: string;
  signals: ConsoleSignal[];
  gaps: string[];
  hypothesesLabel: string;
  hypotheses: Array<{
    title: string;
    detail: string;
    tone: "support" | "review" | "missing";
  }>;
  steps: [string, string, string, string];
};

const configs: Record<string, CaseConsoleConfig> = {
  "01": {
    sceneAria: "退货核验现场",
    title: "退款调查",
    subject: "取消记录与原单关系",
    decisionQuestion: "原单尚未关联，这笔退款现在能否继续？",
    sceneAlt: "退款核验工作台、交易账簿与退货仓库背景",
    sceneAsset: "/case-assets/case-01/scene.png",
    sequenceTitle: "同一客户的取消记录",
    sequenceKind: "time",
    timeField: "invoice_at",
    plotField: "line_amount_cny",
    signals: [
      { key: "line_amount_cny", label: "取消金额", format: "currency" },
      { key: "invoice_id", label: "取消单号" },
      { key: "customer_id", label: "客户编号" },
    ],
    gaps: ["原始订单未关联", "没有退款流水", "没有退货物流记录"],
    hypothesesLabel: "候选解释，不代表最终结论",
    hypotheses: [
      { title: "手工调整", detail: "描述为 Manual，需要核对业务原因", tone: "review" },
      { title: "原单取消", detail: "取消标记成立，但原单尚未找到", tone: "support" },
      { title: "异常退款", detail: "缺少支付与物流记录，当前不能判断", tone: "missing" },
    ],
    steps: ["发现大额取消", "查找原单关系", "核对退款与退货记录", "人工决定是否继续"],
  },
  "02": {
    sceneAria: "会员行为分析台",
    title: "首批试投",
    subject: "浏览、加购与购买行为",
    decisionQuestion: "哪些会员只进入首批小范围试投？",
    sceneAlt: "会员运营分析中心与匿名人群分布",
    sceneAsset: "/case-assets/case-02/scene.png",
    sequenceTitle: "会员行为序列",
    sequenceKind: "records",
    plotField: "engagement_score",
    signals: [
      { key: "view_count", label: "浏览", format: "integer" },
      { key: "cart_count", label: "加购", format: "integer" },
      { key: "buy_count", label: "购买", format: "integer" },
    ],
    gaps: ["没有消费金额", "没有优惠券曝光记录", "没有随机对照结果"],
    hypothesesLabel: "试投依据，不代表增量效果",
    hypotheses: [
      { title: "高意向会员", detail: "浏览、加购与购买都较活跃", tone: "support" },
      { title: "只看未买", detail: "需要区分兴趣与真实购买意愿", tone: "review" },
      { title: "增量未知", detail: "试投前没有转化和毛利结果", tone: "missing" },
    ],
    steps: ["划分行为群体", "核对三类行为", "形成首批名单", "主管确认试投"],
  },
  "03": {
    sceneAria: "餐饮服务现场",
    title: "差评问题排查",
    subject: "接待、排队与上菜体验",
    decisionQuestion: "接待态度是否先进入小范围验证？",
    sceneAlt: "中式餐饮服务现场与接待、排队、上菜触点",
    sceneAsset: "/case-assets/case-03/scene.png",
    sequenceTitle: "评论样本分布",
    sequenceKind: "records",
    plotField: "star",
    signals: [
      { key: "star", label: "评分", format: "decimal" },
      { key: "Service#Hospitality", label: "接待态度" },
      { key: "Service#Queue", label: "排队体验" },
    ],
    gaps: ["没有门店和订单", "没有评论时间", "没有处理结果"],
    hypothesesLabel: "待验证问题，不代表普遍原因",
    hypotheses: [
      { title: "接待态度", detail: "负向样本集中，需要抽样复核原文", tone: "support" },
      { title: "排队秩序", detail: "部分评论同时提到排队混乱", tone: "review" },
      { title: "上菜时效", detail: "缺少订单时间，暂时无法量化", tone: "missing" },
    ],
    steps: ["定位低星评论", "回看评论原文", "区分服务触点", "创建验证任务"],
  },
  "04": {
    sceneAria: "申请材料核验桌面",
    title: "材料完整性复核",
    subject: "身份、收入、授权与一致性",
    decisionQuestion: "材料是否足够进入人工复核？",
    sceneAlt: "中国金融机构申请卷宗与材料核验桌面",
    sceneAsset: "/case-assets/case-04/scene.png",
    sequenceTitle: "材料核对步骤",
    sequenceKind: "process",
    plotField: "debt_service_ratio_bps",
    signals: [
      { key: "requested_amount_fen", label: "申请金额", format: "currencyFen" },
      { key: "declared_income_band", label: "收入档" },
      { key: "debt_service_ratio_bps", label: "债务负担", format: "basisPoints" },
    ],
    gaps: ["收入证明缺失", "没有真实征信文件", "没有人工复核结论"],
    hypothesesLabel: "材料问题，不代表授信结论",
    hypotheses: [
      { title: "身份材料", detail: "已核验，可继续使用", tone: "support" },
      { title: "收入材料", detail: "当前记录显示缺失", tone: "review" },
      { title: "还款能力", detail: "材料不足，不能据此判断", tone: "missing" },
    ],
    steps: ["打开申请卷宗", "逐项核对材料", "标出缺失项", "请求补充材料"],
  },
  "05": {
    sceneAria: "急诊转运协调中心",
    title: "交接冲突处理",
    subject: "实际发生时间与系统收到时间",
    decisionQuestion: "迟到事件是否推翻当前交接状态？",
    sceneAlt: "医院急诊观察区至留观区的转运协调中心，不含患者身份信息",
    sceneAsset: "/case-assets/case-05/scene.png",
    sequenceTitle: "转运事件到达顺序",
    sequenceKind: "time",
    timeField: "event_time",
    plotField: "event_version",
    signals: [
      { key: "from_department", label: "转出单元" },
      { key: "to_department", label: "接收单元" },
      { key: "co_sign_status", label: "会签状态" },
    ],
    gaps: ["没有患者身份信息", "没有临床优先级", "没有真实床位容量"],
    hypothesesLabel: "交接问题，不代表临床判断",
    hypotheses: [
      { title: "迟到修正", detail: "事件发生与收到时间存在明显差异", tone: "support" },
      { title: "重复消息", detail: "需要按版本核对是否重复送达", tone: "review" },
      { title: "临床状态", detail: "数据不含诊疗信息，系统不作判断", tone: "missing" },
    ],
    steps: ["发现状态冲突", "对齐两个时间", "核对版本与会签", "人工升级协调"],
  },
  "06": {
    sceneAria: "空气质量监测网",
    title: "小时数据发布审核",
    subject: "站点污染物记录",
    decisionQuestion: "选中站点的这一小时能否纳入发布？",
    sceneAlt: "北京空气质量监测控制室与十二站点数据网",
    sceneAsset: "/case-assets/case-06/scene.png",
    sequenceTitle: "六类污染物与缺测带",
    sequenceKind: "time",
    timeField: "observed_at",
    plotField: "PM2.5",
    signals: [
      { key: "PM2.5", label: "PM2.5", format: "decimal", unit: "μg/m³" },
      { key: "PM10", label: "PM10", format: "decimal", unit: "μg/m³" },
      { key: "station", label: "站点" },
    ],
    gaps: ["没有仪器校准记录", "没有官方质控标志", "本地关注线不是法规阈值"],
    hypothesesLabel: "数据问题，不代表污染成因",
    hypotheses: [
      { title: "高值记录", detail: "需要与相邻小时和其他污染物对齐", tone: "support" },
      { title: "整组缺测", detail: "缺失值不能补成零后发布", tone: "review" },
      { title: "设备状态", detail: "缺少校准和质控记录", tone: "missing" },
    ],
    steps: ["选中站点小时", "检查六项记录", "核对缺失与高值", "人工提交或拒绝"],
  },
  "07": {
    sceneAria: "履约运行控制中心",
    title: "履约解耦试点评审",
    subject: "发布、故障与恢复",
    decisionQuestion: "是否只启动一个事件接口试点？",
    sceneAlt: "中国即时零售履约控制中心和责任域运行视图",
    sceneAsset: "/case-assets/case-07/scene.png",
    sequenceTitle: "十四天运行记录",
    sequenceKind: "time",
    timeField: "day_index",
    plotField: "arrival_minute",
    signals: [
      { key: "arrival_minute", label: "到达分钟", format: "integer" },
      { key: "item_count", label: "商品数", format: "integer" },
      { key: "order_id", label: "公开订单" },
    ],
    gaps: ["没有真实调用链", "没有容量与 SLA", "没有客户结果"],
    hypothesesLabel: "架构假设，不代表已证实依赖",
    hypotheses: [
      { title: "发布牵连", detail: "发布与故障窗口需要继续对齐", tone: "review" },
      { title: "责任边界", detail: "履约域恢复时间较长，可先做接口试点", tone: "support" },
      { title: "服务拆分", detail: "没有 trace，不能直接证明应拆服务", tone: "missing" },
    ],
    steps: ["观察运行波动", "核对发布与故障", "提出最小试点", "评审是否启动"],
  },
  "08": {
    sceneAria: "养殖水质现场",
    title: "塘区异常研判",
    subject: "水温、溶氧、pH 与浊度",
    decisionQuestion: "现在派现场核查，还是先补现场读数？",
    sceneAlt: "中国水产养殖塘区俯视场景与水质监测点",
    sceneAsset: "/case-assets/case-08/scene.png",
    sequenceTitle: "九十六小时水质记录",
    sequenceKind: "time",
    timeField: "event_time",
    plotField: "dissolved_oxygen_mg_l",
    signals: [
      { key: "dissolved_oxygen_mg_l", label: "溶氧", format: "decimal", unit: "mg/L" },
      { key: "ph", label: "pH", format: "decimal" },
      { key: "turbidity_ntu", label: "浊度", format: "decimal", unit: "NTU" },
    ],
    gaps: ["没有真实传感器坐标", "没有现场观察", "公开底图与事件没有行级关联"],
    hypothesesLabel: "核查方向，不代表事故原因",
    hypotheses: [
      { title: "数值冲突", detail: "多项读数需要现场复测", tone: "support" },
      { title: "传感器离线", detail: "应先确认设备状态与最后读数", tone: "review" },
      { title: "塘口位置", detail: "数据没有真实坐标，不能定位具体塘口", tone: "missing" },
    ],
    steps: ["发现异常读数", "检查传感器状态", "区分数据与现场问题", "派发现场核查"],
  },
  "09": {
    sceneAria: "地铁机电设备现场",
    title: "压缩机现场检查",
    subject: "压力、油温与电机电流",
    decisionQuestion: "现有记录是否足够创建现场检查单？",
    sceneAlt: "中国地铁机电压缩机房与空气生产单元",
    sceneAsset: "/case-assets/case-09/scene.png",
    sequenceTitle: "故障边界前后五分钟",
    sequenceKind: "time",
    timeField: "timestamp",
    plotField: "Motor_current",
    signals: [
      { key: "TP2", label: "TP2 压力", format: "decimal" },
      { key: "Oil_temperature", label: "油温", format: "decimal", unit: "℃" },
      { key: "Motor_current", label: "电机电流", format: "decimal", unit: "A" },
    ],
    gaps: ["没有站点与资产编号", "没有传感器校准状态", "没有维修履历"],
    hypothesesLabel: "检查方向，不代表设备故障结论",
    hypotheses: [
      { title: "电流峰值", detail: "故障窗口附近存在高值，需要核对负载", tone: "support" },
      { title: "油温变化", detail: "应与压力和开关量同时查看", tone: "review" },
      { title: "维护原因", detail: "缺少厂商手册与维修记录", tone: "missing" },
    ],
    steps: ["定位故障窗口", "核对压力与温度", "列出检查点", "提交现场检查"],
  },
  "10": {
    sceneAria: "通信任务链",
    title: "投诉任务恢复核查",
    subject: "请求状态与外部效果",
    decisionQuestion: "查询响应丢失后，是否进入人工恢复核查？",
    sceneAlt: "通信投诉任务恢复控制中心与省级复核队列",
    sceneAsset: "/case-assets/case-10/scene.png",
    sequenceTitle: "任务处理链",
    sequenceKind: "process",
    timeField: "received_at",
    plotField: "priority",
    signals: [
      { key: "task_id", label: "任务号" },
      { key: "city", label: "城市" },
      { key: "routing_queue", label: "复核队列" },
    ],
    gaps: ["没有请求 ID 与幂等键", "没有提交和响应时间", "没有外部效果日志"],
    hypothesesLabel: "恢复状态，不代表任务已经重试",
    hypotheses: [
      { title: "响应丢失", detail: "只能确认当前查询没有可靠回执", tone: "support" },
      { title: "效果未知", detail: "需要人工核对外部系统是否已执行", tone: "review" },
      { title: "安全重试", detail: "缺少事件账本，当前不能执行", tone: "missing" },
    ],
    steps: ["找到中断任务", "核对外部效果", "补齐事件账本", "进入人工恢复"],
  },
  "11": {
    sceneAria: "企业模型准入检查中心",
    title: "模型准入补测",
    subject: "风险、公平与安全准入检查",
    decisionQuestion: "当前候选能否进入灰度会签？",
    sceneAlt: "企业模型发布准入检查工作台与三类评测检查项",
    sceneAsset: "/case-assets/case-11/scene.png",
    sequenceTitle: "准入检查顺序",
    sequenceKind: "process",
    plotField: "metric_value",
    signals: [
      { key: "metric_label", label: "指标" },
      { key: "metric_value", label: "实测值", format: "decimal" },
      { key: "threshold", label: "本地核对线", format: "decimal" },
    ],
    gaps: ["没有评测执行时间", "没有真实运行成本与时延", "模型权重许可待核验"],
    hypothesesLabel: "补测方向，不代表发布结论",
    hypotheses: [
      { title: "地区切片", detail: "准确率差超过本地核对线，应先补测", tone: "support" },
      { title: "样本覆盖", detail: "缺少部分切片记录", tone: "review" },
      { title: "灰度发布", detail: "准入检查未完成，当前不能进入会签", tone: "missing" },
    ],
    steps: ["核对三类准入检查", "定位失败切片", "发起补测", "补齐后再会签"],
  },
  "12": {
    sceneAria: "冷链运输现场",
    title: "冷链偏差调查",
    subject: "车辆、保温箱与记录器",
    decisionQuestion: "是否启动温度偏差调查？",
    sceneAlt: "中国县域冷链车辆、保温箱与温度记录器",
    sceneAsset: "/case-assets/case-12/scene.png",
    sequenceTitle: "五分钟温度记录",
    sequenceKind: "time",
    timeField: "event_time",
    plotField: "temperature_c",
    signals: [
      { key: "temperature_c", label: "箱内温度", format: "temperature" },
      { key: "offline_minutes", label: "离线", format: "integer", unit: "分钟" },
      { key: "handoff_status", label: "交接状态" },
    ],
    gaps: ["没有产品和批次号", "没有真实路线坐标", "没有装箱清单"],
    hypothesesLabel: "调查方向，不代表产品可用性结论",
    hypotheses: [
      { title: "温度偏差", detail: "记录已越过 8℃，需要启动调查", tone: "support" },
      { title: "记录器离线", detail: "离线窗口需要与交接记录核对", tone: "review" },
      { title: "批次影响", detail: "没有批次关系，当前不能判断", tone: "missing" },
    ],
    steps: ["发现温度越界", "核对记录器与交接", "划定偏差窗口", "启动质量调查"],
  },
  "13": {
    sceneAria: "汽车售后车间",
    title: "车辆安全复核",
    subject: "客户报告的车辆症状",
    decisionQuestion: "直接转技师复核，还是先补充车辆状态？",
    sceneAlt: "中国汽车售后车间与客户接车检查场景",
    sceneAsset: "/case-assets/case-13/scene.png",
    sequenceTitle: "接车核对步骤",
    sequenceKind: "process",
    plotField: "review_required",
    signals: [
      { key: "vehicle_type", label: "车型类别" },
      { key: "symptom_category", label: "症状类别" },
      { key: "workflow_state", label: "当前流转" },
    ],
    gaps: ["没有 VIN 与里程", "没有车辆是否可行驶", "没有照片、录音与精确位置"],
    hypothesesLabel: "客户报告，不代表故障诊断",
    hypotheses: [
      { title: "安全相关症状", detail: "应优先转交技师进行安全复核", tone: "support" },
      { title: "车辆状态", detail: "需要补充警告灯和可行驶情况", tone: "review" },
      { title: "道路救援", detail: "缺少位置与状态，当前不能派发", tone: "missing" },
    ],
    steps: ["记录客户原话", "补充车辆状态", "标记安全复核", "转交技师"],
  },
  "14": {
    sceneAria: "选矿浮选现场",
    title: "浮选工艺核查",
    subject: "精矿硅与工艺参数",
    decisionQuestion: "先创建哪一项人工核查任务？",
    sceneAlt: "中国选矿浮选流程工厂和七组浮选柱",
    sceneAsset: "/case-assets/case-14/scene.png",
    sequenceTitle: "七百二十小时工艺记录",
    sequenceKind: "time",
    timeField: "timestamp",
    plotField: "concentrate_silica_mean",
    signals: [
      { key: "concentrate_silica_mean", label: "精矿硅", format: "percent" },
      { key: "concentrate_iron_mean", label: "精矿铁", format: "percent" },
      { key: "pulp_ph_mean", label: "pH", format: "decimal" },
    ],
    gaps: ["没有真实设备拓扑", "没有仪表校准记录", "没有设定值变更与操作员动作"],
    hypothesesLabel: "同步偏离项，不代表根因",
    hypotheses: [
      { title: "三号柱风量", detail: "与高硅窗口同步偏离，优先核查", tone: "support" },
      { title: "药剂与密度", detail: "需要与同一窗口对齐", tone: "review" },
      { title: "自动调参", detail: "没有根因和控制权限，禁止执行", tone: "missing" },
    ],
    steps: ["发现高硅窗口", "对齐工艺参数", "列出同步偏离项", "创建工艺核查单"],
  },
  "15": {
    sceneAria: "半导体检测站",
    title: "生产记录复测",
    subject: "匿名信号通道与检测结果",
    decisionQuestion: "哪条生产观测需要隔离并申请复测？",
    sceneAlt: "半导体制造检测站与匿名信号通道显示",
    sceneAsset: "/case-assets/case-15/scene.png",
    sequenceTitle: "生产观测记录序列",
    sequenceKind: "time",
    timeField: "test_timestamp",
    plotField: "sensor_161",
    signals: [
      { key: "quality_label", label: "检测结果" },
      { key: "review_priority", label: "复核优先级" },
      { key: "sensor_158", label: "匿名通道 158", format: "decimal" },
    ],
    gaps: ["没有真实批次号", "没有设备与工序", "没有复测结果"],
    hypothesesLabel: "待复核通道，不代表缺陷根因",
    hypotheses: [
      { title: "未通过记录", detail: "应先隔离该生产观测", tone: "support" },
      { title: "通道缺失", detail: "通道 158 缺失率很高，不能单独解释", tone: "review" },
      { title: "人工放行", detail: "没有复测结果，当前不能放行", tone: "missing" },
    ],
    steps: ["找到未通过记录", "检查通道覆盖", "标记待复核信号", "隔离并申请复测"],
  },
  "16": {
    sceneAria: "风电场运行现场",
    title: "风机少发核查",
    subject: "风速、功率与日级下偏标记",
    decisionQuestion: "哪台风机优先提交现场核查？",
    sceneAlt: "中国风电场环境与机组运行场景",
    sceneAsset: "/case-assets/case-16/scene.png",
    sequenceTitle: "七天风速与功率",
    sequenceKind: "time",
    timeField: "day",
    plotField: "mean_active_power",
    signals: [
      { key: "mean_wind_speed", label: "平均风速", format: "decimal", unit: "m/s" },
      { key: "mean_active_power", label: "平均功率", format: "decimal", unit: "kW" },
      { key: "valid_power_records", label: "有效点", format: "integer" },
    ],
    gaps: ["没有预期功率或同群基线", "没有限电指令", "没有告警与维护记录"],
    hypothesesLabel: "核查方向，不代表故障概率",
    hypotheses: [
      { title: "日级下偏", detail: "连续标记只表示观察结果，不是故障概率", tone: "support" },
      { title: "同风况比较", detail: "需要补充同群基线后再判断", tone: "review" },
      { title: "限电或故障", detail: "缺少调度和告警记录，无法区分", tone: "missing" },
    ],
    steps: ["发现少发记录", "核对数据覆盖", "补充同群比较", "提交现场核查"],
  },
  "17": {
    sceneAria: "包装设备现场",
    title: "切刀健康排检",
    subject: "转矩、跟随误差与主轴速度",
    decisionQuestion: "哪次会话列入夜班排检候选？",
    sceneAlt: "包装机切刀、刀座、薄膜输送和主轴设备",
    sceneAsset: "/case-assets/case-17/scene.png",
    sequenceTitle: "五百一十九次会话趋势",
    sequenceKind: "records",
    plotField: "health_deviation_index",
    signals: [
      { key: "health_deviation_index", label: "健康偏差", format: "decimal" },
      { key: "rule_threshold", label: "关注线", format: "decimal" },
      { key: "dominant_deviation_signal", label: "主要变化信号" },
    ],
    gaps: ["部分会话没有波形", "没有准确时间轴", "没有刀片更换和停机记录"],
    hypothesesLabel: "排检线索，不代表设备故障结论",
    hypotheses: [
      { title: "切刀转矩", detail: "摘要显示它是主要变化信号", tone: "support" },
      { title: "跟随误差", detail: "有波形的会话才能展开核对", tone: "review" },
      { title: "排产窗口", detail: "没有停机代价与排产数据", tone: "missing" },
    ],
    steps: ["找到高偏差会话", "核对信号覆盖", "查看可用波形", "列入排检候选"],
  },
  "19": {
    sceneAria: "液压动力单元",
    title: "部件检查排序",
    subject: "压力、流量与四类部件状态",
    decisionQuestion: "第 217 次测量循环应先检查哪个部件？",
    sceneAlt: "工业液压动力单元、冷却器、比例阀、泵和蓄能器",
    sceneAsset: "/case-assets/case-19/scene.png",
    sequenceTitle: "测量循环趋势",
    sequenceKind: "records",
    plotField: "cycle_id",
    signals: [
      { key: "main_pressure_mean", label: "主压力", format: "decimal" },
      { key: "main_flow_mean", label: "主流量", format: "decimal" },
      { key: "system_vibration_mean", label: "振动", format: "decimal" },
    ],
    gaps: ["没有真实液压站号", "没有时间戳与部件资产号", "没有维修结果"],
    hypothesesLabel: "检查顺序，不代表维修结论",
    hypotheses: [
      { title: "冷却器", detail: "结合油温与效率状态优先核对", tone: "support" },
      { title: "泵与阀", detail: "压力和流量需要按同一循环对齐", tone: "review" },
      { title: "创建工单", detail: "当前只有测量循环，不足以创建维修工单", tone: "missing" },
    ],
    steps: ["找到异常循环", "核对部件状态", "排出检查顺序", "人工确认"],
  },
  "20": {
    sceneAria: "光伏场站现场",
    title: "光伏少发核查",
    subject: "辐照、功率与归一化出力比",
    decisionQuestion: "站端下一步应先核查哪类线索？",
    sceneAlt: "中国光伏电站环境与站端运行场景",
    sceneAsset: "/case-assets/case-20/scene.png",
    sequenceTitle: "相邻日期站端记录",
    sequenceKind: "time",
    timeField: "date",
    plotField: "mean_efficiency_ratio",
    signals: [
      { key: "mean_irradiance", label: "辐照", format: "decimal", unit: "W/m²" },
      { key: "mean_power_mw", label: "功率", format: "decimal", unit: "MW" },
      { key: "mean_efficiency_ratio", label: "归一化出力比", format: "decimal" },
    ],
    gaps: ["没有场站坐标", "没有调度限电记录", "没有逆变器告警与现场工单"],
    hypothesesLabel: "站端核查方向，不代表归因确认",
    hypotheses: [
      { title: "温度降额", detail: "可作为一条解释线索，不能单独定因", tone: "support" },
      { title: "疑似限电", detail: "需要调度记录才能核实", tone: "review" },
      { title: "设备故障", detail: "缺少逆变器告警与检修结果", tone: "missing" },
    ],
    steps: ["发现少发记录", "对齐气象与功率", "比较三类线索", "提交站端核查"],
  },
};

export function getCaseConsoleConfig(id: string): CaseConsoleConfig | undefined {
  return configs[id];
}
