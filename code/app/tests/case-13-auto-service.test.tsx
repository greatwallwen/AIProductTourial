// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CaseProjection } from "@course-ai-product/case-runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getCaseDefinition } from "../../cases/registry";
import { AutoServiceTriageWorkbench } from "../src/components/workbenches/case-specific/AutoServiceTriageWorkbench";
import type { CaseWorkbenchProps } from "../src/components/workbenches/case-specific/types";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const categories = ["brake", "cooling", "steering", "electrical", "maintenance", "tire"];
const symptoms: Record<string, string> = {
  brake: "制动时出现异响",
  cooling: "发动机温度偏高",
  steering: "低速转向有抖动",
  electrical: "仪表提示蓄电池电压低",
  maintenance: "例行保养到期",
  tire: "轮胎换位后需复查",
};
const regions = ["华东", "华南", "华北", "西南"];
const rows = Array.from({ length: 24 }, (_, index) => {
  const category = categories[index % categories.length];
  const safety = !["maintenance", "tire"].includes(category);
  return {
    intake_id: `CN-AS-${String(index + 1).padStart(3, "0")}`,
    region: regions[index % regions.length],
    vehicle_class: index % 2 ? "轻型商用车" : "乘用车",
    symptom_text: symptoms[category],
    symptom_category: category,
    safety_review_required: safety,
    workflow_state: safety ? "待技师初检" : "待服务顾问核对",
    allowed_action: safety ? "handoff_to_technician" : "lookup_reference",
    automatic_repair_allowed: false,
    data_nature: "deterministic-synthetic-cn-operations",
  };
});
const objects: CaseProjection[] = rows.map((payload) => ({
  caseId: "13",
  objectId: `13-${payload.intake_id}`,
  state: "待分流",
  version: 0,
  payload,
  updatedAt: "2026-07-26T05:00:00.000Z",
}));
const selected = objects[0];

function props(overrides: Partial<CaseWorkbenchProps> = {}): CaseWorkbenchProps {
  return {
    definition: getCaseDefinition("13")!,
    objects,
    selected,
    events: [],
    metrics: [],
    datasetRowCount: 24,
    sceneRows: rows,
    supportingArtifacts: {},
    actorRole: "dispatcher",
    roles: ["dispatcher", "supervisor"],
    commands: [
      { id: "request_details", label: "保存并请求补充", tone: "secondary" },
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

function finishNormalAnswers() {
  fireEvent.click(screen.getByRole("button", { name: "回答：可以" }));
  fireEvent.click(screen.getByRole("button", { name: "回答：无" }));
  fireEvent.click(screen.getByRole("button", { name: "回答：低速制动" }));
  fireEvent.click(screen.getByRole("button", { name: "回答：首次出现" }));
}

describe("AutoServiceTriageWorkbench", () => {
  it("把当前客户问答作为唯一主任务，而不是展示管理概览", () => {
    render(<AutoServiceTriageWorkbench {...props()} />);

    expect(screen.getByRole("heading", { name: "接车通话与安全分流" })).toBeVisible();
    expect(screen.getByRole("complementary", { name: "来电列表" })).toBeVisible();
    expect(screen.getByRole("region", { name: "当前接车通话" })).toBeVisible();
    expect(screen.getByRole("complementary", { name: "接车事实单" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "车辆现在能否安全移动？" })).toBeVisible();
    expect(screen.getByText("“制动时出现异响”")).toBeVisible();
    expect(screen.queryByText("今日进线")).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /询问车辆是否/ })).not.toBeInTheDocument();
  });

  it("保存客户实际回答，并用同一字段合同更新已记录和仍缺少", () => {
    render(<AutoServiceTriageWorkbench {...props()} />);

    fireEvent.click(screen.getByRole("button", { name: "回答：不能" }));
    const dossier = screen.getByRole("complementary", { name: "接车事实单" });
    expect(within(dossier).getByText("车辆移动状态").parentElement).toHaveTextContent("不能");
    expect(within(dossier).getByText("已记录 3 项")).toBeVisible();
    expect(within(dossier).getByText("仍缺少 3 项")).toBeVisible();
    expect(screen.getByRole("heading", { name: "仪表是否出现警示？" })).toBeVisible();
  });

  it("把未回答问题保存为可执行的补充请求", () => {
    const onCommand = vi.fn();
    render(<AutoServiceTriageWorkbench {...props({ onCommand })} />);

    fireEvent.click(screen.getByRole("button", { name: "回答：可以" }));
    fireEvent.click(screen.getByRole("button", { name: "保存并请求补充" }));

    expect(onCommand).toHaveBeenCalledWith(
      "request_details",
      "等待客户补充 3 项回答",
      expect.objectContaining({
        actorId: "case13-service-dispatcher",
        data: expect.objectContaining({
          detailsRequest: expect.objectContaining({
            intakeId: "CN-AS-001",
            requestedQuestionIds: ["warning", "condition", "recurrence"],
          }),
          handoff: expect.objectContaining({
            answers: expect.objectContaining({
              drivable: { value: "can_move", label: "可以", source: "customer_answer" },
            }),
          }),
        }),
      }),
    );
  });

  it("完整问答后提交结构化技师交接", () => {
    const onCommand = vi.fn();
    render(<AutoServiceTriageWorkbench {...props({ onCommand })} />);
    const submit = screen.getByRole("button", { name: "转交技师安全复核" });
    expect(submit).toBeDisabled();

    finishNormalAnswers();
    fireEvent.click(screen.getByRole("checkbox", { name: /已向客户说明症状加重时停止行驶/ }));
    fireEvent.change(screen.getByLabelText("交接技师组"), { target: { value: "安全检视组" } });
    fireEvent.change(screen.getByLabelText("交接说明"), { target: { value: "客户回答已记录，请复核制动异响。" } });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    expect(onCommand.mock.calls[0][0]).toBe("submit_triage");
    expect(onCommand.mock.calls[0][2]).toMatchObject({
      data: {
        handoff: {
          intakeId: "CN-AS-001",
          answers: {
            drivable: { value: "can_move", label: "可以", source: "customer_answer" },
            warning: { value: "none", label: "无", source: "customer_answer" },
            condition: { value: "low_speed_braking", label: "低速制动", source: "customer_answer" },
            recurrence: { value: "first", label: "首次出现", source: "customer_answer" },
          },
          safetyNoticeAcknowledged: true,
          technician: "安全检视组",
          createdBy: "case13-service-dispatcher",
        },
      },
    });
  });

  it("客户回答不能移动时允许先转技师，再补非关键问题", () => {
    render(<AutoServiceTriageWorkbench {...props()} />);
    fireEvent.click(screen.getByRole("button", { name: "回答：不能" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /已向客户说明症状加重时停止行驶/ }));
    fireEvent.change(screen.getByLabelText("交接技师组"), { target: { value: "安全检视组" } });
    fireEvent.change(screen.getByLabelText("交接说明"), { target: { value: "客户表示车辆不能安全移动，先转技师。" } });

    expect(screen.getByText("已触发优先转交")).toBeVisible();
    expect(screen.getByRole("button", { name: "转交技师安全复核" })).toBeEnabled();
  });

  it("由不同的技师主管接收已保存交接", () => {
    const onCommand = vi.fn();
    const handoff = {
      intakeId: "CN-AS-001",
      answers: {
        drivable: { value: "cannot_move", label: "不能", source: "customer_answer" },
      },
      safetyNoticeAcknowledged: true,
      technician: "安全检视组",
      handoffWindow: "30 分钟内",
      note: "客户表示车辆不能安全移动，先转技师。",
      requestedQuestionIds: ["warning", "condition", "recurrence"],
      createdBy: "case13-service-dispatcher",
    };
    render(<AutoServiceTriageWorkbench {...props({
      actorRole: "supervisor",
      selected: { ...selected, state: "技师复核已提交", version: 1, task: { handoff } },
      commands: [{ id: "dispatch_rescue", label: "确认复核已接收", tone: "primary" }],
      onCommand,
    })} />);

    fireEvent.change(screen.getByLabelText("技师接收说明"), { target: { value: "安全检视组已接收，先电话核对车辆位置。" } });
    fireEvent.click(screen.getByRole("button", { name: "确认复核已接收" }));
    expect(onCommand).toHaveBeenCalledWith(
      "dispatch_rescue",
      "安全检视组已接收，先电话核对车辆位置。",
      expect.objectContaining({ actorId: "case13-technician-supervisor" }),
    );
  });

  it("首屏保持确定性，并给当前问题切换提供克制动效", () => {
    const source = readFileSync(resolve(process.cwd(), "src/components/workbenches/case-specific/AutoServiceTriageWorkbench.tsx"), "utf8");
    const css = readFileSync(resolve(process.cwd(), "src/components/workbenches/case-specific/AutoServiceTriageWorkbench.module.css"), "utf8");
    expect(source).not.toContain("Date.now(");
    expect(source).not.toContain("Math.random(");
    expect(source).not.toContain("typeof window");
    expect(source).not.toContain("new Date(");
    expect(source).toContain("suppressHydrationWarning");
    expect(css).toContain("height: 100%");
    expect(css).toContain("@keyframes questionIn");
    expect(css).toContain("prefers-reduced-motion");
  });
});
