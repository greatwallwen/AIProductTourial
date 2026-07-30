// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CaseEvent, CaseProjection } from "@course-ai-product/case-runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getCaseDefinition } from "../../cases/registry";
import { RetailArchitectureWorkbench } from "../src/components/workbenches/case-specific/RetailArchitectureWorkbench";
import type { CaseWorkbenchProps } from "../src/components/workbenches/case-specific/types";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const facilityCode = "CN-FC-COURSE-01";
const facilityLabel = "中国前置仓课程场景";
const selectedDate = "2026-07-14";
const windowId = `${facilityCode}:${selectedDate}`;

function order(id: string, state = "待评审", version = 0): CaseProjection {
  return {
    caseId: "B007",
    objectId: `07-${id}`,
    state,
    version,
    payload: {
      order_id: id,
      day_index: "1",
      arrival_minute: "600.0474",
      item_count: "8",
      item_ids_preview: "I0046;I0483;I0544",
      is_observed_production_order: "False",
      data_nature: "public-benchmark-derived",
    },
    updatedAt: "2026-07-25T08:00:00.000Z",
  };
}

const selected = order("D01-O3173");
const other = order("D01-O3174");
const domainSeeds = [
  { domain: "订单接入", owner: "订单平台组", requests: 8200, requestStep: 137, latency: 148, latencyStep: 4, releases: 0, incidents: 0, recovery: 0 },
  { domain: "库存", owner: "库存平台组", requests: 7900, requestStep: 126, latency: 228, latencyStep: 9, releases: 0, incidents: 0, recovery: 1 },
  { domain: "履约", owner: "履约平台组", requests: 6100, requestStep: 115, latency: 512, latencyStep: 31, releases: 1, incidents: 1, recovery: 3 },
  { domain: "配送交接", owner: "配送平台组", requests: 4800, requestStep: 104, latency: 320, latencyStep: 13, releases: 0, incidents: 0, recovery: 2 },
] as const;

const evidence = Array.from({ length: 14 }, (_, index) => {
  const day = index + 1;
  return domainSeeds.map((seed) => {
    const isLast = day === 14;
    const exact = isLast ? {
      订单接入: [9981, 202, 2, 0, 0],
      库存: [9538, 351, 1, 3, 12],
      履约: [7595, 912, 4, 11, 39],
      配送交接: [6152, 487, 1, 2, 20],
    }[seed.domain] : undefined;
    return {
      facility_code: facilityCode,
      facility_label: facilityLabel,
      scenario_date: `2026-07-${String(day).padStart(2, "0")}`,
      domain: seed.domain,
      owner_team: seed.owner,
      request_count: String(exact?.[0] ?? seed.requests + seed.requestStep * index),
      p95_latency_ms: String(exact?.[1] ?? seed.latency + seed.latencyStep * index),
      release_count: String(exact?.[2] ?? seed.releases + (index > 7 ? 1 : 0)),
      incident_minutes: String(exact?.[3] ?? seed.incidents + Math.floor(index / 3)),
      recovery_minutes: String(exact?.[4] ?? seed.recovery + Math.floor(index * 2.5)),
      data_nature: "deterministic-synthetic-cn-operations",
    };
  });
}).flat();

const reviewWindow = {
  windowId,
  facilityCode,
  facilityLabel: "中国前置仓运行样本",
  scenarioDate: selectedDate,
  focusDomain: "履约",
};

const selectedEvidence = [
  {
    id: `ops:${facilityCode}:${selectedDate}:订单接入`,
    source: "synthetic-domain-record",
    domain: "订单接入",
    requestCount: 9981,
    p95LatencyMs: 202,
    releaseCount: 2,
    incidentMinutes: 0,
    recoveryMinutes: 0,
  },
  {
    id: `ops:${facilityCode}:${selectedDate}:履约`,
    source: "synthetic-domain-record",
    domain: "履约",
    requestCount: 7595,
    p95LatencyMs: 912,
    releaseCount: 4,
    incidentMinutes: 11,
    recoveryMinutes: 39,
  },
];

const hypothesis = "履约域发布增加与恢复变慢同窗出现，但仍需调用链与容量证据核对原因。";
const adr = {
  adrId: "ADR-07-CN-FC-COURSE-01-2026-07-14",
  context: "中国前置仓运行样本 · 2026-07-14 · 履约",
  status: "proposed" as const,
};

const commandEvidenceIds = [
  "public-order-slice:DATA-07",
  `ops:${facilityCode}:${selectedDate}`,
  "source-boundary:public-plus-synthetic",
];
const verifiedTask = {
  reviewWindow,
  selectedEvidence,
  missingObservability: ["调用链", "容量曲线", "变更影响"],
  facts: ["synthetic-domain-record", "source-boundary"],
  hypotheses: [hypothesis],
  constraints: ["release-coupling", "operability"],
  risks: ["replay", "rollback"],
  adr,
  createdBy: "case07-architecture-reviewer",
};

const completeContract = {
  eventName: "FulfillmentRequested.v1",
  producer: "订单接入",
  consumer: "履约",
  schemaVersion: "1.0.0",
  idempotencyField: "event_id",
  orderingKey: "order_id",
  replayPolicy: "按订单号重放，重复事件由幂等键拒绝",
  rollbackPlan: "关闭消费者并回退到同步调用",
  owner: "履约平台组",
  acceptanceCriteria: "正常、重复、乱序和重放回滚均通过",
};

function props(overrides: Partial<CaseWorkbenchProps> = {}): CaseWorkbenchProps {
  return {
    definition: getCaseDefinition("B007")!,
    objects: [selected, other],
    selected,
    events: [],
    metrics: [],
    datasetRowCount: 12000,
    sceneRows: [selected.payload, other.payload],
    supportingArtifacts: { "operational-evidence.csv": evidence },
    actorRole: "architect",
    roles: ["architect", "supervisor"],
    commands: [
      { id: "verify_evidence", label: "记录评审观察", tone: "secondary" },
      { id: "request_observability_evidence", label: "请求补观测", tone: "secondary" },
      { id: "keep_modular_monolith", label: "继续模块化观察", tone: "secondary" },
      { id: "start_event_contract_pilot", label: "批准单事件试点", tone: "primary" },
    ],
    busy: false,
    onActorRoleChange: vi.fn(),
    onCommand: vi.fn(),
    onReset: vi.fn(),
    onSelect: vi.fn(),
    ...overrides,
  };
}

function openTab(name: "观察" | "假设" | "决定") {
  fireEvent.click(screen.getByRole("tab", { name }));
}

describe("RetailArchitectureWorkbench", () => {
  it("renders the selected 14-day by four-domain evidence matrix without overstating the source", () => {
    render(<RetailArchitectureWorkbench {...props()} />);

    expect(screen.getByRole("heading", { name: "即时履约架构评审" })).toBeVisible();
    expect(screen.getByRole("region", { name: "发布与恢复耦合矩阵" })).toBeVisible();
    expect(screen.getAllByRole("button", { name: /选择评审日期 2026-07-/ })).toHaveLength(14);
    expect(within(screen.getByRole("table", { name: "14 天四领域评审矩阵" })).getAllByRole("row")).toHaveLength(5);
    expect(screen.getByText("CN-FC-COURSE-01 · 2026-07-14")).toBeVisible();
    expect(screen.getByText("9,981")).toBeVisible();
    expect(screen.getAllByText("912 ms").length).toBeGreaterThan(0);
    expect(screen.getAllByText("请求数")).toHaveLength(4);
    expect(screen.getByRole("columnheader", { name: "责任域 / 日期" })).toBeVisible();
    expect(document.querySelector('[title="2026-07-14 恢复分钟 71"]')).toBeInTheDocument();
    expect(within(screen.getByRole("complementary", { name: "评审窗口" })).getAllByText("到达时点（源值）").length).toBeGreaterThan(0);
    expect(document.body).not.toHaveTextContent(/到达量（源值）|恢复源值/);
    expect(screen.getByText("同窗出现")).toBeVisible();
    expect(screen.getByText("仍缺调用链")).toBeVisible();
    expect(screen.getByText("公开订单切片")).toBeVisible();
    expect(screen.getByText("合成运营记录")).toBeVisible();
    expect(screen.getByText(/不能证明调用链因果、拆分收益或生产 SLA/)).toBeVisible();
    expect(document.body).not.toHaveTextContent(/晚高峰|到达时点（分钟）|链路已证实|已部署|拆分收益已验证/);
  });

  it("moves the deterministic date cursor and changes metric emphasis", () => {
    render(<RetailArchitectureWorkbench {...props()} />);
    const firstDay = screen.getByRole("button", { name: "选择评审日期 2026-07-01" });
    fireEvent.click(firstDay);
    expect(firstDay).toHaveAttribute("aria-current", "date");
    expect(screen.getByText("CN-FC-COURSE-01 · 2026-07-01")).toBeVisible();
    expect(screen.getByText("8,200")).toBeVisible();
    const recovery = screen.getByRole("button", { name: "突出恢复" });
    fireEvent.click(recovery);
    expect(recovery).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("region", { name: "恢复分钟带" })).toHaveAttribute("data-emphasis", "recovery");
  });

  it("records a facility-and-date review window instead of an individual order", () => {
    const onCommand = vi.fn();
    render(<RetailArchitectureWorkbench {...props({ onCommand })} />);
    openTab("假设");
    fireEvent.change(screen.getByLabelText("可证伪假设"), { target: { value: hypothesis } });
    fireEvent.click(screen.getByRole("button", { name: "记录评审观察" }));

    expect(onCommand).toHaveBeenCalledWith("verify_evidence", hypothesis, {
      actorId: "case07-architecture-reviewer",
      idempotencyKey: `architecture-window:${windowId}:${selected.version}:verify`,
      evidenceIds: commandEvidenceIds,
      data: verifiedTask,
    });
  });

  it("creates an explicit observability request from a supervisor who did not author the review", () => {
    const reviewed: CaseProjection = { ...selected, state: "架构评审中", version: 1, task: verifiedTask };
    const onCommand = vi.fn();
    render(<RetailArchitectureWorkbench {...props({
      selected: reviewed,
      objects: [reviewed, other],
      actorRole: "supervisor",
      commands: [{ id: "request_observability_evidence", label: "请求补观测", tone: "secondary" }],
      onCommand,
    })} />);
    openTab("假设");
    const submit = screen.getByRole("button", { name: "请求补观测" });
    fireEvent.change(screen.getByLabelText("补观测请求人"), { target: { value: "case07-architecture-reviewer" } });
    fireEvent.change(screen.getByLabelText("补观测说明"), { target: { value: "补齐履约域跨服务调用链并对齐变更窗口。" } });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText("补观测请求人"), { target: { value: "architecture-lead-02" } });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    expect(onCommand).toHaveBeenCalledWith("request_observability_evidence", "补齐履约域跨服务调用链并对齐变更窗口。", {
      actorId: "architecture-lead-02",
      idempotencyKey: `architecture-window:${windowId}:${reviewed.version}:observability`,
      evidenceIds: commandEvidenceIds,
      data: {
        request: {
          adrId: adr.adrId,
          requestedSignals: ["调用链", "容量曲线", "变更影响"],
          reason: "补齐履约域跨服务调用链并对齐变更窗口。",
          requestedBy: "architecture-lead-02",
        },
      },
    });
  });

  it("restores only the selected runtime object and signs the window ADR", () => {
    const reviewed: CaseProjection = { ...selected, state: "架构评审中", version: 1, task: verifiedTask };
    const foreignEvent: CaseEvent = {
      eventId: "evt-foreign", caseId: "B007", objectId: other.objectId,
      command: "verify_evidence", actor: { id: "architect-x", role: "architect" },
      fromState: "待评审", toState: "架构评审中", version: 1,
      evidenceIds: [], data: { hypotheses: ["不应恢复的其他对象假设"] },
      occurredAt: "2026-07-26T09:00:00.000Z",
    };
    const onCommand = vi.fn();
    render(<RetailArchitectureWorkbench {...props({ selected: reviewed, objects: [reviewed, other], events: [foreignEvent], onCommand })} />);
    openTab("假设");
    expect(screen.getByLabelText("可证伪假设")).toHaveValue(hypothesis);
    openTab("决定");
    fireEvent.change(screen.getByLabelText("架构决策理由"), { target: { value: "继续收集两个发布窗口，先不增加跨进程复杂度。" } });
    fireEvent.change(screen.getByLabelText("架构决策签署人"), { target: { value: "architecture-lead-02" } });
    fireEvent.click(screen.getByRole("button", { name: "继续模块化观察" }));

    expect(onCommand).toHaveBeenCalledWith("keep_modular_monolith", "继续收集两个发布窗口，先不增加跨进程复杂度。", {
      actorId: "architecture-lead-02",
      idempotencyKey: `architecture-window:${windowId}:${reviewed.version}:modular_monolith`,
      evidenceIds: commandEvidenceIds,
      data: {
        reviewWindow,
        adr: { ...adr, status: "accepted", decision: "modular_monolith", rationale: "继续收集两个发布窗口，先不增加跨进程复杂度。" },
        signature: { signerId: "architecture-lead-02", statement: "同意继续模块化观察并承担后续复核" },
      },
    });
  });

  it("requires the minimal event contract and exposes the compact follow-up only after approval", () => {
    const reviewed: CaseProjection = { ...selected, state: "架构评审中", version: 1, task: verifiedTask };
    const onCommand = vi.fn();
    const { rerender } = render(<RetailArchitectureWorkbench {...props({ selected: reviewed, objects: [reviewed], onCommand })} />);
    openTab("决定");
    fireEvent.change(screen.getByLabelText("架构决策理由"), { target: { value: "仅在订单到履约链路验证一条可回退事件。" } });
    fireEvent.change(screen.getByLabelText("架构决策签署人"), { target: { value: "architecture-lead-02" } });
    expect(screen.getByRole("button", { name: "批准单事件试点" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("契约负责人"), { target: { value: completeContract.owner } });
    fireEvent.change(screen.getByLabelText("试点验收标准"), { target: { value: completeContract.acceptanceCriteria } });
    fireEvent.change(screen.getByLabelText("重放规则"), { target: { value: "按订单号处理重复消息并保持事件一致" } });
    fireEvent.change(screen.getByLabelText("回滚方案"), { target: { value: "发生故障时由负责人处理所有异常" } });
    expect(screen.getByRole("button", { name: "批准单事件试点" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("重放规则"), { target: { value: completeContract.replayPolicy } });
    expect(screen.getByRole("button", { name: "批准单事件试点" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("回滚方案"), { target: { value: completeContract.rollbackPlan } });
    expect(screen.getByRole("button", { name: "批准单事件试点" })).toBeEnabled();
    fireEvent.change(screen.getByLabelText("排序键"), { target: { value: completeContract.idempotencyField } });
    expect(screen.getByRole("button", { name: "批准单事件试点" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("排序键"), { target: { value: completeContract.orderingKey } });
    fireEvent.click(screen.getByRole("button", { name: "批准单事件试点" }));
    expect(onCommand).toHaveBeenCalledWith("start_event_contract_pilot", "仅在订单到履约链路验证一条可回退事件。", expect.objectContaining({
      idempotencyKey: `architecture-window:${windowId}:${reviewed.version}:event_contract_pilot`,
      data: expect.objectContaining({ reviewWindow, eventContract: completeContract }),
    }));

    const acceptedTask = {
      ...verifiedTask,
      adr: { ...adr, status: "accepted" as const, decision: "event_contract_pilot" as const, rationale: "仅在订单到履约链路验证一条可回退事件。" },
      eventContract: completeContract,
      signature: { signerId: "architecture-lead-02", statement: "同意批准单事件试点并承担验收复核" },
    };
    const accepted: CaseProjection = { ...selected, state: "事件契约试点", version: 2, task: acceptedTask };
    rerender(<RetailArchitectureWorkbench {...props({ selected: accepted, objects: [accepted] })} />);
    expect(screen.getByRole("region", { name: "已批准的单事件试点" })).toBeVisible();
    expect(screen.getByText("FulfillmentRequested.v1")).toBeVisible();
    expect(screen.getByText("正常 · 重复 · 乱序 · 重放回滚")).toBeVisible();
  });

  it("keeps markup deterministic and motion reducible", () => {
    const source = readFileSync(resolve(process.cwd(), "src/components/workbenches/case-specific/RetailArchitectureWorkbench.tsx"), "utf8");
    const css = readFileSync(resolve(process.cwd(), "src/components/workbenches/case-specific/RetailArchitectureWorkbench.module.css"), "utf8");
    expect(source).not.toMatch(/Date\.now\(|Math\.random\(|typeof window|new Date\(/);
    expect(css).toContain("prefers-reduced-motion: reduce");
  });
});
