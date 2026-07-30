import type { CaseProjection } from "@course-ai-product/case-runtime";

export type DomainCommandInput = {
  caseId: string;
  command: string;
  actorRole: string;
  actorId?: string;
  idempotencyKey: string;
  reason?: string;
  evidenceIds: string[];
  data?: Record<string, unknown>;
  current: CaseProjection;
  sceneRows?: Record<string, unknown>[];
  supportingArtifacts?: Record<string, Record<string, unknown>[]>;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : [];
}

function number(value: unknown, code = "task_input_required"): number {
  const result = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(result)) {
    throw new Error(code);
  }
  return result;
}

function positiveInteger(value: unknown, code = "task_input_required"): number {
  const result = number(value, code);
  if (!Number.isInteger(result) || result < 1) {
    throw new Error(code);
  }
  return result;
}

function uniqueStrings(value: unknown, code = "task_input_required"): string[] {
  const result = requireStrings(value, code);
  if (new Set(result).size !== result.length) {
    throw new Error(code);
  }
  return result;
}

function requireText(value: unknown, code = "task_input_required"): string {
  const result = text(value);
  if (!result) {
    throw new Error(code);
  }
  return result;
}

function requireStrings(value: unknown, code = "task_input_required"): string[] {
  const result = strings(value);
  if (!result.length) {
    throw new Error(code);
  }
  return result;
}

function mergedTask(input: DomainCommandInput): Record<string, unknown> {
  return {
    ...(input.current.task ?? {}),
    ...(input.data ?? {}),
  };
}

function validateEnvelope(input: DomainCommandInput): void {
  if (input.actorId && (input.actorId.length > 80 || !/^[\w.@-]+$/u.test(input.actorId))) {
    throw new Error("actor_invalid");
  }
  if (input.evidenceIds.length > 32 || input.evidenceIds.some((id) => !id || id.length > 256)) {
    throw new Error("evidence_invalid");
  }
  if (input.data && JSON.stringify(input.data).length > 32_768) {
    throw new Error("task_payload_too_large");
  }
}

const RETURN_EVIDENCE_KEYS = new Set([
  "original_order",
  "payment_record",
  "goods_relation",
  "cancellation_reason",
]);
const RETURN_REQUIRED_EVIDENCE = ["original_order", "payment_record"];
const RETURN_ASSIGNEES = new Set(["财务对账", "销售运营", "订单运营", "售后运营"]);

function validateReturnRequest(input: DomainCommandInput, value: unknown): Record<string, unknown> {
  const task = record(value);
  const candidateId = text(task.candidateId);
  const noMatch = task.candidateDecision === "no_match";
  if (Boolean(candidateId) === noMatch) throw new Error("candidate_required");
  const invoiceId = requireText(input.current.payload.invoice_id, "return_object_required");
  if (candidateId) {
    const claimTime = Date.parse(String(input.current.payload.invoice_at ?? "").replace(" ", "T") + "Z");
    const candidate = (input.sceneRows ?? []).find((row) => text(row.invoice_id) === candidateId);
    const candidateTime = Date.parse(String(candidate?.invoice_at ?? "").replace(" ", "T") + "Z");
    if (
      !candidate ||
      candidateId === invoiceId ||
      number(candidate.quantity, "candidate_invalid") <= 0 ||
      !Number.isFinite(claimTime) ||
      !Number.isFinite(candidateTime) ||
      candidateTime > claimTime
    ) throw new Error("candidate_invalid");
  }
  const requested = uniqueStrings(task.requestedEvidence, "evidence_request_required");
  if (
    requested.some((item) => !RETURN_EVIDENCE_KEYS.has(item)) ||
    RETURN_REQUIRED_EVIDENCE.some((item) => !requested.includes(item))
  ) throw new Error("return_evidence_invalid");
  if (!RETURN_ASSIGNEES.has(requireText(task.assignee, "assignee_required"))) {
    throw new Error("assignee_required");
  }
  const dueAt = requireText(task.dueAt, "due_at_required");
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(dueAt) || Number.isNaN(Date.parse(`${dueAt}T00:00:00+08:00`))) {
    throw new Error("due_at_invalid");
  }
  const requester = requireText(task.requesterId, "sender_actor_required");
  if (requester !== requireText(input.actorId, "sender_actor_required")) throw new Error("actor_mismatch");
  return task;
}

function validateCase01(input: DomainCommandInput): void {
  const data = record(input.data);
  const invoiceId = requireText(input.current.payload.invoice_id, "return_object_required");
  if (input.command === "create_evidence_request") {
    const task = validateReturnRequest(input, data);
    const decisionEvidence = task.candidateDecision === "no_match"
      ? "candidate-decision:no-match"
      : `candidate:${requireText(task.candidateId, "candidate_required")}`;
    if (!sameStrings(uniqueStrings(input.evidenceIds, "return_evidence_mismatch"), [
      `cancellation:${invoiceId}`,
      decisionEvidence,
    ])) throw new Error("return_evidence_mismatch");
    return;
  }
  if (input.command === "submit_manual_review") {
    const persisted = validateReturnRequest(input, input.current.task);
    const requested = uniqueStrings(persisted.requestedEvidence, "evidence_request_required");
    const statuses = record(data.evidenceStatus);
    if (requested.some((item) => statuses[item] !== "received")) throw new Error("evidence_incomplete");
    if (requireText(data.reviewNote, "review_note_required").length < 6) throw new Error("review_note_required");
    const expected = requested.map((item) => `returned-material:${item}`);
    if (!sameStrings(uniqueStrings(input.evidenceIds, "return_evidence_mismatch"), expected)) {
      throw new Error("return_evidence_mismatch");
    }
    return;
  }
  if (input.command === "hold_refund") {
    if (requireText(data.decisionReason ?? input.reason, "decision_reason_required").length < 8) {
      throw new Error("decision_reason_required");
    }
    requireText(input.actorId, "receiver_actor_required");
    if (!input.evidenceIds.includes(`cancellation:${invoiceId}`)) throw new Error("return_evidence_mismatch");
  }
}

function validateTrialPlan(task: Record<string, unknown>): void {
  requireText(task.planName, "trial_plan_required");
  requireText(task.hypothesis, "trial_hypothesis_required");

  const cohort = record(task.cohort);
  const behaviourKey = requireText(cohort.behaviourKey, "trial_cohort_required");
  if (!["view_count", "cart_count", "buy_count"].includes(behaviourKey)) {
    throw new Error("trial_cohort_invalid");
  }
  const eligibleCount = positiveInteger(cohort.eligibleCount, "trial_cohort_required");

  const assignment = record(task.assignment);
  requireText(assignment.seed, "trial_seed_required");
  const sampleSize = positiveInteger(assignment.sampleSize, "trial_assignment_required");
  const treatment = uniqueStrings(assignment.treatmentUserIds, "trial_assignment_required");
  const control = uniqueStrings(assignment.controlUserIds, "trial_assignment_required");
  if (treatment.some((id) => control.includes(id))) {
    throw new Error("trial_assignment_overlap");
  }
  if (treatment.length + control.length !== sampleSize || sampleSize > eligibleCount) {
    throw new Error("trial_assignment_invalid");
  }
  if (assignment.treatmentPercent !== undefined) {
    const treatmentPercent = number(assignment.treatmentPercent, "trial_assignment_ratio_invalid");
    const expectedTreatment = Math.max(1, Math.min(sampleSize - 1, Math.round(sampleSize * treatmentPercent / 100)));
    if (treatmentPercent < 10 || treatmentPercent > 90 || treatment.length !== expectedTreatment) {
      throw new Error("trial_assignment_ratio_invalid");
    }
  }

  const measurement = record(task.measurement);
  requireText(measurement.primaryMetric, "trial_measurement_required");
  requireText(measurement.guardrailMetric, "trial_measurement_required");
  positiveInteger(measurement.observationDays, "trial_measurement_required");

  const budget = record(task.budget);
  const couponValue = number(budget.couponValueCny, "trial_budget_required");
  const ceiling = number(budget.ceilingCny, "trial_budget_required");
  const estimated = number(budget.estimatedCny, "trial_budget_required");
  if (couponValue !== 8 || ceiling <= 0 || estimated !== treatment.length * couponValue || estimated > ceiling) {
    throw new Error("trial_budget_invalid");
  }

  const stopRule = record(task.stopRule);
  const maxTreatments = positiveInteger(stopRule.maxTreatments, "trial_stop_rule_required");
  const maxBudget = number(stopRule.maxBudgetCny, "trial_stop_rule_required");
  if (maxTreatments > treatment.length || maxBudget <= 0 || maxBudget > ceiling) {
    throw new Error("trial_stop_rule_invalid");
  }
}

function validateCase02(input: DomainCommandInput): void {
  if (input.command === "design_trial") {
    validateTrialPlan(record(input.data));
    return;
  }
  if (input.command === "start_trial" || input.command === "stop_trial") {
    if (!input.current.task || !Object.keys(input.current.task).length) {
      throw new Error("persisted_task_required");
    }
    validateTrialPlan(input.current.task);
  }
}

const REVIEW_ASPECTS = new Set([
  "Service#Hospitality",
  "Service#Queue",
  "Service#Timely",
  "Food#Taste",
]);

function validateReviewTask(task: Record<string, unknown>): void {
  requireText(task.taskId, "review_task_required");
  const aspectKey = requireText(task.aspectKey, "review_aspect_required");
  if (!REVIEW_ASPECTS.has(aspectKey)) {
    throw new Error("review_aspect_invalid");
  }
  requireText(task.aspectLabel, "review_aspect_required");
  const support = uniqueStrings(task.supportEvidenceIds, "review_evidence_required");
  const counter = uniqueStrings(task.counterEvidenceIds, "review_evidence_required");
  if ([...support, ...counter].some((id) => !id.startsWith("review:"))) {
    throw new Error("review_evidence_invalid");
  }
  if (support.some((id) => counter.includes(id))) {
    throw new Error("review_evidence_overlap");
  }
  if (requireText(task.testableQuestion, "review_question_required").length < 8) {
    throw new Error("review_question_required");
  }
  requireText(task.researchMethod, "review_method_required");
  const sampleSize = positiveInteger(task.sampleSize, "review_sample_required");
  if (sampleSize > 5_000) {
    throw new Error("review_sample_invalid");
  }
  requireText(task.owner, "assignee_required");
  const dueDate = requireText(task.dueDate, "due_at_required");
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(dueDate) || Number.isNaN(Date.parse(`${dueDate}T00:00:00+08:00`))) {
    throw new Error("due_at_invalid");
  }
  requireText(task.observationWindow, "review_window_required");
  if (requireText(task.successCriteria, "review_success_criteria_required").length < 8) {
    throw new Error("review_success_criteria_required");
  }
}

function validateCase03(input: DomainCommandInput): void {
  if (input.command === "create_validation_task") {
    validateReviewTask(record(input.data));
    return;
  }
  if (input.command === "accept_backlog" || input.command === "archive_signal") {
    const persisted = input.current.task ?? {};
    if (!Object.keys(persisted).length) {
      throw new Error("persisted_task_required");
    }
    validateReviewTask(persisted);
    const submitted = record(input.data);
    const submittedTask = record(submitted.validationTask);
    if (
      requireText(submitted.taskId, "review_task_required") !== requireText(persisted.taskId, "review_task_required") ||
      requireText(submittedTask.taskId, "review_task_required") !== requireText(persisted.taskId, "review_task_required")
    ) {
      throw new Error("review_task_mismatch");
    }
    if (requireText(submitted.supervisorReason ?? input.reason, "review_note_required").length < 4) {
      throw new Error("review_note_required");
    }
  }
}

const CREDIT_MATERIALS = new Set(["identity", "income", "consent", "consistency"]);

function creditMaterialMissing(payload: Record<string, unknown>, key: string): boolean {
  if (key === "identity") return payload.identity_verification_status !== "verified";
  if (key === "income") return payload.income_evidence_status !== "complete";
  if (key === "consent") return payload.consent_status !== "confirmed";
  if (key === "consistency") return payload.application_consistency !== "consistent";
  return false;
}

function validateCreditRequest(
  input: DomainCommandInput,
  value: unknown,
): Record<string, unknown> {
  const request = record(value);
  const requested = uniqueStrings(request.requestedMaterials, "credit_material_required");
  if (
    requested.some((key) => !CREDIT_MATERIALS.has(key)) ||
    requested.some((key) => !creditMaterialMissing(input.current.payload, key))
  ) {
    throw new Error("credit_material_invalid");
  }
  requireText(request.assignee, "assignee_required");
  const dueAt = requireText(request.dueAt, "due_at_required");
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(dueAt) || Number.isNaN(Date.parse(`${dueAt}T00:00:00+08:00`))) {
    throw new Error("due_at_invalid");
  }
  if (requireText(request.requestNote, "credit_request_note_required").length < 6) {
    throw new Error("credit_request_note_required");
  }
  requireText(request.requesterId, "sender_actor_required");
  return request;
}

function validateCase04(input: DomainCommandInput): void {
  const data = record(input.data);
  if (input.command === "request_material") {
    const request = validateCreditRequest(input, data);
    if (requireText(request.requesterId, "sender_actor_required") !== requireText(input.actorId, "sender_actor_required")) {
      throw new Error("actor_mismatch");
    }
    const applicationId = requireText(input.current.payload.application_id, "credit_application_required");
    if (!input.evidenceIds.includes(`application:${applicationId}`)) {
      throw new Error("credit_evidence_mismatch");
    }
    return;
  }
  if (input.command === "record_material_return") {
    const persisted = validateCreditRequest(input, input.current.task);
    const requested = uniqueStrings(persisted.requestedMaterials, "credit_material_required");
    const materialKey = requireText(data.materialKey, "credit_material_required");
    if (!requested.includes(materialKey) || !CREDIT_MATERIALS.has(materialKey)) {
      throw new Error("credit_material_invalid");
    }
    const sourceRef = requireText(data.sourceRef, "credit_return_source_required");
    const receiptId = requireText(data.receiptId, "credit_return_receipt_required");
    const returnActorId = requireText(data.returnActorId, "sender_actor_required");
    if (returnActorId !== requireText(input.actorId, "sender_actor_required")) {
      throw new Error("actor_mismatch");
    }
    const statuses = record(data.materialStatus);
    if (statuses[materialKey] !== "received" || Object.keys(statuses).some((key) => !requested.includes(key))) {
      throw new Error("credit_material_invalid");
    }
    const receipt = record(record(data.returnReceipts)[materialKey]);
    if (
      requireText(receipt.sourceRef, "credit_return_source_required") !== sourceRef ||
      requireText(receipt.receiptId, "credit_return_receipt_required") !== receiptId ||
      requireText(receipt.actorId, "sender_actor_required") !== returnActorId ||
      !input.evidenceIds.includes(`returned-material:${materialKey}`) ||
      !input.evidenceIds.includes(`return-receipt:${receiptId}`)
    ) {
      throw new Error("credit_evidence_mismatch");
    }
    return;
  }
  if (input.command === "start_human_review") {
    const persisted = validateCreditRequest(input, input.current.task);
    const requested = uniqueStrings(persisted.requestedMaterials, "credit_material_required");
    const statuses = { ...record(input.current.task?.materialStatus), ...record(data.materialStatus) };
    const receipts = { ...record(input.current.task?.returnReceipts), ...record(data.returnReceipts) };
    if (requested.some((key) => statuses[key] !== "received")) {
      throw new Error("credit_material_incomplete");
    }
    if (requested.some((key) => !requireText(record(receipts[key]).receiptId, "credit_return_receipt_required"))) {
      throw new Error("credit_return_receipt_required");
    }
    if (requested.some((key) => !input.evidenceIds.includes(`returned-material:${key}`))) {
      throw new Error("credit_evidence_mismatch");
    }
    const requester = requireText(persisted.requesterId, "sender_actor_required");
    const reviewer = requireText(data.secondReviewerId, "receiver_actor_required");
    if (reviewer !== requireText(input.actorId, "receiver_actor_required")) {
      throw new Error("actor_mismatch");
    }
    if (reviewer === requester || data.separationConfirmed !== true) {
      throw new Error("actor_separation_required");
    }
    if (requireText(data.reviewNote, "review_note_required").length < 6) {
      throw new Error("review_note_required");
    }
    return;
  }
  if (input.command === "hold_application") {
    if (requireText(data.decisionReason ?? input.reason, "decision_reason_required").length < 6) {
      throw new Error("decision_reason_required");
    }
  }
}

const HOSPITAL_AUTHORITATIVE_STATES = new Set([
  "接收方已接收，保留迟到修正",
  "仍在转运途中，等待接收确认",
  "床位已确认，等待转运到达",
  "状态无法判定，升级协调",
]);

function hospitalEvent(input: DomainCommandInput, eventId: string): Record<string, unknown> {
  const transportId = requireText(input.current.payload.transport_id, "hospital_object_required");
  const event = (input.sceneRows ?? []).find((row) =>
    text(row.event_id) === eventId && text(row.transport_id) === transportId,
  );
  if (!event) throw new Error("hospital_event_invalid");
  return event;
}

function isHospitalConflict(event: Record<string, unknown>): boolean {
  return String(event.late_event ?? "").toLowerCase() === "true" ||
    (text(event.conflict_type) !== "" && text(event.conflict_type) !== "none");
}

function validateHospitalEvidence(input: DomainCommandInput, event: Record<string, unknown>): void {
  const expected = [event.event_id, event.bed_request_id, event.flow_token]
    .map(text)
    .filter(Boolean);
  if (!sameStrings(uniqueStrings(input.evidenceIds, "hospital_evidence_mismatch"), [...new Set(expected)])) {
    throw new Error("hospital_evidence_mismatch");
  }
}

function validateCase05(input: DomainCommandInput): void {
  const data = record(input.data);
  if (input.command === "nurse_confirm") {
    const event = hospitalEvent(input, requireText(data.selectedEventId, "event_required"));
    if (!HOSPITAL_AUTHORITATIVE_STATES.has(requireText(data.authoritativeState, "authoritative_state_required"))) {
      throw new Error("hospital_state_invalid");
    }
    if (requireText(data.reconciliationReason, "reconciliation_reason_required").length < 8) {
      throw new Error("reconciliation_reason_required");
    }
    const sender = requireText(data.senderActorId, "sender_actor_required");
    if (sender !== requireText(input.actorId, "sender_actor_required")) throw new Error("actor_mismatch");
    validateHospitalEvidence(input, event);
    return;
  }
  if (input.command === "cosign_transfer") {
    const persisted = record(input.current.task);
    const event = hospitalEvent(input, requireText(persisted.selectedEventId, "persisted_task_required"));
    const sender = requireText(persisted.senderActorId, "sender_actor_required");
    const receiver = requireText(data.receiverActorId, "receiver_actor_required");
    if (receiver !== requireText(input.actorId, "receiver_actor_required")) throw new Error("actor_mismatch");
    if (sender === receiver) throw new Error("actor_separation_required");
    if (requireText(data.cosignNote, "cosign_note_required").length < 4) throw new Error("cosign_note_required");
    validateHospitalEvidence(input, event);
    return;
  }
  if (input.command === "escalate_conflict") {
    const event = hospitalEvent(input, requireText(data.selectedEventId, "event_required"));
    if (!isHospitalConflict(event)) throw new Error("hospital_event_invalid");
    if (requireText(data.reconciliationReason ?? input.reason, "reconciliation_reason_required").length < 8) {
      throw new Error("reconciliation_reason_required");
    }
    const actor = requireText(input.actorId, "receiver_actor_required");
    if (text(input.current.task?.senderActorId) === actor) throw new Error("actor_separation_required");
    validateHospitalEvidence(input, event);
    return;
  }
  if (input.command === "reopen_late_event") {
    const eventId = requireText(data.lateEventId, "late_event_required");
    const alreadyHandled = strings(input.current.task?.handledLateEventIds);
    if (alreadyHandled.includes(eventId)) throw new Error("late_event_already_handled");
    const event = hospitalEvent(input, eventId);
    const conflictType = requireText(event.conflict_type, "late_event_required");
    if (
      !["late_event", "late_reopen"].includes(conflictType) ||
      String(event.late_event ?? "").toLowerCase() !== "true" ||
      requireText(data.lateEventOccurredAt, "late_event_required") !== requireText(event.event_time, "late_event_required") ||
      requireText(data.lateEventReceivedAt, "late_event_required") !== requireText(event.received_at, "late_event_required")
    ) {
      throw new Error("late_event_required");
    }
    const nextHandled = uniqueStrings(data.handledLateEventIds, "late_event_required");
    if (!sameStrings(nextHandled, [...alreadyHandled, eventId])) throw new Error("late_event_required");
    requireText(input.actorId, "sender_actor_required");
    validateHospitalEvidence(input, event);
  }
}

const AIR_POLLUTANTS = ["PM2.5", "PM10", "SO2", "NO2", "CO", "O3"] as const;

function airValue(value: unknown): string {
  return value === undefined || value === null ? "" : String(value).trim();
}

function validateAirPackage(
  input: DomainCommandInput,
  value: unknown,
): Record<string, unknown> {
  const releasePackage = record(value);
  const payload = input.current.payload;
  const station = requireText(payload.station, "air_release_object_required");
  const observedAt = requireText(payload.observed_at, "air_release_object_required");
  const sourceRowId = requireText(payload.No, "air_release_object_required");
  const expectedPackageId = `AQ-${observedAt.slice(0, 10).replaceAll("-", "")}-${station}-${sourceRowId}-v1`;
  if (
    requireText(releasePackage.packageId, "air_release_package_required") !== expectedPackageId ||
    requireText(releasePackage.version, "air_release_package_required") !== "1.0" ||
    requireText(releasePackage.station, "air_release_package_required") !== station ||
    requireText(releasePackage.observedAt, "air_release_package_required") !== observedAt ||
    requireText(releasePackage.sourceRowId, "air_release_package_required") !== sourceRowId
  ) {
    throw new Error("air_release_package_mismatch");
  }
  const submittedPollutants = record(releasePackage.pollutants);
  if (AIR_POLLUTANTS.some((key) => airValue(submittedPollutants[key]) !== airValue(payload[key]))) {
    throw new Error("air_release_package_mismatch");
  }
  return releasePackage;
}

function airMissingPollutants(input: DomainCommandInput): string[] {
  return AIR_POLLUTANTS.filter((key) => airValue(input.current.payload[key]) === "");
}

function validateAirCompleteness(input: DomainCommandInput, value: unknown): void {
  const completeness = record(value);
  if (AIR_POLLUTANTS.some((key) => completeness[key] !== (airValue(input.current.payload[key]) ? "present" : "missing"))) {
    throw new Error("air_release_completeness_mismatch");
  }
}

function validateCase06(input: DomainCommandInput): void {
  const data = record(input.data);
  const station = requireText(input.current.payload.station, "air_release_object_required");
  const observedAt = requireText(input.current.payload.observed_at, "air_release_object_required");
  const sourceRowId = requireText(input.current.payload.No, "air_release_object_required");
  const missing = airMissingPollutants(input);
  if (input.command === "freeze_release_scope") {
    const releasePackage = validateAirPackage(input, data.releasePackage);
    validateAirCompleteness(input, data.completeness);
    if (missing.length) throw new Error("air_release_incomplete");
    if (requireText(data.reviewNote, "review_note_required").length < 6) throw new Error("review_note_required");
    const reviewer = requireText(data.reviewerId, "sender_actor_required");
    if (reviewer !== requireText(input.actorId, "sender_actor_required")) throw new Error("actor_mismatch");
    if (
      !input.evidenceIds.includes(`station-hour:${station}:${observedAt}`) ||
      !input.evidenceIds.includes(`source-row:${sourceRowId}`) ||
      requireText(releasePackage.packageId, "air_release_package_required").length < 8
    ) throw new Error("air_release_evidence_mismatch");
    return;
  }
  if (input.command === "publish") {
    const persistedPackage = validateAirPackage(input, input.current.task?.releasePackage);
    validateAirCompleteness(input, input.current.task?.completeness);
    const submittedPackage = validateAirPackage(input, data.releasePackage);
    if (
      requireText(persistedPackage.packageId, "persisted_task_required") !==
      requireText(submittedPackage.packageId, "air_release_package_required")
    ) throw new Error("air_release_package_mismatch");
    if (missing.length) throw new Error("air_release_incomplete");
    const reviewer = requireText(input.current.task?.reviewerId, "sender_actor_required");
    const approver = requireText(data.approverId, "receiver_actor_required");
    if (approver !== requireText(input.actorId, "receiver_actor_required")) throw new Error("actor_mismatch");
    if (approver === reviewer) throw new Error("actor_separation_required");
    if (requireText(data.approvalNote, "review_note_required").length < 6) throw new Error("review_note_required");
    if (!input.evidenceIds.includes(`release-package:${text(submittedPackage.packageId)}`)) {
      throw new Error("air_release_evidence_mismatch");
    }
    return;
  }
  if (input.command === "reject_release") {
    const submittedMissing = uniqueStrings(data.missingPollutants, "air_release_missing_required");
    if (
      submittedMissing.length !== missing.length ||
      missing.some((key) => !submittedMissing.includes(key)) ||
      submittedMissing.some((key) => !AIR_POLLUTANTS.includes(key as typeof AIR_POLLUTANTS[number]))
    ) throw new Error("air_release_completeness_mismatch");
    if (requireText(data.returnReason ?? input.reason, "decision_reason_required").length < 6) {
      throw new Error("decision_reason_required");
    }
    const approver = requireText(data.approverId, "receiver_actor_required");
    if (approver !== requireText(input.actorId, "receiver_actor_required")) throw new Error("actor_mismatch");
  }
}

const ARCHITECTURE_FACTS = new Set(["public-order-slice", "synthetic-domain-record", "source-boundary"]);
const ARCHITECTURE_CONSTRAINTS = new Set(["team-capacity", "release-coupling", "transaction-boundary", "operability"]);
const ARCHITECTURE_RISKS = new Set(["duplicate-delivery", "out-of-order", "replay", "rollback"]);
const OBSERVABILITY_SIGNALS = new Set(["调用链", "容量曲线", "变更影响"]);

function architectureWindow(input: DomainCommandInput): { facilityCode: string; scenarioDate: string; adrId: string } {
  const facilityCode = requireText(input.current.payload.facility_code, "architecture_object_required");
  const scenarioDate = requireText(input.current.payload.scenario_date, "architecture_object_required");
  return {
    facilityCode,
    scenarioDate,
    adrId: `ADR-07-${facilityCode}-${scenarioDate}`,
  };
}

function validateArchitectureEvidence(input: DomainCommandInput, value: unknown): Record<string, unknown> {
  const task = record(value);
  const facts = uniqueStrings(task.facts, "architecture_facts_required");
  const hypotheses = uniqueStrings(task.hypotheses, "architecture_hypothesis_required");
  const constraints = uniqueStrings(task.constraints, "architecture_constraints_required");
  const risks = uniqueStrings(task.risks, "architecture_risks_required");
  if (facts.length < 2 || facts.some((item) => !ARCHITECTURE_FACTS.has(item))) throw new Error("architecture_facts_invalid");
  if (hypotheses.length !== 1 || hypotheses[0].length < 8) throw new Error("architecture_hypothesis_required");
  if (constraints.length < 2 || constraints.some((item) => !ARCHITECTURE_CONSTRAINTS.has(item))) throw new Error("architecture_constraints_invalid");
  if (risks.length < 2 || risks.some((item) => !ARCHITECTURE_RISKS.has(item))) throw new Error("architecture_risks_invalid");
  const adr = record(task.adr);
  const window = architectureWindow(input);
  if (
    requireText(adr.adrId, "architecture_adr_required") !== window.adrId ||
    requireText(adr.context, "architecture_adr_required").length < 8 ||
    adr.status !== "proposed"
  ) throw new Error("architecture_adr_invalid");
  requireText(task.createdBy, "sender_actor_required");
  if (facts.includes("public-order-slice") && !input.evidenceIds.includes("public-order-slice:DATA-07")) {
    throw new Error("architecture_evidence_mismatch");
  }
  if (facts.includes("synthetic-domain-record") && !input.evidenceIds.includes(`ops:${window.facilityCode}:${window.scenarioDate}`)) {
    throw new Error("architecture_evidence_mismatch");
  }
  if (facts.includes("source-boundary") && !input.evidenceIds.includes("source-boundary:public-plus-synthetic")) {
    throw new Error("architecture_evidence_mismatch");
  }
  return task;
}

function validateArchitectureDecision(input: DomainCommandInput, decision: "modular_monolith" | "event_contract_pilot"): void {
  const persisted = validateArchitectureEvidence(input, input.current.task);
  const data = record(input.data);
  const persistedAdr = record(persisted.adr);
  const submittedAdr = record(data.adr);
  if (
    requireText(submittedAdr.adrId, "architecture_adr_required") !== requireText(persistedAdr.adrId, "architecture_adr_required") ||
    requireText(submittedAdr.context, "architecture_adr_required") !== requireText(persistedAdr.context, "architecture_adr_required") ||
    submittedAdr.status !== "accepted" ||
    submittedAdr.decision !== decision ||
    requireText(submittedAdr.rationale, "architecture_rationale_required").length < 8
  ) throw new Error("architecture_adr_invalid");
  const signature = record(data.signature);
  const signer = requireText(signature.signerId, "receiver_actor_required");
  if (signer !== requireText(input.actorId, "receiver_actor_required")) throw new Error("actor_mismatch");
  if (signer === requireText(persisted.createdBy, "sender_actor_required")) throw new Error("actor_separation_required");
  const expectedStatement = decision === "modular_monolith"
    ? "同意继续模块化观察并承担后续复核"
    : "同意批准单事件试点并承担验收复核";
  if (requireText(signature.statement, "architecture_signature_required") !== expectedStatement) {
    throw new Error("architecture_signature_invalid");
  }
  if (decision === "event_contract_pilot") {
    const contract = record(data.eventContract);
    const requiredFields = ["eventName", "producer", "consumer", "schemaVersion", "idempotencyField", "orderingKey", "replayPolicy", "rollbackPlan", "owner", "acceptanceCriteria"];
    if (requiredFields.some((field) => requireText(contract[field], "architecture_contract_required").length < 2)) {
      throw new Error("architecture_contract_required");
    }
    if (
      contract.producer === contract.consumer ||
      !/^\d+\.\d+\.\d+$/u.test(text(contract.schemaVersion)) ||
      contract.idempotencyField === contract.orderingKey ||
      requireText(contract.replayPolicy, "architecture_contract_required").length < 12 ||
      !text(contract.replayPolicy).includes("重放") ||
      requireText(contract.rollbackPlan, "architecture_contract_required").length < 12 ||
      !/(回退|停止|关闭)/u.test(text(contract.rollbackPlan)) ||
      requireText(contract.acceptanceCriteria, "architecture_contract_required").length < 12
    ) {
      throw new Error("architecture_contract_invalid");
    }
  }
}

function validateObservabilityRequest(input: DomainCommandInput): void {
  const persisted = validateArchitectureEvidence(input, input.current.task);
  const request = record(record(input.data).request);
  if (requireText(request.adrId, "architecture_adr_required") !== requireText(record(persisted.adr).adrId, "architecture_adr_required")) {
    throw new Error("architecture_adr_invalid");
  }
  const signals = uniqueStrings(request.requestedSignals, "observability_evidence_required");
  if (signals.length < 2 || signals.some((item) => !OBSERVABILITY_SIGNALS.has(item))) {
    throw new Error("observability_evidence_invalid");
  }
  if (requireText(request.reason, "decision_reason_required").length < 12) throw new Error("decision_reason_required");
  const actor = requireText(request.requestedBy, "receiver_actor_required");
  if (actor !== requireText(input.actorId, "receiver_actor_required")) throw new Error("actor_mismatch");
  if (actor === requireText(persisted.createdBy, "sender_actor_required")) throw new Error("actor_separation_required");
}

function validateCase07(input: DomainCommandInput): void {
  if (input.command === "verify_evidence") {
    const task = validateArchitectureEvidence(input, input.data);
    if (requireText(task.createdBy, "sender_actor_required") !== requireText(input.actorId, "sender_actor_required")) {
      throw new Error("actor_mismatch");
    }
    return;
  }
  if (input.command === "keep_modular_monolith") validateArchitectureDecision(input, "modular_monolith");
  if (input.command === "request_observability_evidence") validateObservabilityRequest(input);
  if (input.command === "start_event_contract_pilot") validateArchitectureDecision(input, "event_contract_pilot");
}

function validateCase08(input: DomainCommandInput): void {
  const data = record(input.data);
  const eventId = requireText(input.current.payload.event_id, "event_required");
  const regionId = requireText(input.current.payload.region_id, "event_required");
  if (input.command === "dispatch_field_check") {
    const dispatch = record(data.dispatch);
    if (requireText(dispatch.eventId, "event_required") !== eventId || requireText(dispatch.regionId, "event_required") !== regionId) {
      throw new Error("field_event_mismatch");
    }
    requireText(dispatch.fieldOperatorId, "field_operator_required");
    if (requireText(dispatch.note, "investigation_reason_required").length < 6) throw new Error("investigation_reason_required");
    if (requireText(dispatch.evidenceIssue, "field_evidence_issue_required") !== requireText(input.current.payload.evidence_status, "field_evidence_issue_required")) {
      throw new Error("field_evidence_issue_mismatch");
    }
    const required = new Set(uniqueStrings(dispatch.requiredEvidence, "field_evidence_required"));
    for (const item of ["temperature_c", "dissolved_oxygen_mg_l", "ph", "turbidity_ntu", "field_photo"]) {
      if (!required.has(item)) throw new Error("field_evidence_required");
    }
    if (requireText(dispatch.createdBy, "sender_actor_required") !== requireText(input.actorId, "sender_actor_required")) {
      throw new Error("actor_mismatch");
    }
    return;
  }
  if (input.command === "submit_field_return") {
    const dispatch = record(input.current.task?.dispatch);
    if (requireText(dispatch.eventId, "persisted_task_required") !== eventId) throw new Error("field_event_mismatch");
    const returned = record(data.fieldReturn);
    if (requireText(returned.eventId, "event_required") !== eventId) throw new Error("field_event_mismatch");
    const operator = requireText(returned.operatorId, "field_operator_required");
    if (operator !== requireText(input.actorId, "field_operator_required") || operator !== requireText(dispatch.fieldOperatorId, "field_operator_required")) {
      throw new Error("actor_mismatch");
    }
    requireText(returned.capturedAt, "field_capture_required");
    const photo = requireText(returned.photoAssetId, "field_photo_required");
    const temperature = number(returned.temperatureC, "field_reading_required");
    const oxygen = number(returned.dissolvedOxygenMgL, "field_reading_required");
    const ph = number(returned.ph, "field_reading_required");
    const turbidity = number(returned.turbidityNtu, "field_reading_required");
    if (temperature < 0 || temperature > 45 || oxygen < 0 || oxygen > 25 || ph < 0 || ph > 14 || turbidity < 0 || turbidity > 1_000) {
      throw new Error("field_reading_invalid");
    }
    if (!input.evidenceIds.includes(photo)) throw new Error("field_photo_required");
    return;
  }
  if (input.command === "confirm_event") {
    const dispatch = record(input.current.task?.dispatch);
    if (requireText(dispatch.eventId, "persisted_task_required") !== eventId) throw new Error("field_event_mismatch");
    const returned = record(input.current.task?.fieldReturn);
    const photo = requireText(returned.photoAssetId, "field_photo_required");
    const operator = requireText(returned.operatorId, "field_operator_required");
    if (!input.evidenceIds.includes(photo)) throw new Error("field_photo_required");
    const validation = record(data.validation);
    if (validation.issueResolved !== true) throw new Error("field_issue_unresolved");
    if (requireText(validation.originalEvidenceStatus, "field_evidence_issue_required") !== requireText(input.current.payload.evidence_status, "field_evidence_issue_required")) {
      throw new Error("field_evidence_issue_mismatch");
    }
    if (requireText(validation.note, "review_note_required").length < 6) throw new Error("review_note_required");
    const supervisor = requireText(validation.confirmedBy, "receiver_actor_required");
    if (supervisor !== requireText(input.actorId, "receiver_actor_required")) throw new Error("actor_mismatch");
    if (supervisor === operator || supervisor === requireText(dispatch.createdBy, "sender_actor_required")) {
      throw new Error("actor_separation_required");
    }
    return;
  }
  if (input.command === "hold_for_evidence") {
    const hold = record(data.hold);
    if (requireText(hold.eventId, "event_required") !== eventId) throw new Error("field_event_mismatch");
    uniqueStrings(hold.missingEvidence, "field_evidence_required");
    if (requireText(hold.reason ?? input.reason, "decision_reason_required").length < 6) throw new Error("decision_reason_required");
    if (requireText(hold.heldBy, "receiver_actor_required") !== requireText(input.actorId, "receiver_actor_required")) {
      throw new Error("actor_mismatch");
    }
  }
}

const METRO_TRACES = new Set(["TP2", "TP3", "H1", "DV_pressure", "Oil_temperature", "Motor_current"]);
const METRO_CHECKS = new Set([
  "核对五分钟窗口与故障边界",
  "核对传感字段、样本数与来源",
  "确认现场检查不触发设备控制",
]);

function validateMetroRetrieval(value: unknown): Record<string, unknown> {
  const retrieval = record(value);
  if (requireText(retrieval.question, "retrieval_question_required").length < 8) throw new Error("retrieval_question_required");
  const query = requireText(retrieval.query, "retrieval_query_required");
  const activeTrace = requireText(retrieval.activeTrace, "retrieval_trace_required");
  if (!METRO_TRACES.has(activeTrace) || !query.includes(activeTrace === "Oil_temperature" ? "油温" : activeTrace)) {
    throw new Error("retrieval_query_mismatch");
  }
  const timestamp = requireText(retrieval.timestamp, "retrieval_window_required");
  const start = requireText(retrieval.windowStart, "retrieval_window_required");
  const end = requireText(retrieval.windowEnd, "retrieval_window_required");
  if (timestamp < start || timestamp > end) throw new Error("retrieval_window_invalid");
  const ranked = records(retrieval.rankedResults);
  if (!ranked.length) throw new Error("retrieval_results_required");
  const ids = ranked.map((item) => requireText(item.id, "retrieval_results_required"));
  if (new Set(ids).size !== ids.length) throw new Error("retrieval_results_invalid");
  for (let index = 0; index < ranked.length; index += 1) {
    const item = ranked[index];
    const stance = requireText(item.stance, "retrieval_results_required");
    if (!["support", "constraint"].includes(stance)) throw new Error("retrieval_results_invalid");
    number(item.score, "retrieval_results_required");
    requireText(item.version, "retrieval_results_required");
    if (index > 0 && number(ranked[index - 1].score) < number(item.score)) throw new Error("retrieval_results_invalid");
  }
  requireText(retrieval.createdBy, "sender_actor_required");
  return retrieval;
}

function validateCase09(input: DomainCommandInput): void {
  const data = record(input.data);
  if (input.command === "run_retrieval") {
    const retrieval = validateMetroRetrieval(data.retrieval);
    if (requireText(retrieval.createdBy, "sender_actor_required") !== requireText(input.actorId, "sender_actor_required")) throw new Error("actor_mismatch");
    const expectedEvidence = records(retrieval.rankedResults).map((item) => `${text(item.id)}@${text(item.version)}`);
    if (expectedEvidence.some((item) => !input.evidenceIds.includes(item))) throw new Error("retrieval_evidence_mismatch");
    return;
  }
  if (input.command === "create_inspection_order") {
    const retrieval = validateMetroRetrieval(input.current.task?.retrieval);
    const inspection = record(data.inspection);
    if (
      requireText(inspection.query, "retrieval_query_required") !== requireText(retrieval.query, "retrieval_query_required") ||
      requireText(inspection.activeTrace, "retrieval_trace_required") !== requireText(retrieval.activeTrace, "retrieval_trace_required") ||
      requireText(inspection.timestamp, "retrieval_window_required") !== requireText(retrieval.timestamp, "retrieval_window_required")
    ) throw new Error("retrieval_task_mismatch");
    const start = requireText(retrieval.windowStart, "retrieval_window_required");
    const end = requireText(retrieval.windowEnd, "retrieval_window_required");
    const windowRows = (input.sceneRows ?? [])
      .map((row) => text(row.timestamp))
      .filter((timestamp) => timestamp >= start && timestamp <= end)
      .map((timestamp) => Date.parse(timestamp.replace(" ", "T") + "Z"))
      .filter((timestamp) => Number.isFinite(timestamp))
      .sort((left, right) => left - right);
    if (windowRows.length < 3) throw new Error("telemetry_window_incomplete");
    let maxGapSeconds = 0;
    for (let index = 1; index < windowRows.length; index += 1) {
      maxGapSeconds = Math.max(maxGapSeconds, (windowRows[index] - windowRows[index - 1]) / 1_000);
    }
    if (maxGapSeconds >= 120) throw new Error("telemetry_gap_unresolved");
    const support = uniqueStrings(inspection.supportCitationIds, "retrieval_citation_required");
    const challenge = uniqueStrings(inspection.challengeCitationIds, "retrieval_citation_required");
    if (support.some((id) => challenge.includes(id))) throw new Error("retrieval_citation_overlap");
    const byId = new Map(records(retrieval.rankedResults).map((item) => [text(item.id), text(item.stance)]));
    if (support.some((id) => byId.get(id) !== "support") || challenge.some((id) => byId.get(id) !== "constraint")) {
      throw new Error("retrieval_citation_invalid");
    }
    const checks = new Set(uniqueStrings(inspection.checked, "inspection_checklist_required"));
    if (checks.size !== METRO_CHECKS.size || [...METRO_CHECKS].some((item) => !checks.has(item))) throw new Error("inspection_checklist_required");
    if (requireText(inspection.note, "investigation_reason_required").length < 6) throw new Error("investigation_reason_required");
    if (inspection.requestedAction !== "on_site_visual_inspection") throw new Error("inspection_action_invalid");
    const reviewer = requireText(inspection.reviewedBy, "receiver_actor_required");
    if (reviewer !== requireText(input.actorId, "receiver_actor_required")) throw new Error("actor_mismatch");
    if (reviewer === requireText(retrieval.createdBy, "sender_actor_required")) throw new Error("actor_separation_required");
    return;
  }
  if (input.command === "hold_investigation") {
    const hold = record(data.hold);
    if (requireText(hold.reason ?? input.reason, "decision_reason_required").length < 6) throw new Error("decision_reason_required");
    if (!METRO_TRACES.has(requireText(hold.activeTrace, "retrieval_trace_required"))) throw new Error("retrieval_trace_required");
    if (requireText(hold.reviewedBy, "receiver_actor_required") !== requireText(input.actorId, "receiver_actor_required")) throw new Error("actor_mismatch");
  }
}

const BOILER_SEGMENTS = new Set([
  "outlet-temperature-chain",
  "final-superheater-section",
  "desuperheater-section",
]);
const BOILER_ATTACHED_EVIDENCE = new Set([
  "minute-temperature",
  "sample-integrity",
]);
const BOILER_REQUESTED_SOURCES = new Set([
  "desuperheater-valve",
  "desuperheater-flow",
  "section-temperatures",
]);

function validateBoilerTask(
  input: DomainCommandInput,
  value: unknown,
  expectedVersion: number,
  checkEvidence: boolean,
): Record<string, unknown> {
  const task = record(value);
  const monitorMinute = requireText(input.current.payload.monitor_minute, "boiler_object_required");
  const eventId = text(input.current.payload.event_id);
  const expectedTaskId = `boiler-check:${input.current.objectId}:v${expectedVersion}`;
  if (
    requireText(task.taskId, "boiler_task_required") !== expectedTaskId ||
    requireText(task.objectId, "boiler_object_required") !== input.current.objectId ||
    number(task.objectVersion, "boiler_task_required") !== expectedVersion ||
    requireText(task.monitorMinute, "boiler_object_required") !== monitorMinute ||
    Math.abs(number(task.observedTemperatureC, "boiler_object_required") - number(input.current.payload.steam_temperature_mean, "boiler_object_required")) > 1e-6
  ) throw new Error("boiler_object_mismatch");
  if (eventId) {
    const windowStart = requireText(task.windowStartMinute, "boiler_window_required");
    const windowEnd = requireText(task.windowEndMinute, "boiler_window_required");
    if (
      requireText(task.eventId, "boiler_event_required") !== eventId ||
      windowStart !== requireText(input.current.payload.window_start_minute, "boiler_window_required") ||
      windowEnd !== requireText(input.current.payload.window_end_minute, "boiler_window_required") ||
      windowEnd !== monitorMinute ||
      number(task.windowRowCount, "boiler_window_required") !== 25
    ) throw new Error("boiler_event_mismatch");
    if (input.sceneRows) {
      const minutes = input.sceneRows
        .map((row) => text(row.monitor_minute))
        .filter((minute) => minute >= windowStart && minute <= windowEnd)
        .map((minute) => Date.parse(`${minute.replace(" ", "T")}:00Z`))
        .sort((left, right) => left - right);
      if (minutes.length !== 25 || new Set(minutes).size !== 25) throw new Error("boiler_window_invalid");
      for (let index = 1; index < minutes.length; index += 1) {
        if (minutes[index]! - minutes[index - 1]! !== 60_000) throw new Error("boiler_window_invalid");
      }
    }
  }
  if (!BOILER_SEGMENTS.has(requireText(task.segmentId, "segment_required"))) throw new Error("segment_required");
  if (requireText(task.investigationReason, "investigation_reason_required").length < 8) {
    throw new Error("investigation_reason_required");
  }
  if (requireText(task.assignee, "assignee_required").length < 2) throw new Error("assignee_required");
  const hasModernEvidenceShape = Array.isArray(task.attachedEvidenceIds) || Array.isArray(task.requestedSourceIds);
  const legacyEvidenceItems = strings(task.evidenceItems);
  if (hasModernEvidenceShape && Array.isArray(task.evidenceItems)) throw new Error("boiler_evidence_mismatch");
  const attachedEvidenceIds = hasModernEvidenceShape
    ? uniqueStrings(task.attachedEvidenceIds, "evidence_request_required")
    : legacyEvidenceItems.filter((item) => BOILER_ATTACHED_EVIDENCE.has(item));
  const requestedSourceIds = hasModernEvidenceShape
    ? strings(task.requestedSourceIds)
    : legacyEvidenceItems.filter((item) => BOILER_REQUESTED_SOURCES.has(item));
  if (new Set(requestedSourceIds).size !== requestedSourceIds.length) throw new Error("boiler_evidence_mismatch");
  if (eventId && requestedSourceIds.length < 1) throw new Error("boiler_requested_source_required");
  const knownLegacyItems = new Set([...attachedEvidenceIds, ...requestedSourceIds]);
  if (
    attachedEvidenceIds.some((item) => !BOILER_ATTACHED_EVIDENCE.has(item)) ||
    requestedSourceIds.some((item) => !BOILER_REQUESTED_SOURCES.has(item)) ||
    legacyEvidenceItems.some((item) => !knownLegacyItems.has(item)) ||
    !attachedEvidenceIds.includes("minute-temperature") ||
    !attachedEvidenceIds.includes("sample-integrity")
  ) throw new Error("boiler_evidence_mismatch");
  const creator = requireText(task.createdBy, "sender_actor_required");
  if (checkEvidence) {
    if (creator !== requireText(input.actorId, "sender_actor_required")) throw new Error("actor_mismatch");
    const expectedEvidence = eventId
      ? [
          `boiler-event:${eventId}`,
          `boiler-window:${requireText(task.windowStartMinute, "boiler_window_required")}:${monitorMinute}`,
          ...attachedEvidenceIds,
        ]
      : [`boiler-window:${monitorMinute}`, ...attachedEvidenceIds];
    if (!sameStrings(uniqueStrings(input.evidenceIds, "boiler_evidence_mismatch"), expectedEvidence)) {
      throw new Error("boiler_evidence_mismatch");
    }
  }
  return task;
}

function validateCase18(input: DomainCommandInput): void {
  const data = record(input.data);
  const monitorMinute = requireText(input.current.payload.monitor_minute, "boiler_object_required");
  if (input.command === "dispatch_shift_check") {
    if (requireText(input.current.payload.temperature_state, "boiler_condition_invalid") === "区间内") {
      throw new Error("boiler_condition_invalid");
    }
    validateBoilerTask(input, data, input.current.version + 1, true);
    return;
  }
  if (input.command === "confirm_segment") {
    const persisted = validateBoilerTask(input, input.current.task, input.current.version, false);
    if (requireText(data.segmentId, "segment_required") !== requireText(persisted.segmentId, "segment_required")) {
      throw new Error("segment_mismatch");
    }
    const supervisor = requireText(data.supervisorId, "receiver_actor_required");
    if (supervisor !== requireText(input.actorId, "receiver_actor_required")) throw new Error("actor_mismatch");
    if (supervisor === requireText(persisted.createdBy, "sender_actor_required")) throw new Error("actor_separation_required");
    if (
      requireText(data.prerequisiteTaskId, "persisted_task_required") !== requireText(persisted.taskId, "persisted_task_required") ||
      requireText(data.supervisorNote, "review_note_required").length < 4
    ) throw new Error("boiler_confirmation_invalid");
    const eventId = text(input.current.payload.event_id);
    const expectedEvidence = [
      ...(eventId ? [`boiler-event:${eventId}`] : []),
      eventId
        ? `boiler-window:${requireText(persisted.windowStartMinute, "boiler_window_required")}:${monitorMinute}`
        : `boiler-window:${monitorMinute}`,
      `boiler-task:${requireText(persisted.taskId, "persisted_task_required")}`,
    ];
    if (!sameStrings(uniqueStrings(input.evidenceIds, "boiler_evidence_mismatch"), expectedEvidence)) {
      throw new Error("boiler_evidence_mismatch");
    }
    return;
  }
  if (input.command === "hold_control_change") {
    if (
      requireText(input.current.payload.temperature_state, "boiler_condition_invalid") === "区间内" ||
      number(input.current.payload.consecutive_deviation_minutes, "boiler_condition_invalid") < 10
    ) throw new Error("boiler_condition_invalid");
    if (!BOILER_SEGMENTS.has(requireText(data.segmentId, "segment_required"))) throw new Error("segment_required");
    if (requireText(data.investigationReason ?? input.reason, "investigation_reason_required").length < 8) {
      throw new Error("investigation_reason_required");
    }
    const supervisor = requireText(data.supervisorId, "receiver_actor_required");
    if (supervisor !== requireText(input.actorId, "receiver_actor_required")) throw new Error("actor_mismatch");
    if (supervisor === text(input.current.task?.createdBy)) throw new Error("actor_separation_required");
    const eventId = text(input.current.payload.event_id);
    const expectedEvidence = eventId
      ? [
          `boiler-event:${eventId}`,
          `boiler-window:${requireText(input.current.payload.window_start_minute, "boiler_window_required")}:${monitorMinute}`,
        ]
      : [`boiler-window:${monitorMinute}`];
    if (!sameStrings(uniqueStrings(input.evidenceIds, "boiler_evidence_mismatch"), expectedEvidence)) {
      throw new Error("boiler_evidence_mismatch");
    }
  }
}

function validateCase10(input: DomainCommandInput): void {
  const data = record(input.data);
  const task = mergedTask(input);
  const localRecoveryKey = requireText(task.localRecoveryKey ?? task.businessIdempotencyKey, "local_recovery_key_required");
  if (
    input.idempotencyKey !== localRecoveryKey &&
    input.idempotencyKey !== `${localRecoveryKey}:${input.command}`
  ) {
    throw new Error("idempotency_key_mismatch");
  }
  const actor = requireText(input.actorId, "sender_actor_required");
  if (input.command === "start_lookup") {
    const plan = record(data.recoveryPlan);
    requireText(plan.lookupTarget, "telecom_lookup_target_required");
    if (requireText(plan.note, "investigation_reason_required").length < 4) throw new Error("investigation_reason_required");
    if (requireText(data.createdBy, "sender_actor_required") !== actor) throw new Error("actor_mismatch");
    return;
  }
  if (input.command === "retry_idempotent") {
    const persisted = input.current.task ?? {};
    if (requireText(persisted.localRecoveryKey ?? persisted.businessIdempotencyKey, "persisted_task_required") !== localRecoveryKey) {
      throw new Error("idempotency_key_mismatch");
    }
    const result = record(data.lookupResult);
    if (!new Set(["effective", "not_effective"]).has(requireText(result.status, "telecom_lookup_result_invalid"))) {
      throw new Error("telecom_lookup_result_invalid");
    }
    if (requireText(result.summary, "telecom_lookup_summary_required").length < 4) throw new Error("telecom_lookup_summary_required");
    const evidenceId = requireText(result.evidenceId, "telecom_lookup_evidence_required");
    if (!input.evidenceIds.includes(evidenceId)) throw new Error("telecom_lookup_evidence_mismatch");
    if (requireText(result.checkedBy, "sender_actor_required") !== actor) throw new Error("actor_mismatch");
    return;
  }
  if (input.command === "keep_pending") {
    if (requireText(data.pendingReason ?? input.reason, "decision_reason_required").length < 4) throw new Error("decision_reason_required");
    if (Object.keys(record(data.lookupResult)).length) throw new Error("telecom_lookup_result_invalid");
    return;
  }
  if (input.command === "close_task") {
    const persisted = input.current.task ?? {};
    const result = record(persisted.lookupResult);
    if (!new Set(["effective", "not_effective"]).has(requireText(result.status, "telecom_lookup_result_invalid"))) {
      throw new Error("telecom_lookup_result_invalid");
    }
    const evidenceId = requireText(result.evidenceId, "telecom_lookup_evidence_required");
    if (!input.evidenceIds.includes(evidenceId)) throw new Error("telecom_lookup_evidence_mismatch");
    const decisionBy = requireText(data.decisionBy, "receiver_actor_required");
    if (decisionBy !== actor) throw new Error("actor_mismatch");
    if (decisionBy === requireText(persisted.createdBy, "sender_actor_required")) throw new Error("actor_separation_required");
    if (requireText(data.closeNote, "review_note_required").length < 4) throw new Error("review_note_required");
  }
}

function comparatorPass(value: number, comparator: string, threshold: number): boolean {
  if (comparator === ">=") return value >= threshold;
  if (comparator === ">") return value > threshold;
  if (comparator === "<") return value < threshold;
  if (comparator === "<=") return value <= threshold;
  throw new Error("model_comparator_invalid");
}

function validateModelCandidate(input: DomainCommandInput, data: Record<string, unknown>): void {
  if (data.aggregateType !== "model_admission_candidate") throw new Error("model_candidate_required");
  if (requireText(data.candidateId, "model_candidate_required") !== requireText(input.current.payload.candidate_id, "model_candidate_required")) {
    throw new Error("model_candidate_mismatch");
  }
  requireText(data.candidateVersion, "model_candidate_required");
  if (requireText(data.policyVersion, "model_policy_required") !== requireText(input.current.payload.policy_version, "model_policy_required")) {
    throw new Error("model_policy_mismatch");
  }
  if (requireText(data.selectedEvaluationId, "model_evaluation_required") !== requireText(input.current.payload.evaluation_id, "model_evaluation_required")) {
    throw new Error("model_evaluation_mismatch");
  }
  const gateSet = records(data.gateSet);
  if (gateSet.length < 3) throw new Error("model_gate_set_required");
  const gateIds = gateSet.map((item) => requireText(item.evaluationId, "model_gate_set_required"));
  if (new Set(gateIds).size !== gateIds.length) throw new Error("model_gate_set_invalid");
  const gates = new Set(gateSet.map((item) => requireText(item.gate, "model_gate_set_required")));
  if (!["risk", "fairness", "safety"].every((gate) => gates.has(gate))) throw new Error("model_gate_set_required");
  if (gateSet.some((item) => !["pass", "fail"].includes(requireText(item.result, "model_gate_set_required")))) throw new Error("model_gate_set_invalid");
  if (!gateIds.includes(requireText(data.selectedEvaluationId))) throw new Error("model_evaluation_mismatch");
  requireText(data.createdBy, "sender_actor_required");
}

function validateCase11(input: DomainCommandInput): void {
  const data = record(input.data);
  validateModelCandidate(input, data);
  const retest = record(data.retest);
  requireText(retest.retestId, "model_retest_required");
  if (requireText(retest.sourceEvaluationId, "model_retest_required") !== requireText(data.selectedEvaluationId, "model_evaluation_required")) {
    throw new Error("model_retest_mismatch");
  }
  if (requireText(retest.sliceId, "model_retest_required") !== requireText(input.current.payload.slice_id, "model_retest_required")) {
    throw new Error("model_retest_mismatch");
  }
  const targetSample = positiveInteger(retest.targetSampleSize, "model_retest_required");
  if (targetSample < positiveInteger(input.current.payload.sample_size, "model_retest_required")) throw new Error("model_retest_sample_invalid");
  requireText(retest.datasetVersion, "model_retest_required");

  if (input.command === "request_release_evidence") {
    if (retest.metricValue !== null || retest.evidenceStatus !== "planned" || retest.computedResult !== "pending") {
      throw new Error("model_retest_invalid");
    }
    if (data.decision !== "request_retest") throw new Error("model_decision_invalid");
    if (requireText(data.createdBy, "sender_actor_required") !== requireText(input.actorId, "sender_actor_required")) throw new Error("actor_mismatch");
    if (requireText(data.note, "investigation_reason_required").length < 4) throw new Error("investigation_reason_required");
    return;
  }

  const chair = requireText(data.decisionBy, "receiver_actor_required");
  if (chair !== requireText(input.actorId, "receiver_actor_required")) throw new Error("actor_mismatch");
  if (chair === requireText(data.createdBy, "sender_actor_required")) throw new Error("actor_separation_required");
  if (input.command === "reject_candidate") {
    if (data.decision !== "reject") throw new Error("model_decision_invalid");
    if (requireText(data.note ?? input.reason, "decision_reason_required").length < 4) throw new Error("decision_reason_required");
    return;
  }
  if (input.command === "approve_canary") {
    const persisted = input.current.task ?? {};
    if (requireText(persisted.candidateId, "persisted_task_required") !== requireText(data.candidateId, "model_candidate_required")) {
      throw new Error("model_candidate_mismatch");
    }
    const persistedRetest = record(persisted.retest);
    if (
      requireText(persistedRetest.retestId, "persisted_task_required") !== requireText(retest.retestId, "model_retest_required") ||
      requireText(persistedRetest.datasetVersion, "persisted_task_required") !== requireText(retest.datasetVersion, "model_retest_required")
    ) throw new Error("model_retest_mismatch");
    const metricValue = number(retest.metricValue, "model_retest_required");
    const threshold = number(input.current.payload.threshold, "model_retest_required");
    const pass = comparatorPass(metricValue, requireText(input.current.payload.comparator, "model_comparator_invalid"), threshold);
    if (retest.evidenceStatus !== "complete" || retest.computedResult !== (pass ? "pass" : "fail") || !pass) {
      throw new Error("model_retest_not_passed");
    }
    const reviews = record(data.gateReviews);
    const signers = ["risk", "fairness", "safety"].map((gate) => {
      const review = record(reviews[gate]);
      if (review.status !== "signed" || requireText(review.role, "model_review_required") !== `${gate}_reviewer`) {
        throw new Error("model_review_required");
      }
      return requireText(review.signerId, "model_review_required");
    });
    if (new Set([...signers, chair]).size !== 4) throw new Error("actor_separation_required");
    const recomputed = records(data.recomputedGateResults);
    if (recomputed.length !== 3 || recomputed.some((item) => item.result !== "pass")) throw new Error("model_gate_not_passed");
    if (data.decision !== "approve") throw new Error("model_decision_invalid");
  }
}

function coldChainWindow(value: unknown): number {
  const source = requireText(value, "cold_chain_window_required");
  if (!/^\d{2}:\d{2}$/u.test(source)) throw new Error("cold_chain_window_invalid");
  const [hour, minute] = source.split(":").map(Number);
  if (hour > 23 || minute > 59) throw new Error("cold_chain_window_invalid");
  return hour * 60 + minute;
}

function validateColdChainAggregate(input: DomainCommandInput, data: Record<string, unknown>): void {
  if (data.aggregateType !== "cold_chain_investigation") throw new Error("cold_chain_investigation_required");
  const investigationId = requireText(input.current.payload.investigation_id, "cold_chain_investigation_required");
  const routeId = requireText(input.current.payload.route_id, "cold_chain_investigation_required");
  if (requireText(data.investigationId) !== investigationId || requireText(data.routeId) !== routeId) {
    throw new Error("cold_chain_investigation_mismatch");
  }
  const eventIds = uniqueStrings(data.routeEventIds, "cold_chain_events_required");
  if (!eventIds.includes(requireText(input.current.payload.event_id, "cold_chain_events_required"))) throw new Error("cold_chain_events_invalid");
  const window = record(data.investigationWindow);
  const sourceRange = record(window.sourceTimeRange);
  const start = coldChainWindow(window.start);
  const end = coldChainWindow(window.end);
  const sourceStart = coldChainWindow(sourceRange.start);
  const sourceEnd = coldChainWindow(sourceRange.end);
  if (start > end || start < sourceStart || end > sourceEnd) throw new Error("cold_chain_window_invalid");
  const observations = record(data.observations);
  if (number(observations.maxTemperatureC, "cold_chain_observation_required") !== number(input.current.payload.temperature_c, "cold_chain_observation_required")) {
    throw new Error("cold_chain_peak_mismatch");
  }
  const excursionIds = strings(observations.excursionEventIds);
  if (number(input.current.payload.temperature_c) > 8 && !excursionIds.includes(requireText(input.current.payload.event_id))) {
    throw new Error("cold_chain_excursion_mismatch");
  }
  if (excursionIds.some((id) => !eventIds.includes(id))) throw new Error("cold_chain_excursion_mismatch");
  requireText(data.createdBy, "sender_actor_required");
}

function validateCase12(input: DomainCommandInput): void {
  const data = record(input.data);
  validateColdChainAggregate(input, data);
  if (input.command === "open_investigation") {
    if (data.qualityDecision !== "investigate" || data.freezeScope !== null) throw new Error("cold_chain_decision_invalid");
    if (requireText(data.createdBy, "sender_actor_required") !== requireText(input.actorId, "sender_actor_required")) throw new Error("actor_mismatch");
    if (requireText(data.note, "investigation_reason_required").length < 4) throw new Error("investigation_reason_required");
    return;
  }
  const decisionBy = requireText(data.decisionBy, "receiver_actor_required");
  if (decisionBy !== requireText(input.actorId, "receiver_actor_required")) throw new Error("actor_mismatch");
  if (decisionBy === requireText(data.createdBy, "sender_actor_required")) throw new Error("actor_separation_required");
  if (input.command === "quality_cosign") {
    const persisted = input.current.task ?? {};
    if (
      requireText(persisted.investigationId, "persisted_task_required") !== requireText(data.investigationId, "cold_chain_investigation_required") ||
      requireText(persisted.routeId, "persisted_task_required") !== requireText(data.routeId, "cold_chain_investigation_required") ||
      requireText(persisted.createdBy, "persisted_task_required") !== requireText(data.createdBy, "sender_actor_required")
    ) throw new Error("cold_chain_investigation_mismatch");
    if (data.qualityDecision !== "cosign" || data.freezeScope !== null) throw new Error("cold_chain_decision_invalid");
    const gaps = strings(data.evidenceGaps);
    if (gaps.length) {
      const supplement = record(data.supplementalEvidence);
      requireText(supplement.evidenceId, "cold_chain_evidence_required");
      if (supplement.verificationStatus !== "verified") throw new Error("cold_chain_evidence_unverified");
      if (!strings(data.routeEventIds).includes(requireText(supplement.recordedAtEventId, "cold_chain_evidence_required"))) {
        throw new Error("cold_chain_evidence_mismatch");
      }
    }
    return;
  }
  if (input.command === "hold_batch") {
    if (data.qualityDecision !== "freeze") throw new Error("cold_chain_decision_invalid");
    if (requireText(data.note ?? input.reason, "decision_reason_required").length < 4) throw new Error("decision_reason_required");
    const scope = record(data.freezeScope);
    if (
      scope.scope !== "investigation_route" ||
      scope.investigationId !== data.investigationId ||
      scope.routeId !== data.routeId ||
      scope.batchId !== null ||
      scope.batchIdStatus !== "not_available_in_dataset"
    ) throw new Error("cold_chain_freeze_scope_invalid");
  }
}

function requireSameObjectId(input: DomainCommandInput, value: unknown, code: string): string {
  const submitted = requireText(value, code);
  const expected = requireText(input.current.payload.intake_id, code);
  if (submitted !== expected) {
    throw new Error(code);
  }
  return submitted;
}

const AUTO_SERVICE_ANSWERS: Record<string, Record<string, string>> = {
  drivable: { can_move: "可以", cannot_move: "不能", uncertain: "不确定", unasked: "未询问" },
  warning: { present: "有", none: "无", uncertain: "不确定", unasked: "未询问" },
  condition: { low_speed_braking: "低速制动", high_speed_braking: "高速制动", multiple_conditions: "多种条件", unasked: "未询问" },
  recurrence: { first: "首次出现", repeated: "反复出现", uncertain: "不确定", unasked: "未询问" },
};

function validateCase13Answers(value: unknown): Record<string, unknown> {
  const answers = record(value);
  for (const [questionId, answerValue] of Object.entries(answers)) {
    const allowed = AUTO_SERVICE_ANSWERS[questionId];
    if (!allowed) throw new Error("customer_answer_invalid");
    const answer = record(answerValue);
    const submittedValue = requireText(answer.value, "customer_answer_invalid");
    if (allowed[submittedValue] !== requireText(answer.label, "customer_answer_invalid")) {
      throw new Error("customer_answer_invalid");
    }
    if (answer.source !== "customer_answer") throw new Error("customer_answer_source_invalid");
  }
  return answers;
}

function missingCase13Questions(answers: Record<string, unknown>): string[] {
  return Object.keys(AUTO_SERVICE_ANSWERS).filter((questionId) => {
    const answer = record(answers[questionId]);
    return !text(answer.value) || answer.value === "unasked";
  });
}

function validateCase13Handoff(input: DomainCommandInput, value: unknown): Record<string, unknown> {
  const handoff = record(value);
  requireSameObjectId(input, handoff.intakeId, "handoff_object_mismatch");
  const answers = validateCase13Answers(handoff.answers);
  const missingQuestions = missingCase13Questions(answers);
  const drivable = record(answers.drivable).value;
  const highRisk = drivable === "cannot_move" || drivable === "uncertain";
  if (missingQuestions.length && !highRisk) throw new Error("customer_answer_incomplete");
  if (handoff.safetyNoticeAcknowledged !== true) throw new Error("safety_notice_required");
  const technician = requireText(handoff.technician, "technician_required");
  if (technician === "待分配") {
    throw new Error("technician_required");
  }
  requireText(handoff.handoffWindow, "response_window_required");
  if (requireText(handoff.note, "handoff_note_required").length < 4) {
    throw new Error("handoff_note_required");
  }
  requireText(handoff.createdBy, "sender_actor_required");
  return handoff;
}

function validateCase13(input: DomainCommandInput): void {
  const data = record(input.data);
  if (input.command === "request_details") {
    const request = record(data.detailsRequest);
    requireSameObjectId(input, request.intakeId, "handoff_object_mismatch");
    const requestedQuestionIds = uniqueStrings(request.requestedQuestionIds, "details_request_required");
    if (requestedQuestionIds.some((questionId) => !AUTO_SERVICE_ANSWERS[questionId])) {
      throw new Error("details_request_invalid");
    }
    requireText(request.assignee, "assignee_required");
    requireText(request.responseWindow, "response_window_required");
    const handoff = record(data.handoff);
    requireSameObjectId(input, handoff.intakeId, "handoff_object_mismatch");
    const answers = validateCase13Answers(handoff.answers);
    const expected = missingCase13Questions(answers);
    if (expected.length !== requestedQuestionIds.length || expected.some((questionId) => !requestedQuestionIds.includes(questionId))) {
      throw new Error("details_request_mismatch");
    }
    return;
  }
  if (input.command === "submit_triage") {
    const handoff = validateCase13Handoff(input, data.handoff);
    const actorId = requireText(input.actorId, "sender_actor_required");
    if (requireText(handoff.createdBy, "sender_actor_required") !== actorId) {
      throw new Error("actor_mismatch");
    }
    return;
  }
  if (input.command === "dispatch_rescue") {
    const persisted = validateCase13Handoff(input, input.current.task?.handoff);
    const acceptance = record(data.acceptance);
    requireSameObjectId(input, acceptance.intakeId, "handoff_object_mismatch");
    const receiver = requireText(acceptance.technicianSupervisorId, "receiver_actor_required");
    if (receiver !== requireText(input.actorId, "receiver_actor_required")) {
      throw new Error("actor_mismatch");
    }
    if (receiver === requireText(persisted.createdBy, "sender_actor_required")) {
      throw new Error("actor_separation_required");
    }
    if (requireText(acceptance.note ?? input.reason, "review_note_required").length < 4) {
      throw new Error("review_note_required");
    }
  }
}

const FLOTATION_HYPOTHESES = new Set(["air_balance", "reagent", "pulp", "instrument"]);
const FLOTATION_PROHIBITED_CLAIMS = new Set([
  "rootCause",
  "root_cause",
  "confidence",
  "setpoint",
  "recommendedSetpoint",
  "recommended_setpoint",
]);

function flotationHour(value: unknown): number {
  const source = requireText(value, "process_window_required");
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/u.test(source)) {
    throw new Error("process_window_invalid");
  }
  const parsed = Date.parse(`${source.replace(" ", "T")}+08:00`);
  if (Number.isNaN(parsed)) {
    throw new Error("process_window_invalid");
  }
  return parsed;
}

function case14PriorityCells(payload: Record<string, unknown>): string[] {
  const projected = text(payload.priority_cell_ids)
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
  if (projected.length) return [...new Set(projected)];
  return [...text(payload.dominant_deviation).matchAll(/(\d+)号浮选柱风量/gu)]
    .map((match) => match[1])
    .filter((item): item is string => Boolean(item));
}

function validateCase14WindowRows(
  input: DomainCommandInput,
  windowStart: string,
  windowEnd: string,
): void {
  if (!input.sceneRows) return;
  const timestamps = input.sceneRows
    .map((row) => text(row.monitor_hour))
    .filter((timestamp) => timestamp >= windowStart && timestamp <= windowEnd)
    .map((timestamp) => flotationHour(timestamp))
    .sort((left, right) => left - right);
  if (timestamps.length !== 72 || new Set(timestamps).size !== 72) {
    throw new Error("process_window_invalid");
  }
  for (let index = 1; index < timestamps.length; index += 1) {
    if (timestamps[index]! - timestamps[index - 1]! !== 3_600_000) {
      throw new Error("process_window_invalid");
    }
  }
}

function validateCase14Review(input: DomainCommandInput, value: unknown): Record<string, unknown> {
  const task = record(value);
  requireText(task.taskId, "process_review_required");
  if ([...FLOTATION_PROHIBITED_CLAIMS].some((field) => field in task)) {
    throw new Error("process_claim_not_allowed");
  }
  const eventId = requireText(task.eventId, "process_event_required");
  if (eventId !== requireText(input.current.payload.event_id, "process_event_required")) {
    throw new Error("process_object_mismatch");
  }
  const hours = positiveInteger(task.hours, "process_window_required");
  if (hours !== 72) {
    throw new Error("process_window_invalid");
  }
  const rowCount = positiveInteger(task.rowCount, "process_window_required");
  if (rowCount !== 72) {
    throw new Error("process_window_invalid");
  }
  const windowStart = requireText(task.windowStart, "process_window_required");
  const windowEnd = requireText(task.windowEnd, "process_window_required");
  const start = flotationHour(windowStart);
  const end = flotationHour(windowEnd);
  if (start > end || (end - start) / 3_600_000 !== 71) {
    throw new Error("process_window_invalid");
  }
  if (
    windowEnd !== requireText(input.current.payload.end_hour, "process_window_required") ||
    windowEnd !== requireText(input.current.payload.monitor_hour, "process_window_required")
  ) {
    throw new Error("process_object_mismatch");
  }
  validateCase14WindowRows(input, windowStart, windowEnd);
  const priorityCellIds = uniqueStrings(task.priorityCellIds, "process_priority_required");
  const expectedPriorityCellIds = case14PriorityCells(input.current.payload);
  if (!expectedPriorityCellIds.length || !sameStrings(priorityCellIds, expectedPriorityCellIds)) {
    throw new Error("process_priority_mismatch");
  }
  if (!FLOTATION_HYPOTHESES.has(requireText(task.hypothesis, "process_hypothesis_required"))) {
    throw new Error("process_hypothesis_invalid");
  }
  requireText(task.assignee, "assignee_required");
  const dueAt = requireText(task.dueAt, "due_at_required");
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(dueAt) || Number.isNaN(Date.parse(`${dueAt}T00:00:00+08:00`))) {
    throw new Error("due_at_invalid");
  }
  if (requireText(task.note, "investigation_reason_required").length < 4) {
    throw new Error("investigation_reason_required");
  }
  const evidenceItems = uniqueStrings(task.evidenceItems, "process_evidence_required");
  if (
    !evidenceItems.includes(`event:${eventId}`) ||
    !evidenceItems.includes(`trend:${windowStart}:${windowEnd}`) ||
    !evidenceItems.includes(`quality:${windowEnd}`) ||
    !sameStrings(
      evidenceItems.filter((item) => item.startsWith("cell-air:")).map((item) => item.slice("cell-air:".length)),
      expectedPriorityCellIds,
    )
  ) {
    throw new Error("process_evidence_invalid");
  }
  const sourceEvent = (input.supportingArtifacts?.["events.csv"] ?? [])
    .find((item) => text(item.event_id) === eventId);
  if (sourceEvent && (
    text(sourceEvent.end_hour) !== windowEnd ||
    text(sourceEvent.start_hour) !== requireText(input.current.payload.start_hour, "process_event_required") ||
    positiveInteger(sourceEvent.duration_hours, "process_event_required") !== positiveInteger(input.current.payload.duration_hours, "process_event_required") ||
    !sameStrings(case14PriorityCells(sourceEvent), expectedPriorityCellIds)
  )) {
    throw new Error("process_event_mismatch");
  }
  requireText(task.createdBy, "sender_actor_required");
  return task;
}

function sameCase14Review(left: Record<string, unknown>, right: Record<string, unknown>): boolean {
  return requireText(left.taskId, "process_review_required") === requireText(right.taskId, "process_review_required") &&
    requireText(left.eventId, "process_event_required") === requireText(right.eventId, "process_event_required") &&
    positiveInteger(left.hours, "process_window_required") === positiveInteger(right.hours, "process_window_required") &&
    positiveInteger(left.rowCount, "process_window_required") === positiveInteger(right.rowCount, "process_window_required") &&
    requireText(left.windowStart, "process_window_required") === requireText(right.windowStart, "process_window_required") &&
    requireText(left.windowEnd, "process_window_required") === requireText(right.windowEnd, "process_window_required") &&
    sameStrings(
      uniqueStrings(left.priorityCellIds, "process_priority_required"),
      uniqueStrings(right.priorityCellIds, "process_priority_required"),
    ) &&
    requireText(left.hypothesis, "process_hypothesis_required") === requireText(right.hypothesis, "process_hypothesis_required") &&
    requireText(left.assignee, "assignee_required") === requireText(right.assignee, "assignee_required") &&
    requireText(left.dueAt, "due_at_required") === requireText(right.dueAt, "due_at_required") &&
    requireText(left.note, "investigation_reason_required") === requireText(right.note, "investigation_reason_required") &&
    requireText(left.createdBy, "sender_actor_required") === requireText(right.createdBy, "sender_actor_required") &&
    sameStrings(
      uniqueStrings(left.evidenceItems, "process_evidence_required"),
      uniqueStrings(right.evidenceItems, "process_evidence_required"),
    );
}

function validateCase14Supervisor(
  input: DomainCommandInput,
  decisionValue: unknown,
  persisted?: Record<string, unknown>,
): void {
  const decision = record(decisionValue);
  const supervisorId = requireText(decision.supervisorId, "receiver_actor_required");
  if (supervisorId !== requireText(input.actorId, "receiver_actor_required")) {
    throw new Error("actor_mismatch");
  }
  if (persisted) {
    if (requireText(decision.taskId, "process_review_required") !== requireText(persisted.taskId, "process_review_required")) {
      throw new Error("process_task_mismatch");
    }
    if (supervisorId === requireText(persisted.createdBy, "sender_actor_required")) {
      throw new Error("actor_separation_required");
    }
  }
  if (requireText(decision.note ?? input.reason, "review_note_required").length < 4) {
    throw new Error("review_note_required");
  }
}

function validateCase14(input: DomainCommandInput): void {
  const data = record(input.data);
  if (input.command === "submit_process_review") {
    const task = validateCase14Review(input, data.processReview);
    const actorId = requireText(input.actorId, "sender_actor_required");
    if (requireText(task.createdBy, "sender_actor_required") !== actorId) {
      throw new Error("actor_mismatch");
    }
    return;
  }
  if (input.command === "dispatch_instrument_check" || input.command === "hold_adjustment") {
    const persistedValue = record(input.current.task?.processReview);
    const hasPersistedReview = Boolean(text(persistedValue.taskId));
    if (input.command === "hold_adjustment" && !hasPersistedReview) {
      validateCase14Supervisor(input, data.supervisorDecision);
      return;
    }
    const persisted = validateCase14Review(input, input.current.task?.processReview);
    const submitted = validateCase14Review(input, data.processReview);
    if (!sameCase14Review(submitted, persisted)) {
      throw new Error("process_task_mismatch");
    }
    validateCase14Supervisor(input, data.supervisorDecision, persisted);
  }
}

const WAFER_SENSORS = new Set([
  "sensor_021", "sensor_022", "sensor_024", "sensor_090", "sensor_158", "sensor_159",
  "sensor_160", "sensor_161", "sensor_162", "sensor_294", "sensor_295", "sensor_296",
]);

function optionalNumber(value: unknown): number | undefined {
  if (value === "" || value === null || value === undefined) return undefined;
  const result = Number(value);
  return Number.isFinite(result) ? result : undefined;
}

function sameStrings(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((item) => right.includes(item));
}

function validateWaferAggregate(input: DomainCommandInput, data: Record<string, unknown>): {
  retestTask: Record<string, unknown>;
  sensorIds: string[];
} {
  if (data.aggregateType !== "wafer_retest_case" || data.serverValidationRequired !== true) {
    throw new Error("wafer_retest_required");
  }
  const waferId = requireText(input.current.payload.wafer_id, "wafer_object_required");
  if (
    requireText(data.waferObservationId, "wafer_object_required") !== waferId ||
    number(data.observationVersion, "wafer_version_required") !== input.current.version ||
    requireText(data.sourceTimestamp, "wafer_object_required") !== requireText(input.current.payload.test_timestamp, "wafer_object_required") ||
    requireText(data.originalQualityLabel, "wafer_object_required") !== requireText(input.current.payload.quality_label, "wafer_object_required") ||
    requireText(data.reviewPriority, "wafer_object_required") !== requireText(input.current.payload.review_priority, "wafer_object_required")
  ) throw new Error("wafer_object_mismatch");
  const evidence = records(data.sensorEvidence);
  if (!evidence.length) throw new Error("wafer_sensor_required");
  const sensorIds = evidence.map((item) => requireText(item.sensorId, "wafer_sensor_required"));
  if (new Set(sensorIds).size !== sensorIds.length || sensorIds.some((item) => !WAFER_SENSORS.has(item))) {
    throw new Error("wafer_sensor_invalid");
  }
  const ranking = new Map(
    (input.supportingArtifacts?.["sensor-ranking.csv"] ?? []).map((item) => [text(item.sensor_id), optionalNumber(item.missing_rows) ?? 0]),
  );
  for (const item of evidence) {
    const sensorId = requireText(item.sensorId, "wafer_sensor_required");
    const raw = input.current.payload[sensorId];
    const missing = raw === "" || raw === null || raw === undefined;
    const submittedRaw = item.rawValue;
    const submittedNumeric = item.numericValue;
    if (
      item.isMissing !== missing ||
      (missing ? submittedRaw !== null || submittedNumeric !== null : text(submittedRaw) !== text(raw) || number(submittedNumeric) !== number(raw)) ||
      (ranking.has(sensorId) && number(item.datasetMissingRows) !== ranking.get(sensorId))
    ) throw new Error("wafer_sensor_mismatch");
    if (!input.evidenceIds.includes(`sensor:${waferId}:${sensorId}`)) throw new Error("wafer_evidence_mismatch");
  }
  if (!input.evidenceIds.includes(`wafer:${waferId}`)) throw new Error("wafer_evidence_mismatch");
  return { retestTask: record(data.retestTask), sensorIds };
}

function validateCase15(input: DomainCommandInput): void {
  const data = record(input.data);
  const { retestTask, sensorIds } = validateWaferAggregate(input, data);
  const waferId = requireText(input.current.payload.wafer_id, "wafer_object_required");
  const supervisor = record(data.supervisorReview);
  if (input.command === "request_retest") {
    const expectedTaskId = `RETEST-${waferId}-V${input.current.version + 1}`;
    if (
      requireText(retestTask.taskId, "wafer_retest_task_required") !== expectedTaskId ||
      retestTask.status !== "requested" ||
      data.decision !== "request_retest" ||
      requireText(retestTask.requestedByRole, "wafer_requester_required") !== "quality_engineer"
    ) throw new Error("wafer_retest_task_invalid");
    const requestedSensors = uniqueStrings(retestTask.selectedSensorIds, "wafer_sensor_required");
    if (!sameStrings(requestedSensors, sensorIds)) throw new Error("wafer_sensor_mismatch");
    const checks = record(retestTask.requestedChecks);
    if (!["preserve", "missing", "manual"].every((key) => checks[key] === true)) throw new Error("wafer_checklist_required");
    if (requireText(retestTask.note, "investigation_reason_required").length < 6) throw new Error("investigation_reason_required");
    const requester = requireText(retestTask.requestedByActorId, "sender_actor_required");
    if (requester !== requireText(input.actorId, "sender_actor_required")) throw new Error("actor_mismatch");
    if (!input.evidenceIds.includes(`retest-task:${expectedTaskId}`)) throw new Error("wafer_evidence_mismatch");
    return;
  }
  const persisted = record(input.current.task?.retestTask);
  const persistedTaskId = text(persisted.taskId);
  if (input.command === "release_batch") {
    if (!persistedTaskId || requireText(retestTask.taskId, "persisted_task_required") !== persistedTaskId) {
      throw new Error("wafer_retest_task_mismatch");
    }
    if (!sameStrings(uniqueStrings(persisted.selectedSensorIds, "wafer_sensor_required"), sensorIds)) {
      throw new Error("wafer_sensor_mismatch");
    }
    const reviewer = requireText(supervisor.reviewerId, "receiver_actor_required");
    if (reviewer !== requireText(input.actorId, "receiver_actor_required")) throw new Error("actor_mismatch");
    if (reviewer === requireText(persisted.requestedByActorId, "sender_actor_required")) throw new Error("actor_separation_required");
    if (
      supervisor.decision !== "confirm_retest_request" ||
      supervisor.reviewerRole !== "supervisor" ||
      requireText(supervisor.prerequisiteTaskId, "persisted_task_required") !== persistedTaskId ||
      requireText(supervisor.note, "review_note_required").length < 6 ||
      data.decision !== "confirm_retest_request"
    ) throw new Error("wafer_supervisor_review_invalid");
    return;
  }
  if (input.command === "quarantine_batch") {
    const reviewer = requireText(supervisor.reviewerId, "receiver_actor_required");
    if (reviewer !== requireText(input.actorId, "receiver_actor_required")) throw new Error("actor_mismatch");
    if (persistedTaskId && reviewer === requireText(persisted.requestedByActorId, "sender_actor_required")) {
      throw new Error("actor_separation_required");
    }
    if (
      supervisor.decision !== "continue_quarantine" ||
      supervisor.reviewerRole !== "supervisor" ||
      (persistedTaskId ? supervisor.prerequisiteTaskId !== persistedTaskId : supervisor.prerequisiteTaskId !== null) ||
      requireText(supervisor.note, "decision_reason_required").length < 6 ||
      data.decision !== "continue_quarantine"
    ) throw new Error("wafer_supervisor_review_invalid");
  }
}

const WIND_CHECKS = new Set([
  "核对 SCADA 风速与功率完整性", "补充同群基线", "核对限电指令", "补充告警与维修结果",
]);
const WIND_EVIDENCE = ["peer_baseline", "curtailment_order", "alarm_log", "maintenance_result"];

function turbineKey(value: unknown): string {
  const source = text(value).replace(/^T/iu, "");
  const parsed = Number(source);
  return Number.isFinite(parsed) ? String(parsed) : source;
}

function windRows(input: DomainCommandInput, turbineId: string): Record<string, unknown>[] {
  const rows = (input.sceneRows ?? [])
    .filter((item) => turbineKey(item.turbine_id) === turbineId)
    .sort((left, right) => (optionalNumber(left.day) ?? 0) - (optionalNumber(right.day) ?? 0));
  return (rows.length ? rows : [input.current.payload]).slice(0, 7);
}

function windCoverage(rows: Record<string, unknown>[], field: string): { valid: number; total: number } {
  return {
    valid: rows.reduce((sum, item) => sum + (optionalNumber(item[field]) ?? 0), 0),
    total: rows.reduce((sum, item) => sum + (optionalNumber(item.source_records) ?? 0), 0),
  };
}

function validateWindAggregate(input: DomainCommandInput, data: Record<string, unknown>): Record<string, unknown> {
  if (data.aggregateType !== "wind_underperformance_investigation" || data.serverValidationRequired !== true) {
    throw new Error("wind_investigation_required");
  }
  const turbineId = turbineKey(input.current.payload.turbine_id);
  if (
    requireText(data.turbineId, "wind_object_required") !== turbineId ||
    requireText(data.investigationId, "wind_investigation_required") !== `WIND-INV-${turbineId}` ||
    number(data.taskVersion, "wind_version_required") !== input.current.version + 1
  ) throw new Error("wind_object_mismatch");
  const rows = windRows(input, turbineId);
  const window = record(data.operatingWindow);
  const expectedDays = rows.map((item) => text(item.day));
  const days = uniqueStrings(window.dayIds, "wind_window_required");
  const underperformanceDays = rows.filter((item) => optionalNumber(item.underperformance_share) === 1).length;
  const expectedWind = windCoverage(rows, "valid_wind_records");
  const expectedPower = windCoverage(rows, "valid_power_records");
  const wind = record(window.windCoverage);
  const power = record(window.powerCoverage);
  if (
    window.scope !== "seven_operating_days" ||
    !sameStrings(days, expectedDays) ||
    number(window.underperformanceDays, "wind_window_required") !== underperformanceDays ||
    number(wind.valid, "wind_window_required") !== expectedWind.valid ||
    number(wind.total, "wind_window_required") !== expectedWind.total ||
    number(power.valid, "wind_window_required") !== expectedPower.valid ||
    number(power.total, "wind_window_required") !== expectedPower.total
  ) throw new Error("wind_window_mismatch");
  if (!input.evidenceIds.includes(`wind-window:${turbineId}:days-${expectedDays.join("-")}`)) {
    throw new Error("wind_evidence_mismatch");
  }
  return data;
}

function validateWindRequest(value: unknown, turbineId: string): Record<string, unknown> {
  const request = record(value);
  if (
    requireText(request.requestId, "wind_request_required") !== `WIND-CHECK-${turbineId}` ||
    request.scope !== "seven_operating_days"
  ) throw new Error("wind_request_invalid");
  const checks = uniqueStrings(request.checks, "wind_checklist_required");
  if (checks.some((item) => !WIND_CHECKS.has(item))) throw new Error("wind_checklist_invalid");
  requireText(request.requesterId, "sender_actor_required");
  requireText(request.assigneeId, "assignee_required");
  requireText(request.expectedShift, "due_at_required");
  if (request.requesterId === request.assigneeId) throw new Error("actor_separation_required");
  if (requireText(request.note, "investigation_reason_required").length < 6) throw new Error("investigation_reason_required");
  return request;
}

function validateCase16(input: DomainCommandInput): void {
  const data = validateWindAggregate(input, record(input.data));
  const turbineId = requireText(data.turbineId, "wind_object_required");
  const request = validateWindRequest(data.request, turbineId);
  const evidence = record(data.evidence);
  if (WIND_EVIDENCE.some((key) => !Object.keys(evidence).includes(key))) throw new Error("wind_evidence_required");
  if (input.command === "submit_field_check") {
    if (
      data.decision !== "request_field_inspection" ||
      request.status !== "requested" ||
      requireText(request.requesterId, "sender_actor_required") !== requireText(input.actorId, "sender_actor_required")
    ) throw new Error("wind_request_invalid");
    const checks = strings(request.checks);
    for (const key of WIND_EVIDENCE) {
      const item = record(evidence[key]);
      const shouldRequest = key === "peer_baseline"
        ? checks.includes("补充同群基线")
        : key === "curtailment_order"
          ? checks.includes("核对限电指令")
          : checks.includes("补充告警与维修结果");
      if (item.status !== (shouldRequest ? "requested" : "missing")) throw new Error("wind_evidence_invalid");
    }
    return;
  }
  if (input.command === "schedule_maintenance") {
    const persisted = input.current.task ?? {};
    if (
      requireText(persisted.investigationId, "persisted_task_required") !== requireText(data.investigationId, "wind_investigation_required") ||
      requireText(record(persisted.request).requestId, "persisted_task_required") !== requireText(request.requestId, "wind_request_required")
    ) throw new Error("wind_request_mismatch");
    const inspection = record(data.fieldInspection);
    const inspector = requireText(inspection.inspectorId, "wind_inspector_required");
    requireText(inspection.observedShift, "wind_inspection_required");
    if (requireText(inspection.finding, "wind_inspection_required").length < 6 || inspection.status !== "returned") {
      throw new Error("wind_inspection_invalid");
    }
    const references = {
      peer_baseline: requireText(inspection.peerBaselineRef, "wind_evidence_required"),
      curtailment_order: requireText(inspection.curtailmentOrderRef, "wind_evidence_required"),
      alarm_log: requireText(inspection.alarmLogRef, "wind_evidence_required"),
      maintenance_result: requireText(inspection.maintenanceResultRef, "wind_evidence_required"),
    };
    for (const key of WIND_EVIDENCE) {
      const item = record(evidence[key]);
      if (item.status !== "verified" || text(item.reference) !== references[key as keyof typeof references]) {
        throw new Error("wind_evidence_invalid");
      }
    }
    const confirmation = record(data.supervisorConfirmation);
    const supervisor = requireText(confirmation.supervisorId, "receiver_actor_required");
    if (supervisor !== requireText(input.actorId, "receiver_actor_required")) throw new Error("actor_mismatch");
    if (new Set([supervisor, inspector, requireText(request.requesterId, "sender_actor_required")]).size !== 3) {
      throw new Error("actor_separation_required");
    }
    if (confirmation.decision !== "confirm" || requireText(confirmation.note, "review_note_required").length < 6 || data.decision !== "confirm_field_inspection") {
      throw new Error("wind_confirmation_invalid");
    }
    return;
  }
  if (input.command === "hold_attribution") {
    const supervisor = requireText(input.actorId, "receiver_actor_required");
    if (!supervisor || data.decision !== "hold_for_evidence" || requireText(request.note, "decision_reason_required").length < 6) {
      throw new Error("decision_reason_required");
    }
  }
}

const CUTTER_SIGNALS = ["cutter_motor_torque", "cutter_follow_error", "film_follow_error"];

function validateCutterSource(input: DomainCommandInput, data: Record<string, unknown>, sessionId: string): Record<string, unknown>[] {
  if (data.aggregateType !== "cutter_health_review_session" || data.serverValidationRequired !== true) {
    throw new Error("cutter_review_required");
  }
  if (
    requireText(data.sessionId, "cutter_object_required") !== sessionId ||
    requireText(data.reviewId, "cutter_review_required") !== `CUTTER-REVIEW-${sessionId}` ||
    number(data.taskVersion, "cutter_version_required") !== input.current.version + 1
  ) throw new Error("cutter_object_mismatch");
  const waveformRows = (input.supportingArtifacts?.["waveform.csv"] ?? [])
    .filter((item) => text(item.session_id) === sessionId)
    .sort((left, right) => (optionalNumber(left.sample_index) ?? 0) - (optionalNumber(right.sample_index) ?? 0));
  const source = record(data.source);
  if (
    source.waveformArtifact !== "waveform.csv" ||
    number(source.sampleCount, "cutter_waveform_required") !== waveformRows.length ||
    (input.sceneRows && number(source.summaryDatasetRows, "cutter_source_required") !== input.sceneRows.length)
  ) throw new Error("cutter_source_mismatch");
  const channels = records(source.channels);
  const fields = channels.map((item) => requireText(item.field, "cutter_channel_required"));
  if (!sameStrings(fields, CUTTER_SIGNALS)) throw new Error("cutter_channel_invalid");
  if (waveformRows.length < 2) throw new Error("cutter_waveform_required");
  if (!input.evidenceIds.includes(`session:${sessionId}:summary`) || !input.evidenceIds.includes(`waveform:${sessionId}:samples-${waveformRows.length}`)) {
    throw new Error("cutter_evidence_mismatch");
  }
  return waveformRows;
}

function validateCutterPlan(input: DomainCommandInput, value: unknown, waveformRows: Record<string, unknown>[]): Record<string, unknown> {
  const plan = record(value);
  const sessionId = requireText(input.current.payload.session_id, "cutter_object_required");
  if (
    requireText(plan.planId, "cutter_plan_required") !== `CUTTER-PLAN-${sessionId}` ||
    requireText(plan.sessionId, "cutter_plan_required") !== sessionId ||
    !CUTTER_SIGNALS.includes(requireText(plan.selectedSignal, "cutter_signal_required"))
  ) throw new Error("cutter_plan_invalid");
  const planner = requireText(plan.plannerId, "sender_actor_required");
  const cursor = record(plan.syncedCursor);
  const sampleIndex = positiveInteger(cursor.sampleIndex, "cutter_cursor_required");
  const channels = uniqueStrings(cursor.channels, "cutter_channel_required");
  if (!sameStrings(channels, CUTTER_SIGNALS)) throw new Error("cutter_channel_invalid");
  const sample = waveformRows.find((item) => number(item.sample_index, "cutter_cursor_required") === sampleIndex);
  if (!sample) throw new Error("cutter_cursor_invalid");
  const values = record(cursor.values);
  for (const field of CUTTER_SIGNALS) {
    const expected = optionalNumber(sample[field]);
    const submitted = values[field];
    if (expected === undefined ? submitted !== null : number(submitted, "cutter_cursor_required") !== expected) {
      throw new Error("cutter_cursor_mismatch");
    }
  }
  const window = record(plan.inspectionWindow);
  const start = positiveInteger(window.startSample, "cutter_window_required");
  const end = positiveInteger(window.endSample, "cutter_window_required");
  if (start >= end || end > waveformRows.length || sampleIndex < start || sampleIndex > end) throw new Error("cutter_window_invalid");
  requireText(plan.direction, "cutter_direction_required");
  if (requireText(plan.note, "investigation_reason_required").length < 6) throw new Error("investigation_reason_required");
  if (!input.evidenceIds.includes(`waveform:${sessionId}:cursor-${sampleIndex}`)) throw new Error("cutter_evidence_mismatch");
  return { ...plan, plannerId: planner };
}

function validateCase17(input: DomainCommandInput): void {
  const data = record(input.data);
  const sessionId = requireText(input.current.payload.session_id, "cutter_object_required");
  const waveformRows = validateCutterSource(input, data, sessionId);
  if (input.command === "schedule_night_inspection") {
    const plan = validateCutterPlan(input, data.inspectionPlan, waveformRows);
    if (
      plan.status !== "pending_confirmation" ||
      data.decision !== "schedule_inspection" ||
      requireText(plan.plannerId, "sender_actor_required") !== requireText(input.actorId, "sender_actor_required")
    ) throw new Error("cutter_plan_invalid");
    return;
  }
  if (input.command === "confirm_maintenance") {
    const persisted = record(input.current.task?.inspectionPlan);
    const plan = validateCutterPlan(input, data.inspectionPlan, waveformRows);
    if (
      requireText(persisted.planId, "persisted_task_required") !== requireText(plan.planId, "cutter_plan_required") ||
      JSON.stringify(persisted.syncedCursor) !== JSON.stringify(plan.syncedCursor) ||
      JSON.stringify(persisted.inspectionWindow) !== JSON.stringify(plan.inspectionWindow)
    ) throw new Error("cutter_plan_mismatch");
    const confirmation = record(data.supervisorConfirmation);
    const supervisor = requireText(confirmation.supervisorId, "receiver_actor_required");
    if (supervisor !== requireText(input.actorId, "receiver_actor_required")) throw new Error("actor_mismatch");
    if (supervisor === requireText(persisted.plannerId, "sender_actor_required")) throw new Error("actor_separation_required");
    if (
      requireText(confirmation.confirmedPlanId, "cutter_plan_required") !== requireText(persisted.planId, "cutter_plan_required") ||
      confirmation.decision !== "confirm" ||
      requireText(confirmation.note, "review_note_required").length < 6 ||
      data.decision !== "confirm_inspection"
    ) throw new Error("cutter_confirmation_invalid");
    return;
  }
  if (input.command === "continue_monitoring") {
    const continuation = record(data.continuation);
    const additional = positiveInteger(continuation.additionalSamples, "cutter_sample_count_required");
    if (
      additional < 128 || additional > 8192 ||
      requireText(continuation.reason, "decision_reason_required").length < 6 ||
      continuation.status !== "requested" ||
      data.decision !== "continue_sampling" ||
      data.inspectionPlan !== undefined
    ) throw new Error("cutter_continuation_invalid");
    requireText(input.actorId, "sender_actor_required");
  }
}

const HYDRAULIC_COMPONENTS = [
  { key: "pump", label: "泵", state: "pump_state", severity: "pump_severity", condition: "pump_condition" },
  { key: "valve", label: "比例阀", state: "valve_state", severity: "valve_severity", condition: "valve_condition" },
  { key: "cooler", label: "冷却器", state: "cooler_state", severity: "cooler_severity", condition: "cooler_condition" },
  { key: "accumulator", label: "蓄能器", state: "accumulator_state", severity: "accumulator_severity", condition: "accumulator_condition" },
] as const;
const HYDRAULIC_BASES = new Set(["cycle-condition-flags", "sensor-trend-20", "component-state-model"]);

function hydraulicSeverity(value: unknown): number {
  const severity = text(value).toLowerCase();
  return severity === "critical" ? 3 : severity === "warning" ? 2 : severity === "normal" ? 1 : 0;
}

function validateHydraulicTask(input: DomainCommandInput, value: unknown, checkEvidence: boolean): Record<string, unknown> {
  const task = record(value);
  const cycleId = requireText(input.current.payload.cycle_id, "hydraulic_object_required");
  if (
    requireText(task.taskId, "hydraulic_task_required") !== `HYD-${cycleId}-v1` ||
    requireText(task.cycleId, "hydraulic_object_required") !== cycleId
  ) throw new Error("hydraulic_object_mismatch");
  const order = records(task.inspectionOrder);
  if (order.length !== HYDRAULIC_COMPONENTS.length) throw new Error("hydraulic_order_required");
  const keys = order.map((item) => requireText(item.component, "hydraulic_order_required"));
  if (!sameStrings(keys, HYDRAULIC_COMPONENTS.map((item) => item.key))) throw new Error("hydraulic_order_invalid");
  order.forEach((item, index) => {
    const definition = HYDRAULIC_COMPONENTS.find((candidate) => candidate.key === item.component);
    if (
      !definition ||
      number(item.position, "hydraulic_order_required") !== index + 1 ||
      text(item.label) !== definition.label ||
      text(item.state) !== text(input.current.payload[definition.state]) ||
      text(item.severity) !== text(input.current.payload[definition.severity]) ||
      text(item.conditionCode) !== text(input.current.payload[definition.condition])
    ) throw new Error("hydraulic_order_mismatch");
  });
  if (task.orderConfirmed !== true) throw new Error("hydraulic_order_unconfirmed");
  const reviewed = uniqueStrings(task.reviewed, "hydraulic_review_required");
  if (reviewed.some((item) => !HYDRAULIC_COMPONENTS.some((candidate) => candidate.key === item))) {
    throw new Error("hydraulic_review_invalid");
  }
  const required = HYDRAULIC_COMPONENTS
    .filter((item) => hydraulicSeverity(input.current.payload[item.severity]) >= 2)
    .map((item) => item.key);
  const affectedCount = positiveInteger(input.current.payload.affected_component_count, "hydraulic_review_required");
  if (required.some((item) => !reviewed.includes(item)) || reviewed.length < affectedCount) {
    throw new Error("hydraulic_review_incomplete");
  }
  const bases = uniqueStrings(task.evidenceBasis, "hydraulic_basis_required");
  if (bases.length < 2 || bases.some((item) => !HYDRAULIC_BASES.has(item))) throw new Error("hydraulic_basis_invalid");
  requireText(task.owner, "assignee_required");
  const dueAt = requireText(task.dueAt, "due_at_required");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/u.test(dueAt) || Number.isNaN(Date.parse(`${dueAt}:00+08:00`))) {
    throw new Error("due_at_invalid");
  }
  requireText(task.reviewerId, "sender_actor_required");
  if (requireText(task.reviewNote, "review_note_required").length < 6) throw new Error("review_note_required");
  if (checkEvidence) {
    if (!input.evidenceIds.includes(`cycle:${cycleId}`)) throw new Error("hydraulic_evidence_mismatch");
    for (const item of order) {
      if (!input.evidenceIds.includes(`component:${text(item.component)}:condition:${text(item.conditionCode)}`)) {
        throw new Error("hydraulic_evidence_mismatch");
      }
    }
    if (bases.some((item) => !input.evidenceIds.includes(`basis:${item}`))) throw new Error("hydraulic_evidence_mismatch");
  }
  return task;
}

function validateCase19(input: DomainCommandInput): void {
  const data = record(input.data);
  const cycleId = requireText(input.current.payload.cycle_id, "hydraulic_object_required");
  if (input.command === "submit_maintenance_review") {
    const task = validateHydraulicTask(input, data, true);
    if (requireText(task.reviewerId, "sender_actor_required") !== requireText(input.actorId, "sender_actor_required")) {
      throw new Error("actor_mismatch");
    }
    return;
  }
  if (input.command === "confirm_check_order") {
    const persisted = validateHydraulicTask(input, input.current.task, false);
    if (
      requireText(data.taskId, "hydraulic_task_required") !== requireText(persisted.taskId, "hydraulic_task_required") ||
      JSON.stringify(data.inspectionOrder) !== JSON.stringify(persisted.inspectionOrder)
    ) throw new Error("hydraulic_task_mismatch");
    const supervisor = requireText(data.supervisorId, "receiver_actor_required");
    if (supervisor !== requireText(input.actorId, "receiver_actor_required")) throw new Error("actor_mismatch");
    if (supervisor === requireText(persisted.reviewerId, "sender_actor_required")) throw new Error("actor_separation_required");
    if (data.decision !== "confirmed" || requireText(data.supervisorNote, "review_note_required").length < 6) {
      throw new Error("hydraulic_confirmation_invalid");
    }
    if (
      !input.evidenceIds.includes(`maintenance-task:${text(persisted.taskId)}`) ||
      !input.evidenceIds.includes(`cycle:${cycleId}`)
    ) throw new Error("hydraulic_evidence_mismatch");
    return;
  }
  if (input.command === "continue_sampling") {
    if (requireText(data.cycleId, "hydraulic_object_required") !== cycleId) throw new Error("hydraulic_object_mismatch");
    if (requireText(data.observationReason ?? input.reason, "decision_reason_required").length < 6) throw new Error("decision_reason_required");
    requireText(data.owner, "assignee_required");
    const dueAt = requireText(data.dueAt, "due_at_required");
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/u.test(dueAt)) throw new Error("due_at_invalid");
    requireText(input.actorId, "sender_actor_required");
    if (!input.evidenceIds.includes(`cycle:${cycleId}`)) throw new Error("hydraulic_evidence_mismatch");
  }
}

const PV_FACTORS = new Set(["temperature", "curtailment", "equipment"]);
const PV_SOURCES = ["dispatch-curtailment-log", "inverter-alert-log", "maintenance-work-order"];
const PV_SOURCE_LABELS: Record<string, string> = {
  "dispatch-curtailment-log": "调度限电记录",
  "inverter-alert-log": "逆变器告警",
  "maintenance-work-order": "站端检修工单",
};

function validatePvDirection(input: DomainCommandInput, value: unknown): Record<string, unknown> {
  const direction = record(value);
  const code = requireText(direction.code, "pv_direction_required");
  if (!PV_FACTORS.has(code) || direction.status !== "provisional") throw new Error("pv_direction_invalid");
  const expectedLabel = code === "temperature" ? "温度影响" : code === "equipment" ? "设备侧异常" : "疑似限电";
  if (requireText(direction.label, "pv_direction_required") !== expectedLabel) throw new Error("pv_direction_invalid");
  const basis = record(direction.basis);
  if (
    text(basis.meanEfficiencyRatio) !== text(input.current.payload.mean_efficiency_ratio) ||
    text(basis.curtailmentSuspectedShare) !== text(input.current.payload.curtailment_suspected_share) ||
    text(basis.temperatureDeratingShare) !== text(input.current.payload.mean_temperature_derating_pct)
  ) throw new Error("pv_direction_mismatch");
  return direction;
}

function validatePvTask(input: DomainCommandInput, value: unknown, checkEvidence: boolean): Record<string, unknown> {
  const task = record(value);
  const stationId = requireText(input.current.payload.station_id, "pv_object_required");
  const date = requireText(input.current.payload.date, "pv_object_required");
  const expectedTaskId = `PV-${stationId}-${date.replaceAll("-", "")}-v1`;
  if (
    requireText(task.taskId, "pv_task_required") !== expectedTaskId ||
    requireText(task.stationId, "pv_object_required") !== stationId ||
    requireText(task.date, "pv_object_required") !== date
  ) throw new Error("pv_object_mismatch");
  validatePvDirection(input, task.direction);
  const sources = records(task.evidenceSources);
  if (sources.length !== 4) throw new Error("pv_sources_required");
  const loaded = sources.find((item) => item.sourceId === "station-day-aggregate");
  if (
    !loaded || loaded.status !== "loaded" ||
    loaded.evidenceId !== `station-day:${stationId}:${date}` ||
    text(loaded.label) !== "公开站日汇总"
  ) throw new Error("pv_sources_invalid");
  for (const sourceId of PV_SOURCES) {
    const source = sources.find((item) => item.sourceId === sourceId);
    if (
      !source || source.status !== "load_failed" || source.failureCode !== "source_not_in_dataset" ||
      text(source.label) !== PV_SOURCE_LABELS[sourceId]
    ) throw new Error("pv_sources_invalid");
  }
  const request = record(task.retrievalRequest);
  const requested = uniqueStrings(request.requestedSourceIds, "pv_retrieval_required");
  if (!sameStrings(requested, PV_SOURCES)) throw new Error("pv_retrieval_invalid");
  requireText(request.owner, "assignee_required");
  const dueAt = requireText(request.dueAt, "due_at_required");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/u.test(dueAt) || Number.isNaN(Date.parse(`${dueAt}:00+08:00`))) {
    throw new Error("due_at_invalid");
  }
  requireText(request.requesterId, "sender_actor_required");
  if (requireText(request.note, "investigation_reason_required").length < 6) throw new Error("investigation_reason_required");
  if (checkEvidence) {
    if (!input.evidenceIds.includes(`station-day:${stationId}:${date}`)) throw new Error("pv_evidence_mismatch");
    if (PV_SOURCES.some((sourceId) => !input.evidenceIds.includes(`load-failure:${sourceId}`))) {
      throw new Error("pv_evidence_mismatch");
    }
  }
  return task;
}

function validateCase20(input: DomainCommandInput): void {
  const data = record(input.data);
  const stationId = requireText(input.current.payload.station_id, "pv_object_required");
  const date = requireText(input.current.payload.date, "pv_object_required");
  if (input.command === "submit_station_check") {
    const task = validatePvTask(input, data, true);
    if (requireText(record(task.retrievalRequest).requesterId, "sender_actor_required") !== requireText(input.actorId, "sender_actor_required")) {
      throw new Error("actor_mismatch");
    }
    return;
  }
  if (input.command === "confirm_attribution") {
    const persisted = validatePvTask(input, input.current.task, false);
    if (requireText(data.taskId, "pv_task_required") !== requireText(persisted.taskId, "pv_task_required")) {
      throw new Error("pv_task_mismatch");
    }
    const submittedDirection = validatePvDirection(input, data.direction);
    const persistedDirection = validatePvDirection(input, persisted.direction);
    if (JSON.stringify(submittedDirection) !== JSON.stringify(persistedDirection)) throw new Error("pv_direction_mismatch");
    const supervisor = requireText(data.supervisorId, "receiver_actor_required");
    if (supervisor !== requireText(input.actorId, "receiver_actor_required")) throw new Error("actor_mismatch");
    if (supervisor === requireText(record(persisted.retrievalRequest).requesterId, "sender_actor_required")) {
      throw new Error("actor_separation_required");
    }
    if (data.decision !== "confirmed_for_field_investigation" || requireText(data.supervisorNote, "review_note_required").length < 6) {
      throw new Error("pv_confirmation_invalid");
    }
    if (
      !input.evidenceIds.includes(`investigation-task:${text(persisted.taskId)}`) ||
      !input.evidenceIds.includes(`station-day:${stationId}:${date}`)
    ) throw new Error("pv_evidence_mismatch");
    return;
  }
  if (input.command === "hold_control_change") {
    const expectedTaskId = input.current.task?.taskId ?? `PV-${stationId}-${date.replaceAll("-", "")}-v1`;
    if (
      requireText(data.taskId, "pv_task_required") !== expectedTaskId ||
      requireText(data.stationId, "pv_object_required") !== stationId ||
      requireText(data.date, "pv_object_required") !== date ||
      data.controlScope !== "automatic-control" ||
      requireText(data.blockReason ?? input.reason, "decision_reason_required").length < 6 ||
      !sameStrings(uniqueStrings(data.loadingFailures, "pv_sources_required"), PV_SOURCES)
    ) throw new Error("pv_control_block_invalid");
    const actor = requireText(input.actorId, "sender_actor_required");
    const requester = text(record(input.current.task?.retrievalRequest).requesterId);
    if (input.actorRole === "supervisor" && requester && actor === requester) throw new Error("actor_separation_required");
    if (
      !input.evidenceIds.includes(`station-day:${stationId}:${date}`) ||
      PV_SOURCES.some((sourceId) => !input.evidenceIds.includes(`load-failure:${sourceId}`))
    ) throw new Error("pv_evidence_mismatch");
  }
}

export function validateDomainCommand(input: DomainCommandInput): void {
  validateEnvelope(input);
  if (input.caseId === "B001") validateCase01(input);
  if (input.caseId === "B002") validateCase02(input);
  if (input.caseId === "B003") validateCase03(input);
  if (input.caseId === "B004") validateCase04(input);
  if (input.caseId === "B005") validateCase05(input);
  if (input.caseId === "B006") validateCase06(input);
  if (input.caseId === "B007") validateCase07(input);
  if (input.caseId === "B008") validateCase08(input);
  if (input.caseId === "B009") validateCase09(input);
  if (input.caseId === "B010") validateCase10(input);
  if (input.caseId === "B011") validateCase11(input);
  if (input.caseId === "B012") validateCase12(input);
  if (input.caseId === "B013") validateCase13(input);
  if (input.caseId === "B014") validateCase14(input);
  if (input.caseId === "B015") validateCase15(input);
  if (input.caseId === "B016") validateCase16(input);
  if (input.caseId === "B017") validateCase17(input);
  if (input.caseId === "B018") validateCase18(input);
  if (input.caseId === "B019") validateCase19(input);
  if (input.caseId === "B020") validateCase20(input);
}
