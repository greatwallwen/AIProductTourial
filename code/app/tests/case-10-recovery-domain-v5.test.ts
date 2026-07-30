import type { CaseProjection } from "@course-ai-product/case-runtime";
import { describe, expect, it } from "vitest";
import { validateDomainCommand } from "../../cases/domain-command";

const payload = {
  task_id: "CN-TEL-2025Q2-0008",
  external_lookup_scenario: "committed_response_lost",
};
const key = "LRK-CN-TEL-2025Q2-0008";

function projection(state: string, task: Record<string, unknown> = {}): CaseProjection {
  return {
    caseId: "10",
    objectId: "10-CN-TEL-2025Q2-0008",
    state,
    version: state === "执行中" ? 0 : 1,
    payload,
    task,
    updatedAt: "2026-07-27T08:00:00.000Z",
  };
}

function validate(command: string, current: CaseProjection, data: Record<string, unknown>, actorId: string, evidenceIds: string[] = []) {
  return () => validateDomainCommand({
    caseId: "10",
    command,
    actorRole: command === "close_task" ? "supervisor" : "coordinator",
    actorId,
    idempotencyKey: `${key}:${command}`,
    evidenceIds,
    data,
    current,
  });
}

describe("case 10 recovery evidence gate", () => {
  it("starts a local lookup without claiming an external result", () => {
    expect(validate("start_lookup", projection("执行中"), {
      localRecoveryKey: key,
      createdBy: "case10-recovery-coordinator",
      recoveryPlan: { lookupTarget: "业务受理记录", note: "只查询外部效果，不重放原请求" },
    }, "case10-recovery-coordinator")).not.toThrow();
  });

  it("requires an explicit result, summary and matching evidence", () => {
    const current = projection("外部效果待核对", {
      localRecoveryKey: key,
      createdBy: "case10-recovery-coordinator",
    });
    const base = {
      localRecoveryKey: key,
      lookupResult: {
        status: "effective",
        summary: "查询材料显示外部效果已存在，禁止重放原请求",
        evidenceId: "lookup-evidence:CN-TEL-0008",
        checkedBy: "case10-recovery-coordinator",
      },
    };
    expect(validate("retry_idempotent", current, base, "case10-recovery-coordinator", ["lookup-evidence:CN-TEL-0008"])).not.toThrow();
    expect(validate("retry_idempotent", current, {
      ...base,
      lookupResult: { ...base.lookupResult, status: "unknown" },
    }, "case10-recovery-coordinator", ["lookup-evidence:CN-TEL-0008"])).toThrow("telecom_lookup_result_invalid");
    expect(validate("retry_idempotent", current, base, "case10-recovery-coordinator", [])).toThrow("telecom_lookup_evidence_mismatch");
  });

  it("keeps unknown work pending and forbids closing without a persisted explicit result", () => {
    const pending = projection("外部效果待核对", {
      localRecoveryKey: key,
      createdBy: "case10-recovery-coordinator",
    });
    expect(validate("keep_pending", pending, {
      localRecoveryKey: key,
      pendingReason: "外部查询仍无可验证回执",
    }, "case10-recovery-coordinator")).not.toThrow();
    expect(validate("close_task", projection("恢复记录待确认", pending.task), {
      localRecoveryKey: key,
      decisionBy: "case10-recovery-supervisor",
      closeNote: "证据完整，关闭课程核查",
    }, "case10-recovery-supervisor")).toThrow("telecom_lookup_result_invalid");
  });

  it("requires a different supervisor and the persisted lookup evidence to close", () => {
    const result = {
      status: "not_effective",
      summary: "核对材料显示外部效果未发生，转人工处理",
      evidenceId: "lookup-evidence:CN-TEL-0008",
      checkedBy: "case10-recovery-coordinator",
    };
    const current = projection("恢复记录待确认", {
      localRecoveryKey: key,
      createdBy: "case10-recovery-coordinator",
      lookupResult: result,
    });
    const data = {
      localRecoveryKey: key,
      decisionBy: "case10-recovery-supervisor",
      closeNote: "已核对明确结果与证据，关闭课程核查",
    };
    expect(validate("close_task", current, data, "case10-recovery-supervisor", [result.evidenceId])).not.toThrow();
    expect(validate("close_task", current, {
      ...data,
      decisionBy: "case10-recovery-coordinator",
    }, "case10-recovery-coordinator", [result.evidenceId])).toThrow("actor_separation_required");
  });
});
