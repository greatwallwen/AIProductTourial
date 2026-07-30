// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  CaseEvent,
  CaseProjection,
  CommandResult,
} from "@course-ai-product/case-runtime";
import type { CaseDefinition, CaseMetric } from "../../cases/contracts";
import { getCaseDefinition } from "../../cases/registry";
import { CaseExperience } from "../src/components/CaseExperience";
import { CaseOverview } from "../src/components/CaseOverview";

const base = getCaseDefinition("01")!;

const definition: CaseDefinition = {
  ...base,
  featuredObjectId: "OBJ-001",
  views: [
    { id: "overview", label: "概览" },
    { id: "work", label: "处置" },
    { id: "evidence", label: "依据" },
    { id: "audit", label: "记录" },
  ],
  primaryRole: "operator",
  workflow: {
    initialState: "待处理",
    commands: {
      request_evidence: {
        from: ["待处理"],
        to: "待补证",
        roles: ["operator"],
      },
      approve_review: {
        from: ["待处理"],
        to: "人工复核中",
        roles: ["supervisor"],
      },
    },
  },
  commandLabels: {
    request_evidence: "要求补充材料",
    approve_review: "提交人工复核",
  },
};

const objects: CaseProjection[] = [
  {
    caseId: "01",
    objectId: "OBJ-001",
    state: "待处理",
    version: 0,
    payload: {
      invoice_id: "C-OBJ-001",
      customer_id: "CUS-01",
      stock_code: "SKU-01",
      line_amount_cny: "-128",
      reason_code: "R01",
      decision: {
        level: "urgent",
        label: "原订单关系缺失",
        reason: "当前记录不能证明原订单和退货对象一致。",
        recommendedCommand: "request_evidence",
        sourceFields: ["reason_code"],
      },
    },
    updatedAt: "2026-07-24T08:00:00.000Z",
  },
  {
    caseId: "01",
    objectId: "OBJ-002",
    state: "待处理",
    version: 0,
    payload: {
      invoice_id: "C-OBJ-002",
      customer_id: "CUS-02",
      stock_code: "SKU-02",
      line_amount_cny: "-256",
      reason_code: "R02",
      decision: {
        level: "attention",
        label: "等待核验",
        reason: "需要核对物流签收。",
        recommendedCommand: "request_evidence",
        sourceFields: ["reason_code"],
      },
    },
    updatedAt: "2026-07-24T08:00:00.000Z",
  },
];

const metrics: CaseMetric[] = [
  { id: "records", label: "全量记录", value: "8,400", note: "权威数据集" },
  { id: "review", label: "待复核", value: "312", note: "按规则计算" },
];

const retailDefinition = getCaseDefinition("01")!;
const retailObjects: CaseProjection[] = [
  {
    caseId: "01",
    objectId: "01-C496116-M",
    state: "待核验",
    version: 0,
    payload: {
      invoice_id: "C496116",
      stock_code: "M",
      description: "Manual",
      quantity: "-1",
      invoice_at: "2010-01-25 11:46:00",
      customer_id: "",
      country: "United Kingdom",
      is_cancellation_proxy: "True",
      line_amount_cny: "-81700",
      operational_currency: "CNY",
      decision: {
        level: "urgent",
        label: "先暂缓退款",
        reason: "取消记录金额较高，需先锁定原单和退款关系。",
        recommendedCommand: "hold_refund",
        sourceFields: ["is_cancellation_proxy", "line_amount_cny"],
      },
    },
    updatedAt: "2010-01-25T11:46:00.000Z",
  },
];

function eventFor(projection: CaseProjection, command = "request_evidence"): CaseEvent {
  return {
    eventId: `evt-${projection.objectId}-${projection.version}`,
    caseId: projection.caseId,
    objectId: projection.objectId,
    command,
    actor: { id: "local-operator", role: "operator" },
    fromState: "待处理",
    toState: projection.state,
    version: projection.version,
    evidenceIds: ["dataset-row"],
    occurredAt: "2026-07-24T08:05:00.000Z",
  };
}

function receiptFor(
  projection: CaseProjection,
  receiptId = `receipt-${projection.objectId}`,
  command = "request_evidence",
): CommandResult {
  return {
    receiptId,
    inputHash: "input-hash",
    eventHash: "event-hash",
    projection,
    event: eventFor(projection, command),
    duplicate: false,
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("CaseOverview", () => {
  it("shows the stable story object and a single route into the workbench", () => {
    render(
      <CaseOverview
        definition={definition}
        defaultProjection={objects[0]}
        metrics={metrics}
        workHref="/cases/01/work"
      />,
    );

    expect(screen.getByText("OBJ-001")).toBeVisible();
    expect(screen.getByText("原订单关系缺失")).toBeVisible();
    expect(screen.getByText("8,400")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "进入处置工作台" }),
    ).toHaveAttribute("href", "/cases/01/work");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("CaseExperience read model", () => {
  it("presents the return case as an invoice investigation at the real operating scene", () => {
    render(
      <CaseExperience
        definition={retailDefinition}
        activeView="work"
        initialObjects={retailObjects}
        initialEvents={[]}
        initialReceipt={undefined}
        datasetRowCount={14794}
        datasetHash="sha256-value"
        metrics={[]}
      />,
    );

    expect(screen.getByText("B01 · 跨境售后异常调查")).toBeVisible();
    expect(screen.getByRole("heading", { name: "原单核对中" })).toBeVisible();
    expect(screen.getByRole("region", { name: "当前取消单" })).toBeVisible();
    expect(screen.getByRole("region", { name: "原单核对镜头" })).toBeVisible();
    expect(screen.getAllByText("¥81,700.00").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("退款动作尚未授权")).toBeVisible();
    expect(screen.getByRole("group", { name: "切换候选原单" })).toBeVisible();
    expect(screen.queryByRole("table", { name: "可能原单" })).not.toBeInTheDocument();
  });

  it.each([
    {
      id: "02",
      heading: "8 元券首批试投",
      boundary: "数据使用边界",
      rowCount: 5000,
      usesTable: false,
      payload: { user_id: "U00001", buy_count: "4", cart_count: "12", view_count: "12", value_segment: "观察" },
    },
    {
      id: "03",
      heading: "顾客评论研究室",
      boundary: "研究判断",
      rowCount: 6970,
      usesTable: false,
      payload: { id: "44998", review: "上菜速度很快，但服务态度需要改善。", star: "2", "Service#Hospitality": "-1", "Service#Queue": "-2", "Service#Timely": "1", "Food#Taste": "-2" },
    },
    {
      id: "04",
      heading: "申请材料补正与双岗复核",
      boundary: "材料完整不等于授信结论",
      rowCount: 1200,
      usesTable: false,
      payload: { application_id: "CR20260000001", province_name: "四川省", city_name: "成都市", customer_segment: "new_customer", channel: "客户经理", requested_amount_fen: "379919", declared_income_band: "5000-7999", identity_verification_status: "verified", income_evidence_status: "missing", consent_status: "confirmed", application_consistency: "consistent", debt_service_ratio_bps: "4315" },
    },
  ])("renders case $id as its own operating product", ({ id, heading, boundary, rowCount, usesTable, payload }) => {
    const caseDefinition = getCaseDefinition(id)!;
    const projection: CaseProjection = {
      caseId: id,
      objectId: `${id}-fixture-01`,
      state: caseDefinition.initialState,
      version: 0,
      payload,
      updatedAt: "2026-07-24T08:00:00.000Z",
    };
    render(<CaseExperience definition={caseDefinition} activeView="work" initialObjects={[projection]} initialEvents={[]} initialReceipt={undefined} datasetRowCount={rowCount} datasetHash="sha256-value" metrics={metrics} />);
    expect(screen.getByRole("heading", { name: heading })).toBeVisible();
    expect(screen.getByText(boundary)).toBeVisible();
    if (usesTable) expect(screen.getByRole("table")).toBeVisible();
    else expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows event time and received time separately in hospital transfer coordination", () => {
    const caseDefinition = getCaseDefinition("05")!;
    const hospitalObjects: CaseProjection[] = [
      { caseId: "05", objectId: "05-TRN-0001-TRN-0001-06", state: caseDefinition.initialState, version: 0, payload: { transport_id: "TRN-0001", event_version: "6", event_time: "2026-07-03T08:27:00+08:00", received_at: "2026-07-03T09:09:00+08:00", source_system: "OPS_AUDIT", from_department: "急诊观察区", to_department: "外科留观区", event_type: "correction_appended", co_sign_status: "pending", conflict_type: "late_event", late_event: "True" }, updatedAt: "2026-07-03T09:09:00+08:00" },
      { caseId: "05", objectId: "05-TRN-0002-TRN-0002-06", state: caseDefinition.initialState, version: 0, payload: { transport_id: "TRN-0002", event_version: "6", event_time: "2026-07-03T08:19:00+08:00", received_at: "2026-07-03T08:39:00+08:00", source_system: "OPS_AUDIT", from_department: "急诊抢救区", to_department: "日间诊疗区", event_type: "correction_appended", co_sign_status: "pending", conflict_type: "out_of_order", late_event: "False" }, updatedAt: "2026-07-03T08:39:00+08:00" },
    ];
    const sceneRows = [
      { event_id: "TRN-0001-01", transport_id: "TRN-0001", event_version: "1", event_time: "2026-07-03T08:07:00+08:00", received_at: "2026-07-03T08:08:00+08:00", source_system: "ED_BOARD", from_department: "急诊观察区", to_department: "外科留观区", event_type: "transport_requested", co_sign_status: "pending", conflict_type: "none", late_event: "False" },
      { event_id: "TRN-0001-02", transport_id: "TRN-0001", event_version: "2", event_time: "2026-07-03T08:11:00+08:00", received_at: "2026-07-03T08:13:00+08:00", source_system: "TRANSPORT_DISPATCH", from_department: "急诊观察区", to_department: "外科留观区", event_type: "transport_assigned", co_sign_status: "pending", conflict_type: "none", late_event: "False" },
      { event_id: "TRN-0001-03", transport_id: "TRN-0001", event_version: "3", event_time: "2026-07-03T08:15:00+08:00", received_at: "2026-07-03T08:17:00+08:00", source_system: "BED_CONTROL", from_department: "急诊观察区", to_department: "外科留观区", event_type: "bed_request_confirmed", co_sign_status: "pending", conflict_type: "none", late_event: "False" },
      { event_id: "TRN-0001-04", transport_id: "TRN-0001", event_version: "4", event_time: "2026-07-03T08:19:00+08:00", received_at: "2026-07-03T08:21:00+08:00", source_system: "WARD_BOARD", from_department: "急诊观察区", to_department: "外科留观区", event_type: "handoff_received", co_sign_status: "pending", conflict_type: "none", late_event: "False" },
      { event_id: "TRN-0001-05", transport_id: "TRN-0001", event_version: "5", event_time: "2026-07-03T08:23:00+08:00", received_at: "2026-07-03T08:25:00+08:00", source_system: "OPS_AUDIT", from_department: "急诊观察区", to_department: "外科留观区", event_type: "coordination_snapshot", co_sign_status: "pending", conflict_type: "none", late_event: "False" },
      hospitalObjects[0]!.payload,
    ];
    render(<CaseExperience definition={caseDefinition} activeView="work" initialObjects={hospitalObjects} initialEvents={[]} initialReceipt={undefined} datasetRowCount={4320} datasetHash="sha256-value" metrics={metrics} sceneRows={sceneRows} />);
    expect(screen.getByRole("heading", { name: "转运晚到事件调和单" })).toBeVisible();
    expect(screen.getAllByText(/晚到 42 分钟/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole("region", { name: "业务发生时间轴" }).querySelectorAll("button")).toHaveLength(6);
    expect(screen.getByRole("region", { name: "系统接收时间轴" }).querySelectorAll("button")).toHaveLength(6);
    expect(screen.getByText("v6")).toBeVisible();
    expect(screen.getByText(/不含患者身份、诊断、治疗或临床优先级/)).toBeVisible();
    expect(screen.queryByText("05-TRN-0001-TRN-0001-06")).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it.each([
    {
      id: "06", heading: "历史空气质量数据摘录质检", boundary: "系统按源字段逐项核对，不填 0，不用其他记录补值。", rowCount: 21039,
      payload: { No: "33541", station: "Gucheng", observed_at: "2016-12-27 12:00:00", hour: "12", "PM2.5": "", PM10: "", SO2: "", NO2: "", CO: "", O3: "", TEMP: "2.0", PRES: "1028.4", DEWP: "-17.0", RAIN: "0.0", wd: "E", WSPM: "1.3", missing_pollutant_count: "6" },
      sceneRows: [{ station: "Gucheng", No: "33541", observed_at: "2016-12-27 12:00:00", missing_pollutant_count: "6" }, { station: "Nongzhanguan", No: "33541", observed_at: "2016-12-27 12:00:00", "PM2.5": "22", PM10: "31", SO2: "4", NO2: "28", CO: "600", O3: "55", missing_pollutant_count: "0" }],
      supportingArtifacts: {},
    },
    {
      id: "07", heading: "即时履约架构评审", boundary: "证据边界", rowCount: 12000,
      payload: { order_id: "D01-O3173", day_index: "1", arrival_minute: "600.0474", item_count: "8", item_ids_preview: "I0046;I0483", is_observed_production_order: "False" },
      sceneRows: [],
      supportingArtifacts: { "operational-evidence.csv": [{ scenario_date: "2026-07-01", domain: "履约", owner_team: "履约平台组", request_count: "6100", p95_latency_ms: "892", release_count: "3", incident_minutes: "10", recovery_minutes: "40" }] },
    },
    {
      id: "08", heading: "水质冲突现场取证单", boundary: "仅限人工复核 · 不连接设备控制", rowCount: 864,
      payload: { event_id: "CN-AQ-02-038", event_time: "2026-06-02T13:00:00+08:00", region_id: "CN-POND-02", archive_member: "Region2/region2_2024_merge.tif", temperature_c: "32.12", dissolved_oxygen_mg_l: "5.75", ph: "7.31", turbidity_ntu: "8.82", sensor_status: "online", evidence_status: "value_conflict", risk_level: "high", control_authority: "human-review-only", source_id: "COURSE-OPS-08" },
      sceneRows: [], supportingArtifacts: {},
    },
    {
      id: "09", heading: "空压机遥测断档调查", boundary: "只申请现场目视检查，不诊断、不停机、不控制设备", rowCount: 4090,
      payload: { source_row_index: "5625640", timestamp: "2020-04-18 00:00:01", TP2: "-0.018", TP3: "8.248", H1: "8.238", DV_pressure: "-0.024", Reservoirs: "8.248", Oil_temperature: "49.45", Motor_current: "0.04", known_failure_window: "True", maintenance_action_allowed: "False" },
      sceneRows: [{ timestamp: "2020-04-17 23:59:58", TP2: "0", TP3: "8.2", H1: "8.1", DV_pressure: "0", Oil_temperature: "49", Motor_current: "0.1" }, { timestamp: "2020-04-18 00:00:01", TP2: "-0.018", TP3: "8.248", H1: "8.238", DV_pressure: "-0.024", Oil_temperature: "49.45", Motor_current: "0.04" }],
      supportingArtifacts: { "knowledge.jsonl": [{ id: "K1", title: "字段说明", content: "TP2、TP3 是压力相关信号。", boundary: "不提供故障诊断。" }] },
    },
    {
      id: "10", heading: "通信请求恢复核查", boundary: "本地动作不等于外部处理结果；投诉主张保持未核实。", rowCount: 1000,
      payload: { task_id: "CN-TEL-2025Q2-0008", received_at: "2025-07-01T09:17:00", category: "资费争议", subcategory: "合约套餐变更", province: "福建", city: "福州", channel: "互联网服务入口", priority: "关注", external_lookup_scenario: "committed_response_lost", routing_queue: "福建服务复核队列", evidence_complete: "False", allegation_verified: "False" },
      sceneRows: [], supportingArtifacts: {},
    },
  ])("renders case $id as a scene-specific operating product", ({ id, heading, boundary, rowCount, payload, sceneRows, supportingArtifacts }) => {
    const caseDefinition = getCaseDefinition(id)!;
    const projection: CaseProjection = { caseId: id, objectId: `${id}-fixture`, state: caseDefinition.initialState, version: 0, payload, updatedAt: "2026-07-25T12:00:00.000Z" };
    render(<CaseExperience definition={caseDefinition} activeView="work" initialObjects={[projection]} initialEvents={[]} initialReceipt={undefined} datasetRowCount={rowCount} datasetHash="sha256-value" metrics={[]} sceneRows={sceneRows} supportingArtifacts={supportingArtifacts} />);
    expect(screen.getByRole("heading", { name: heading })).toBeVisible();
    expect(screen.getAllByText(boundary).length).toBeGreaterThan(0);
  });

  it.each([
    {
      id: "11", heading: "企业模型准入补测", boundary: "候选按编号和政策版本聚合；公开元数据不等于企业准入结论。", rowCount: 9,
      payload: { evaluation_id: "EVAL-11-004", candidate_id: "MODEL-ADMISSION-001", gate: "fairness", metric_id: "region_accuracy_gap", metric_label: "地区切片准确率差", metric_value: "0.047", comparator: "<=", threshold: "0.03", sample_size: "720", slice_id: "east-west", evidence_status: "missing_slice", result: "evidence_required", policy_version: "MODEL-GATE-2026.1" },
      sceneRows: [
        { evaluation_id: "EVAL-11-001", gate: "risk", metric_label: "无证据陈述率", metric_value: "0.032", comparator: "<=", threshold: "0.04", sample_size: "800", evidence_status: "complete", result: "pass" },
        { evaluation_id: "EVAL-11-004", gate: "fairness", metric_label: "地区切片准确率差", metric_value: "0.047", comparator: "<=", threshold: "0.03", sample_size: "720", evidence_status: "missing_slice", result: "evidence_required" },
        { evaluation_id: "EVAL-11-008", gate: "safety", metric_label: "越权工具调用率", metric_value: "0", comparator: "<=", threshold: "0.002", sample_size: "500", evidence_status: "complete", result: "pass" },
      ],
    },
    {
      id: "12", heading: "县域冷链运输记录调查", boundary: "调查范围仅限当前运输记录。提交时仍会校验调查单版本、时间窗口、事件关联与操作角色。", rowCount: 360,
      payload: { investigation_id: "CCI-2026-001", event_id: "CN-CC-01-014", event_time: "2026-07-06T08:35:00", province: "四川", county: "彭州市", route_id: "CN-SC-PZ-01", vehicle_code: "COURSE-VEH-01", container_code: "COURSE-BOX-01", logger_code: "COURSE-LOGGER-01", temperature_c: "9.3", route_record_status: "complete", calibration_status: "valid", handoff_status: "missing", sample_completeness: "1.0", offline_minutes: "0" },
      sceneRows: [
        { investigation_id: "CCI-2026-001", event_id: "CN-CC-01-001", event_time: "2026-07-06T07:30:00", temperature_c: "4.08", handoff_status: "missing", route_record_status: "complete" },
        { investigation_id: "CCI-2026-001", event_id: "CN-CC-01-014", event_time: "2026-07-06T08:35:00", temperature_c: "9.3", handoff_status: "missing", route_record_status: "complete" },
      ],
    },
    {
      id: "13", heading: "接车通话与安全分流", boundary: "客户描述不等于故障诊断；页面不生成维修或换件建议。", rowCount: 24,
      payload: { intake_id: "CN-AS-001", region: "华东", vehicle_class: "乘用车", symptom_text: "制动时出现异响", symptom_category: "brake", safety_review_required: "True", workflow_state: "待技师初检", automatic_repair_allowed: "False" },
      sceneRows: [
        { intake_id: "CN-AS-001", symptom_category: "brake" }, { intake_id: "CN-AS-002", symptom_category: "cooling" },
        { intake_id: "CN-AS-003", symptom_category: "steering" }, { intake_id: "CN-AS-004", symptom_category: "electrical" },
      ],
    },
    {
      id: "14", heading: "连续高硅事件调查台", boundary: "共变只决定先查什么，不直接判定根因。", rowCount: 720,
      payload: { monitor_hour: "2017-04-02 07:00:00", source_samples: "180", completeness_state: "完整", feed_iron_mean: "56.73", feed_silica_mean: "12.73", starch_flow_mean: "2146.19", amine_flow_mean: "487.47", pulp_flow_mean: "402.46", pulp_ph_mean: "9.7445", concentrate_iron_mean: "64.03", concentrate_silica_mean: "3.11", quality_state: "高杂质", consecutive_high_hours: "39", column_1_air_mean: "250", column_1_level_mean: "450", column_2_air_mean: "250", column_2_level_mean: "451", column_3_air_mean: "250", column_3_level_mean: "449", column_4_air_mean: "295", column_4_level_mean: "452", column_5_air_mean: "306", column_5_level_mean: "455", column_6_air_mean: "250", column_6_level_mean: "460", column_7_air_mean: "250", column_7_level_mean: "451" },
      sceneRows: [
        { concentrate_silica_mean: "2.8", pulp_flow_mean: "398", pulp_ph_mean: "9.7" },
        { concentrate_silica_mean: "3.11", pulp_flow_mean: "402.46", pulp_ph_mean: "9.7445" },
      ],
    },
    {
      id: "15", heading: "半导体生产观测复测", boundary: "通道没有设备、工序、单位和控制限映射。高缺失率会影响比较，只能形成复测申请。", rowCount: 1567,
      payload: { wafer_id: "SECOM-0003", test_timestamp: "19/07/2008 13:17:00", quality_label: "fail", sensor_161: "759", sensor_159: "562", sensor_021: "-5447.75", sensor_024: "-1916.5", sensor_158: "", sensor_160: "788", sensor_294: "251.4536", sensor_162: "2100", sensor_296: "325.0672", sensor_295: "329.6406", sensor_022: "2701.75", sensor_090: "9317.1698", review_priority: "quality-gate-review", causal_root_cause_allowed: "False", automatic_scrap_allowed: "False" },
      sceneRows: [
        { wafer_id: "SECOM-0003", quality_label: "fail", review_priority: "quality-gate-review" },
        { wafer_id: "SECOM-0001", quality_label: "pass", review_priority: "routine-gate" },
      ],
    },
    {
      id: "16", heading: "风机出力下偏核查", boundary: "下偏不等于故障", rowCount: 938,
      payload: { turbine_id: "7", day: "1", source_records: "144", valid_wind_records: "143", valid_power_records: "143", mean_wind_speed: "8.7921678", mean_active_power: "579.36203", underperformance_share: "1" },
      sceneRows: [
        { turbine_id: "7", day: "1", mean_wind_speed: "8.7921678", mean_active_power: "579.36203", underperformance_share: "1" },
        { turbine_id: "7", day: "2", mean_wind_speed: "6.4378873", mean_active_power: "443.77986", underperformance_share: "1" },
      ],
      supportingArtifacts: { "turbine-locations.csv": [{ turbine_id: "7", turbine_x: "3360.5473", turbine_y: "8816.23834" }, { turbine_id: "8", turbine_x: "3400", turbine_y: "8700" }] },
    },
    {
      id: "17", heading: "包装切刀会话复核", boundary: "偏差不等于设备故障", rowCount: 519,
      payload: { session_id: "BD-0003", operating_mode: "1", source_samples: "2048", cutter_torque_mean: "-0.02152884", cutter_torque_std: "0.43730253", cutter_follow_error_mean: "-0.00000217", cutter_follow_error_std: "0.07830023", film_follow_error_mean: "0.82114835", film_follow_error_std: "0.10570246", health_deviation_index: "3.85604256", rule_threshold: "3.77546317", evidence_coverage: "可用", dominant_deviation_signal: "切刀转矩均值", rule_review_level: "关注" },
      sceneRows: [],
      supportingArtifacts: { "waveform.csv": [{ session_id: "BD-0003", sample_index: "0", cutter_motor_torque: "0.1", cutter_follow_error: "0.02", film_follow_error: "0.8" }, { session_id: "BD-0003", sample_index: "1", cutter_motor_torque: "-0.2", cutter_follow_error: "0.01", film_follow_error: "0.82" }] },
    },
    {
      id: "18", heading: "主汽低温事件", boundary: "不是厂方控制限，不能直接触发自动调节。", rowCount: 7201,
      payload: { monitor_minute: "2022-03-29 17:46", valid_samples: "12", steam_temperature_mean: "529.845833", steam_temperature_min: "529.69", steam_temperature_max: "529.98", temperature_state: "低于来源区间", consecutive_deviation_minutes: "24", data_completeness: "完整" },
      sceneRows: [{ monitor_minute: "2022-03-29 17:45", steam_temperature_mean: "529.6" }, { monitor_minute: "2022-03-29 17:46", steam_temperature_mean: "529.845833" }],
      supportingArtifacts: { "events.csv": [{ event_id: "E-1" }], "imputation-points.csv": [{ sample_time: "2022-03-29 17:46" }] },
    },
    {
      id: "19", heading: "液压动力单元检查排序", boundary: "状态等级不是维修结论", rowCount: 2205,
      payload: { cycle_id: "217", main_pressure_mean: "156.552065", return_pressure_mean: "105.311372", system_pressure_mean: "1.645498", motor_power_mean: "2423.7161", main_flow_mean: "6.234048", tank_temperature_mean: "54.272117", system_vibration_mean: "0.68205", cooler_condition: "3.0", cooler_state: "接近故障", cooler_severity: "critical", valve_condition: "73.0", valve_state: "接近故障", valve_severity: "critical", pump_condition: "2.0", pump_state: "严重泄漏", pump_severity: "critical", accumulator_condition: "130.0", accumulator_state: "最佳压力", accumulator_severity: "normal", stability_label: "稳定", overall_severity_label: "临界", affected_component_count: "3" },
      sceneRows: [{ cycle_id: "216", main_pressure_mean: "155", main_flow_mean: "6.1", tank_temperature_mean: "54" }, { cycle_id: "217", main_pressure_mean: "156.552065", main_flow_mean: "6.234048", tank_temperature_mean: "54.272117" }],
      supportingArtifacts: {},
    },
    {
      id: "20", heading: "光伏站端记录核查", boundary: "线索不等于少发原因", rowCount: 5327,
      payload: { station_id: "8", date: "2020-05-19", capacity_mw: "30", source_records: "96", mean_irradiance: "331.79396", mean_air_temperature: "21.608491", mean_power_mw: "3.6710417", mean_efficiency_ratio: "0.36193088", mean_temperature_derating_pct: "0.0023726074", curtailment_suspected_share: "0.40625" },
      sceneRows: [{ station_id: "7", date: "2020-05-19", mean_power_mw: "3.61", mean_efficiency_ratio: "0.359" }, { station_id: "8", date: "2020-05-18", mean_power_mw: "3.5", mean_efficiency_ratio: "0.35" }, { station_id: "8", date: "2020-05-19", mean_irradiance: "331.79396", mean_power_mw: "3.6710417", mean_efficiency_ratio: "0.36193088" }],
      supportingArtifacts: {},
    },
  ])("renders case $id as a distinct evidence-bound workbench", ({ id, heading, boundary, rowCount, payload, sceneRows, supportingArtifacts, allowsTable }) => {
    const caseDefinition = getCaseDefinition(id)!;
    const projection: CaseProjection = { caseId: id, objectId: `${id}-fixture`, state: caseDefinition.initialState, version: 0, payload, updatedAt: "2026-07-25T12:00:00.000Z" };
    render(<CaseExperience definition={caseDefinition} activeView="work" initialObjects={[projection]} initialEvents={[]} initialReceipt={undefined} datasetRowCount={rowCount} datasetHash="sha256-value" metrics={[]} sceneRows={sceneRows} supportingArtifacts={supportingArtifacts ?? {}} />);
    expect(screen.getByText(heading)).toBeVisible();
    expect(screen.getByText(boundary)).toBeVisible();
    if (allowsTable) expect(screen.getByRole("table")).toBeVisible();
    else expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("restores the persisted receipt on the audit view and offers reset", () => {
    const completed = {
      ...objects[0],
      state: "待补证",
      version: 1,
    };
    const receipt = receiptFor(completed, "receipt-persisted-01");

    render(
      <CaseExperience
        definition={definition}
        activeView="audit"
        initialObjects={[completed, objects[1]]}
        initialEvents={[receipt.event]}
        initialReceipt={receipt}
        datasetRowCount={8400}
        datasetHash="sha256-value"
        metrics={metrics}
      />,
    );

    expect(screen.getByText("receipt-persiste")).toBeVisible();
    expect(screen.queryByText("尚未执行")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "恢复案例 B01" }),
    ).toBeEnabled();
  });

  it("changes events and receipt together when another object is selected", async () => {
    const nextProjection = {
      ...objects[1],
      state: "待补证",
      version: 1,
    };
    const nextReceipt = receiptFor(nextProjection, "receipt-object-02");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          projection: nextProjection,
          events: [nextReceipt.event],
          receipt: nextReceipt,
        }),
      }),
    );

    render(
      <CaseExperience
        definition={definition}
        activeView="work"
        initialObjects={objects}
        initialEvents={[]}
        initialReceipt={undefined}
        datasetRowCount={8400}
        datasetHash="sha256-value"
        metrics={metrics}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "查看取消单队列" }));
    const queue = screen.getByRole("dialog", { name: "取消单队列" });
    fireEvent.click(within(queue).getByRole("button", { name: /C-OBJ-002/ }));

    await waitFor(() => expect(screen.getByText(/已记录 /)).toBeVisible());
    expect(fetch).toHaveBeenCalledWith("/api/cases/01/objects/OBJ-002");
  });

  it("filters actions by role and sends the selected actor role", async () => {
    const completed = {
      ...retailObjects[0],
      state: "退款已暂缓",
      version: 1,
      task: { decisionReason: "原单与付款关系尚未补齐，先暂缓本次退款。" },
    };
    const responseReceipt = receiptFor(
      completed,
      "receipt-supervisor",
      "hold_refund",
    );
    responseReceipt.event.data = completed.task;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => responseReceipt,
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <CaseExperience
        definition={retailDefinition}
        activeView="work"
        initialObjects={retailObjects}
        initialEvents={[]}
        initialReceipt={undefined}
        datasetRowCount={14794}
        datasetHash="sha256-value"
        metrics={[]}
      />,
    );

    expect(screen.getByRole("button", { name: /创建原单补证任务/ })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /暂缓退款/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "业务主管" }),
    ).toHaveValue("supervisor");

    fireEvent.change(screen.getByRole("combobox", { name: "当前操作角色" }), {
      target: { value: "supervisor" },
    });
    fireEvent.change(screen.getByLabelText("暂缓退款理由"), {
      target: { value: "原单与付款关系尚未补齐，先暂缓本次退款。" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^暂缓退款/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({
      command: "hold_refund",
      actorRole: "supervisor",
      data: { decisionReason: "原单与付款关系尚未补齐，先暂缓本次退款。" },
    });
  });

  it("resets from the work view and clears the previous receipt", async () => {
    const oldReceipt = receiptFor(objects[0], "receipt-before-reset");
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ objects }),
      }),
    );

    render(
      <CaseExperience
        definition={definition}
        activeView="work"
        initialObjects={objects}
        initialEvents={[oldReceipt.event]}
        initialReceipt={oldReceipt}
        datasetRowCount={8400}
        datasetHash="sha256-value"
        metrics={metrics}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "恢复案例 B01" }));

    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  });
});
