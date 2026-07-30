// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CaseEvent, CaseProjection } from "@course-ai-product/case-runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getCaseDefinition } from "../../cases/registry";
import { TelecomRecoveryWorkbench } from "../src/components/workbenches/case-specific/TelecomRecoveryWorkbench";
import type { CaseWorkbenchProps } from "../src/components/workbenches/case-specific/types";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function projection(
  id: string,
  province: string,
  city: string,
  priority: string,
  scenario: string,
  category = "资费争议",
  state = "执行中",
): CaseProjection {
  return {
    caseId: "B010",
    objectId: `10-${id}`,
    state,
    version: state === "执行中" ? 0 : 1,
    payload: {
      task_id: id,
      received_at: "2025-07-01T09:17:00",
      category,
      subcategory: "合约套餐变更",
      province,
      city,
      channel: "互联网服务入口",
      priority,
      external_lookup_scenario: scenario,
      routing_queue: `${province}服务复核队列`,
      evidence_complete: "False",
      allegation_verified: "False",
      data_nature: "deterministic-synthetic-cn-operations",
    },
    updatedAt: "2026-07-25T08:00:00.000Z",
  };
}

const selected = projection("CN-TEL-2025Q2-0008", "福建", "福州", "关注", "committed_response_lost");
const second = projection("CN-TEL-2025Q2-0009", "广东", "广州", "高", "effect_status_unknown", "服务争议");
const safe = projection("CN-TEL-2025Q2-0010", "浙江", "杭州", "常规", "not_committed", "营销争议");

function readyProjection(): CaseProjection {
  return {
    ...selected,
    state: "恢复记录待确认",
    version: 2,
    task: {
      localRecoveryKey: "IK-2025Q2-0008-48f259d0",
      recoveryPlan: { lookupTarget: "计费中心", note: "核对套餐变更是否已经生效" },
      createdBy: "case10-recovery-coordinator",
      lookupResult: {
        status: "effective",
        summary: "查询材料显示原变更已存在，不重放原请求",
        evidenceId: "LOOKUP-2025Q2-0008",
        checkedBy: "case10-recovery-coordinator",
      },
    },
  };
}

const recordedResult: CaseEvent = {
  eventId: "evt-result-10",
  caseId: "B010",
  objectId: selected.objectId,
  command: "retry_idempotent",
  fromState: "外部效果待核对",
  toState: "恢复记录待确认",
  actor: { id: "case10-coordinator", role: "coordinator" },
  version: 2,
  occurredAt: "2026-07-25T08:12:00.000Z",
  reason: 'recovery-check:{"lookupTarget":"计费中心","recoveryWindow":"24 小时","note":"核对套餐变更是否已经生效","lookupResult":"effective","resultSummary":"查询材料显示原变更已存在，不重放原请求","evidenceId":"LOOKUP-2025Q2-0008"}',
  evidenceIds: ["lookup-evidence:LOOKUP-2025Q2-0008"],
};

function props(overrides: Partial<CaseWorkbenchProps> = {}): CaseWorkbenchProps {
  return {
    definition: getCaseDefinition("B010")!,
    objects: [selected, second, safe],
    selected,
    events: [],
    metrics: [],
    datasetRowCount: 1000,
    sceneRows: [],
    supportingArtifacts: {},
    actorRole: "coordinator",
    roles: ["coordinator", "supervisor"],
    commands: [{ id: "start_lookup", label: "进入恢复核查", tone: "secondary" }],
    busy: false,
    onActorRoleChange: vi.fn(),
    onCommand: vi.fn(),
    onReset: vi.fn(),
    onSelect: vi.fn(),
    ...overrides,
  };
}

describe("TelecomRecoveryWorkbench", () => {
  it("renders a forensic waterfall, four evidence slots and a gated result panel", () => {
    render(<TelecomRecoveryWorkbench {...props()} />);

    expect(screen.getByRole("heading", { name: "通信请求恢复核查" })).toBeVisible();
    expect(screen.getByRole("complementary", { name: "匿名恢复核查单目录" })).toBeVisible();
    expect(screen.getByRole("region", { name: "调用链路取证" })).toBeVisible();
    expect(screen.getByRole("region", { name: "证据对比矩阵" })).toBeVisible();
    expect(screen.getByRole("complementary", { name: "核对结果与完成条件" })).toBeVisible();
    expect(screen.getByText("本地系统")).toBeVisible();
    expect(screen.getByText("网络边界")).toBeVisible();
    expect(screen.getAllByText("外部效果未知").length).toBeGreaterThan(0);
    expect(screen.getByText("本地恢复关联键")).toBeVisible();
    expect(screen.getByText("1,000")).toBeVisible();
    expect(screen.queryByText("外部调用日志")).not.toBeInTheDocument();
    expect(screen.queryByText("操作历史")).not.toBeInTheDocument();
    expect(screen.queryByText(/^幂等键$/)).not.toBeInTheDocument();
  });

  it("filters the compact grouped directory and selects another task", () => {
    const onSelect = vi.fn();
    render(<TelecomRecoveryWorkbench {...props({ onSelect })} />);
    const directory = screen.getByRole("complementary", { name: "匿名恢复核查单目录" });

    fireEvent.click(within(directory).getByRole("button", { name: /效果未知/ }));
    expect(within(directory).getByRole("button", { name: /CN-TEL-2025Q2-0009/ })).toBeVisible();
    expect(within(directory).queryByRole("button", { name: /CN-TEL-2025Q2-0008/ })).not.toBeInTheDocument();

    fireEvent.click(within(directory).getByRole("button", { name: /CN-TEL-2025Q2-0009/ }));
    expect(onSelect).toHaveBeenCalledWith(second.objectId);

    fireEvent.click(within(directory).getByRole("button", { name: /尚未提交/ }));
    expect(within(directory).getByRole("button", { name: /CN-TEL-2025Q2-0010/ })).toBeVisible();
  });

  it("starts an external-effect lookup with the displayed local recovery key", () => {
    const onCommand = vi.fn();
    render(<TelecomRecoveryWorkbench {...props({ onCommand })} />);

    fireEvent.change(screen.getByLabelText("查询目标"), { target: { value: "计费中心" } });
    fireEvent.change(screen.getByLabelText("查询说明"), { target: { value: "只查询套餐变更是否已经生效，不重放原请求" } });
    fireEvent.click(screen.getByRole("button", { name: "发起外部效果查询" }));

    expect(onCommand).toHaveBeenCalledTimes(1);
    expect(onCommand.mock.calls[0][0]).toBe("start_lookup");
    const record = JSON.parse(String(onCommand.mock.calls[0][1]).replace("recovery-plan:", ""));
    expect(record).toMatchObject({ lookupTarget: "计费中心", lookupResult: "unknown" });
    const options = onCommand.mock.calls[0][2];
    expect(options.actorId).toBe("case10-recovery-coordinator");
    expect(options.data.localRecoveryKey).toMatch(/^IK-2025Q2-0008-/);
    expect(options.data.createdBy).toBe("case10-recovery-coordinator");
    expect(options.data.recoveryPlan).toEqual({
      lookupTarget: "计费中心",
      note: "只查询套餐变更是否已经生效，不重放原请求",
    });
    expect(options.idempotencyKey).toBe(`${options.data.localRecoveryKey}:start_lookup`);
    expect(options.evidenceIds).toContain(`task:${selected.payload.task_id}`);
  });

  it("requires a known result, summary and evidence number before recording a result", () => {
    const onCommand = vi.fn();
    const pending = { ...selected, state: "外部效果待核对", version: 1 };
    render(<TelecomRecoveryWorkbench {...props({
      selected: pending,
      objects: [pending, second, safe],
      commands: [{ id: "retry_idempotent", label: "记录外部核对结果", tone: "secondary" }],
      onCommand,
    })} />);

    const recordButton = screen.getByRole("button", { name: "记录外部核对结果" });
    expect(recordButton).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: "已生效" }));
    fireEvent.change(screen.getByLabelText("查询结果摘要"), { target: { value: "查询材料显示原变更已经存在，不重放原请求" } });
    expect(recordButton).toBeDisabled();
    fireEvent.change(screen.getByLabelText("证据编号"), { target: { value: "LOOKUP-2025Q2-0008" } });
    expect(recordButton).toBeEnabled();
    fireEvent.click(recordButton);

    expect(onCommand).toHaveBeenCalledTimes(1);
    expect(onCommand.mock.calls[0][0]).toBe("retry_idempotent");
    const result = JSON.parse(String(onCommand.mock.calls[0][1]).replace("recovery-check:", ""));
    expect(result).toMatchObject({
      lookupResult: "effective",
      resultSummary: "查询材料显示原变更已经存在，不重放原请求",
      evidenceId: "LOOKUP-2025Q2-0008",
    });
    const options = onCommand.mock.calls[0][2];
    expect(options.actorId).toBe("case10-recovery-coordinator");
    expect(options.data.localRecoveryKey).toMatch(/^IK-2025Q2-0008-/);
    expect(options.data.lookupResult).toEqual({
      status: "effective",
      summary: "查询材料显示原变更已经存在，不重放原请求",
      evidenceId: "LOOKUP-2025Q2-0008",
      checkedBy: "case10-recovery-coordinator",
    });
    expect(options.evidenceIds).toContain("LOOKUP-2025Q2-0008");
  });

  it("keeps an unknown result pending without pretending the existing contract persisted it", () => {
    const onCommand = vi.fn();
    const pending = { ...selected, state: "外部效果待核对", version: 1 };
    render(<TelecomRecoveryWorkbench {...props({
      selected: pending,
      objects: [pending, second, safe],
      commands: [
        { id: "retry_idempotent", label: "记录外部核对结果", tone: "secondary" },
        { id: "keep_pending", label: "保留待核对", tone: "secondary" },
      ],
      onCommand,
    })} />);

    expect(screen.getByRole("radio", { name: "仍未知" })).toBeChecked();
    fireEvent.change(screen.getByLabelText("查询结果摘要"), { target: { value: "查询仍未返回，等待补充可验证材料" } });
    fireEvent.click(screen.getByRole("button", { name: "保留待核对" }));

    expect(onCommand).toHaveBeenCalledTimes(1);
    expect(onCommand.mock.calls[0][0]).toBe("keep_pending");
    const pendingRecord = JSON.parse(String(onCommand.mock.calls[0][1]).replace("recovery-pending:", ""));
    expect(pendingRecord).toMatchObject({
      lookupResult: "unknown",
      resultSummary: "查询仍未返回，等待补充可验证材料",
    });
    const options = onCommand.mock.calls[0][2];
    expect(options.actorId).toBe("case10-recovery-coordinator");
    expect(options.data.localRecoveryKey).toMatch(/^IK-2025Q2-0008-/);
    expect(options.data.pendingReason).toBe("查询仍未返回，等待补充可验证材料");
    expect(screen.getByRole("button", { name: "关闭课程恢复核查" })).toBeDisabled();
  });

  it("restores the recorded result, exposes the supervisor gate and closes through the legacy command", () => {
    const onCommand = vi.fn();
    const ready = readyProjection();
    render(<TelecomRecoveryWorkbench {...props({
      selected: ready,
      objects: [ready, second, safe],
      events: [recordedResult],
      actorRole: "supervisor",
      commands: [{ id: "close_task", label: "完成恢复核查", tone: "primary" }],
      onCommand,
    })} />);

    expect(screen.getByRole("radio", { name: "已生效" })).toBeChecked();
    expect(screen.getByLabelText("查询结果摘要")).toHaveValue("查询材料显示原变更已存在，不重放原请求");
    expect(screen.getByLabelText("证据编号")).toHaveValue("LOOKUP-2025Q2-0008");
    expect(screen.getByText("角色分离").closest("li")).toHaveTextContent("业务主管");
    const close = screen.getByRole("button", { name: "关闭课程恢复核查" });
    expect(close).toBeEnabled();
    fireEvent.click(close);

    expect(onCommand).toHaveBeenCalledTimes(1);
    expect(onCommand.mock.calls[0][0]).toBe("close_task");
    expect(String(onCommand.mock.calls[0][1])).toContain("recovery-close:");
    const options = onCommand.mock.calls[0][2];
    expect(options.actorId).toBe("case10-recovery-supervisor");
    expect(options.data).toMatchObject({
      localRecoveryKey: "IK-2025Q2-0008-48f259d0",
      decisionBy: "case10-recovery-supervisor",
      closeNote: "查询材料显示原变更已存在，不重放原请求",
    });
    expect(options.evidenceIds).toContain("LOOKUP-2025Q2-0008");
  });

  it("resets local result fields when the selected object changes", () => {
    const ready = readyProjection();
    const { rerender } = render(<TelecomRecoveryWorkbench {...props({
      selected: ready,
      objects: [ready, second, safe],
      events: [recordedResult],
      commands: [],
    })} />);
    expect(screen.getByRole("radio", { name: "已生效" })).toBeChecked();

    rerender(<TelecomRecoveryWorkbench {...props({ selected: second, commands: [] })} />);
    expect(screen.getByRole("radio", { name: "仍未知" })).toBeChecked();
    expect(screen.getByLabelText("查询结果摘要")).toHaveValue("");
    expect(screen.getByLabelText("证据编号")).toHaveValue("");
  });

  it("keeps visible claims local and hydration markup deterministic", () => {
    render(<TelecomRecoveryWorkbench {...props()} />);
    expect(screen.getAllByText("投诉未核实").length).toBeGreaterThan(0);
    expect(screen.getByText(/当前页面不连接真实运营商系统/)).toBeVisible();
    expect(screen.queryByText(/运营商处理成功|投诉已解决|外部幂等键/)).not.toBeInTheDocument();

    const source = readFileSync(resolve(process.cwd(), "src/components/workbenches/case-specific/TelecomRecoveryWorkbench.tsx"), "utf8");
    expect(source).not.toContain("Date.now(");
    expect(source).not.toContain("Math.random(");
    expect(source).not.toContain("typeof window");
    expect(source).not.toContain("new Date(");
  });
});
