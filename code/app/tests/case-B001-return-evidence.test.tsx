// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { CaseEvent, CaseProjection } from "@course-ai-product/case-runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getCaseDefinition } from "../../cases/registry";
import { ReturnEvidenceWorkbench } from "../src/components/workbenches/case-specific/ReturnEvidenceWorkbench";
import type { CaseWorkbenchProps } from "../src/components/workbenches/case-specific/types";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const claim = {
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

const candidateRows = [
  {
    invoice_id: "496015",
    stock_code: "M",
    description: "Manual",
    quantity: "1",
    invoice_at: "2010-01-20 10:20:00",
    customer_id: "C17949",
    line_amount_cny: "81768.96",
  },
  {
    invoice_id: "495901",
    stock_code: "M",
    description: "Manual",
    quantity: "1",
    invoice_at: "2010-01-10 08:15:00",
    customer_id: "C10001",
    line_amount_cny: "78000",
  },
];

function projection(
  state = "待核验",
  task?: Record<string, unknown>,
): CaseProjection {
  return {
    caseId: "B001",
    objectId: "B001-C496116-M",
    state,
    version: state === "待核验" ? 0 : 1,
    payload: claim,
    task,
    updatedAt: "2026-07-26T08:00:00.000Z",
  };
}

function props(overrides: Partial<CaseWorkbenchProps> = {}): CaseWorkbenchProps {
  const selected = projection();
  return {
    definition: getCaseDefinition("B001")!,
    objects: [selected],
    selected,
    events: [],
    metrics: [],
    datasetRowCount: 14794,
    sceneRows: [claim, ...candidateRows],
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

describe("ReturnEvidenceWorkbench", () => {
  it("requires an explicit candidate decision and sends a structured evidence request", () => {
    const onCommand = vi.fn();
    render(<ReturnEvidenceWorkbench {...props({ onCommand })} />);

    const create = screen.getByRole("button", { name: /^创建原单补证任务/ });
    expect(create).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "没有可确认原单" }));
    expect(screen.getByText("已记录：当前切片无可确认原单")).toBeVisible();
    expect(create).toBeEnabled();
    fireEvent.click(create);

    expect(onCommand).toHaveBeenCalledTimes(1);
    const [command, reason, options] = onCommand.mock.calls[0]!;
    expect(command).toBe("create_evidence_request");
    expect(reason).toContain("无可确认候选原单");
    expect(options.data).toEqual({
      candidateDecision: "no_match",
      requestedEvidence: ["original_order", "payment_record"],
      assignee: "财务对账",
      dueAt: "2026-07-29",
      requesterId: "case01-evidence-analyst",
    });
    expect(options.actorId).toBe("case01-evidence-analyst");
    expect(options.evidenceIds).toContain("candidate-decision:no-match");
  });

  it("compares one candidate at a time and persists the deliberate selection", () => {
    const onCommand = vi.fn();
    render(<ReturnEvidenceWorkbench {...props({ onCommand })} />);

    expect(screen.getByRole("region", { name: "原单核对镜头" })).toBeVisible();
    expect(screen.queryByRole("table", { name: "可能原单" })).not.toBeInTheDocument();
    const candidates = screen.getByRole("group", { name: "切换候选原单" });
    fireEvent.click(within(candidates).getByRole("button", { name: "选择候选原单 496015" }));
    expect(screen.getByText("已选择候选 496015")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "关闭" }));
    fireEvent.click(screen.getByRole("button", { name: /^创建原单补证任务/ }));

    const options = onCommand.mock.calls[0]?.[2];
    expect(options.data.candidateId).toBe("496015");
    expect(options.data.candidateDecision).toBeUndefined();
    expect(options.evidenceIds).toContain("candidate:496015");
  });

  it("shows explainable field checks and real evidence gaps without inventing an AI score", () => {
    render(<ReturnEvidenceWorkbench {...props()} />);

    const lens = screen.getByRole("region", { name: "原单核对镜头" });
    expect(within(lens).getByText("客户一致")).toBeVisible();
    expect(within(lens).getByText("商品一致")).toBeVisible();
    expect(within(lens).getByText("金额方向相反")).toBeVisible();
    expect(within(lens).getByText("缺少付款记录")).toBeVisible();
    expect(within(lens).getByText("缺少原单关系凭证")).toBeVisible();
    expect(screen.queryByText(/AI\s*评分|匹配率|置信度/)).not.toBeInTheDocument();
  });

  it("restores the task from the projection and blocks review until every requested item is received", () => {
    const selected = projection("待补证", {
      candidateId: "496015",
      requestedEvidence: ["original_order", "payment_record", "goods_relation"],
      assignee: "订单运营",
      dueAt: "2026-08-02",
      evidenceStatus: {
        original_order: "received",
        payment_record: "missing",
        goods_relation: "missing",
      },
    });
    const onCommand = vi.fn();
    render(<ReturnEvidenceWorkbench {...props({
      selected,
      objects: [selected],
      actorRole: "analyst",
      commands: [{ id: "submit_manual_review", label: "提交独立人工复核", tone: "secondary" }],
      onCommand,
    })} />);

    expect(screen.getByLabelText("补证负责人")).toHaveValue("订单运营");
    expect(screen.getByLabelText("补证负责人")).toBeDisabled();
    expect(screen.getByLabelText("补证期限")).toHaveValue("2026-08-02");
    const submit = screen.getByRole("button", { name: /^提交独立人工复核/ });
    expect(submit).toBeDisabled();

    const materials = screen.getByLabelText("补证材料");
    fireEvent.click(within(materials).getByRole("button", { name: /付款或结算凭证/ }));
    fireEvent.click(within(materials).getByRole("button", { name: /商品与取消单关系/ }));
    fireEvent.change(screen.getByLabelText("人工复核说明"), { target: { value: "原单、付款与商品关系材料均已回传。" } });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    const [command, reason, options] = onCommand.mock.calls[0]!;
    expect(command).toBe("submit_manual_review");
    expect(reason).toBe("原单、付款与商品关系材料均已回传。");
    expect(options.data).toEqual({
      evidenceStatus: {
        original_order: "received",
        payment_record: "received",
        goods_relation: "received",
        cancellation_reason: "missing",
      },
      reviewNote: "原单、付款与商品关系材料均已回传。",
    });
    expect(options.actorId).toBe("case01-evidence-analyst");
    expect(options.evidenceIds).toEqual([
      "returned-material:original_order",
      "returned-material:payment_record",
      "returned-material:goods_relation",
    ]);
  });

  it("can recover the request from event data when the projection task is absent", () => {
    const selected = projection("待补证");
    const event: CaseEvent = {
      eventId: "evt-01-request",
      caseId: "B001",
      objectId: selected.objectId,
      command: "create_evidence_request",
      actor: { id: "analyst-01", role: "analyst" },
      fromState: "待核验",
      toState: "待补证",
      version: 1,
      reason: "请求补证",
      evidenceIds: ["candidate:496015"],
      data: {
        candidateId: "496015",
        requestedEvidence: ["original_order", "payment_record"],
        assignee: "销售运营",
        dueAt: "2026-08-03",
      },
      occurredAt: "2026-07-26T08:10:00.000Z",
    };

    render(<ReturnEvidenceWorkbench {...props({
      selected,
      objects: [selected],
      events: [event],
      commands: [{ id: "submit_manual_review", label: "提交独立人工复核", tone: "secondary" }],
    })} />);

    expect(screen.getByText("已选择候选 496015")).toBeVisible();
    expect(screen.getByLabelText("补证负责人")).toHaveValue("销售运营");
    expect(screen.getByLabelText("补证期限")).toHaveValue("2026-08-03");
  });
});
