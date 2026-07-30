// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { CaseProjection } from "@course-ai-product/case-runtime";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getCaseDefinition } from "../../cases/registry";
import { CaseExperience } from "../src/components/CaseExperience";
import { HydraulicConditionWorkbench } from "../src/components/workbenches/case-specific/HydraulicConditionWorkbench";
import { MemberTrialWorkbench } from "../src/components/workbenches/case-specific/MemberTrialWorkbench";
import type { CaseWorkbenchProps } from "../src/components/workbenches/case-specific/types";

vi.mock("../src/components/workbenches/case-specific", () => {
  const WorkbenchStub = () => <div data-testid="case-workbench-stub" />;
  return {
    AirQualityReleaseWorkbench: WorkbenchStub,
    AutoServiceTriageWorkbench: WorkbenchStub,
    BoilerEventWorkbench: WorkbenchStub,
    AquacultureResponseWorkbench: WorkbenchStub,
    ColdChainInvestigationWorkbench: WorkbenchStub,
    CreditMaterialWorkbench: WorkbenchStub,
    CutterHealthWorkbench: WorkbenchStub,
    FlotationReviewWorkbench: WorkbenchStub,
    HospitalTransferWorkbench: WorkbenchStub,
    HydraulicConditionWorkbench: WorkbenchStub,
    MemberTrialWorkbench: WorkbenchStub,
    MetroCompressorWorkbench: WorkbenchStub,
    ModelAdmissionWorkbench: WorkbenchStub,
    PvLossWorkbench: WorkbenchStub,
    RetailArchitectureWorkbench: WorkbenchStub,
    ReturnEvidenceWorkbench: WorkbenchStub,
    ReviewResearchWorkbench: WorkbenchStub,
    TelecomRecoveryWorkbench: WorkbenchStub,
    TransferNoticeWorkbench: WorkbenchStub,
    WaferRetestWorkbench: WorkbenchStub,
    WeekendRouteWorkbench: WorkbenchStub,
    WindUnderperformanceWorkbench: WorkbenchStub,
    SpringFestivalScreeningWorkbench: WorkbenchStub,
    SupermarketReplenishmentWorkbench: WorkbenchStub,
  };
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function projection(
  caseId: string,
  objectId: string,
  state: string,
  payload: Record<string, unknown>,
): CaseProjection {
  return {
    caseId,
    objectId,
    state,
    version: 0,
    payload,
    updatedAt: "2026-07-26T08:00:00.000Z",
  };
}

const memberRows = [
  { user_id: "U001", buy_count: "3", cart_count: "5", view_count: "12", engagement_score: "70", value_segment: "观察" },
  { user_id: "U002", buy_count: "4", cart_count: "6", view_count: "14", engagement_score: "82", value_segment: "观察" },
  { user_id: "U003", buy_count: "5", cart_count: "7", view_count: "16", engagement_score: "94", value_segment: "成长" },
  { user_id: "U004", buy_count: "6", cart_count: "8", view_count: "18", engagement_score: "106", value_segment: "成长" },
];

function memberProps(overrides: Partial<CaseWorkbenchProps> = {}): CaseWorkbenchProps {
  const objects = memberRows.map((row) => projection("B002", `02-${row.user_id}`, "待入组", row));
  return {
    definition: getCaseDefinition("B002")!,
    objects,
    selected: objects[3]!,
    events: [],
    metrics: [],
    datasetRowCount: 5000,
    sceneRows: memberRows,
    supportingArtifacts: {},
    actorRole: "operator",
    roles: ["operator", "supervisor"],
    commands: [{ id: "design_trial", label: "提交首批试投名单", tone: "secondary" }],
    busy: false,
    onActorRoleChange: vi.fn(),
    onCommand: vi.fn(),
    onReset: vi.fn(),
    onSelect: vi.fn(),
    ...overrides,
  };
}

const hydraulicPayload = {
  cycle_id: "217",
  main_pressure_mean: "156.552065",
  return_pressure_mean: "105.31137183333334",
  system_pressure_mean: "1.645498",
  motor_power_mean: "2423.7161",
  main_flow_mean: "6.234048333333334",
  tank_temperature_mean: "54.27211666666667",
  system_vibration_mean: "0.68205",
  cooler_condition: "3.0",
  cooler_state: "接近故障",
  cooler_severity: "critical",
  valve_condition: "73.0",
  valve_state: "接近故障",
  valve_severity: "critical",
  pump_condition: "2.0",
  pump_state: "严重泄漏",
  pump_severity: "critical",
  accumulator_condition: "130.0",
  accumulator_state: "最佳压力",
  accumulator_severity: "normal",
  stability_label: "稳定",
  overall_severity_label: "临界",
  affected_component_count: "3",
  automatic_maintenance_allowed: "False",
};

function hydraulicProps(overrides: Partial<CaseWorkbenchProps> = {}): CaseWorkbenchProps {
  const selected = projection("B019", "19-217", "待排序", hydraulicPayload);
  return {
    definition: getCaseDefinition("B019")!,
    objects: [selected],
    selected,
    events: [],
    metrics: [],
    datasetRowCount: 2205,
    sceneRows: [hydraulicPayload],
    supportingArtifacts: {},
    actorRole: "reliability_engineer",
    roles: ["reliability_engineer", "supervisor"],
    commands: [{ id: "submit_maintenance_review", label: "提交检查顺序", tone: "primary" }],
    busy: false,
    onActorRoleChange: vi.fn(),
    onCommand: vi.fn(),
    onReset: vi.fn(),
    onSelect: vi.fn(),
    ...overrides,
  };
}

describe("20 个案例的黄金产品合同", () => {
  it("每个工作页直达核心任务，并把证据与活动收进上下文抽屉", () => {
    const failures: string[] = [];

    for (let index = 1; index <= 20; index += 1) {
      const caseId = `B${String(index).padStart(3, "0")}`;
      const definition = getCaseDefinition(caseId)!;
      const selected = projection(caseId, `${caseId}-golden-object`, definition.workflow.initialState, {});
      const view = render(
        <CaseExperience
          definition={definition}
          activeView="work"
          initialObjects={[selected]}
          initialEvents={[]}
          datasetRowCount={1}
          datasetHash="golden-fixture-sha"
          metrics={[]}
        />,
      );
      const hrefs = Array.from(view.container.querySelectorAll<HTMLAnchorElement>("a[href]"))
        .map((anchor) => anchor.getAttribute("href"));
      if (hrefs.includes(`/cases/${caseId}`)) failures.push(`${caseId}:overview-link`);
      if (hrefs.includes(`/cases/${caseId}/evidence`)) failures.push(`${caseId}:evidence-link`);
      if (hrefs.includes(`/cases/${caseId}/audit`)) failures.push(`${caseId}:audit-link`);
      if (caseId !== "B018" && !screen.queryByRole("button", { name: "查看当前数据" })) failures.push(`${caseId}:evidence-drawer`);
      if (caseId !== "B018" && !screen.queryByRole("button", { name: "查看操作记录" })) failures.push(`${caseId}:activity-drawer`);
      view.unmount();
    }

    expect(failures).toEqual([]);
  });

  it("案例 02 可从确定性分组下钻到具体会员，并同步解释入组原因、预算与名单状态", () => {
    render(<MemberTrialWorkbench {...memberProps()} />);

    fireEvent.click(screen.getByRole("button", { name: "查看处理组名单" }));
    const member = screen.getAllByRole("button", { name: /会员 U00\d · 处理组/ })[0]!;
    const memberId = member.textContent?.match(/U\d+/)?.[0] ?? "";
    fireEvent.click(member);

    const explanation = screen.getByLabelText("成员入组说明");
    expect(explanation).toHaveTextContent(memberId);
    expect(explanation).toHaveTextContent("处理组");
    expect(explanation).toHaveTextContent(/满足.*浏览次数|确定性分组种子/);
    expect(screen.getByLabelText("试投预算联动")).toHaveTextContent("¥24");
    expect(screen.getByLabelText("名单状态")).toHaveTextContent(/预算内|可提交/);
  });

  it("案例 19 的场景热点与检查顺序双向同步，调整后的顺序写入提交任务", () => {
    const onCommand = vi.fn();
    render(<HydraulicConditionWorkbench {...hydraulicProps({ onCommand })} />);
    const orderSection = screen.getByRole("heading", { name: "部件检查顺序" }).closest("section")!;

    fireEvent.click(screen.getByRole("button", { name: "检查冷却器：接近故障" }));
    expect(within(orderSection).getByRole("button", { name: "核对部件：冷却器" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(within(orderSection).getByRole("button", { name: "核对部件：泵" }));
    expect(screen.getByRole("button", { name: "检查泵：严重泄漏" })).toHaveAttribute("data-active", "true");
    fireEvent.click(within(orderSection).getByRole("button", { name: "核对部件：比例阀" }));

    fireEvent.click(within(orderSection).getByRole("button", { name: "上移冷却器" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /本循环部件状态/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /最近 20 次循环趋势/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: "我已按当前循环记录核对检查顺序" }));
    fireEvent.change(screen.getByLabelText("液压检查负责人"), { target: { value: "液压检修组-A" } });
    fireEvent.change(screen.getByLabelText("液压检查截止时间"), { target: { value: "2026-07-28T08:00" } });
    fireEvent.change(screen.getByLabelText("液压复核提交人ID"), { target: { value: "reliability-engineer-01" } });
    fireEvent.change(screen.getByLabelText("液压检查说明"), {
      target: { value: "先核对泵，再核对冷却器和比例阀状态。" },
    });
    fireEvent.click(screen.getByRole("button", { name: "提交检查顺序" }));

    const options = onCommand.mock.calls[0]?.[2] as {
      data?: { inspectionOrder?: Array<{ component: string }> };
    };
    expect(options.data?.inspectionOrder?.map((item) => item.component)).toEqual([
      "pump",
      "cooler",
      "valve",
      "accumulator",
    ]);
  });

  it("案例 19 明示静态场景降级仍可操作，并为减少动态偏好关闭非必要动效", () => {
    render(<HydraulicConditionWorkbench {...hydraulicProps()} />);
    const scene = screen.getByLabelText("液压动力单元现场");
    expect(scene).toHaveAttribute("data-render-mode", "static-fallback");
    expect(within(scene).getByText("静态场景 · 热点与检查顺序仍可操作")).toBeVisible();

    const stylesheet = readFileSync(
      resolve(process.cwd(), "src/components/workbenches/case-specific/HydraulicConditionWorkbench.module.css"),
      "utf8",
    );
    expect(stylesheet).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  });
});
