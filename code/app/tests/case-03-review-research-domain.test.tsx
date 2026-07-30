// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { CaseEvent, CaseProjection } from "@course-ai-product/case-runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getCaseDefinition } from "../../cases/registry";
import { ReviewResearchWorkbench } from "../src/components/workbenches/case-specific/ReviewResearchWorkbench";
import type { CaseWorkbenchProps } from "../src/components/workbenches/case-specific/types";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function review(
  id: string,
  content: string,
  hospitality: number,
  state = "待研判",
): CaseProjection {
  return {
    caseId: "03",
    objectId: `03-${id}`,
    state,
    version: state === "待研判" ? 0 : 1,
    payload: {
      id,
      review: content,
      star: hospitality < 0 ? "1" : "5",
      "Service#Hospitality": String(hospitality),
      "Service#Queue": "0",
      "Service#Timely": "0",
      "Food#Taste": "0",
      source_id: "DATA-03",
    },
    updatedAt: "2026-07-26T08:00:00.000Z",
  };
}

const selected = review("5353", "叫了四五个服务员都说没空，后来还拿着单子质问我们。", -1);
const supporting = review("5354", "服务员态度冷淡，询问时一直说没空。", -1);
const counter = review("1948", "服务员主动处理问题，服务还不错。", 1);
const objects = [selected, supporting, counter];

function props(overrides: Partial<CaseWorkbenchProps> = {}): CaseWorkbenchProps {
  return {
    definition: getCaseDefinition("03")!,
    objects,
    selected,
    events: [],
    metrics: [],
    datasetRowCount: 6970,
    sceneRows: objects.map((item) => item.payload),
    supportingArtifacts: {},
    actorRole: "operator",
    roles: ["operator", "supervisor"],
    commands: [{ id: "create_validation_task", label: "创建需求验证单", tone: "primary" }],
    busy: false,
    onActorRoleChange: vi.fn(),
    onCommand: vi.fn(),
    onReset: vi.fn(),
    onSelect: vi.fn(),
    ...overrides,
  };
}

describe("case 03 review research domain task", () => {
  it("gates required fields and submits a typed, evidence-linked, idempotent validation task", () => {
    const onCommand = vi.fn();
    render(<ReviewResearchWorkbench {...props({ onCommand })} />);
    const panel = screen.getByRole("complementary", { name: "主题摘要与验证" });
    const submit = within(panel).getByRole("button", { name: "提交结构化验证任务" });

    expect(submit).toBeDisabled();
    expect(within(panel).getByLabelText(/review:5353/)).toBeChecked();
    expect(within(panel).getByLabelText(/review:1948/)).toBeChecked();

    fireEvent.change(within(panel).getByLabelText("样本规模"), { target: { value: "24" } });
    fireEvent.change(within(panel).getByLabelText("负责人"), { target: { value: "林研究员" } });
    fireEvent.change(within(panel).getByLabelText("期限"), { target: { value: "2026-08-15" } });
    fireEvent.change(within(panel).getByLabelText("什么结果算问题成立"), { target: { value: "24 条样本中同类负向信号占比达到 30%" } });
    expect(submit).toBeEnabled();

    fireEvent.click(submit);
    expect(onCommand).toHaveBeenCalledWith(
      "create_validation_task",
      "接待态度负向体验是否会在同主题样本中稳定重复出现？",
      expect.objectContaining({
        data: expect.objectContaining({
          taskId: "RR-5353-Service-Hospitality",
          aspectKey: "Service#Hospitality",
          supportEvidenceIds: ["review:5353"],
          counterEvidenceIds: ["review:1948"],
          sampleSize: 24,
          owner: "林研究员",
          dueDate: "2026-08-15",
          observationWindow: "连续 14 天",
          successCriteria: "24 条样本中同类负向信号占比达到 30%",
        }),
        evidenceIds: ["review:5353", "review:1948"],
        idempotencyKey: "case-03:03-5353:create_validation_task:v0",
      }),
    );

    fireEvent.click(within(panel).getByLabelText(/review:1948/));
    expect(submit).toBeDisabled();
  });

  it("merges selected.task with historical event data before supervisor acceptance or archive", () => {
    const pending: CaseProjection = {
      ...selected,
      state: "待验证",
      version: 1,
      task: {
        owner: "周研究员",
        dueDate: "2026-08-20",
        observationWindow: "连续 21 天",
        successCriteria: "同类信号达到预设阈值且访谈出现一致证词",
      },
    };
    const event: CaseEvent = {
      eventId: "evt-case-03-create",
      caseId: "03",
      objectId: pending.objectId,
      command: "create_validation_task",
      actor: { id: "operator", role: "operator" },
      fromState: "待研判",
      toState: "待验证",
      version: 1,
      evidenceIds: ["review:5353", "review:1948"],
      data: {
        taskId: "RR-5353-Service-Hospitality",
        aspectKey: "Service#Hospitality",
        aspectLabel: "接待态度",
        supportEvidenceIds: ["review:5353"],
        counterEvidenceIds: ["review:1948"],
        testableQuestion: "接待态度负向体验是否会在同主题样本中稳定重复出现？",
        researchMethod: "评论分层复核 + 半结构化访谈",
        sampleSize: 36,
      },
      occurredAt: "2026-07-26T09:00:00.000Z",
    };
    const onCommand = vi.fn();
    const onActorRoleChange = vi.fn();
    render(<ReviewResearchWorkbench {...props({
      selected: pending,
      objects: [pending, supporting, counter],
      events: [event],
      actorRole: "supervisor",
      commands: [
        { id: "accept_backlog", label: "排入验证队列", tone: "secondary" },
        { id: "archive_signal", label: "归档弱信号", tone: "secondary" },
      ],
      onActorRoleChange,
      onCommand,
    })} />);
    const panel = screen.getByRole("complementary", { name: "主题摘要与验证" });

    expect(within(panel).getByText("周研究员 · 2026-08-20")).toBeVisible();
    expect(within(panel).getByText("36 条 · 连续 21 天")).toBeVisible();
    expect(within(panel).getByText("review:1948")).toBeVisible();
    const accept = within(panel).getByRole("button", { name: "安排这项调查" });
    const archive = within(panel).getByRole("button", { name: "暂不安排这项调查" });
    expect(accept).toBeDisabled();
    expect(archive).toBeDisabled();

    fireEvent.change(within(panel).getByLabelText("主管处理说明"), { target: { value: "证据正反齐全，进入排期。" } });
    fireEvent.click(accept);
    expect(onCommand).toHaveBeenLastCalledWith(
      "accept_backlog",
      "证据正反齐全，进入排期。",
      expect.objectContaining({
        data: expect.objectContaining({
          taskId: "RR-5353-Service-Hospitality",
          supervisorDecision: "accepted",
          supervisorReason: "证据正反齐全，进入排期。",
          validationTask: expect.objectContaining({ owner: "周研究员", sampleSize: 36 }),
        }),
        evidenceIds: ["review:5353", "review:1948"],
      }),
    );

    fireEvent.change(within(panel).getByLabelText("主管处理说明"), { target: { value: "信号不足，保留证据后归档。" } });
    fireEvent.click(archive);
    expect(onCommand).toHaveBeenLastCalledWith(
      "archive_signal",
      "信号不足，保留证据后归档。",
      expect.objectContaining({ data: expect.objectContaining({ supervisorDecision: "archived" }) }),
    );

    fireEvent.change(screen.getByLabelText("当前操作角色"), { target: { value: "operator" } });
    expect(onActorRoleChange).toHaveBeenCalledWith("operator");
  });

  it("keeps a failed command recoverable through the persisted-object refresh hook", () => {
    const onSelect = vi.fn();
    render(<ReviewResearchWorkbench {...props({ error: "版本冲突，请刷新后继续。", onSelect })} />);

    expect(screen.getByRole("alert")).toHaveTextContent("版本冲突");
    expect(screen.getByText(/核对服务端持久化状态后再试/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /刷新当前记录/ }));
    expect(onSelect).toHaveBeenCalledWith("03-5353");
  });
});
