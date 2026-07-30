// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CaseEvent, CaseProjection } from "@course-ai-product/case-runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getCaseDefinition } from "../../cases/registry";
import { CreditMaterialWorkbench } from "../src/components/workbenches/case-specific/CreditMaterialWorkbench";
import type { CaseWorkbenchProps } from "../src/components/workbenches/case-specific/types";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function projection(id: string, income: "missing" | "complete", state = "待复核"): CaseProjection {
  return {
    caseId: "04",
    objectId: `04-${id}`,
    state,
    version: state === "待复核" ? 0 : 1,
    payload: {
      application_id: id,
      province_name: "四川省",
      city_name: "成都市",
      requested_amount_fen: id === "CR20260000001" ? "379919" : "4216031",
      application_at: "2026-04-01T08:47:00+08:00",
      identity_verification_status: "verified",
      income_evidence_status: income,
      consent_status: "confirmed",
      application_consistency: "consistent",
    },
    updatedAt: "2026-07-25T08:00:00.000Z",
  };
}

const selected = projection("CR20260000001", "missing");
const complete = projection("CR20260000049", "complete");

function props(overrides: Partial<CaseWorkbenchProps> = {}): CaseWorkbenchProps {
  return {
    definition: getCaseDefinition("04")!,
    objects: [selected, complete],
    selected,
    events: [],
    metrics: [],
    datasetRowCount: 1200,
    sceneRows: [selected.payload, complete.payload],
    supportingArtifacts: {},
    actorRole: "reviewer",
    roles: ["reviewer", "supervisor"],
    commands: [{ id: "request_material", label: "请求补件", tone: "secondary" }],
    busy: false,
    onActorRoleChange: vi.fn(),
    onCommand: vi.fn(),
    onReset: vi.fn(),
    onSelect: vi.fn(),
    ...overrides,
  };
}

describe("CreditMaterialWorkbench", () => {
  it("renders the three-column application dossier without an automatic credit decision", () => {
    render(<CreditMaterialWorkbench {...props()} />);

    expect(screen.getByRole("heading", { name: "申请材料补正与双岗复核" })).toBeVisible();
    expect(screen.getByRole("complementary", { name: "申请案卷队列" })).toBeVisible();
    expect(screen.getByRole("region", { name: "申请材料案卷" })).toBeVisible();
    expect(screen.getByRole("complementary", { name: "当前补件任务" })).toBeVisible();
    expect(screen.getAllByText("¥3,799.19").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("材料完整不等于授信结论")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "查看身份材料" }));
    expect(screen.getByText(/原始个人资料不进入工作台/)).toBeVisible();
  });

  it("requires a complete material request and submits the exact recoverable task", () => {
    const onCommand = vi.fn();
    render(<CreditMaterialWorkbench {...props({ onCommand })} />);
    const panel = screen.getByRole("complementary", { name: "当前补件任务" });
    const submit = within(panel).getByRole("button", { name: "请求补件" });

    expect(submit).toBeDisabled();
    fireEvent.change(within(panel).getByLabelText("补件说明"), {
      target: { value: "请补充近三个月收入材料并注明来源。" },
    });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    expect(onCommand).toHaveBeenCalledWith(
      "request_material",
      "请补充近三个月收入材料并注明来源。",
      {
        actorId: "credit-reviewer-01",
        idempotencyKey: `credit-material:${selected.objectId}:${selected.version}:request`,
        evidenceIds: ["application:CR20260000001"],
        data: {
          requestedMaterials: ["income"],
          assignee: "客户材料岗",
          dueAt: "2026-08-01",
          requestNote: "请补充近三个月收入材料并注明来源。",
          requesterId: "credit-reviewer-01",
        },
      },
    );
  });

  it("restores the task, requires every return, and blocks same-person review", () => {
    const pending: CaseProjection = {
      ...selected,
      state: "补件中",
      version: 1,
      payload: { ...selected.payload, consent_status: "not_confirmed" },
      task: {
        requestedMaterials: ["income", "consent"],
        assignee: "客户材料岗",
        dueAt: "2026-08-06",
        requestNote: "补充收入和授权材料。",
        requesterId: "credit-reviewer-01",
      },
    };
    const onCommand = vi.fn();
    render(<CreditMaterialWorkbench {...props({
      selected: pending,
      objects: [pending, complete],
      actorRole: "supervisor",
      commands: [{ id: "start_human_review", label: "进入人工复核", tone: "primary" }],
      onCommand,
    })} />);
    const panel = screen.getByRole("complementary", { name: "当前补件任务" });
    const submit = within(panel).getByRole("button", { name: "进入人工复核" });

    expect(within(panel).getByText("客户材料岗 · 2026-08-06")).toBeVisible();
    expect(submit).toBeDisabled();
    fireEvent.click(within(panel).getByRole("button", { name: /收入材料标记已回传/ }));
    expect(submit).toBeDisabled();
    fireEvent.click(within(panel).getByRole("button", { name: /授权材料标记已回传/ }));
    fireEvent.change(within(panel).getByLabelText("第二复核人员身份"), { target: { value: "credit-reviewer-01" } });
    fireEvent.click(within(panel).getByLabelText(/确认初审与第二复核不是同一身份/));
    fireEvent.change(within(panel).getByLabelText("第二身份复核说明"), {
      target: { value: "已核对材料来源及字段一致性。" },
    });
    expect(within(panel).getByRole("alert")).toHaveTextContent("不能与初审身份相同");
    expect(submit).toBeDisabled();

    fireEvent.change(within(panel).getByLabelText("第二复核人员身份"), { target: { value: "credit-reviewer-02" } });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    expect(onCommand).toHaveBeenCalledWith(
      "start_human_review",
      "已核对材料来源及字段一致性。",
      {
        actorId: "credit-reviewer-02",
        idempotencyKey: `credit-material:${pending.objectId}:${pending.version}:review`,
        evidenceIds: ["returned-material:income", "returned-material:consent"],
        data: {
          materialStatus: {
            identity: "received",
            income: "received",
            consent: "received",
            consistency: "received",
          },
          secondReviewerId: "credit-reviewer-02",
          reviewNote: "已核对材料来源及字段一致性。",
          separationConfirmed: true,
        },
      },
    );
  });

  it("recovers task data from events and keeps the refresh hook available on errors", () => {
    const pending = { ...selected, state: "补件中", version: 1 };
    const event: CaseEvent = {
      eventId: "evt-credit-material-request",
      caseId: "04",
      objectId: pending.objectId,
      command: "request_material",
      actor: { id: "credit-reviewer-03", role: "reviewer" },
      fromState: "待复核",
      toState: "补件中",
      version: 1,
      evidenceIds: ["application:CR20260000001"],
      data: {
        requestedMaterials: ["income"],
        assignee: "成都材料岗",
        dueAt: "2026-08-08",
        requestNote: "补充收入来源材料。",
        requesterId: "credit-reviewer-03",
      },
      occurredAt: "2026-07-26T09:00:00.000Z",
    };
    const onSelect = vi.fn();
    render(<CreditMaterialWorkbench {...props({
      selected: pending,
      objects: [pending, complete],
      events: [event],
      commands: [{ id: "start_human_review", label: "进入人工复核", tone: "primary" }],
      error: "申请版本已变化，请刷新后继续。",
      onSelect,
    })} />);
    const panel = screen.getByRole("complementary", { name: "当前补件任务" });

    expect(within(panel).getByText("成都材料岗 · 2026-08-08")).toBeVisible();
    fireEvent.click(within(panel).getByRole("button", { name: "刷新当前申请" }));
    expect(onSelect).toHaveBeenCalledWith(pending.objectId);
  });

  it("keeps server-rendered content deterministic", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/workbenches/case-specific/CreditMaterialWorkbench.tsx"),
      "utf8",
    );
    expect(source).not.toContain("Date.now(");
    expect(source).not.toContain("Math.random(");
    expect(source).not.toContain("typeof window");
    expect(source).not.toContain("new Date(");
  });
});
