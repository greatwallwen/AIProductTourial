"use client";

import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Droplets,
  FileSearch,
  History,
  LockKeyhole,
  RefreshCw,
  Send,
  ShieldCheck,
  Thermometer,
  UserRoundCheck,
  Waves,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import styles from "./AquacultureResponseWorkbench.module.css";
import type { CaseWorkbenchProps } from "./types";

type Panel = "details" | "dispatch" | "hold" | null;
type QueueFilter = "all" | "high" | "missing" | "conflict";
type FieldReturnDraft = {
  operatorId: string;
  capturedAt: string;
  photoAssetId: string;
  temperatureC: string;
  dissolvedOxygenMgL: string;
  ph: string;
  turbidityNtu: string;
};

const evidenceLabels: Record<string, string> = {
  complete: "证据齐全",
  source_missing: "来源缺失",
  value_conflict: "数值不一致",
};
const riskLabels: Record<string, string> = { normal: "低风险", medium: "中风险", high: "高风险" };
const riskRank: Record<string, number> = { high: 3, medium: 2, normal: 1 };
const evidenceRank: Record<string, number> = { source_missing: 3, value_conflict: 2, complete: 1 };
const missingEvidenceOptions = [
  { id: "temperature_c", label: "现场水温" },
  { id: "dissolved_oxygen_mg_l", label: "现场溶解氧" },
  { id: "ph", label: "现场 pH" },
  { id: "turbidity_ntu", label: "现场浊度" },
  { id: "field_photo", label: "现场照片" },
] as const;
const trendDefinitions = [
  { field: "temperature_c", label: "水温", unit: "℃", tone: "red" },
  { field: "dissolved_oxygen_mg_l", label: "溶解氧", unit: "mg/L", tone: "blue" },
  { field: "ph", label: "pH", unit: "", tone: "violet" },
  { field: "turbidity_ntu", label: "浊度", unit: "NTU", tone: "amber" },
] as const;

function text(value: unknown): string {
  return value === undefined || value === null ? "" : String(value);
}

function number(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function reading(value: unknown, digits: number, unit: string): string {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? `${parsed.toFixed(digits)}${unit}` : "—";
}

function shortTime(value: unknown): string {
  const source = text(value);
  return source.includes("T") ? source.slice(5, 16).replace("T", " ") : source || "—";
}

function pondLabel(value: unknown): string {
  const source = text(value);
  const match = source.match(/(\d+)$/);
  return match ? `${Number(match[1])} 号塘` : source || "未登记塘区";
}

function roleLabel(role: string): string {
  if (role === "dispatcher") return "值班调度";
  if (role === "field_operator") return "现场人员";
  if (role === "supervisor") return "主管";
  return role;
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function parseLegacyDispatch(reason: unknown): Record<string, unknown> | undefined {
  const source = text(reason);
  if (!source.startsWith("field-dispatch:")) return undefined;
  try {
    return record(JSON.parse(source.slice("field-dispatch:".length)));
  } catch {
    return undefined;
  }
}

function restoredTask(props: CaseWorkbenchProps): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  for (const event of props.events
    .filter((item) => item.objectId === props.selected.objectId)
    .sort((left, right) => left.version - right.version)) {
    if (event.data) Object.assign(merged, event.data);
    const legacyDispatch = parseLegacyDispatch(event.reason);
    if (legacyDispatch) merged.dispatch = legacyDispatch;
  }
  if (props.receipt?.event.data) Object.assign(merged, props.receipt.event.data);
  if (props.selected.task) Object.assign(merged, props.selected.task);
  return merged;
}

function draftFrom(value: Record<string, unknown>, dispatch: Record<string, unknown>): FieldReturnDraft {
  return {
    operatorId: text(value.operatorId) || text(dispatch.fieldOperatorId),
    capturedAt: text(value.capturedAt),
    photoAssetId: text(value.photoAssetId),
    temperatureC: text(value.temperatureC),
    dissolvedOxygenMgL: text(value.dissolvedOxygenMgL),
    ph: text(value.ph),
    turbidityNtu: text(value.turbidityNtu),
  };
}

function isPersistedReturn(value: Record<string, unknown>): boolean {
  return ["operatorId", "capturedAt", "photoAssetId", "temperatureC", "dissolvedOxygenMgL", "ph", "turbidityNtu"]
    .every((key) => value[key] !== undefined && value[key] !== null && text(value[key]).trim() !== "");
}

function actorId(role: string): string {
  if (role === "field_operator") return "case08-field-operator";
  if (role === "supervisor") return "case08-aquaculture-supervisor";
  return "case08-field-dispatcher";
}

function Sparkline({ rows, field, label, unit, tone }: {
  rows: Record<string, unknown>[];
  field: string;
  label: string;
  unit: string;
  tone: string;
}) {
  const values = rows.map((row) => number(row[field]));
  const safeValues = values.length ? values : [0];
  const minimum = Math.min(...safeValues);
  const maximum = Math.max(...safeValues);
  const range = maximum - minimum || 1;
  const points = safeValues.map((value, index) => {
    const x = safeValues.length === 1 ? 210 : 10 + index * (400 / (safeValues.length - 1));
    const y = 56 - ((value - minimum) / range) * 44;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const latest = safeValues[safeValues.length - 1];

  return (
    <figure className={styles.trendCard} data-tone={tone}>
      <figcaption>
        <span>{label}</span>
        <strong>{latest.toFixed(2)} {unit}</strong>
      </figcaption>
      <svg role="img" aria-label={`${label} 96 小时趋势`} viewBox="0 0 420 68" preserveAspectRatio="none">
        <line x1="10" x2="410" y1="13" y2="13" />
        <line x1="10" x2="410" y1="34" y2="34" />
        <line x1="10" x2="410" y1="55" y2="55" />
        <polyline points={points} />
      </svg>
      <small>{minimum.toFixed(2)}–{maximum.toFixed(2)} {unit} · {rows.length} 个采样点</small>
    </figure>
  );
}

export function AquacultureResponseWorkbench(props: CaseWorkbenchProps) {
  const row = props.selected.payload;
  const restored = useMemo(
    () => restoredTask(props),
    [props.events, props.receipt, props.selected.objectId, props.selected.task, props.selected.version],
  );
  const dispatchTask = record(restored.dispatch);
  const persistedReturn = record(restored.fieldReturn);
  const validationTask = record(restored.validation);
  const holdTask = record(restored.hold);
  const hasPersistedReturn = isPersistedReturn(persistedReturn);
  const hasValidation = validationTask.issueResolved === true;
  const commandIds = useMemo(() => new Set(props.commands.map((command) => command.id)), [props.commands]);
  const [panel, setPanel] = useState<Panel>(null);
  const [queueFilter, setQueueFilter] = useState<QueueFilter>("all");
  const [fieldOperatorId, setFieldOperatorId] = useState(text(dispatchTask.fieldOperatorId));
  const [dispatchNote, setDispatchNote] = useState(text(dispatchTask.note));
  const [fieldReturn, setFieldReturn] = useState<FieldReturnDraft>(() => draftFrom(persistedReturn, dispatchTask));
  const [confirmationNote, setConfirmationNote] = useState(text(validationTask.note));
  const [reviewed, setReviewed] = useState(validationTask.issueResolved === true);
  const [missingEvidence, setMissingEvidence] = useState<string[]>(strings(holdTask.missingEvidence));
  const [holdReason, setHoldReason] = useState(text(holdTask.reason));

  useEffect(() => {
    setPanel(null);
    setQueueFilter("all");
    setFieldOperatorId(text(dispatchTask.fieldOperatorId));
    setDispatchNote(text(dispatchTask.note));
    setFieldReturn(draftFrom(persistedReturn, dispatchTask));
    setConfirmationNote(text(validationTask.note));
    setReviewed(validationTask.issueResolved === true);
    setMissingEvidence(strings(holdTask.missingEvidence));
    setHoldReason(text(holdTask.reason));
  }, [props.selected.objectId, props.selected.version, restored]);

  useEffect(() => {
    if (!panel) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPanel(null);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [panel]);

  const queue = useMemo(() => [...props.objects]
    .sort((left, right) =>
      (riskRank[text(right.payload.risk_level)] ?? 0) - (riskRank[text(left.payload.risk_level)] ?? 0)
      || (evidenceRank[text(right.payload.evidence_status)] ?? 0) - (evidenceRank[text(left.payload.evidence_status)] ?? 0)
      || text(right.payload.event_time).localeCompare(text(left.payload.event_time)),
    )
    .filter((item) => queueFilter === "all"
      || (queueFilter === "high" && text(item.payload.risk_level) === "high")
      || (queueFilter === "missing" && text(item.payload.evidence_status) === "source_missing")
      || (queueFilter === "conflict" && text(item.payload.evidence_status) === "value_conflict")), [props.objects, queueFilter]);
  const latestByRegion = useMemo(() => {
    const latest = new Map<string, CaseWorkbenchProps["selected"]>();
    for (const item of props.objects) {
      const regionId = text(item.payload.region_id);
      if (!regionId) continue;
      const current = latest.get(regionId);
      if (!current || text(item.payload.event_time).localeCompare(text(current.payload.event_time)) > 0) {
        latest.set(regionId, item);
      }
    }
    return [...latest.values()].sort((left, right) => text(left.payload.region_id).localeCompare(text(right.payload.region_id)));
  }, [props.objects]);

  const trendRows = useMemo(() => props.sceneRows
    .filter((item) => text(item.region_id) === text(row.region_id))
    .sort((left, right) => text(left.event_time).localeCompare(text(right.event_time))), [props.sceneRows, row.region_id]);
  const repair = useMemo(() => (props.supportingArtifacts["repair-evidence.jsonl"] ?? [])
    .find((item) => text(item.event_id) === text(row.event_id)), [props.supportingArtifacts, row.event_id]);
  const returnStageOpen = commandIds.has("submit_field_return")
    || props.selected.state.includes("现场取证")
    || props.selected.state.includes("现场核查");

  const measurementRules = [
    { key: "temperatureC" as const, label: "水温", min: 0, max: 45 },
    { key: "dissolvedOxygenMgL" as const, label: "溶解氧", min: 0, max: 25 },
    { key: "ph" as const, label: "pH", min: 0, max: 14 },
    { key: "turbidityNtu" as const, label: "浊度", min: 0, max: 1000 },
  ];
  const fieldErrors = measurementRules.flatMap((rule) => {
    const source = fieldReturn[rule.key].trim();
    if (!source) return [];
    const value = Number(source);
    return Number.isFinite(value) && value >= rule.min && value <= rule.max
      ? []
      : [`${rule.label} 应在 ${rule.min}–${rule.max} 之间`];
  });
  const fieldReturnComplete = fieldReturn.operatorId.trim().length >= 2
    && fieldReturn.capturedAt.length >= 10
    && fieldReturn.photoAssetId.trim().length >= 4
    && measurementRules.every((rule) => fieldReturn[rule.key].trim() !== "")
    && fieldErrors.length === 0;
  const canDispatch = /^[\w.@-]{2,80}$/u.test(fieldOperatorId.trim()) && dispatchNote.trim().length >= 6;
  const canSubmitReturn = commandIds.has("submit_field_return") && fieldReturnComplete;
  const canConfirm = commandIds.has("confirm_event") && hasPersistedReturn && reviewed && confirmationNote.trim().length >= 6;
  const canHold = commandIds.has("hold_for_evidence") && missingEvidence.length > 0 && holdReason.trim().length >= 6;

  function updateField<Key extends keyof FieldReturnDraft>(key: Key, value: FieldReturnDraft[Key]) {
    setFieldReturn((current) => ({ ...current, [key]: value }));
  }

  function toggleMissingEvidence(id: string) {
    setMissingEvidence((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id]);
  }

  function submitDispatch() {
    if (!canDispatch) return;
    const currentActor = actorId(props.actorRole);
    const dispatch = {
      eventId: text(row.event_id),
      regionId: text(row.region_id),
      fieldOperatorId: fieldOperatorId.trim(),
      note: dispatchNote.trim(),
      evidenceIssue: text(row.evidence_status),
      requiredEvidence: ["temperature_c", "dissolved_oxygen_mg_l", "ph", "turbidity_ntu", "field_photo"],
      createdBy: currentActor,
    };
    props.onCommand("dispatch_field_check", dispatch.note, {
      actorId: currentActor,
      data: { dispatch },
      evidenceIds: [text(row.event_id), text(row.archive_member)].filter(Boolean),
      idempotencyKey: `case-B008:${props.selected.objectId}:dispatch_field_check:v${props.selected.version}`,
    });
    setPanel(null);
  }

  function submitFieldReturn() {
    if (!canSubmitReturn) return;
    const returned = {
      eventId: text(row.event_id),
      operatorId: fieldReturn.operatorId.trim(),
      capturedAt: fieldReturn.capturedAt,
      photoAssetId: fieldReturn.photoAssetId.trim(),
      temperatureC: Number(fieldReturn.temperatureC),
      dissolvedOxygenMgL: Number(fieldReturn.dissolvedOxygenMgL),
      ph: Number(fieldReturn.ph),
      turbidityNtu: Number(fieldReturn.turbidityNtu),
    };
    props.onCommand("submit_field_return", "现场四项读数与照片已登记", {
      actorId: returned.operatorId,
      data: { fieldReturn: returned },
      evidenceIds: [text(row.event_id), returned.photoAssetId],
      idempotencyKey: `case-B008:${props.selected.objectId}:submit_field_return:v${props.selected.version}:${returned.operatorId}`,
    });
  }

  function confirmAdoption() {
    if (!canConfirm) return;
    const currentActor = "case08-aquaculture-supervisor";
    const validation = {
      issueResolved: true,
      originalEvidenceStatus: text(row.evidence_status),
      note: confirmationNote.trim(),
      ...(repair ? { repairEvidenceId: text(repair.repair_id) } : {}),
      confirmedBy: currentActor,
    };
    props.onCommand("confirm_event", validation.note, {
      actorId: currentActor,
      data: { eventId: text(row.event_id), validation },
      evidenceIds: [
        text(row.event_id),
        text(persistedReturn.photoAssetId),
        ...(repair ? [text(repair.repair_id), text(repair.evidence_hash)] : []),
      ].filter(Boolean),
      idempotencyKey: `case-B008:${props.selected.objectId}:confirm_event:v${props.selected.version}:${text(persistedReturn.operatorId)}`,
    });
  }

  function holdForEvidence() {
    if (!canHold) return;
    const currentActor = "case08-aquaculture-supervisor";
    const hold = {
      eventId: text(row.event_id),
      missingEvidence,
      reason: holdReason.trim(),
      heldBy: currentActor,
    };
    props.onCommand("hold_for_evidence", hold.reason, {
      actorId: currentActor,
      data: { hold },
      evidenceIds: [text(row.event_id)],
      idempotencyKey: `case-B008:${props.selected.objectId}:hold_for_evidence:v${props.selected.version}`,
    });
    setPanel(null);
  }

  return (
    <main className={styles.root} aria-label="水质冲突现场取证工作台">
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <span className={styles.caseNumber}>案例 08</span>
          <div>
            <h1>水质冲突现场取证单</h1>
            <p>{pondLabel(row.region_id)} · {text(row.event_id)} · {shortTime(row.event_time)}</p>
          </div>
        </div>
        <div className={styles.boundary}><ShieldCheck size={17} />仅限人工复核 · 不连接设备控制</div>
        <div className={styles.headerActions}>
          <label>
            <span>当前角色</span>
            <select aria-label="当前操作角色" value={props.actorRole} onChange={(event) => props.onActorRoleChange(event.target.value)}>
              {props.roles.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}
            </select>
          </label>
          <button type="button" className={styles.iconButton} aria-label="恢复案例 B008" title="恢复初始状态" onClick={props.onReset} disabled={props.busy}><RefreshCw size={18} /></button>
        </div>
      </header>

      <section className={styles.content}>
        <aside className={styles.dossier} aria-label="事件档案">
          <div className={styles.dossierTop}>
            <span className={styles.status} data-tone={text(row.risk_level)}>{riskLabels[text(row.risk_level)] ?? "待判断"}</span>
            <span className={styles.evidenceStatus}>{evidenceLabels[text(row.evidence_status)] ?? "待核对"}</span>
          </div>
          <div className={styles.pondIdentity}>
            <Droplets size={24} />
            <div><small>当前事件</small><strong>{pondLabel(row.region_id)}</strong></div>
          </div>
          <dl className={styles.facts}>
            <div><dt>事件编号</dt><dd>{text(row.event_id) || "—"}</dd></div>
            <div><dt>采集时间</dt><dd>{shortTime(row.event_time)}</dd></div>
            <div><dt>传感器</dt><dd>{text(row.sensor_status) === "online" ? "在线" : "离线"}</dd></div>
            <div><dt>数据来源</dt><dd>{text(row.source_id) || "—"}</dd></div>
          </dl>
          <div className={styles.taskState}>
            <small>当前进度</small>
            <strong>{props.selected.state}</strong>
            {text(dispatchTask.fieldOperatorId) ? <p>现场人员：{text(dispatchTask.fieldOperatorId)}</p> : <p>尚未登记现场人员</p>}
          </div>
          <div className={styles.sideActions}>
            {commandIds.has("dispatch_field_check") ? <button type="button" className={styles.primaryButton} onClick={() => setPanel("dispatch")}><Send size={17} />派发现场取证</button> : null}
            {commandIds.has("hold_for_evidence") ? <button type="button" className={styles.secondaryButton} onClick={() => setPanel("hold")}><AlertTriangle size={17} />暂缓并补充证据</button> : null}
            <button type="button" className={styles.secondaryButton} onClick={() => setPanel("details")}><History size={17} />查看异常与 96 小时趋势</button>
          </div>
          <p className={styles.datasetNote}>{props.datasetRowCount.toLocaleString("zh-CN")} 条本地水质记录；队列和趋势仅在详情中展开。</p>
        </aside>

        <section className={styles.workArea} aria-label="现场取证流程">
          <div className={styles.stageGrid}>
            <section className={styles.stage} aria-label="系统记录">
              <header className={styles.stageHeader}>
                <span>01</span>
                <div><h2>系统记录</h2><p>保留上游原始读数</p></div>
                <CheckCircle2 className={styles.stageDone} size={20} />
              </header>
              <div className={styles.metrics}>
                <article data-tone="warm"><Thermometer size={18} /><span>水温</span><strong>{reading(row.temperature_c, 2, "℃")}</strong></article>
                <article data-tone="cool"><Waves size={18} /><span>溶解氧</span><strong>{reading(row.dissolved_oxygen_mg_l, 2, " mg/L")}</strong></article>
                <article data-tone="violet"><span className={styles.metricSymbol}>pH</span><span>酸碱度</span><strong>{reading(row.ph, 2, "")}</strong></article>
                <article data-tone="amber"><Droplets size={18} /><span>浊度</span><strong>{reading(row.turbidity_ntu, 2, " NTU")}</strong></article>
              </div>
              <div className={styles.sourceCard}>
                <div><FileSearch size={18} /><strong>原始记录</strong></div>
                <p>确定性水质事件记录</p>
                <small>来源编号 <code>{text(row.source_id) || "未登记"}</code></small>
                <span>{evidenceLabels[text(row.evidence_status)] ?? "待核对"}</span>
              </div>
              <div className={styles.ruleCard}>
                <AlertTriangle size={18} />
                <div><strong>人工复核规则</strong><p>水温 ≥ 31℃ 进入高风险核查；这是本地复核规则，不是生产告警阈值。</p></div>
              </div>
              <p className={styles.sourceWarning}>上游未提供冲突字段，当前只能登记为“数值不一致”，不能判断哪一方正确。</p>
            </section>

            <section className={styles.stage} aria-label="现场回传">
              <header className={styles.stageHeader}>
                <span>02</span>
                <div><h2>现场回传</h2><p>人员、时间、照片、四项读数</p></div>
                {hasPersistedReturn ? <CheckCircle2 className={styles.stageDone} size={20} /> : <Clock3 className={styles.stageWaiting} size={20} />}
              </header>
              {hasPersistedReturn ? (
                <div className={styles.returnReceipt}>
                  <div className={styles.returnPerson}><UserRoundCheck size={24} /><div><small>现场人员</small><strong>{text(persistedReturn.operatorId)}</strong></div></div>
                  <dl>
                    <div><dt>采集时间</dt><dd>{text(persistedReturn.capturedAt)}</dd></div>
                    <div><dt>照片资产号</dt><dd>{text(persistedReturn.photoAssetId)}</dd></div>
                  </dl>
                  <div className={styles.returnMetrics}>
                    <span>水温<strong>{reading(persistedReturn.temperatureC, 2, "℃")}</strong></span>
                    <span>溶解氧<strong>{reading(persistedReturn.dissolvedOxygenMgL, 2, " mg/L")}</strong></span>
                    <span>pH<strong>{reading(persistedReturn.ph, 2, "")}</strong></span>
                    <span>浊度<strong>{reading(persistedReturn.turbidityNtu, 2, " NTU")}</strong></span>
                  </div>
                  <p><Check size={15} />现场回传已保存，等待主管复核。</p>
                </div>
              ) : returnStageOpen ? (
                <form className={styles.fieldForm} onSubmit={(event) => { event.preventDefault(); submitFieldReturn(); }}>
                  <div className={styles.formRow}>
                    <label><span>现场回传人员</span><input value={fieldReturn.operatorId} readOnly aria-readonly="true" /></label>
                    <label><span>采集时间</span><input type="datetime-local" value={fieldReturn.capturedAt} onChange={(event) => updateField("capturedAt", event.target.value)} /></label>
                  </div>
                  <label><span>现场照片资产号</span><input value={fieldReturn.photoAssetId} onChange={(event) => updateField("photoAssetId", event.target.value)} placeholder="填写可追溯资产号" /></label>
                  <div className={styles.measurementGrid}>
                    <label><span>现场水温</span><div><input aria-label="现场水温" type="number" min="0" max="45" step="0.01" value={fieldReturn.temperatureC} onChange={(event) => updateField("temperatureC", event.target.value)} /><b>℃</b></div></label>
                    <label><span>现场溶解氧</span><div><input aria-label="现场溶解氧" type="number" min="0" max="25" step="0.01" value={fieldReturn.dissolvedOxygenMgL} onChange={(event) => updateField("dissolvedOxygenMgL", event.target.value)} /><b>mg/L</b></div></label>
                    <label><span>现场 pH</span><div><input aria-label="现场 pH" type="number" min="0" max="14" step="0.01" value={fieldReturn.ph} onChange={(event) => updateField("ph", event.target.value)} /></div></label>
                    <label><span>现场浊度</span><div><input aria-label="现场浊度" type="number" min="0" max="1000" step="0.01" value={fieldReturn.turbidityNtu} onChange={(event) => updateField("turbidityNtu", event.target.value)} /><b>NTU</b></div></label>
                  </div>
                  {fieldErrors.length ? <div className={styles.inlineError} role="alert">{fieldErrors.join("；")}</div> : null}
                  <button type="submit" className={styles.primaryButton} disabled={props.busy || !canSubmitReturn}><ClipboardCheck size={17} />提交现场回传</button>
                  {!commandIds.has("submit_field_return") ? <p className={styles.permissionHint}>切换到现场人员角色后提交。</p> : null}
                </form>
              ) : (
                <div className={styles.emptyStage}><Clock3 size={30} /><strong>等待派发现场取证</strong><p>派发后，现场人员在此登记四项读数和照片资产号。</p></div>
              )}
            </section>

            <section className={styles.stage} aria-label="主管采信">
              <header className={styles.stageHeader}>
                <span>03</span>
                <div><h2>主管采信</h2><p>只确认已持久化的现场证据</p></div>
                {hasValidation ? <CheckCircle2 className={styles.stageDone} size={20} /> : hasPersistedReturn ? <Clock3 className={styles.stageWaiting} size={20} /> : <LockKeyhole className={styles.stageLocked} size={20} />}
              </header>
              {!hasPersistedReturn ? (
                <div className={styles.emptyStage}><LockKeyhole size={30} /><strong>现场回传后解锁</strong><p>未保存的表单不构成证据，主管不能提前确认。</p></div>
              ) : hasValidation ? (
                <div className={styles.adopted}><CheckCircle2 size={34} /><strong>现场证据已采信</strong><p>{text(validationTask.note)}</p><small>确认人：{text(validationTask.confirmedBy)}</small></div>
              ) : commandIds.has("confirm_event") ? (
                <form className={styles.supervisorForm} onSubmit={(event) => { event.preventDefault(); confirmAdoption(); }}>
                  <div className={styles.compareCard}>
                    <span>系统水温 <strong>{reading(row.temperature_c, 2, "℃")}</strong></span>
                    <ChevronRight size={18} />
                    <span>现场水温 <strong>{reading(persistedReturn.temperatureC, 2, "℃")}</strong></span>
                  </div>
                  <label><span>采信说明</span><textarea value={confirmationNote} onChange={(event) => setConfirmationNote(event.target.value)} placeholder="说明采用依据和仍需关注的限制" /></label>
                  <label className={styles.checkLabel}><input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} />确认现场证据已经人工复核</label>
                  <button type="submit" className={styles.primaryButton} disabled={props.busy || !canConfirm}><Check size={17} />确认采信</button>
                  {repair ? <p className={styles.repairHint}>存在修复回执 {text(repair.repair_id)}；回执不包含替代读数，仍以人工复核为准。</p> : null}
                </form>
              ) : (
                <div className={styles.emptyStage}><UserRoundCheck size={30} /><strong>等待主管确认</strong><p>现场回传已经保存，切换主管角色完成采信。</p></div>
              )}
            </section>
          </div>

          <section className={styles.auditRail} aria-label="取证进度">
            <article data-state="done"><span><Check size={15} /></span><div><strong>系统记录</strong><small>{shortTime(row.event_time)}</small></div></article>
            <i />
            <article data-state={hasPersistedReturn ? "done" : returnStageOpen ? "active" : "waiting"}><span>{hasPersistedReturn ? <Check size={15} /> : "2"}</span><div><strong>现场回传</strong><small>{hasPersistedReturn ? text(persistedReturn.capturedAt) : returnStageOpen ? "正在取证" : "等待派发"}</small></div></article>
            <i />
            <article data-state={hasValidation ? "done" : hasPersistedReturn ? "active" : "waiting"}><span>{hasValidation ? <Check size={15} /> : "3"}</span><div><strong>主管采信</strong><small>{hasValidation ? "已确认" : hasPersistedReturn ? "待确认" : "未解锁"}</small></div></article>
          </section>
          {props.receipt ? <p className={styles.receipt} role="status"><CheckCircle2 size={16} />最近操作已保存 · 版本 {props.receipt.event.version}</p> : null}
          {props.error ? <p className={styles.error} role="alert"><AlertTriangle size={16} />{props.error}<button type="button" onClick={() => props.onSelect(props.selected.objectId)}>刷新当前事件</button></p> : null}
        </section>
      </section>

      {panel === "details" ? (
        <div className={styles.overlay} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPanel(null); }}>
          <section className={styles.drawer} role="dialog" aria-modal="true" aria-label="异常队列与 96 小时趋势">
            <header className={styles.dialogHeader}><div><small>{pondLabel(row.region_id)}</small><h2>异常队列与 96 小时趋势</h2></div><button type="button" className={styles.iconButton} aria-label="关闭详情" onClick={() => setPanel(null)}><X size={20} /></button></header>
            <section className={styles.trendGrid} aria-label="四项趋势">
              {trendDefinitions.map((definition) => <Sparkline key={definition.field} rows={trendRows} {...definition} />)}
            </section>
            <section className={styles.queueSection} aria-label="异常事件队列">
              <header>
                <div><h3>异常事件</h3><span>{queue.length} 条</span></div>
                <div className={styles.queueControls}>
                  <label className={styles.regionSelector}>塘位<select aria-label="按塘位选择最新事件" value={text(row.region_id)} onChange={(event) => {
                    const candidate = latestByRegion.find((item) => text(item.payload.region_id) === event.target.value);
                    if (candidate && candidate.objectId !== props.selected.objectId) props.onSelect(candidate.objectId);
                  }}>{latestByRegion.map((item) => <option key={text(item.payload.region_id)} value={text(item.payload.region_id)}>{pondLabel(item.payload.region_id)} · 最新 {text(item.payload.event_id)}</option>)}</select></label>
                  <div className={styles.queueFilters}>{(["all", "high", "missing", "conflict"] as const).map((filter) => <button key={filter} type="button" aria-pressed={queueFilter === filter} onClick={() => setQueueFilter(filter)}>{filter === "all" ? "全部" : filter === "high" ? "高风险" : filter === "missing" ? "来源缺失" : "数值不一致"}</button>)}</div>
                </div>
              </header>
              <div className={styles.queueList}>{queue.map((item) => {
                const evidence = text(item.payload.evidence_status);
                const risk = text(item.payload.risk_level);
                return <button key={item.objectId} type="button" aria-pressed={item.objectId === props.selected.objectId} onClick={() => props.onSelect(item.objectId)}>
                  <span className={styles.queueDot} data-tone={risk} />
                  <span><strong>{text(item.payload.event_id)}</strong><small>{pondLabel(item.payload.region_id)} · {shortTime(item.payload.event_time)}</small></span>
                  <em>{evidenceLabels[evidence] ?? "待核对"}</em>
                  <b>{riskLabels[risk] ?? "待判断"}</b>
                  <ChevronRight size={17} />
                </button>;
              })}</div>
            </section>
          </section>
        </div>
      ) : null}

      {panel === "dispatch" ? (
        <div className={styles.overlay} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPanel(null); }}>
          <form className={styles.modal} role="dialog" aria-modal="true" aria-label="派发现场取证" onSubmit={(event) => { event.preventDefault(); submitDispatch(); }}>
            <header className={styles.dialogHeader}><div><small>{text(row.event_id)}</small><h2>派发现场取证</h2></div><button type="button" className={styles.iconButton} aria-label="关闭派发表单" onClick={() => setPanel(null)}><X size={20} /></button></header>
            <p className={styles.modalLead}>登记实际执行人的系统编号和核查要求；不预填班组或到达时限。</p>
            <label><span>现场人员编号</span><input value={fieldOperatorId} onChange={(event) => setFieldOperatorId(event.target.value)} placeholder="例如 AQ-FIELD-02" /></label>
            <label><span>核查说明</span><textarea value={dispatchNote} onChange={(event) => setDispatchNote(event.target.value)} placeholder="说明仪表、读数和照片要求" /></label>
            <div className={styles.modalActions}><button type="button" className={styles.secondaryButton} onClick={() => setPanel(null)}>取消</button><button type="submit" className={styles.primaryButton} disabled={props.busy || !canDispatch}><Send size={17} />确认派发</button></div>
          </form>
        </div>
      ) : null}

      {panel === "hold" ? (
        <div className={styles.overlay} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPanel(null); }}>
          <form className={styles.modal} role="dialog" aria-modal="true" aria-label="暂缓并补充证据" onSubmit={(event) => { event.preventDefault(); holdForEvidence(); }}>
            <header className={styles.dialogHeader}><div><small>{text(row.event_id)}</small><h2>暂缓并补充证据</h2></div><button type="button" className={styles.iconButton} aria-label="关闭暂缓表单" onClick={() => setPanel(null)}><X size={20} /></button></header>
            <fieldset className={styles.checkGrid}><legend>缺少的现场证据</legend>{missingEvidenceOptions.map((item) => <label key={item.id}><input type="checkbox" checked={missingEvidence.includes(item.id)} onChange={() => toggleMissingEvidence(item.id)} />{item.label}</label>)}</fieldset>
            <label><span>暂缓原因</span><textarea value={holdReason} onChange={(event) => setHoldReason(event.target.value)} placeholder="说明缺少什么以及恢复处理的条件" /></label>
            <div className={styles.modalActions}><button type="button" className={styles.secondaryButton} onClick={() => setPanel(null)}>取消</button><button type="submit" className={styles.dangerButton} disabled={props.busy || !canHold}><AlertTriangle size={17} />确认暂缓</button></div>
          </form>
        </div>
      ) : null}
    </main>
  );
}
