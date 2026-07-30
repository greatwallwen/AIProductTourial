import { describe, expect, it } from "vitest";
import type { CaseProjection } from "@course-ai-product/case-runtime";
import { validateDomainCommand } from "../../cases/domain-command";

function projection(
  caseId: string,
  state: string,
  task: Record<string, unknown> = {},
): CaseProjection {
  return {
    caseId,
    objectId: `${caseId}-OBJECT-1`,
    state,
    version: 1,
    payload: {},
    task,
    updatedAt: "2026-07-26T00:00:00.000Z",
  };
}

function validate(
  caseId: string,
  command: string,
  current: CaseProjection,
  data: Record<string, unknown>,
  overrides: Partial<Parameters<typeof validateDomainCommand>[0]> = {},
) {
  return () =>
    validateDomainCommand({
      caseId,
      command,
      actorRole: "analyst",
      idempotencyKey: `${caseId}-key`,
      evidenceIds: ["dataset-row"],
      data,
      current,
      ...overrides,
    });
}

describe("case domain command gates", () => {
  it("requires a reproducible evidence request for case 01", () => {
    const current = {
      ...projection("B001", "待核验"),
      payload: { invoice_id: "C536365", invoice_at: "2010-12-02 09:00:00" },
    };
    expect(validate("B001", "create_evidence_request", current, {})).toThrow(
      "candidate_required",
    );
    expect(
      validate("B001", "create_evidence_request", current, {
        candidateId: "536365",
        requestedEvidence: ["original_order", "payment_record"],
        assignee: "售后运营",
        dueAt: "2026-07-27",
        requesterId: "return-analyst",
      }, {
        actorId: "return-analyst",
        evidenceIds: ["cancellation:C536365", "candidate:536365"],
        sceneRows: [{ invoice_id: "536365", invoice_at: "2010-12-01 09:00:00", quantity: "1" }],
      }),
    ).not.toThrow();
  });

  it("blocks case 01 review until every requested item is received", () => {
    const current = {
      ...projection("B001", "待补证", {
      candidateId: "536365",
      requestedEvidence: ["original_order", "payment_record"],
      assignee: "售后运营",
      dueAt: "2026-07-27",
      requesterId: "return-analyst",
      }),
      payload: { invoice_id: "C536365", invoice_at: "2010-12-02 09:00:00" },
    };
    expect(
      validate("B001", "submit_manual_review", current, {
        evidenceStatus: { original_order: "received", payment_record: "missing" },
        reviewNote: "原单已核对，等待付款记录。",
      }, {
        actorId: "return-analyst",
        evidenceIds: ["returned-material:original_order", "returned-material:payment_record"],
        sceneRows: [{ invoice_id: "536365", invoice_at: "2010-12-01 09:00:00", quantity: "1" }],
      }),
    ).toThrow("evidence_incomplete");
    expect(
      validate("B001", "submit_manual_review", current, {
        evidenceStatus: { original_order: "received", payment_record: "received" },
        reviewNote: "两项材料已回传，提交独立复核。",
      }, {
        actorId: "return-analyst",
        evidenceIds: ["returned-material:original_order", "returned-material:payment_record"],
        sceneRows: [{ invoice_id: "536365", invoice_at: "2010-12-01 09:00:00", quantity: "1" }],
      }),
    ).not.toThrow();
  });

  it("requires two different actors for the case 05 cosign", () => {
    const current = {
      ...projection("B005", "待接收会签", {
      selectedEventId: "EVT-06",
      authoritativeState: "接收方已接收，保留迟到修正",
      reconciliationReason: "以病区接收事件和护理确认记录为准。",
      senderActorId: "nurse-li",
      }),
      payload: { transport_id: "TRN-01" },
    };
    const sceneRows = [{
      event_id: "EVT-06",
      transport_id: "TRN-01",
      bed_request_id: "BED-01",
      flow_token: "FLOW-01",
      event_time: "2026-07-26T09:00:00+08:00",
      conflict_type: "late_event",
      late_event: "True",
    }];
    expect(
      validate("B005", "cosign_transfer", current, {
        receiverActorId: "nurse-li",
        cosignNote: "已接收。",
      }, {
        actorId: "nurse-li",
        evidenceIds: ["EVT-06", "BED-01", "FLOW-01"],
        sceneRows,
      }),
    ).toThrow("actor_separation_required");
    expect(
      validate("B005", "cosign_transfer", current, {
        receiverActorId: "ward-chen",
        cosignNote: "病区已核对床位和到达时间。",
      }, {
        actorId: "ward-chen",
        evidenceIds: ["EVT-06", "BED-01", "FLOW-01"],
        sceneRows,
      }),
    ).not.toThrow();
  });

  it("keeps the case 18 submitted and confirmed segment identical", () => {
    const current = {
      ...projection("B018", "当班排查中", {
        taskId: "boiler-check:B018-OBJECT-1:v1",
        objectId: "B018-OBJECT-1",
        objectVersion: 1,
        monitorMinute: "2026-07-26 09:00",
        observedTemperatureC: 528.5,
        segmentId: "final-superheater-section",
        investigationReason: "出口温度连续偏高，需要检查末级过热器出口段。",
        assignee: "当班工艺员-赵工",
        evidenceItems: ["minute-temperature", "sample-integrity"],
        createdBy: "engineer-zhao",
      }),
      payload: {
        monitor_minute: "2026-07-26 09:00",
        steam_temperature_mean: "528.5",
        temperature_state: "低于来源区间",
        consecutive_deviation_minutes: "24",
      },
    };
    expect(
      validate("B018", "confirm_segment", current, {
        segmentId: "desuperheater-section",
        supervisorNote: "先查减温水阀。",
        supervisorId: "shift-supervisor",
        prerequisiteTaskId: "boiler-check:B018-OBJECT-1:v1",
      }, {
        actorId: "shift-supervisor",
        evidenceIds: ["boiler-window:2026-07-26 09:00", "boiler-task:boiler-check:B018-OBJECT-1:v1"],
      }),
    ).toThrow("segment_mismatch");
    expect(
      validate("B018", "confirm_segment", current, {
        segmentId: "final-superheater-section",
        supervisorNote: "同意先查过热器出口测点与邻近温度。",
        supervisorId: "shift-supervisor",
        prerequisiteTaskId: "boiler-check:B018-OBJECT-1:v1",
      }, {
        actorId: "shift-supervisor",
        evidenceIds: ["boiler-window:2026-07-26 09:00", "boiler-task:boiler-check:B018-OBJECT-1:v1"],
      }),
    ).not.toThrow();
  });

  it("uses the displayed case 10 business key in the actual request", () => {
    const current = projection("B010", "执行中");
    const lookupData = {
      businessIdempotencyKey: "IK-TASK-001",
      createdBy: "case10-coordinator",
      recoveryPlan: { lookupTarget: "外部响应回执", note: "核对外部响应是否返回" },
    };
    expect(
      validate(
        "B010",
        "start_lookup",
        current,
        lookupData,
        { idempotencyKey: "random-uuid", actorId: "case10-coordinator" },
      ),
    ).toThrow("idempotency_key_mismatch");
    expect(
      validate(
        "B010",
        "start_lookup",
        current,
        lookupData,
        { idempotencyKey: "IK-TASK-001:start_lookup", actorId: "case10-coordinator" },
      ),
    ).not.toThrow();
  });

  it("rejects overlapping or underfunded case 02 trial assignments", () => {
    const current = projection("B002", "待入组");
    const trialPlan = {
      planName: "8 元券首批试投",
      hypothesis: "向高参与会员发放 8 元券，会提高 7 日核销率",
      cohort: {
        behaviourKey: "view_count",
        minimum: 2,
        segment: "活跃",
        eligibleCount: 20,
      },
      assignment: {
        seed: "coupon-2026-q3-v1",
        treatmentPercent: 50,
        sampleSize: 4,
        treatmentUserIds: ["U-01", "U-02"],
        controlUserIds: ["U-03", "U-04"],
      },
      measurement: {
        primaryMetric: "7 日核销率",
        guardrailMetric: "客诉率不高于对照组",
        observationDays: 7,
      },
      budget: { couponValueCny: 8, ceilingCny: 100, estimatedCny: 16 },
      stopRule: { maxTreatments: 2, maxBudgetCny: 80 },
    };
    expect(validate("B002", "design_trial", current, trialPlan)).not.toThrow();
    expect(
      validate("B002", "design_trial", current, {
        ...trialPlan,
        assignment: {
          ...trialPlan.assignment,
          controlUserIds: ["U-02", "U-04"],
        },
      }),
    ).toThrow("trial_assignment_overlap");
    expect(
      validate("B002", "design_trial", current, {
        ...trialPlan,
        budget: { couponValueCny: 8, ceilingCny: 8, estimatedCny: 16 },
      }),
    ).toThrow("trial_budget_invalid");
    expect(
      validate("B002", "design_trial", current, {
        ...trialPlan,
        assignment: { ...trialPlan.assignment, treatmentPercent: 80 },
      }),
    ).toThrow("trial_assignment_ratio_invalid");
  });

  it("requires case 02 supervisor actions to reuse a persisted plan", () => {
    const empty = projection("B002", "试投待审");
    expect(validate("B002", "start_trial", empty, {})).toThrow(
      "persisted_task_required",
    );
  });

  it("requires support and counter evidence in case 03", () => {
    const current = projection("B003", "待研判");
    const task = {
      taskId: "RR-100-Service-Hospitality",
      aspectKey: "Service#Hospitality",
      aspectLabel: "接待态度",
      supportEvidenceIds: ["review:100"],
      counterEvidenceIds: ["review:208"],
      testableQuestion: "接待态度负向体验是否会在同主题样本中稳定重复出现？",
      researchMethod: "评论分层复核 + 半结构化访谈",
      sampleSize: 24,
      owner: "用户研究员王敏",
      dueDate: "2027-12-31",
      observationWindow: "连续 14 天",
      successCriteria: "同主题负向样本占比连续两周超过 15%",
    };
    expect(validate("B003", "create_validation_task", current, task)).not.toThrow();
    expect(
      validate("B003", "create_validation_task", current, {
        ...task,
        counterEvidenceIds: ["review:100"],
      }),
    ).toThrow("review_evidence_overlap");
  });

  it("prevents case 03 supervisor decisions from swapping the saved task", () => {
    const savedTask = {
      taskId: "RR-100-Service-Hospitality",
      aspectKey: "Service#Hospitality",
      aspectLabel: "接待态度",
      supportEvidenceIds: ["review:100"],
      counterEvidenceIds: ["review:208"],
      testableQuestion: "接待态度负向体验是否会在同主题样本中稳定重复出现？",
      researchMethod: "评论分层复核 + 半结构化访谈",
      sampleSize: 24,
      owner: "用户研究员王敏",
      dueDate: "2027-12-31",
      observationWindow: "连续 14 天",
      successCriteria: "同主题负向样本占比连续两周超过 15%",
    };
    const current = projection("B003", "待验证", savedTask);
    expect(
      validate("B003", "accept_backlog", current, {
        taskId: savedTask.taskId,
        validationTask: savedTask,
        supervisorReason: "样本、方法和期限均可执行。",
      }),
    ).not.toThrow();
    expect(
      validate("B003", "accept_backlog", current, {
        taskId: "RR-SWAPPED",
        validationTask: { ...savedTask, taskId: "RR-SWAPPED" },
        supervisorReason: "换成另一张任务单。",
      }),
    ).toThrow("review_task_mismatch");
  });

  it("requires a complete, object-bound case 13 technician handoff", () => {
    const current = {
      ...projection("B013", "待分流"),
      payload: { intake_id: "CN-AS-001" },
    };
    const handoff = {
      intakeId: "CN-AS-001",
      answers: {
        drivable: { value: "can_move", label: "可以", source: "customer_answer" },
        warning: { value: "none", label: "无", source: "customer_answer" },
        condition: { value: "low_speed_braking", label: "低速制动", source: "customer_answer" },
        recurrence: { value: "first", label: "首次出现", source: "customer_answer" },
      },
      safetyNoticeAcknowledged: true,
      technician: "安全检视组",
      handoffWindow: "30 分钟内",
      note: "车辆状态与制动异响条件已记录。",
      requestedDetails: [],
      createdBy: "case13-service-dispatcher",
    };
    expect(
      validate(
        "B013",
        "submit_triage",
        current,
        { handoff },
        { actorId: "case13-service-dispatcher" },
      ),
    ).not.toThrow();
    expect(
      validate(
        "B013",
        "submit_triage",
        current,
        { handoff: { ...handoff, answers: {
          drivable: handoff.answers.drivable,
          condition: handoff.answers.condition,
          recurrence: handoff.answers.recurrence,
        } } },
        { actorId: "case13-service-dispatcher" },
      ),
    ).toThrow("customer_answer_incomplete");
  });

  it("keeps case 13 details requests actionable and technician acceptance separated", () => {
    const pending = {
      ...projection("B013", "待分流"),
      payload: { intake_id: "CN-AS-001" },
    };
    expect(
      validate("B013", "request_details", pending, {
        detailsRequest: {
          intakeId: "CN-AS-001",
          requestedQuestionIds: ["warning", "condition", "recurrence"],
          assignee: "服务调度",
          responseWindow: "30 分钟内",
        },
        handoff: {
          intakeId: "CN-AS-001",
          answers: { drivable: { value: "can_move", label: "可以", source: "customer_answer" } },
        },
      }),
    ).not.toThrow();

    const handoff = {
      intakeId: "CN-AS-001",
      answers: {
        drivable: { value: "can_move", label: "可以", source: "customer_answer" },
        warning: { value: "none", label: "无", source: "customer_answer" },
        condition: { value: "low_speed_braking", label: "低速制动", source: "customer_answer" },
        recurrence: { value: "first", label: "首次出现", source: "customer_answer" },
      },
      safetyNoticeAcknowledged: true,
      technician: "安全检视组",
      handoffWindow: "30 分钟内",
      note: "车辆状态与制动异响条件已记录。",
      requestedDetails: [],
      createdBy: "case13-service-dispatcher",
    };
    const submitted = {
      ...projection("B013", "技师复核已提交", { handoff }),
      payload: { intake_id: "CN-AS-001" },
    };
    expect(
      validate(
        "B013",
        "dispatch_rescue",
        submitted,
        {
          handoff,
          acceptance: {
            intakeId: "CN-AS-001",
            technicianSupervisorId: "case13-technician-supervisor",
            note: "安全检视组已接收，先核对制动异响。",
          },
        },
        { actorId: "case13-technician-supervisor" },
      ),
    ).not.toThrow();
    expect(
      validate(
        "B013",
        "dispatch_rescue",
        submitted,
        {
          handoff,
          acceptance: {
            intakeId: "CN-AS-001",
            technicianSupervisorId: "case13-service-dispatcher",
            note: "由原调度自行确认接收。",
          },
        },
        { actorId: "case13-service-dispatcher" },
      ),
    ).toThrow("actor_separation_required");
  });

  const case14Payload = {
    event_id: "FQ-0016",
    start_hour: "2017-03-31 17:00:00",
    end_hour: "2017-04-02 07:00:00",
    monitor_hour: "2017-04-02 07:00:00",
    duration_hours: "39",
    priority_cell_ids: "3|1|2",
    dominant_deviation: "3号浮选柱风量:-3.07|1号浮选柱风量:-3.04|2号浮选柱风量:-2.82",
  };
  const case14Review = {
    taskId: "FLOT-FQ-0016-V1",
    eventId: "FQ-0016",
    hours: 72,
    rowCount: 72,
    windowStart: "2017-03-30 08:00:00",
    windowEnd: "2017-04-02 07:00:00",
    priorityCellIds: ["3", "1", "2"],
    hypothesis: "air_balance",
    assignee: "当班工艺工程师",
    dueAt: "2026-07-27",
    note: "按每列历史记录先核对三号、一号、二号槽风量与仪表完整性。",
    evidenceItems: [
      "event:FQ-0016",
      "trend:2017-03-30 08:00:00:2017-04-02 07:00:00",
      "cell-air:3",
      "cell-air:1",
      "cell-air:2",
      "quality:2017-04-02 07:00:00",
    ],
    createdBy: "case14-process-engineer",
  };

  it("binds case 14 review to the actual 72-hour event slice", () => {
    const current = {
      ...projection("B014", "待诊断"),
      objectId: "B014-FQ-0016",
      payload: case14Payload,
    };
    expect(
      validate(
        "B014",
        "submit_process_review",
        current,
        { processReview: case14Review },
        { actorId: "case14-process-engineer" },
      ),
    ).not.toThrow();
    expect(
      validate(
        "B014",
        "submit_process_review",
        current,
        { processReview: { ...case14Review, rowCount: 71 } },
        { actorId: "case14-process-engineer" },
      ),
    ).toThrow("process_window_invalid");
  });

  it("requires the case 14 supervisor to confirm the persisted task as a different actor", () => {
    const current = {
      ...projection("B014", "工艺复核中", { processReview: case14Review }),
      objectId: "B014-FQ-0016",
      payload: case14Payload,
    };
    expect(
      validate(
        "B014",
        "dispatch_instrument_check",
        current,
        {
          processReview: case14Review,
          supervisorDecision: {
            taskId: case14Review.taskId,
            supervisorId: "case14-production-supervisor",
            note: "同意按核查单下发现场检查。",
          },
        },
        { actorId: "case14-production-supervisor" },
      ),
    ).not.toThrow();
    expect(
      validate(
        "B014",
        "dispatch_instrument_check",
        current,
        {
          processReview: case14Review,
          supervisorDecision: {
            taskId: case14Review.taskId,
            supervisorId: "case14-process-engineer",
            note: "由原提交人自行确认。",
          },
        },
        { actorId: "case14-process-engineer" },
      ),
    ).toThrow("actor_separation_required");
  });

  it("rejects a case 14 supervisor payload that rewrites the persisted review window", () => {
    const current = {
      ...projection("B014", "工艺复核中", { processReview: case14Review }),
      objectId: "B014-FQ-0016",
      payload: case14Payload,
    };
    const rewritten = {
      ...case14Review,
      assignee: "未经工程师提交的另一班组",
    };

    expect(
      validate(
        "B014",
        "dispatch_instrument_check",
        current,
        {
          processReview: rewritten,
          supervisorDecision: {
            taskId: case14Review.taskId,
            supervisorId: "case14-production-supervisor",
            note: "只确认工程师已经提交的同一证据窗口。",
          },
        },
        { actorId: "case14-production-supervisor" },
      ),
    ).toThrow("process_task_mismatch");
  });
});
