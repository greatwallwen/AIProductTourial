// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { CaseEvent, CaseProjection } from "@course-ai-product/case-runtime";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getCaseDefinition } from "../../cases/registry";
import { CreditMaterialWorkbench } from "../src/components/workbenches/case-specific/CreditMaterialWorkbench";
import type { CaseWorkbenchProps } from "../src/components/workbenches/case-specific/types";

afterEach(cleanup);

function row(index: number, overrides: Record<string, unknown> = {}) {
  return {
    application_id: `CR2026${String(index).padStart(7, "0")}`,
    application_at: `2026-04-${String((index % 27) + 1).padStart(2, "0")}T08:47:00+08:00`,
    province_name: "四川省",
    city_name: index === 20 ? "杭州市" : "成都市",
    customer_segment: index % 2 ? "new_customer" : "returning_customer",
    channel: "客户经理",
    requested_amount_fen: String(300000 + index * 1000),
    declared_income_band: "5000-7999",
    identity_verification_status: "verified",
    income_evidence_status: index === 1 ? "missing" : "complete",
    consent_status: "confirmed",
    application_consistency: "consistent",
    debt_service_ratio_bps: "4315",
    data_nature: "deterministic_synthetic",
    ...overrides,
  };
}

function projection(payload: Record<string, unknown>, state = "待复核", version = 0): CaseProjection {
  return {
    caseId: "04",
    objectId: `04-${String(payload.application_id)}`,
    state,
    version,
    payload,
    updatedAt: "2026-07-27T08:00:00.000Z",
  };
}

const objects = Array.from({ length: 20 }, (_, index) => projection(row(index + 1)));

function props(overrides: Partial<CaseWorkbenchProps> = {}): CaseWorkbenchProps {
  return {
    definition: getCaseDefinition("04")!,
    objects,
    selected: objects[0]!,
    events: [],
    metrics: [],
    datasetRowCount: 1200,
    sceneRows: objects.map((item) => item.payload),
    supportingArtifacts: {},
    actorRole: "reviewer",
    roles: ["reviewer", "supervisor"],
    commands: [{ id: "request_material", label: "创建补件任务", tone: "secondary" }],
    busy: false,
    onActorRoleChange: vi.fn(),
    onCommand: vi.fn(),
    onReset: vi.fn(),
    onSelect: vi.fn(),
    ...overrides,
  };
}

describe("Case 04 V5 申请材料补正与双岗复核", () => {
  it("以匿名材料槽和当前任务构成案卷桌面", () => {
    render(<CreditMaterialWorkbench {...props()} />);

    expect(screen.getByRole("heading", { name: "申请材料补正与双岗复核" })).toBeVisible();
    expect(screen.getByRole("region", { name: "匿名材料槽" })).toBeVisible();
    expect(screen.getByRole("complementary", { name: "当前补件任务" })).toBeVisible();
    expect(screen.queryByText(/身份证号|手机号|姓名|信用分|违约概率|建议授信|自动通过|拒贷/)).not.toBeInTheDocument();
    expect(screen.queryByText(/上传附件|拖拽文件|身份证（正反面）/)).not.toBeInTheDocument();
  });

  it("可以搜索并到达默认切片之外的第 13 条和末条申请", () => {
    render(<CreditMaterialWorkbench {...props()} />);
    const queue = screen.getByRole("complementary", { name: "申请案卷队列" });
    const search = within(queue).getByRole("searchbox", { name: "搜索申请编号或城市" });

    fireEvent.change(search, { target: { value: "CR20260000013" } });
    expect(within(queue).getByRole("button", { name: /CR20260000013/ })).toBeVisible();
    fireEvent.change(search, { target: { value: "杭州市" } });
    expect(within(queue).getByRole("button", { name: /CR20260000020/ })).toBeVisible();
    expect(within(queue).getByText("已加载 20 / 数据 1,200")).toBeVisible();
  });

  it("只允许为源记录中真实缺失的材料创建补件任务", () => {
    render(<CreditMaterialWorkbench {...props()} />);
    const task = screen.getByRole("complementary", { name: "当前补件任务" });

    expect(within(task).getByRole("checkbox", { name: /身份材料/ })).toBeDisabled();
    expect(within(task).getByRole("checkbox", { name: /收入材料/ })).toBeEnabled();
    expect(within(task).getByRole("checkbox", { name: /授权材料/ })).toBeDisabled();
    expect(within(task).getByRole("checkbox", { name: /申请信息一致性/ })).toBeDisabled();
  });

  it("只恢复当前申请的事件，切换对象不会继承其他案卷草稿", () => {
    const foreignEvent: CaseEvent = {
      eventId: "evt-foreign-request",
      caseId: "04",
      objectId: objects[1]!.objectId,
      command: "request_material",
      actor: { id: "foreign-reviewer", role: "reviewer" },
      fromState: "待复核",
      toState: "待补件",
      version: 1,
      evidenceIds: ["application:CR20260000002"],
      data: {
        requestedMaterials: ["income"],
        assignee: "外部案卷负责人",
        dueAt: "2026-09-01",
        requestNote: "这是另一个申请的补件任务。",
        requesterId: "foreign-reviewer",
      },
      occurredAt: "2026-07-27T08:10:00.000Z",
    };
    const view = render(<CreditMaterialWorkbench {...props({ events: [foreignEvent] })} />);

    expect(screen.queryByText("外部案卷负责人 · 2026-09-01")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("补件说明"), { target: { value: "当前案卷尚未保存的草稿说明" } });
    view.rerender(<CreditMaterialWorkbench {...props({ selected: objects[1]!, events: [foreignEvent] })} />);
    expect(screen.queryByDisplayValue("当前案卷尚未保存的草稿说明")).not.toBeInTheDocument();
    expect(screen.getByText("外部案卷负责人 · 2026-09-01")).toBeVisible();
  });

  it("发现共享回传命令时逐项提交匿名来源回执", () => {
    const pending: CaseProjection = {
      ...objects[0]!,
      state: "待补件",
      version: 1,
      task: {
        requestedMaterials: ["income"],
        assignee: "客户材料岗",
        dueAt: "2026-08-01",
        requestNote: "请补充收入来源材料。",
        requesterId: "credit-reviewer-01",
      },
    };
    const onCommand = vi.fn();
    render(<CreditMaterialWorkbench {...props({
      selected: pending,
      objects: [pending, ...objects.slice(1)],
      commands: [
        { id: "record_material_return", label: "记录材料回传", tone: "secondary" },
        { id: "start_human_review", label: "进入人工复核", tone: "primary" },
      ],
      onCommand,
    })} />);

    fireEvent.change(screen.getByLabelText("匿名材料来源"), { target: { value: "bank-statement-channel" } });
    fireEvent.change(screen.getByLabelText("材料回执编号"), { target: { value: "RET-2026-0001" } });
    fireEvent.change(screen.getByLabelText("回传操作身份"), { target: { value: "credit-material-01" } });
    fireEvent.click(screen.getByRole("button", { name: "记录材料回传" }));

    expect(onCommand).toHaveBeenCalledWith(
      "record_material_return",
      "收入材料回传：RET-2026-0001",
      {
        actorId: "credit-material-01",
        idempotencyKey: `credit-material:${pending.objectId}:${pending.version}:return:income:RET-2026-0001`,
        evidenceIds: ["returned-material:income", "return-receipt:RET-2026-0001"],
        data: {
          materialKey: "income",
          sourceRef: "bank-statement-channel",
          receiptId: "RET-2026-0001",
          returnActorId: "credit-material-01",
          materialStatus: {
            income: "received",
          },
          returnReceipts: {
            income: {
              sourceRef: "bank-statement-channel",
              receiptId: "RET-2026-0001",
              actorId: "credit-material-01",
            },
          },
        },
      },
    );
  });

  it("关闭持续动效并保持服务端渲染确定性", () => {
    const stylesheet = readFileSync(resolve(
      process.cwd(),
      "src/components/workbenches/case-specific/CreditMaterialWorkbench.module.css",
    ), "utf8");
    const source = readFileSync(resolve(
      process.cwd(),
      "src/components/workbenches/case-specific/CreditMaterialWorkbench.tsx",
    ), "utf8");

    expect(stylesheet).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    expect(stylesheet).not.toMatch(/animation-iteration-count:\s*infinite/);
    expect(source).not.toMatch(/Date\.now\(|Math\.random\(|typeof window|new Date\(/);
  });
});
