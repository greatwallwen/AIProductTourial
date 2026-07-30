// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { CaseEvent, CaseProjection } from "@course-ai-product/case-runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getCaseDefinition } from "../../cases/registry";
import { AquacultureResponseWorkbench } from "../src/components/workbenches/case-specific/AquacultureResponseWorkbench";
import { HospitalTransferWorkbench } from "../src/components/workbenches/case-specific/HospitalTransferWorkbench";
import { ReturnEvidenceWorkbench } from "../src/components/workbenches/case-specific/ReturnEvidenceWorkbench";
import type { CaseWorkbenchProps } from "../src/components/workbenches/case-specific/types";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const returnClaim = {
  invoice_id: "C496116",
  stock_code: "M",
  description: "Manual",
  quantity: "-1",
  invoice_at: "2010-01-25 11:46:00",
  customer_id: "C17949",
  country: "United Kingdom",
  is_cancellation_proxy: "True",
  line_amount_cny: "-81768.96",
  operational_currency: "CNY",
  fx_rate_gbp_cny: "9.10",
  fx_basis: "课程固定汇率",
  source_sheet: "Year 2009-2010",
  data_nature: "公开数据换算",
};

const returnCandidate = {
  invoice_id: "496015",
  stock_code: "M",
  description: "Manual",
  quantity: "1",
  invoice_at: "2010-01-20 10:20:00",
  customer_id: "C17949",
  line_amount_cny: "81768.96",
};

function returnProjection(
  invoiceId = "C496116",
  overrides: Partial<CaseProjection> = {},
): CaseProjection {
  const payload = {
    ...returnClaim,
    invoice_id: invoiceId,
    ...(overrides.payload ?? {}),
  };
  return {
    caseId: "01",
    objectId: `01-${invoiceId}-M`,
    state: "待核验",
    version: 0,
    updatedAt: "2026-07-26T08:00:00.000Z",
    ...overrides,
    payload,
  };
}

function returnProps(overrides: Partial<CaseWorkbenchProps> = {}): CaseWorkbenchProps {
  const selected = returnProjection();
  return {
    definition: getCaseDefinition("01")!,
    objects: [selected],
    selected,
    events: [],
    metrics: [],
    datasetRowCount: 14794,
    sceneRows: [returnClaim, returnCandidate],
    supportingArtifacts: {},
    actorRole: "analyst",
    roles: ["analyst", "supervisor"],
    commands: [{ id: "create_evidence_request", label: "创建原单补证任务", tone: "secondary" }],
    busy: false,
    onActorRoleChange: vi.fn(),
    onCommand: vi.fn(),
    onReset: vi.fn(),
    onSelect: vi.fn(),
    ...overrides,
  };
}

const firstLateTransfer = {
  event_id: "TRN-9001-01",
  transport_id: "TRN-9001",
  flow_token: "FLOW-9001-A",
  event_version: "1",
  event_time: "2026-07-03T08:07:00+08:00",
  received_at: "2026-07-03T08:40:00+08:00",
  source_system: "ED_BOARD",
  from_department: "急诊观察区",
  to_department: "外科留观区",
  bed_request_id: "BED-901",
  role: "emergency_nurse",
  actor_id: "ER-N-01",
  event_type: "correction_appended",
  co_sign_status: "pending",
  conflict_type: "late_event",
  late_event: "True",
};

const secondLateTransfer = {
  ...firstLateTransfer,
  event_id: "TRN-9001-02",
  flow_token: "FLOW-9001-B",
  event_version: "2",
  event_time: "2026-07-03T08:11:00+08:00",
  received_at: "2026-07-03T08:51:00+08:00",
  source_system: "BED_CONTROL",
  bed_request_id: "BED-902",
  actor_id: "BED-C-02",
};

function transferProjection(): CaseProjection {
  return {
    caseId: "05",
    objectId: "05-TRN-9001-TRN-9001-02",
    state: "待会签",
    version: 0,
    payload: secondLateTransfer,
    task: {
      coordination: {
        selectedEventId: firstLateTransfer.event_id,
        authoritativeState: "接收方已接收，保留迟到修正",
        reconciliationReason: "先保留第一条迟到事件，等待时间线复核",
        senderActorId: "ER-N-07",
      },
    },
    updatedAt: "2026-07-26T08:00:00.000Z",
  };
}

function transferProps(overrides: Partial<CaseWorkbenchProps> = {}): CaseWorkbenchProps {
  const selected = transferProjection();
  return {
    definition: getCaseDefinition("05")!,
    objects: [selected],
    selected,
    events: [],
    metrics: [],
    datasetRowCount: 4320,
    sceneRows: [firstLateTransfer, secondLateTransfer],
    supportingArtifacts: {},
    actorRole: "coordinator",
    roles: ["coordinator", "supervisor"],
    commands: [{ id: "nurse_confirm", label: "确认转运事件", tone: "secondary" }],
    busy: false,
    onActorRoleChange: vi.fn(),
    onCommand: vi.fn(),
    onReset: vi.fn(),
    onSelect: vi.fn(),
    ...overrides,
  };
}

function aquacultureProjection(
  eventId: string,
  regionId: string,
  eventTime: string,
  overrides: Partial<CaseProjection> = {},
): CaseProjection {
  const payload = {
    event_id: eventId,
    event_time: eventTime,
    region_id: regionId,
    archive_member: `${regionId}/region_2024_merge.tif`,
    temperature_c: "32.12",
    dissolved_oxygen_mg_l: "5.75",
    ph: "7.31",
    turbidity_ntu: "8.82",
    sensor_status: "online",
    evidence_status: "value_conflict",
    risk_level: "high",
    source_id: "COURSE-OPS-08",
    ...(overrides.payload ?? {}),
  };
  return {
    caseId: "08",
    objectId: `08-${eventId}-${regionId}`,
    state: "待分派",
    version: 0,
    updatedAt: "2026-07-25T08:00:00.000Z",
    ...overrides,
    payload,
  };
}

function aquacultureProps(
  selected: CaseProjection,
  overrides: Partial<CaseWorkbenchProps> = {},
): CaseWorkbenchProps {
  return {
    definition: getCaseDefinition("08")!,
    objects: [selected],
    selected,
    events: [],
    metrics: [],
    datasetRowCount: 864,
    sceneRows: [selected.payload],
    supportingArtifacts: {},
    actorRole: "dispatcher",
    roles: ["dispatcher", "field_operator", "supervisor"],
    commands: [{ id: "dispatch_field_check", label: "派发现场核查", tone: "secondary" }],
    busy: false,
    onActorRoleChange: vi.fn(),
    onCommand: vi.fn(),
    onReset: vi.fn(),
    onSelect: vi.fn(),
    ...overrides,
  };
}

describe("批次 3 红灯合同：案例 01、05、08", () => {
  it("案例 01 只用当前案卷事件恢复候选、负责人和期限", () => {
    const selected = returnProjection();
    const otherCaseEvent: CaseEvent = {
      eventId: "evt-other-case-request",
      caseId: "01",
      objectId: "01-C-OTHER-M",
      command: "create_evidence_request",
      actor: { id: "analyst-other", role: "analyst" },
      fromState: "待核验",
      toState: "待补证",
      version: 1,
      reason: "其他案卷请求补证",
      evidenceIds: ["candidate:496015"],
      data: {
        candidateId: "496015",
        requestedEvidence: ["original_order", "payment_record"],
        assignee: "销售运营",
        dueAt: "2026-08-03",
      },
      occurredAt: "2026-07-26T08:10:00.000Z",
    };

    render(<ReturnEvidenceWorkbench {...returnProps({
      selected,
      objects: [selected],
      events: [otherCaseEvent],
    })} />);

    expect.soft(screen.queryByText("尚未作出候选判断")).toBeVisible();
    expect.soft(screen.getByLabelText("补证负责人")).toHaveValue("财务对账");
    expect(screen.getByLabelText("补证期限")).toHaveValue("2026-07-29");
  });

  it("案例 01 的下一页同时更新页码和可见案卷", () => {
    const objects = Array.from({ length: 9 }, (_, index) =>
      returnProjection(`C-PAGE-${String(index + 1).padStart(2, "0")}`));

    render(<ReturnEvidenceWorkbench {...returnProps({
      selected: objects[0]!,
      objects,
    })} />);

    fireEvent.click(screen.getByRole("button", { name: "查看取消单队列" }));
    const queue = screen.getByRole("dialog", { name: "取消单队列" });
    expect(within(queue).getByText("C-PAGE-01")).toBeVisible();
    expect(within(queue).queryByText("C-PAGE-09")).not.toBeInTheDocument();
    fireEvent.click(within(queue).getByRole("button", { name: "下一页" }));

    expect.soft(within(queue).queryByText("C-PAGE-01")).not.toBeInTheDocument();
    expect.soft(within(queue).queryByText("C-PAGE-09")).toBeVisible();
    expect(within(queue).getByText("2 / 2")).toBeVisible();
  });

  it("案例 05 的时间线选择驱动同一事件的命令、证据和幂等键", () => {
    const onCommand = vi.fn();
    render(<HospitalTransferWorkbench {...transferProps({ onCommand })} />);

    const timeline = screen.getByRole("region", { name: "转运事件时间线" });
    fireEvent.click(within(timeline).getAllByRole("button")[1]!);
    fireEvent.click(screen.getByRole("button", { name: "确认转运事件" }));

    expect(onCommand).toHaveBeenCalledTimes(1);
    const options = onCommand.mock.calls[0]?.[2];
    expect.soft(options.data.selectedEventId).toBe(secondLateTransfer.event_id);
    expect.soft(options.evidenceIds).toEqual([
      secondLateTransfer.event_id,
      secondLateTransfer.bed_request_id,
      secondLateTransfer.flow_token,
    ]);
    expect(options.idempotencyKey).toBe(
      `case-05:TRN-9001:nurse_confirm:v0:${secondLateTransfer.event_id}`,
    );
  });

  it("案例 05 在系统开启减弱动效时不为回放标记设置定时过渡", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockImplementation((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } satisfies MediaQueryList)));

    render(<HospitalTransferWorkbench {...transferProps()} />);

    const replayMarker = screen.getByLabelText(/回放位置：第/);
    expect(replayMarker.style.transition).not.toMatch(/(?:^|\s|,)\w+\s+[1-9]\d*(?:ms|s)/);
  });

  it("案例 08 对越界 pH 现场读数失败关闭且不提交回传命令", () => {
    const selected = aquacultureProjection(
      "CN-AQ-02-038",
      "CN-POND-02",
      "2026-06-02T13:00:00+08:00",
      {
        state: "现场取证中",
        version: 1,
        task: {
          dispatch: {
            eventId: "CN-AQ-02-038",
            regionId: "CN-POND-02",
            fieldOperatorId: "AQ-FIELD-02",
            note: "复测四项水质读数并登记现场照片",
            evidenceIssue: "value_conflict",
            requiredEvidence: ["temperature_c", "dissolved_oxygen_mg_l", "ph", "turbidity_ntu", "field_photo"],
            createdBy: "case08-field-dispatcher",
          },
        },
      },
    );
    const onCommand = vi.fn();
    render(<AquacultureResponseWorkbench {...aquacultureProps(selected, {
      actorRole: "field_operator",
      commands: [{ id: "submit_field_return", label: "提交现场回传", tone: "primary" }],
      onCommand,
    })} />);

    expect(screen.getByLabelText("现场回传人员")).toHaveValue("AQ-FIELD-02");
    fireEvent.change(screen.getByLabelText("采集时间"), { target: { value: "2026-07-26T09:00" } });
    fireEvent.change(screen.getByLabelText("现场照片资产号"), { target: { value: "PHOTO-CN-AQ-02-038" } });
    fireEvent.change(screen.getByLabelText("现场水温"), { target: { value: "31.20" } });
    fireEvent.change(screen.getByLabelText("现场溶解氧"), { target: { value: "5.40" } });
    fireEvent.change(screen.getByLabelText("现场 pH"), { target: { value: "20" } });
    fireEvent.change(screen.getByLabelText("现场浊度"), { target: { value: "8.10" } });

    expect(screen.getByText("pH 应在 0–14 之间")).toBeVisible();
    const submit = screen.getByRole("button", { name: "提交现场回传" });
    expect.soft(submit).toBeDisabled();
    fireEvent.click(submit);
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("案例 08 点击塘位时选择该塘按事件时间排序的最新对象", () => {
    const selected = aquacultureProjection(
      "CN-AQ-02-010",
      "CN-POND-02",
      "2026-06-02T10:00:00+08:00",
    );
    const oldPondEvent = aquacultureProjection(
      "CN-AQ-01-001",
      "CN-POND-01",
      "2026-06-02T08:00:00+08:00",
    );
    const latestPondEvent = aquacultureProjection(
      "CN-AQ-01-002",
      "CN-POND-01",
      "2026-06-02T14:00:00+08:00",
    );
    const onSelect = vi.fn();

    render(<AquacultureResponseWorkbench {...aquacultureProps(selected, {
      objects: [selected, oldPondEvent, latestPondEvent],
      sceneRows: [selected.payload, oldPondEvent.payload, latestPondEvent.payload],
      onSelect,
    })} />);

    fireEvent.click(screen.getByRole("button", { name: "查看异常与 96 小时趋势" }));
    const details = screen.getByRole("dialog", { name: "异常队列与 96 小时趋势" });
    fireEvent.change(within(details).getByLabelText("按塘位选择最新事件"), { target: { value: "CN-POND-01" } });

    expect(onSelect).toHaveBeenCalledWith(latestPondEvent.objectId);
  });

  it("案例 08 保留三身份隔离和三栏取证布局", () => {
    const selected = aquacultureProjection("CN-AQ-02-038", "CN-POND-02", "2026-06-02T13:00:00+08:00");
    render(<AquacultureResponseWorkbench {...aquacultureProps(selected)} />);

    const role = screen.getByLabelText("当前操作角色");
    expect(within(role).getByRole("option", { name: "值班调度" })).toHaveValue("dispatcher");
    expect(within(role).getByRole("option", { name: "现场人员" })).toHaveValue("field_operator");
    expect(within(role).getByRole("option", { name: "主管" })).toHaveValue("supervisor");
    expect(screen.getByRole("region", { name: "系统记录" })).toBeVisible();
    expect(screen.getByRole("region", { name: "现场回传" })).toHaveTextContent("等待派发现场取证");
    expect(screen.getByRole("region", { name: "主管采信" })).toHaveTextContent("现场回传后解锁");
  });
});
