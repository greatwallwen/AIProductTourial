import { describe, expect, it } from "vitest";
import type { CaseProjection } from "@course-ai-product/case-runtime";
import { validateDomainCommand } from "../../cases/domain-command";

function projection(
  caseId: string,
  state: string,
  payload: Record<string, unknown>,
  task: Record<string, unknown> = {},
): CaseProjection {
  return {
    caseId,
    objectId: `${caseId}-OBJECT-1`,
    state,
    version: 1,
    payload,
    task,
    updatedAt: "2026-07-26T00:00:00.000Z",
  };
}

function validate(
  caseId: string,
  command: string,
  current: CaseProjection,
  data: Record<string, unknown>,
  actorId: string,
  evidenceIds: string[],
) {
  return () => validateDomainCommand({
    caseId,
    command,
    actorRole: command === "request_material" || command === "record_material_return" || command === "freeze_release_scope" || command === "verify_evidence"
      ? "reviewer"
      : "supervisor",
    actorId,
    idempotencyKey: `${caseId}:${command}:${current.version}`,
    evidenceIds,
    data,
    current,
  });
}

const creditPayload = {
  application_id: "CR20260000001",
  identity_verification_status: "verified",
  income_evidence_status: "missing",
  consent_status: "confirmed",
  application_consistency: "consistent",
};

describe("productized domain gates for cases 04, 06 and 07", () => {
  it("allows case 04 to request only real missing material and requires a separate reviewer", () => {
    const request = {
      requestedMaterials: ["income"],
      assignee: "客户材料岗",
      dueAt: "2026-08-01",
      requestNote: "请补充近三个月收入材料并注明来源。",
      requesterId: "credit-reviewer-01",
    };
    const initial = projection("B004", "待复核", creditPayload);
    expect(validate("B004", "request_material", initial, request, "credit-reviewer-01", [
      "application:CR20260000001",
    ])).not.toThrow();
    expect(validate("B004", "request_material", initial, {
      ...request,
      requestedMaterials: ["income", "identity"],
    }, "credit-reviewer-01", ["application:CR20260000001"])).toThrow("credit_material_invalid");

    const pending = projection("B004", "待补正", creditPayload, request);
    const returnedReceipt = {
      materialKey: "income",
      sourceRef: "匿名收入材料回传-01",
      receiptId: "RET-CR20260000001-INCOME-01",
      returnActorId: "credit-reviewer-03",
      materialStatus: { income: "received" },
      returnReceipts: {
        income: {
          sourceRef: "匿名收入材料回传-01",
          receiptId: "RET-CR20260000001-INCOME-01",
          actorId: "credit-reviewer-03",
        },
      },
    };
    expect(validate("B004", "record_material_return", pending, returnedReceipt, "credit-reviewer-03", [
      "returned-material:income",
      "return-receipt:RET-CR20260000001-INCOME-01",
    ])).not.toThrow();
    expect(validate("B004", "record_material_return", pending, {
      ...returnedReceipt,
      materialKey: "identity",
    }, "credit-reviewer-03", [
      "returned-material:identity",
      "return-receipt:RET-CR20260000001-INCOME-01",
    ])).toThrow("credit_material_invalid");
    expect(validate("B004", "record_material_return", pending, {
      ...returnedReceipt,
      returnActorId: "another-reviewer",
    }, "credit-reviewer-03", [
      "returned-material:income",
      "return-receipt:RET-CR20260000001-INCOME-01",
    ])).toThrow("actor_mismatch");

    const returnedProjection = projection("B004", "待补正", creditPayload, {
      ...request,
      materialStatus: returnedReceipt.materialStatus,
      returnReceipts: returnedReceipt.returnReceipts,
    });
    const returned = {
      materialStatus: { income: "received" },
      secondReviewerId: "credit-reviewer-02",
      reviewNote: "已核对收入材料来源和申请字段一致性。",
      separationConfirmed: true,
    };
    expect(validate("B004", "start_human_review", returnedProjection, returned, "credit-reviewer-02", [
      "returned-material:income",
    ])).not.toThrow();
    expect(validate("B004", "start_human_review", returnedProjection, {
      ...returned,
      secondReviewerId: "credit-reviewer-01",
    }, "credit-reviewer-01", ["returned-material:income"])).toThrow("actor_separation_required");
  });

  it("binds case 06 release actions to the exact station-hour package and two actors", () => {
    const payload = {
      station: "Wanliu",
      No: "33541",
      observed_at: "2016-12-27 12:00:00",
      "PM2.5": "16",
      PM10: "33",
      SO2: "7",
      NO2: "39",
      CO: "700",
      O3: "26",
    };
    const releasePackage = {
      packageId: "AQ-20161227-Wanliu-33541-v1",
      version: "1.0",
      station: "Wanliu",
      observedAt: "2016-12-27 12:00:00",
      sourceRowId: "33541",
      pollutants: { "PM2.5": "16", PM10: "33", SO2: "7", NO2: "39", CO: "700", O3: "26" },
    };
    const completeness = { "PM2.5": "present", PM10: "present", SO2: "present", NO2: "present", CO: "present", O3: "present" };
    const initial = projection("B006", "待审核", payload);
    expect(validate("B006", "freeze_release_scope", initial, {
      releasePackage,
      completeness,
      reviewNote: "六项污染物和站点时次已经逐项核对。",
      reviewerId: "case06-air-auditor",
    }, "case06-air-auditor", [
      "station-hour:Wanliu:2016-12-27 12:00:00",
      "source-row:33541",
    ])).not.toThrow();
    expect(validate("B006", "freeze_release_scope", initial, {
      releasePackage: { ...releasePackage, pollutants: { ...releasePackage.pollutants, O3: "999" } },
      completeness,
      reviewNote: "六项污染物和站点时次已经逐项核对。",
      reviewerId: "case06-air-auditor",
    }, "case06-air-auditor", [
      "station-hour:Wanliu:2016-12-27 12:00:00",
      "source-row:33541",
    ])).toThrow("air_release_package_mismatch");

    const pending = projection("B006", "待发布", payload, {
      releasePackage,
      completeness,
      reviewNote: "六项污染物和站点时次已经逐项核对。",
      reviewerId: "case06-air-auditor",
    });
    expect(validate("B006", "publish", pending, {
      releasePackage,
      approvalNote: "主管已复核发布包版本和六项字段。",
      approverId: "case06-release-supervisor",
    }, "case06-release-supervisor", ["release-package:AQ-20161227-Wanliu-33541-v1"])).not.toThrow();
    expect(validate("B006", "publish", pending, {
      releasePackage,
      approvalNote: "审核员自行确认同一份发布包。",
      approverId: "case06-air-auditor",
    }, "case06-air-auditor", ["release-package:AQ-20161227-Wanliu-33541-v1"])).toThrow("actor_separation_required");
  });

  it("requires case 07 decisions to derive from persisted facts, ADR and a signed contract", () => {
    const payload = { facility_code: "CN-FC-COURSE-01", scenario_date: "2026-07-14" };
    const task = {
      facts: ["public-order-slice", "synthetic-domain-record"],
      hypotheses: ["履约延迟可能与发布耦合有关，需要进一步验证。"],
      constraints: ["team-capacity", "release-coupling"],
      risks: ["duplicate-delivery", "out-of-order"],
      adr: {
        adrId: "ADR-07-CN-FC-COURSE-01-2026-07-14",
        context: "中国前置仓课程场景 · 2026-07-14 · 四域评审",
        status: "proposed",
      },
      createdBy: "case07-architecture-reviewer",
    };
    const evidenceIds = ["public-order-slice:DATA-07", "ops:CN-FC-COURSE-01:2026-07-14"];
    const initial = projection("B007", "待评审", payload);
    expect(validate("B007", "verify_evidence", initial, task, "case07-architecture-reviewer", evidenceIds)).not.toThrow();
    expect(validate("B007", "verify_evidence", initial, {
      ...task,
      facts: ["public-order-slice", "production-sla-proven"],
    }, "case07-architecture-reviewer", evidenceIds)).toThrow("architecture_facts_invalid");

    const reviewed = projection("B007", "架构评审中", payload, task);
    const adr = {
      ...task.adr,
      status: "accepted",
      decision: "event_contract_pilot",
      rationale: "先在订单到履约链路验证一个可回退的事件契约。",
    };
    const signature = {
      signerId: "architecture-lead-02",
      statement: "同意批准单事件试点并承担验收复核",
    };
    expect(validate("B007", "start_event_contract_pilot", reviewed, {
      adr,
      signature,
      eventContract: {
        eventName: "FulfillmentRequested.v1",
        producer: "订单接入",
        consumer: "履约",
        schemaVersion: "1.0.0",
        idempotencyField: "event_id",
        orderingKey: "order_id",
        replayPolicy: "按订单号重放，重复事件由幂等键拒绝",
        rollbackPlan: "关闭消费者并回退到同步调用",
        owner: "履约平台组",
        acceptanceCriteria: "重复、乱序和回滚测试全部通过",
      },
    }, "architecture-lead-02", evidenceIds)).not.toThrow();
    expect(validate("B007", "start_event_contract_pilot", reviewed, {
      adr,
      signature,
      eventContract: {
        eventName: "FulfillmentRequested.v1",
        producer: "履约",
        consumer: "履约",
        schemaVersion: "v1",
        idempotencyField: "event_id",
        orderingKey: "order_id",
        replayPolicy: "回放",
        rollbackPlan: "回退",
        owner: "履约平台组",
        acceptanceCriteria: "通过测试",
      },
    }, "architecture-lead-02", evidenceIds)).toThrow("architecture_contract_invalid");
  });
});
