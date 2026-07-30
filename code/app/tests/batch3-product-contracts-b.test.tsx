// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { CaseProjection } from "@course-ai-product/case-runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getCaseDefinition } from "../../cases/registry";
import { AutoServiceTriageWorkbench } from "../src/components/workbenches/case-specific/AutoServiceTriageWorkbench";
import { ColdChainInvestigationWorkbench } from "../src/components/workbenches/case-specific/ColdChainInvestigationWorkbench";
import type { CaseWorkbenchProps } from "../src/components/workbenches/case-specific/types";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const coldChainRows: Record<string, unknown>[] = [
  {
    investigation_id: "CCI-TEMP-001",
    event_id: "TEMP-START-001",
    route_id: "ROUTE-TEMPERATURE",
    province: "四川省",
    county: "温控县",
    event_time: "2026-07-18T08:00:00+08:00",
    temperature_c: 5.2,
    calibration_status: "valid",
    route_record_status: "complete",
    handoff_status: "complete",
    offline_minutes: 0,
    vehicle_code: "COURSE-VEH-TEMP",
    logger_code: "COURSE-LOGGER-TEMP",
  },
  {
    investigation_id: "CCI-TEMP-001",
    event_id: "TEMP-PEAK-002",
    route_id: "ROUTE-TEMPERATURE",
    province: "四川省",
    county: "温控县",
    event_time: "2026-07-18T08:05:00+08:00",
    temperature_c: 9.3,
    calibration_status: "valid",
    route_record_status: "missing",
    handoff_status: "complete",
    offline_minutes: 15,
    vehicle_code: "COURSE-VEH-TEMP",
    logger_code: "COURSE-LOGGER-TEMP",
  },
  {
    investigation_id: "CCI-HANDOFF-002",
    event_id: "HANDOFF-ONLY-001",
    route_id: "ROUTE-HANDOFF",
    province: "云南省",
    county: "交接县",
    event_time: "2026-07-18T09:00:00+08:00",
    temperature_c: 5.4,
    calibration_status: "valid",
    route_record_status: "complete",
    handoff_status: "missing",
    offline_minutes: 0,
    vehicle_code: "COURSE-VEH-HANDOFF",
    logger_code: "COURSE-LOGGER-HANDOFF",
  },
];

function projection(caseId: string, objectId: string, payload: Record<string, unknown>): CaseProjection {
  return {
    caseId,
    objectId,
    state: caseId === "B012" ? "待调查" : "待分流",
    version: 0,
    payload,
    updatedAt: "2026-07-26T08:00:00.000Z",
  };
}

const coldChainObjects = [
  projection("B012", "B012-CCI-TEMP-001-TEMP-PEAK-002", coldChainRows[1]),
  projection("B012", "B012-CCI-HANDOFF-002-HANDOFF-ONLY-001", coldChainRows[2]),
];

function coldChainProps(overrides: Partial<CaseWorkbenchProps> = {}): CaseWorkbenchProps {
  return {
    definition: getCaseDefinition("B012")!,
    objects: coldChainObjects,
    selected: coldChainObjects[0],
    events: [],
    metrics: [],
    datasetRowCount: coldChainRows.length,
    sceneRows: coldChainRows,
    supportingArtifacts: {},
    actorRole: "quality_reviewer",
    roles: ["quality_reviewer", "supervisor"],
    commands: [{ id: "open_investigation", label: "启动偏差调查", tone: "primary" }],
    busy: false,
    onActorRoleChange: vi.fn(),
    onCommand: vi.fn(),
    onReset: vi.fn(),
    onSelect: vi.fn(),
    ...overrides,
  };
}

const autoServiceRow: Record<string, unknown> = {
  intake_id: "CN-AS-001",
  region: "华东",
  vehicle_class: "乘用车",
  symptom_text: "制动时出现异响",
  symptom_category: "brake",
  safety_review_required: true,
  workflow_state: "待技师初检",
  allowed_action: "handoff_to_technician",
  automatic_repair_allowed: false,
  data_nature: "deterministic-synthetic-cn-operations",
};
const autoServiceObject = projection("B013", "B013-CN-AS-001", autoServiceRow);

function autoServiceProps(overrides: Partial<CaseWorkbenchProps> = {}): CaseWorkbenchProps {
  return {
    definition: getCaseDefinition("B013")!,
    objects: [autoServiceObject],
    selected: autoServiceObject,
    events: [],
    metrics: [],
    datasetRowCount: 1,
    sceneRows: [autoServiceRow],
    supportingArtifacts: {},
    actorRole: "dispatcher",
    roles: ["dispatcher", "supervisor"],
    commands: [
      { id: "request_details", label: "请求补充车辆状态", tone: "secondary" },
      { id: "submit_triage", label: "转交技师安全复核", tone: "primary" },
    ],
    busy: false,
    onActorRoleChange: vi.fn(),
    onCommand: vi.fn(),
    onReset: vi.fn(),
    onSelect: vi.fn(),
    ...overrides,
  };
}

describe("batch 3 product contracts — cases 12 and 13", () => {
  it("案例 12：异常类型筛选分别只保留温度偏差路线和交接缺失路线", () => {
    render(<ColdChainInvestigationWorkbench {...coldChainProps()} />);

    const queue = screen.getByRole("complementary", { name: "调查列表" });
    fireEvent.click(within(queue).getByRole("button", { name: "温度偏差" }));
    expect(within(queue).getByRole("button", { name: /温控县/ })).toBeVisible();
    expect(within(queue).queryByRole("button", { name: /交接县/ })).not.toBeInTheDocument();

    fireEvent.click(within(queue).getByRole("button", { name: "交接缺失" }));
    expect(within(queue).queryByRole("button", { name: /温控县/ })).not.toBeInTheDocument();
    expect(within(queue).getByRole("button", { name: /交接县/ })).toBeVisible();
  });

  it("案例 12：选择时间带记录后显示交接、路线记录和离线分钟原值", () => {
    render(<ColdChainInvestigationWorkbench {...coldChainProps()} />);

    fireEvent.click(screen.getByRole("button", { name: /08:05，TEMP-PEAK-002，9.3℃/ }));
    const detail = screen.getByRole("article", { name: "当前记录详情" });
    expect(detail).toHaveTextContent(/交接\s*完整/);
    expect(detail).toHaveTextContent(/路线记录\s*缺失/);
    expect(detail).toHaveTextContent(/离线\s*15 分钟/);
  });

  it("案例 13：部位选择只改变定位当前态，不替客户生成答案", () => {
    render(<AutoServiceTriageWorkbench {...autoServiceProps()} />);

    const brakeHotspot = screen.getByRole("button", { name: "制动区域" });
    const coolingHotspot = screen.getByRole("button", { name: "冷却区域" });
    expect(brakeHotspot).toHaveAttribute("data-current", "true");

    fireEvent.click(coolingHotspot);

    expect(coolingHotspot).toHaveAttribute("aria-pressed", "true");
    expect(coolingHotspot).toHaveAttribute("data-current", "true");
    expect(brakeHotspot).toHaveAttribute("data-current", "false");
    expect(screen.getByRole("heading", { name: "车辆现在能否安全移动？" })).toBeVisible();
  });

  it("案例 13：待补清单只列可回答问题，不虚构车辆身份字段", () => {
    render(<AutoServiceTriageWorkbench {...autoServiceProps()} />);

    const dossier = screen.getByRole("complementary", { name: "接车事实单" });
    expect(within(dossier).getByText("仍缺少 4 项")).toBeVisible();
    for (const label of ["车辆移动状态", "仪表警示", "发生条件", "出现频次"]) {
      expect(within(dossier).getByText(label, { exact: true })).toBeVisible();
    }
    expect(screen.queryByText("车辆识别代号")).not.toBeInTheDocument();
    expect(screen.queryByText("故障码")).not.toBeInTheDocument();
  });
});
