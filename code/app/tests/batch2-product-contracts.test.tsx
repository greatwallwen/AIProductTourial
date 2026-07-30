// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { CaseEvent, CaseProjection } from "@course-ai-product/case-runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getCaseDefinition } from "../../cases/registry";
import { AirQualityReleaseWorkbench } from "../src/components/workbenches/case-specific/AirQualityReleaseWorkbench";
import { CreditMaterialWorkbench } from "../src/components/workbenches/case-specific/CreditMaterialWorkbench";
import { ModelAdmissionWorkbench } from "../src/components/workbenches/case-specific/ModelAdmissionWorkbench";
import { RetailArchitectureWorkbench } from "../src/components/workbenches/case-specific/RetailArchitectureWorkbench";
import { ReviewResearchWorkbench } from "../src/components/workbenches/case-specific/ReviewResearchWorkbench";
import { TelecomRecoveryWorkbench } from "../src/components/workbenches/case-specific/TelecomRecoveryWorkbench";
import { WaferRetestWorkbench } from "../src/components/workbenches/case-specific/WaferRetestWorkbench";
import type { CaseWorkbenchProps } from "../src/components/workbenches/case-specific/types";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function object(
  caseId: string,
  objectId: string,
  state: string,
  payload: Record<string, unknown>,
  overrides: Partial<CaseProjection> = {},
): CaseProjection {
  return {
    caseId,
    objectId,
    state,
    version: 0,
    payload,
    updatedAt: "2026-07-26T08:00:00.000Z",
    ...overrides,
  };
}

function callbacks() {
  return {
    onActorRoleChange: vi.fn(),
    onCommand: vi.fn(),
    onReset: vi.fn(),
    onSelect: vi.fn(),
  };
}

const positiveSelectedReview = object("03", "03-900", "待研判", {
  id: "900",
  review: "服务员主动解释排队进度，接待很耐心。",
  star: "5",
  "Service#Hospitality": "1",
  "Service#Queue": "-2",
  "Service#Timely": "-2",
  "Food#Taste": "-2",
  source_id: "DATA-03",
  data_nature: "public-derived",
});
const negativeHospitalityReview = object("03", "03-901", "待研判", {
  id: "901",
  review: "服务员态度冷淡，询问排队进度时一直说没空。",
  star: "1",
  "Service#Hospitality": "-1",
  "Service#Queue": "-2",
  "Service#Timely": "-2",
  "Food#Taste": "-2",
  source_id: "DATA-03",
  data_nature: "public-derived",
});
const reviewObjects = [positiveSelectedReview, negativeHospitalityReview];

function reviewProps(overrides: Partial<CaseWorkbenchProps> = {}): CaseWorkbenchProps {
  return {
    definition: getCaseDefinition("03")!,
    objects: reviewObjects,
    selected: positiveSelectedReview,
    events: [],
    metrics: [],
    datasetRowCount: 6970,
    sceneRows: reviewObjects.map((item) => item.payload),
    supportingArtifacts: {},
    actorRole: "operator",
    roles: ["operator", "supervisor"],
    commands: [{ id: "create_validation_task", label: "创建需求验证单", tone: "primary" }],
    busy: false,
    ...callbacks(),
    ...overrides,
  };
}

const creditApplication = object("04", "04-CR20260000001", "待复核", {
  application_id: "CR20260000001",
  province_name: "四川省",
  city_name: "成都市",
  requested_amount_fen: "380000",
  application_at: "2026-04-01T08:00:00+08:00",
  identity_verification_status: "pending",
  income_evidence_status: "complete",
  consent_status: "confirmed",
  application_consistency: "consistent",
});
const creditObjects = [creditApplication];

function creditProps(overrides: Partial<CaseWorkbenchProps> = {}): CaseWorkbenchProps {
  return {
    definition: getCaseDefinition("04")!,
    objects: creditObjects,
    selected: creditObjects[0]!,
    events: [],
    metrics: [],
    datasetRowCount: 1200,
    sceneRows: creditObjects.map((item) => item.payload),
    supportingArtifacts: {},
    actorRole: "reviewer",
    roles: ["reviewer", "supervisor"],
    commands: [],
    busy: false,
    ...callbacks(),
    ...overrides,
  };
}

function airObject(station: string, no: string, missing = false): CaseProjection {
  return object("06", `06-${station}-${no}`, "待审核", {
    station,
    No: no,
    observed_at: "2016-12-27 12:00:00",
    hour: "12",
    "PM2.5": missing ? "" : "16",
    PM10: missing ? "" : "33",
    SO2: missing ? "" : "7",
    NO2: missing ? "" : "39",
    CO: missing ? "" : "700",
    O3: missing ? "" : "26",
    TEMP: "2.0",
    PRES: "1028.4",
    wd: "E",
    WSPM: "1.3",
    RAIN: "0.0",
    missing_pollutant_count: missing ? "6" : "0",
  });
}

const guchengComplete = airObject("Gucheng", "33541");
const wanliuComplete = airObject("Wanliu", "33542");
const airObjects = [guchengComplete, wanliuComplete];
const completeAirMap = { "PM2.5": "present", PM10: "present", SO2: "present", NO2: "present", CO: "present", O3: "present" };
const wanliuPackage = {
  packageId: "AQ-20161227-Wanliu-33542-v1",
  version: "1.0",
  station: "Wanliu",
  observedAt: "2016-12-27 12:00:00",
  sourceRowId: "33542",
  pollutants: { "PM2.5": "16", PM10: "33", SO2: "7", NO2: "39", CO: "700", O3: "26" },
};

function airProps(overrides: Partial<CaseWorkbenchProps> = {}): CaseWorkbenchProps {
  return {
    definition: getCaseDefinition("06")!,
    objects: airObjects,
    selected: airObjects[0]!,
    events: [],
    metrics: [],
    datasetRowCount: 21039,
    sceneRows: airObjects.map((item) => item.payload),
    supportingArtifacts: {},
    actorRole: "auditor",
    roles: ["auditor", "supervisor"],
    commands: [],
    busy: false,
    ...callbacks(),
    ...overrides,
  };
}

const retailOrders = Array.from({ length: 13 }, (_, index) => {
  const orderId = `D01-O${String(index + 1).padStart(4, "0")}`;
  return object("07", `07-${orderId}`, "待评审", {
    order_id: orderId,
    day_index: "1",
    arrival_minute: String(600 + index / 10),
    item_count: String(4 + (index % 5)),
    item_ids_preview: "I0046;I0483;I0544",
    is_observed_production_order: "False",
    data_nature: "public-benchmark-derived",
  });
});

const retailEvidence = [
  ["订单接入", "订单平台组", "9981", "202"],
  ["库存", "库存平台组", "9538", "351"],
  ["履约", "履约平台组", "7595", "912"],
  ["配送交接", "配送平台组", "6152", "487"],
].map(([domain, owner_team, request_count, p95_latency_ms]) => ({
  facility_code: "CN-FC-COURSE-01",
  facility_label: "中国前置仓课程场景",
  scenario_date: "2026-07-14",
  domain,
  owner_team,
  request_count,
  p95_latency_ms,
  release_count: "2",
  incident_minutes: "3",
  recovery_minutes: "20",
  data_nature: "deterministic-synthetic-cn-operations",
}));

function retailProps(): CaseWorkbenchProps {
  return {
    definition: getCaseDefinition("07")!,
    objects: retailOrders,
    selected: retailOrders[0]!,
    events: [],
    metrics: [],
    datasetRowCount: 12000,
    sceneRows: retailOrders.map((item) => item.payload),
    supportingArtifacts: { "operational-evidence.csv": retailEvidence },
    actorRole: "architect",
    roles: ["architect", "supervisor"],
    commands: [],
    busy: false,
    ...callbacks(),
  };
}

const telecomObjects = Array.from({ length: 19 }, (_, index) => {
  const taskId = `CN-TEL-2025Q2-${String(index + 1).padStart(4, "0")}`;
  return object("10", `10-${taskId}`, "执行中", {
    task_id: taskId,
    received_at: "2025-07-01T09:17:00",
    category: "资费争议",
    subcategory: "合约套餐变更",
    province: "福建",
    city: "福州",
    channel: "互联网服务入口",
    priority: index % 3 === 0 ? "高" : "关注",
    external_lookup_scenario: "committed_response_lost",
    routing_queue: "福建服务复核队列",
    evidence_complete: "False",
    allegation_verified: "False",
    data_nature: "deterministic-synthetic-cn-operations",
  });
});

function telecomProps(): CaseWorkbenchProps {
  return {
    definition: getCaseDefinition("10")!,
    objects: telecomObjects,
    selected: telecomObjects[0]!,
    events: [],
    metrics: [],
    datasetRowCount: 1000,
    sceneRows: [],
    supportingArtifacts: {},
    actorRole: "coordinator",
    roles: ["coordinator", "supervisor"],
    commands: [],
    busy: false,
    ...callbacks(),
  };
}

const admissionRows = [
  { evaluation_id: "EVAL-11-001", candidate_id: "MODEL-ADMISSION-001", gate: "risk", metric_label: "无证据陈述率", metric_value: "0.032", comparator: "<=", threshold: "0.04", sample_size: "800", slice_id: "knowledge-qa", evidence_status: "complete", result: "pass", policy_version: "MODEL-GATE-2026.1" },
  { evaluation_id: "EVAL-11-004", candidate_id: "MODEL-ADMISSION-001", gate: "fairness", metric_label: "地区切片准确率差", metric_value: "0.047", comparator: "<=", threshold: "0.03", sample_size: "720", slice_id: "east-west", evidence_status: "missing_slice", result: "evidence_required", policy_version: "MODEL-GATE-2026.1" },
  { evaluation_id: "EVAL-11-007", candidate_id: "MODEL-ADMISSION-001", gate: "safety", metric_label: "高风险请求拒答率", metric_value: "0.991", comparator: ">=", threshold: "0.98", sample_size: "900", slice_id: "high-risk", evidence_status: "complete", result: "pass", policy_version: "MODEL-GATE-2026.1" },
];
const admissionObjects = admissionRows.map((row) => object("11", `11-${row.evaluation_id}-${row.candidate_id}`, "待会签", row));
const admissionEvent: CaseEvent = {
  eventId: "evt-11-batch2",
  caseId: "11",
  objectId: admissionObjects[1]!.objectId,
  command: "request_release_evidence",
  actor: { id: "case11-release-manager", role: "release_manager" },
  fromState: "待会签",
  toState: "补测中",
  version: 1,
  evidenceIds: ["evaluation:EVAL-11-004"],
  occurredAt: "2026-07-26T09:15:00.000Z",
};

function admissionProps(): CaseWorkbenchProps {
  return {
    definition: getCaseDefinition("11")!,
    objects: admissionObjects,
    selected: admissionObjects[1]!,
    events: [admissionEvent],
    metrics: [],
    datasetRowCount: 3,
    sceneRows: admissionRows,
    supportingArtifacts: {},
    actorRole: "release_manager",
    roles: ["release_manager", "supervisor"],
    commands: [],
    busy: false,
    ...callbacks(),
  };
}

const waferSensors = {
  sensor_021: "-5447.75",
  sensor_022: "2701.75",
  sensor_024: "-1916.5",
  sensor_090: "9317.1698",
  sensor_158: "",
  sensor_159: "562",
  sensor_160: "788",
  sensor_161: "759",
  sensor_162: "2100",
  sensor_294: "251.4536",
  sensor_295: "329.6406",
  sensor_296: "325.0672",
};
const wafer = object("15", "15-SECOM-0003", "待复核", {
  wafer_id: "SECOM-0003",
  test_timestamp: "19/07/2008 13:13:00",
  quality_label: "fail",
  review_priority: "quality-gate-review",
  ...waferSensors,
});

function waferProps(): CaseWorkbenchProps {
  return {
    definition: getCaseDefinition("15")!,
    objects: [wafer],
    selected: wafer,
    events: [],
    metrics: [{ id: "failed", label: "未通过观测", value: "104", note: "质量标签未通过" }],
    datasetRowCount: 1567,
    sceneRows: [wafer.payload],
    supportingArtifacts: {
      "sensor-ranking.csv": Object.keys(waferSensors).map((sensorId, index) => ({
        sensor_id: sensorId,
        missing_rows: sensorId === "sensor_158" ? "1429" : String(index),
      })),
    },
    actorRole: "quality_engineer",
    roles: ["quality_engineer", "supervisor"],
    commands: [],
    busy: false,
    ...callbacks(),
  };
}

describe("批次 2 对抗式产品合同", () => {
  it("案例 03 在提交前阻止正向评论充当负向证据且同一评论正反复用", () => {
    const onCommand = vi.fn();
    render(<ReviewResearchWorkbench {...reviewProps({ onCommand })} />);
    const panel = screen.getByRole("complementary", { name: "主题摘要与验证" });
    fireEvent.change(within(panel).getByLabelText("样本规模"), { target: { value: "20" } });
    fireEvent.change(within(panel).getByLabelText("负责人"), { target: { value: "林研究员" } });
    fireEvent.change(within(panel).getByLabelText("期限"), { target: { value: "2026-08-15" } });
    fireEvent.change(within(panel).getByLabelText("什么结果算问题成立"), { target: { value: "20 条样本中负向证据比例达到 30%" } });

    const submit = within(panel).getByRole("button", { name: "提交结构化验证任务" });
    expect(submit).toBeDisabled();
    expect(within(panel).queryByRole("checkbox", { name: /review:900 支持证据/ })).not.toBeInTheDocument();
    expect(within(panel).getByRole("status")).toHaveTextContent(/至少选择一条支持原话和一条相反原话/);
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("案例 04 的材料选择驱动同一份材料详情，而不是固定展示收入材料", () => {
    render(<CreditMaterialWorkbench {...creditProps()} />);
    const checklist = screen.getByRole("region", { name: "材料清单与核对" });
    fireEvent.click(within(checklist).getByRole("button", { name: "查看身份材料" }));

    const detail = screen.getByRole("region", { name: "所选材料详情" });
    expect(detail).toHaveTextContent("身份材料");
    expect(detail).toHaveTextContent("身份待核验");
    expect(detail).not.toHaveTextContent("收入材料（缺失）");
  });

  it("案例 06 阻止把其他站点的冻结发布包提交给当前站点时次", () => {
    const onCommand = vi.fn();
    const mismatchedPackage: CaseProjection = {
      ...guchengComplete,
      state: "待发布",
      version: 1,
      task: {
        releasePackage: wanliuPackage,
        completeness: completeAirMap,
        reviewNote: "六项污染物字段及站点时次已核对。",
        reviewerId: "case06-air-auditor",
      },
    };
    render(<AirQualityReleaseWorkbench {...airProps({
      selected: mismatchedPackage,
      objects: [mismatchedPackage, wanliuComplete],
      actorRole: "supervisor",
      commands: [{ id: "publish", label: "确认本批次摘录", tone: "primary" }],
      onCommand,
    })} />);
    fireEvent.change(screen.getByLabelText("复核意见"), { target: { value: "已复核当前站点、时次及锁定摘录。" } });

    const blockedAction = screen.getByRole("button", { name: "等待锁定摘录复核" });
    expect(blockedAction).toBeDisabled();
    expect(screen.getByRole("alert", { name: "摘录绑定异常" })).toHaveTextContent(/古城.*万柳|当前记录.*锁定摘录/);
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("案例 07 把已载入订单数量保留在来源口径中而不恢复订单级队列", () => {
    render(<RetailArchitectureWorkbench {...retailProps()} />);
    const rail = screen.getByRole("complementary", { name: "评审窗口" });
    expect(within(rail).getByText(/当前载入 13 条/)).toBeVisible();
    expect(screen.getByRole("region", { name: "发布与恢复耦合矩阵" })).toBeVisible();
    expect(screen.queryByRole("region", { name: "订单评审队列" })).not.toBeInTheDocument();
  });

  it("案例 10 可按任务号收窄恢复核查单目录", () => {
    render(<TelecomRecoveryWorkbench {...telecomProps()} />);
    const queue = screen.getByRole("complementary", { name: "匿名恢复核查单目录" });
    fireEvent.change(within(queue).getByRole("textbox", { name: "搜索核查单" }), { target: { value: "0019" } });
    expect(within(queue).getByRole("button", { name: /CN-TEL-2025Q2-0019/ })).toBeVisible();
    expect(within(queue).queryByRole("button", { name: /CN-TEL-2025Q2-0001/ })).not.toBeInTheDocument();
  });

  it("案例 11 的操作日志按钮打开由持久化事件生成的业务日志", () => {
    render(<ModelAdmissionWorkbench {...admissionProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "操作日志" }));
    const dialog = screen.getByRole("dialog", { name: "模型准入操作日志" });
    expect(dialog).toHaveTextContent("发起地区切片补测");
    expect(dialog).toHaveTextContent("待会签 → 补测中");
    expect(dialog).toHaveTextContent("case11-release-manager");
  });

  it("案例 11 不向业务用户暴露仓库内部名称", () => {
    render(<ModelAdmissionWorkbench {...admissionProps()} />);
    expect(screen.queryByText("Course_AIProduct 本地记录")).not.toBeInTheDocument();
    expect(screen.getByText("3 项本地评测")).toBeVisible();
  });

  it("案例 15 只用一张覆盖矩阵完成查看与复测选择", () => {
    render(<WaferRetestWorkbench {...waferProps()} />);
    const coverage = screen.getByRole("region", { name: "通道覆盖矩阵" });
    const coverageToggle = within(coverage).getByRole("button", { name: "将 sensor_021 列入复测" });
    fireEvent.click(coverageToggle);

    expect.soft(coverageToggle).toHaveAccessibleName("从复测中移除 sensor_021");
    expect.soft(coverageToggle).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { name: "sensor_021" })).toBeVisible();
    expect(within(coverage).getByText("已选 2")).toBeVisible();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "通道覆盖条" })).not.toBeInTheDocument();
  });
});
