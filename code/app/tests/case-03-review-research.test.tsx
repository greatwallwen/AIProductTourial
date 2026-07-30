// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CaseProjection } from "@course-ai-product/case-runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getCaseDefinition } from "../../cases/registry";
import { ReviewResearchWorkbench } from "../src/components/workbenches/case-specific/ReviewResearchWorkbench";
import type { CaseWorkbenchProps } from "../src/components/workbenches/case-specific/types";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function comment(
  id: string,
  review: string,
  labels: {
    queue: number;
    hospitality: number;
    timely: number;
    taste: number;
    star?: number;
  },
  state = "待研判",
): CaseProjection {
  return {
    caseId: "03",
    objectId: `03-${id}`,
    state,
    version: 0,
    payload: {
      id,
      split: "train",
      review,
      star: String(labels.star ?? 1),
      "Service#Queue": String(labels.queue),
      "Service#Hospitality": String(labels.hospitality),
      "Service#Timely": String(labels.timely),
      "Food#Taste": String(labels.taste),
      source_id: "DATA-03",
      data_nature: "public-derived",
    },
    updatedAt: "2026-07-25T08:00:00.000Z",
  };
}

const selected = comment(
  "5353",
  "今天去吃饭，叫了四五个服务员都说没空，西瓜汁等了半天也没上，后来服务员拿着单子过来质问我们。食物本身还可以。",
  { queue: -1, hospitality: -1, timely: -1, taste: 0 },
);

const queueNegative = comment(
  "31401",
  "人多得不行，也没个等号排队系统，后面又不按照先来后到的顺序发牌号。等了半天才开始上菜。",
  { queue: -1, hospitality: -2, timely: -1, taste: 0 },
);

const hospitalityPositive = comment(
  "1948",
  "菜的味道不理想，后来喊服务员回炉处理。虽然餐食品质一般，但是服务还不错。",
  { queue: -2, hospitality: 1, timely: -2, taste: -1 },
);

const weakSignal = comment(
  "33102",
  "服务很热情，主动介绍菜品，整体体验很好。",
  { queue: 0, hospitality: 1, timely: 0, taste: -2, star: 5 },
);

const objects = [selected, queueNegative, hospitalityPositive, weakSignal];

function props(overrides: Partial<CaseWorkbenchProps> = {}): CaseWorkbenchProps {
  return {
    definition: getCaseDefinition("03")!,
    objects,
    selected,
    events: [],
    metrics: [
      { id: "low-star", label: "低星评价", value: "3,586", note: "一星或二星评价" },
      { id: "service-negative", label: "服务负向", value: "1,936", note: "排队、接待或时效明确负向" },
      { id: "food-negative", label: "餐食负向", value: "2,335", note: "口味或推荐意愿明确负向" },
    ],
    datasetRowCount: 6970,
    sceneRows: objects.map((item) => item.payload),
    supportingArtifacts: {},
    actorRole: "operator",
    roles: ["operator", "supervisor"],
    commands: [{ id: "create_validation_task", label: "创建需求验证单", tone: "secondary" }],
    busy: false,
    onActorRoleChange: vi.fn(),
    onCommand: vi.fn(),
    onReset: vi.fn(),
    onSelect: vi.fn(),
    ...overrides,
  };
}

describe("ReviewResearchWorkbench", () => {
  it("turns a real Chinese review into a three-column evidence research workspace", () => {
    render(<ReviewResearchWorkbench {...props()} />);

    expect(screen.getByRole("heading", { name: "顾客评论研究室" })).toBeVisible();
    expect(screen.getByRole("complementary", { name: "主题与筛选" })).toBeVisible();
    expect(screen.getByRole("region", { name: "评论证据研究" })).toBeVisible();
    expect(screen.getByText("评论摘要")).toBeVisible();
    expect(screen.getByText("查看完整评论原文")).toBeVisible();
    expect(screen.getAllByText(selected.payload.review as string).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("complementary", { name: "主题摘要与验证" })).toBeVisible();
    expect(screen.getByText("研究判断")).toBeVisible();
    expect(screen.getByText(/标签用于找样本，不是普遍原因/)).toBeVisible();
    expect(screen.getByText("数据没有餐厅标识，不做门店排名")).toBeVisible();
    expect(screen.getAllByText("1,936").length).toBeGreaterThan(0);
    expect(screen.getAllByText("服务员", { selector: "mark" }).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("没空", { selector: "mark" }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("region", { name: "同主题评论对照" })).toBeVisible();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText(/满意度|转化率|路线图优先级/)).not.toBeInTheDocument();
  });

  it("filters by topic and raw text, then selects only a runtime-backed object", () => {
    const onSelect = vi.fn();
    render(<ReviewResearchWorkbench {...props({ onSelect })} />);
    const filters = screen.getByRole("complementary", { name: "主题与筛选" });

    fireEvent.click(within(filters).getByRole("button", { name: /排队/ }));
    expect(screen.getByText("主题摘要：排队")).toBeVisible();
    fireEvent.change(within(filters).getByLabelText("搜索评论原话"), { target: { value: "等号排队" } });
    const result = within(filters).getByRole("button", { name: /评论 #31401/ });
    fireEvent.click(result);

    expect(onSelect).toHaveBeenCalledWith("03-31401");
    expect(within(filters).queryByRole("button", { name: /评论 #5353/ })).not.toBeInTheDocument();
  });

  it("uses the runtime command and refresh hooks for creation, persisted state reload, and error recovery", () => {
    const onCommand = vi.fn();
    const onSelect = vi.fn();
    render(<ReviewResearchWorkbench {...props({
      error: "动作未执行，请检查服务状态后重试。",
      onCommand,
      onSelect,
    })} />);

    fireEvent.change(screen.getByLabelText("样本规模"), { target: { value: "24" } });
    fireEvent.change(screen.getByLabelText("负责人"), { target: { value: "林研究员" } });
    fireEvent.change(screen.getByLabelText("期限"), { target: { value: "2026-08-15" } });
    fireEvent.change(screen.getByLabelText("什么结果算问题成立"), {
      target: { value: "24 条访谈中至少 8 条再次提到接待态度问题" },
    });
    fireEvent.click(screen.getByRole("button", { name: "提交结构化验证任务" }));
    fireEvent.click(screen.getByRole("button", { name: /刷新当前记录/ }));

    expect(onCommand).toHaveBeenCalledWith(
      "create_validation_task",
      expect.stringContaining("接待态度"),
      expect.objectContaining({
        data: expect.objectContaining({ sampleSize: 24, owner: "林研究员" }),
      }),
    );
    expect(onSelect).toHaveBeenCalledWith("03-5353");
    expect(screen.getByRole("alert")).toHaveTextContent("动作未执行");
    expect(screen.getByText(/核对服务端持久化状态后再试/)).toBeVisible();
  });

  it("shows only the supervisor transitions supplied by the current runtime state", () => {
    const onCommand = vi.fn();
    const pending = {
      ...selected,
      state: "待验证",
      version: 1,
      task: {
        taskId: "RR-5353-Service-Hospitality",
        aspectKey: "Service#Hospitality",
        aspectLabel: "接待态度",
        supportEvidenceIds: ["review:5353"],
        counterEvidenceIds: ["review:1948"],
        testableQuestion: "接待态度负向体验是否会在同主题样本中稳定重复出现？",
        researchMethod: "评论分层复核 + 半结构化访谈",
        sampleSize: 24,
        owner: "林研究员",
        dueDate: "2026-08-15",
        observationWindow: "连续 14 天",
        successCriteria: "24 条访谈中至少 8 条再次提到接待态度问题",
      },
    };
    render(<ReviewResearchWorkbench {...props({
      selected: pending,
      objects: [pending, ...objects.slice(1)],
      actorRole: "supervisor",
      commands: [
        { id: "accept_backlog", label: "排入验证队列", tone: "secondary" },
        { id: "archive_signal", label: "归档弱信号", tone: "secondary" },
      ],
      onCommand,
    })} />);

    fireEvent.change(screen.getByLabelText("主管处理说明"), {
      target: { value: "先安排本周访谈核查" },
    });
    fireEvent.click(screen.getByRole("button", { name: "安排这项调查" }));
    fireEvent.click(screen.getByRole("button", { name: "暂不安排这项调查" }));
    expect(onCommand).toHaveBeenNthCalledWith(
      1,
      "accept_backlog",
      "先安排本周访谈核查",
      expect.objectContaining({ data: expect.objectContaining({ supervisorDecision: "accepted" }) }),
    );
    expect(onCommand).toHaveBeenNthCalledWith(
      2,
      "archive_signal",
      "先安排本周访谈核查",
      expect.objectContaining({ data: expect.objectContaining({ supervisorDecision: "archived" }) }),
    );
    expect(screen.queryByRole("button", { name: "提交结构化验证任务" })).not.toBeInTheDocument();
  });

  it("keeps server-rendered content free of runtime-dependent branches", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/workbenches/case-specific/ReviewResearchWorkbench.tsx"),
      "utf8",
    );
    expect(source).not.toContain("Date.now(");
    expect(source).not.toContain("Math.random(");
    expect(source).not.toContain("typeof window");
    expect(source).not.toContain("new Date(");
  });
});
