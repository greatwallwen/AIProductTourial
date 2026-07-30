import { describe, expect, it } from "vitest";
import type { CaseProjection } from "@course-ai-product/case-runtime";
import { validateDomainCommand, type DomainCommandInput } from "../../cases/domain-command";

function projection(
  caseId: string,
  objectId: string,
  payload: Record<string, unknown>,
  task: Record<string, unknown> = {},
  version = 0,
): CaseProjection {
  return {
    caseId,
    objectId,
    state: version ? "处理中" : "待处理",
    version,
    payload,
    task,
    updatedAt: "2026-07-26T00:00:00.000Z",
  };
}

const returnPayload = {
  invoice_id: "C496116",
  invoice_at: "2010-01-25 11:46:00",
  quantity: "-1",
};
const returnRows = [
  returnPayload,
  { invoice_id: "496015", invoice_at: "2010-01-20 10:20:00", quantity: "1" },
];
const returnRequest = {
  candidateId: "496015",
  requestedEvidence: ["original_order", "payment_record", "goods_relation"],
  assignee: "订单运营",
  dueAt: "2026-07-29",
  requesterId: "case01-evidence-analyst",
};

function case01Request(overrides: Partial<DomainCommandInput> = {}): DomainCommandInput {
  return {
    caseId: "B001",
    command: "create_evidence_request",
    actorRole: "analyst",
    actorId: "case01-evidence-analyst",
    idempotencyKey: "return-evidence:01-C496116-M:0:request",
    evidenceIds: ["cancellation:C496116", "candidate:496015"],
    data: returnRequest,
    current: projection("B001", "B001-C496116-M", returnPayload),
    sceneRows: returnRows,
    ...overrides,
  };
}

const hospitalEvent = {
  event_id: "TRN-0001-06",
  transport_id: "TRN-0001",
  event_time: "2026-07-03T08:27:00+08:00",
  received_at: "2026-07-03T09:09:00+08:00",
  bed_request_id: "BED-008",
  flow_token: "FLOW-0001",
  late_event: "True",
  conflict_type: "late_event",
};

function case05Nurse(overrides: Partial<DomainCommandInput> = {}): DomainCommandInput {
  return {
    caseId: "B005",
    command: "nurse_confirm",
    actorRole: "coordinator",
    actorId: "ER-N-07",
    idempotencyKey: "case-B005:TRN-0001:nurse_confirm:v0:TRN-0001-06",
    evidenceIds: ["TRN-0001-06", "BED-008", "FLOW-0001"],
    data: {
      selectedEventId: "TRN-0001-06",
      authoritativeState: "接收方已接收，保留迟到修正",
      reconciliationReason: "接收记录已存在，迟到事件只追加修正说明。",
      senderActorId: "ER-N-07",
    },
    current: projection("B005", "B005-TRN-0001-TRN-0001-06", { transport_id: "TRN-0001" }),
    sceneRows: [hospitalEvent],
    ...overrides,
  };
}

const boilerPayload = {
  monitor_minute: "2022-03-29 17:46",
  steam_temperature_mean: "528.5",
  temperature_state: "低于来源区间",
  consecutive_deviation_minutes: "24",
};
const boilerTask = {
  taskId: "boiler-check:18-2022-03-29-17-46:v1",
  objectId: "18-2022-03-29-17-46",
  objectVersion: 1,
  monitorMinute: "2022-03-29 17:46",
  observedTemperatureC: 528.5,
  segmentId: "final-superheater-section",
  investigationReason: "出口温度连续下偏，先核对末级过热器前后段温差。",
  assignee: "运行一班张工",
  evidenceItems: ["minute-temperature", "sample-integrity"],
  createdBy: "case18-process-engineer",
};

function case18Dispatch(overrides: Partial<DomainCommandInput> = {}): DomainCommandInput {
  return {
    caseId: "B018",
    command: "dispatch_shift_check",
    actorRole: "process_engineer",
    actorId: "case18-process-engineer",
    idempotencyKey: `${boilerTask.taskId}:dispatch_shift_check`,
    evidenceIds: ["boiler-window:2022-03-29 17:46", "minute-temperature", "sample-integrity"],
    data: boilerTask,
    current: projection("B018", "18-2022-03-29-17-46", boilerPayload),
    ...overrides,
  };
}

describe("productized domain gates for cases 01, 05 and 18", () => {
  it("binds a case 01 evidence request to a real earlier positive source row", () => {
    expect(() => validateDomainCommand(case01Request())).not.toThrow();
    expect(() => validateDomainCommand(case01Request({
      data: { ...returnRequest, candidateId: "UNKNOWN" },
      evidenceIds: ["cancellation:C496116", "candidate:UNKNOWN"],
    }))).toThrow("candidate_invalid");
  });

  it("requires case 01 fixed evidence keys, the two baseline items and exact evidence IDs", () => {
    expect(() => validateDomainCommand(case01Request({
      data: { ...returnRequest, requestedEvidence: ["original_order", "made_up"] },
    }))).toThrow("return_evidence_invalid");
    expect(() => validateDomainCommand(case01Request({
      evidenceIds: ["candidate:496015", "cancellation:C999999"],
    }))).toThrow("return_evidence_mismatch");
  });

  it("does not let a case 01 review shrink the persisted evidence request", () => {
    const current = projection("B001", "B001-C496116-M", returnPayload, returnRequest, 1);
    expect(() => validateDomainCommand({
      ...case01Request(),
      command: "submit_manual_review",
      current,
      data: {
        requestedEvidence: ["original_order", "payment_record"],
        evidenceStatus: { original_order: "received", payment_record: "received" },
        reviewNote: "两项材料已经齐全，申请直接提交。",
      },
      evidenceIds: ["returned-material:original_order", "returned-material:payment_record"],
    })).toThrow("evidence_incomplete");
  });

  it("binds a case 05 first signature to the real event and request actor", () => {
    expect(() => validateDomainCommand(case05Nurse())).not.toThrow();
    expect(() => validateDomainCommand(case05Nurse({ actorId: "OTHER-NURSE" }))).toThrow("actor_mismatch");
    expect(() => validateDomainCommand(case05Nurse({
      sceneRows: [{ ...hospitalEvent, transport_id: "TRN-OTHER" }],
    }))).toThrow("hospital_event_invalid");
  });

  it("rejects an unregistered case 05 authoritative state and mismatched event evidence", () => {
    expect(() => validateDomainCommand(case05Nurse({
      data: { ...case05Nurse().data, authoritativeState: "AI 已自动完成转运" },
    }))).toThrow("hospital_state_invalid");
    expect(() => validateDomainCommand(case05Nurse({
      evidenceIds: ["TRN-0001-06", "BED-WRONG", "FLOW-0001"],
    }))).toThrow("hospital_evidence_mismatch");
  });

  it("uses the persisted case 05 sender for independent cosign", () => {
    const current = projection("B005", "B005-TRN-0001-TRN-0001-06", { transport_id: "TRN-0001" }, {
      ...(case05Nurse().data ?? {}),
    }, 1);
    expect(() => validateDomainCommand({
      ...case05Nurse(),
      command: "cosign_transfer",
      actorRole: "supervisor",
      actorId: "ER-N-07",
      current,
      data: {
        senderActorId: "SPOOFED-SENDER",
        receiverActorId: "ER-N-07",
        cosignNote: "已经核对床位与到达记录。",
      },
    })).toThrow("actor_separation_required");
  });

  it("only reopens case 05 for the exact late event timestamp", () => {
    expect(() => validateDomainCommand({
      ...case05Nurse(),
      command: "reopen_late_event",
      data: {
        lateEventId: "TRN-0001-06",
        lateEventOccurredAt: "2026-07-03T08:27:00+08:00",
        lateEventReceivedAt: "2026-07-03T09:09:00+08:00",
        handledLateEventIds: ["TRN-0001-06"],
      },
    })).not.toThrow();
    expect(() => validateDomainCommand({
      ...case05Nurse(),
      command: "reopen_late_event",
      data: {
        lateEventId: "TRN-0001-06",
        lateEventOccurredAt: "2026-07-03T08:28:00+08:00",
        lateEventReceivedAt: "2026-07-03T09:09:00+08:00",
        handledLateEventIds: ["TRN-0001-06"],
      },
    })).toThrow("late_event_required");
    expect(() => validateDomainCommand({
      ...case05Nurse(),
      command: "reopen_late_event",
      data: {
        lateEventId: "TRN-0001-06",
        lateEventOccurredAt: "2026-07-03T08:27:00+08:00",
        lateEventReceivedAt: "2026-07-03T09:08:00+08:00",
        handledLateEventIds: ["TRN-0001-06"],
      },
    })).toThrow("late_event_required");
    expect(() => validateDomainCommand({
      ...case05Nurse(),
      command: "reopen_late_event",
      sceneRows: [{ ...hospitalEvent, late_event: "False", conflict_type: "duplicate" }],
      data: {
        lateEventId: "TRN-0001-06",
        lateEventOccurredAt: "2026-07-03T08:27:00+08:00",
        lateEventReceivedAt: "2026-07-03T09:09:00+08:00",
        handledLateEventIds: ["TRN-0001-06"],
      },
    })).toThrow("late_event_required");
    expect(() => validateDomainCommand({
      ...case05Nurse(),
      command: "reopen_late_event",
      current: projection("B005", "B005-TRN-0001-TRN-0001-06", { transport_id: "TRN-0001" }, {
        handledLateEventIds: ["TRN-0001-06"],
      }, 2),
      data: {
        lateEventId: "TRN-0001-06",
        lateEventOccurredAt: "2026-07-03T08:27:00+08:00",
        lateEventReceivedAt: "2026-07-03T09:09:00+08:00",
        handledLateEventIds: ["TRN-0001-06"],
      },
    })).toThrow("late_event_already_handled");
  });

  it("binds a case 18 dispatch task to the current window, actor and baseline evidence", () => {
    expect(() => validateDomainCommand(case18Dispatch())).not.toThrow();
    expect(() => validateDomainCommand(case18Dispatch({
      data: { ...boilerTask, evidenceItems: ["minute-temperature", "desuperheater-flow"] },
      evidenceIds: ["boiler-window:2022-03-29 17:46", "minute-temperature", "desuperheater-flow"],
    }))).toThrow("boiler_evidence_mismatch");
  });

  it("does not dispatch case 18 when the current temperature is inside the source interval", () => {
    expect(() => validateDomainCommand(case18Dispatch({
      current: projection("B018", "18-2022-03-29-17-46", { ...boilerPayload, temperature_state: "区间内" }),
    }))).toThrow("boiler_condition_invalid");
  });

  it("requires an independent case 18 supervisor and the persisted task receipt", () => {
    const current = projection("B018", "18-2022-03-29-17-46", boilerPayload, boilerTask, 1);
    expect(() => validateDomainCommand({
      ...case18Dispatch(),
      command: "confirm_segment",
      actorRole: "supervisor",
      actorId: "case18-process-engineer",
      current,
      data: {
        segmentId: "final-superheater-section",
        supervisorId: "case18-process-engineer",
        prerequisiteTaskId: boilerTask.taskId,
        supervisorNote: "同意按当前检查段执行现场核对。",
      },
      evidenceIds: ["boiler-window:2022-03-29 17:46", `boiler-task:${boilerTask.taskId}`],
    })).toThrow("actor_separation_required");
  });

  it("only blocks case 18 automatic control after a sustained deviation", () => {
    expect(() => validateDomainCommand({
      ...case18Dispatch(),
      command: "hold_control_change",
      actorRole: "supervisor",
      actorId: "case18-shift-supervisor",
      current: projection("B018", "18-2022-03-29-17-46", {
        ...boilerPayload,
        consecutive_deviation_minutes: "9",
      }),
      data: {
        segmentId: "final-superheater-section",
        investigationReason: "偏差原因未明，先保持当前控制参数不变。",
        supervisorId: "case18-shift-supervisor",
      },
      evidenceIds: ["boiler-window:2022-03-29 17:46"],
    })).toThrow("boiler_condition_invalid");
  });
});
