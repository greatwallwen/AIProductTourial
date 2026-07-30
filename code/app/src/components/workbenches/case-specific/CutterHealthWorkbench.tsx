"use client";

import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Database,
  Gauge,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  Waves,
  Wrench,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./CutterHealthWorkbench.module.css";
import type { CaseWorkbenchProps } from "./types";

const signals = [
  { field: "cutter_motor_torque", mean: "cutter_torque_mean", std: "cutter_torque_std", label: "切刀转矩", channel: "通道 1", tone: "torque" },
  { field: "cutter_follow_error", mean: "cutter_follow_error_mean", std: "cutter_follow_error_std", label: "切刀跟随误差", channel: "通道 2", tone: "cutter" },
  { field: "film_follow_error", mean: "film_follow_error_mean", std: "film_follow_error_std", label: "薄膜跟随误差", channel: "通道 3", tone: "film" },
] as const;

type SignalField = (typeof signals)[number]["field"];
type CutterDraft = { signal: string; viewed: boolean; direction: string; note: string };
type InspectionPlan = {
  planId?: string;
  sessionId?: string;
  plannerId?: string;
  selectedSignal?: string;
  syncedCursor?: {
    sampleIndex?: number;
    channels?: string[];
    values?: Record<string, number | null>;
  };
  inspectionWindow?: { startSample?: number; endSample?: number };
  direction?: string;
  note?: string;
  status?: string;
};

function text(value: unknown, fallback = "—"): string {
  return value == null || value === "" ? fallback : String(value);
}

function numeric(value: unknown): number | undefined {
  if (value === "" || value == null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function format(value: unknown, digits = 3): string {
  const parsed = numeric(value);
  return parsed == null ? "—" : parsed.toLocaleString("zh-CN", { maximumFractionDigits: digits });
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function roleLabel(role: string): string {
  return role === "maintenance_planner" ? "维护计划员" : role === "supervisor" ? "维护主管" : role;
}

function parseDraft(reason: unknown): CutterDraft | undefined {
  const source = String(reason ?? "");
  if (!source.startsWith("cutter-review:")) return undefined;
  try {
    return JSON.parse(source.slice("cutter-review:".length)) as CutterDraft;
  } catch {
    return undefined;
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function defaultCursorIndex(rowCount: number): number {
  return rowCount >= 128 ? 127 : 0;
}

function defaultWindowStart(rowCount: number): string {
  return rowCount >= 160 ? "96" : "1";
}

function defaultWindowEnd(rowCount: number): string {
  return String(rowCount >= 160 ? 160 : Math.max(1, rowCount));
}

function waveformPoints(
  rows: Record<string, unknown>[],
  field: string,
  top: number,
  bottom: number,
  width = 1000,
): string {
  const values = rows.map((item) => numeric(item[field]));
  const present = values.filter((item): item is number => item != null);
  if (!present.length) return "";
  const min = Math.min(...present);
  const max = Math.max(...present);
  const span = max - min || 1;
  return values.map((value, index) => {
    const x = (index / Math.max(1, values.length - 1)) * width;
    const y = value == null ? (top + bottom) / 2 : bottom - ((value - min) / span) * (bottom - top);
    return `${x},${y}`;
  }).join(" ");
}

export function CutterHealthWorkbench(props: CaseWorkbenchProps) {
  const row = props.selected.payload;
  const sessionId = text(row.session_id);
  const allWaveforms = props.supportingArtifacts["waveform.csv"] ?? [];
  const reviewQueueCount = (props.supportingArtifacts["review-queue.csv"] ?? []).length;
  const waveformRows = useMemo(() => allWaveforms
    .filter((item) => text(item.session_id) === sessionId)
    .sort((a, b) => Number(a.sample_index) - Number(b.sample_index)), [allWaveforms, sessionId]);
  const waveformSessions = useMemo(
    () => new Set(allWaveforms.map((item) => text(item.session_id))),
    [allWaveforms],
  );
  const waveformObjects = useMemo(
    () => props.objects.filter((item) => waveformSessions.has(text(item.payload.session_id))).slice(0, 8),
    [props.objects, waveformSessions],
  );
  const legacyDraft = useMemo(() => {
    const event = [...props.events].reverse().find((item) => item.objectId === props.selected.objectId && parseDraft(item.reason));
    return parseDraft(event?.reason);
  }, [props.events, props.selected.objectId]);
  const aggregateData = useMemo(() => {
    const historical = props.events
      .filter((event) => event.objectId === props.selected.objectId)
      .reduce<Record<string, unknown>>((merged, event) => ({ ...merged, ...record(event.data) }), {});
    return { ...historical, ...record(props.selected.task), ...record(props.receipt?.event.data) };
  }, [props.events, props.receipt, props.selected.objectId, props.selected.task]);
  const aggregateSignature = JSON.stringify(aggregateData);
  const restoredPlan = record(aggregateData.inspectionPlan) as InspectionPlan;
  const restoredCursor = record(restoredPlan.syncedCursor);
  const restoredWindow = record(restoredPlan.inspectionWindow);
  const restoredConfirmation = record(aggregateData.supervisorConfirmation);
  const restoredContinuation = record(aggregateData.continuation);

  const [query, setQuery] = useState("");
  const [priorityOnly, setPriorityOnly] = useState(false);
  const [signal, setSignal] = useState<SignalField>(() => (restoredPlan.selectedSignal ?? legacyDraft?.signal ?? "cutter_motor_torque") as SignalField);
  const [cursorIndex, setCursorIndex] = useState(() => clamp(
    (numeric(restoredCursor.sampleIndex) ?? defaultCursorIndex(waveformRows.length) + 1) - 1,
    0,
    Math.max(0, waveformRows.length - 1),
  ));
  const [cursorTouched, setCursorTouched] = useState(Boolean((restoredCursor.channels as unknown[] | undefined)?.length === 3 || legacyDraft?.viewed));
  const [windowStart, setWindowStart] = useState(text(restoredWindow.startSample, defaultWindowStart(waveformRows.length)));
  const [windowEnd, setWindowEnd] = useState(text(restoredWindow.endSample, defaultWindowEnd(waveformRows.length)));
  const [plannerId, setPlannerId] = useState(text(restoredPlan.plannerId, "planner-01"));
  const [direction, setDirection] = useState(text(restoredPlan.direction, legacyDraft?.direction ?? "切刀转矩与薄膜跟随性能"));
  const [note, setNote] = useState(text(restoredPlan.note, legacyDraft?.note ?? "").replace("—", ""));
  const [supervisorId, setSupervisorId] = useState(text(restoredConfirmation.supervisorId, "supervisor-01"));
  const [supervisorNote, setSupervisorNote] = useState(text(restoredConfirmation.note, "").replace("—", ""));
  const [additionalSamples, setAdditionalSamples] = useState(text(restoredContinuation.additionalSamples, "512"));
  const [continuationReason, setContinuationReason] = useState(text(restoredContinuation.reason, "").replace("—", ""));
  const sessionRef = useRef(sessionId);

  useEffect(() => {
    const sessionChanged = sessionRef.current !== sessionId;
    sessionRef.current = sessionId;
    const maximum = Math.max(0, waveformRows.length - 1);
    setSignal((restoredPlan.selectedSignal ?? legacyDraft?.signal ?? "cutter_motor_torque") as SignalField);
    setCursorIndex(clamp((numeric(restoredCursor.sampleIndex) ?? defaultCursorIndex(waveformRows.length) + 1) - 1, 0, maximum));
    setCursorTouched(Boolean((restoredCursor.channels as unknown[] | undefined)?.length === 3 || legacyDraft?.viewed));
    setWindowStart(text(restoredWindow.startSample, defaultWindowStart(waveformRows.length)));
    setWindowEnd(text(restoredWindow.endSample, defaultWindowEnd(waveformRows.length)));
    setPlannerId(text(restoredPlan.plannerId, "planner-01"));
    setDirection(text(restoredPlan.direction, legacyDraft?.direction ?? "切刀转矩与薄膜跟随性能"));
    setNote(text(restoredPlan.note, legacyDraft?.note ?? "").replace("—", ""));
    setSupervisorId(text(restoredConfirmation.supervisorId, "supervisor-01"));
    setSupervisorNote(text(restoredConfirmation.note, "").replace("—", ""));
    if (sessionChanged || restoredContinuation.additionalSamples !== undefined || restoredContinuation.reason !== undefined) {
      setAdditionalSamples(text(restoredContinuation.additionalSamples, "512"));
      setContinuationReason(text(restoredContinuation.reason, "").replace("—", ""));
    }
  }, [aggregateSignature, legacyDraft, sessionId, waveformRows.length]);

  const filtered = waveformObjects.filter((item) => {
    const level = text(item.payload.rule_review_level);
    const matchesPriority = !priorityOnly || level === "优先复核" || level === "关注";
    const searchText = [item.payload.session_id, level, item.payload.dominant_deviation_signal].map((value) => text(value).toLowerCase()).join(" ");
    return matchesPriority && (!query.trim() || searchText.includes(query.trim().toLowerCase()));
  });
  const attention = (numeric(row.health_deviation_index) ?? 0) >= (numeric(row.rule_threshold) ?? Number.POSITIVE_INFINITY);
  const currentSample = waveformRows[cursorIndex] ?? {};
  const sampleNumber = numeric(currentSample.sample_index) ?? cursorIndex + 1;
  const cursorX = waveformRows.length <= 1 ? 0 : (cursorIndex / (waveformRows.length - 1)) * 1000;
  const start = numeric(windowStart) ?? 0;
  const end = numeric(windowEnd) ?? 0;
  const validWindow = waveformRows.length >= 2 && start >= 1 && end <= waveformRows.length && start < end;
  const cursorInsideWindow = sampleNumber >= start && sampleNumber <= end;
  const xForSample = (sample: number) => waveformRows.length <= 1
    ? 0
    : (clamp(sample, 1, waveformRows.length) - 1) / (waveformRows.length - 1) * 1000;
  const windowX = Math.min(xForSample(start || 1), xForSample(end || 1));
  const windowWidth = Math.max(0, Math.abs(xForSample(end || 1) - xForSample(start || 1)));
  const planPersisted = Boolean(restoredPlan.planId && restoredPlan.sessionId === sessionId);
  const plannerReady = Boolean(
    props.actorRole === "maintenance_planner"
    && !planPersisted
    && waveformRows.length >= 2
    && cursorTouched
    && validWindow
    && cursorInsideWindow
    && plannerId.trim()
    && note.trim().length >= 6,
  );
  const supervisorReady = Boolean(
    props.actorRole === "supervisor"
    && planPersisted
    && supervisorId.trim()
    && supervisorId.trim() !== text(restoredPlan.plannerId, "")
    && supervisorNote.trim().length >= 6,
  );
  const continuationReady = Boolean(
    props.actorRole === "maintenance_planner"
    && waveformRows.length >= 2
    && (numeric(additionalSamples) ?? 0) >= 128
    && (numeric(additionalSamples) ?? 0) <= 8192
    && continuationReason.trim().length >= 6,
  );

  function rowsForSession(candidateSessionId: string) {
    return allWaveforms
      .filter((item) => text(item.session_id) === candidateSessionId)
      .sort((a, b) => Number(a.sample_index) - Number(b.sample_index));
  }

  function reviewSignal(field: SignalField) {
    setSignal(field);
    if (waveformRows.length) setCursorTouched(true);
  }

  function moveCursor(raw: string) {
    setCursorIndex(clamp(Number(raw), 0, Math.max(0, waveformRows.length - 1)));
    setCursorTouched(waveformRows.length > 0);
  }

  function runCommand(command: string) {
    if (command === "schedule_night_inspection" && !plannerReady) return;
    if (command === "confirm_maintenance" && !supervisorReady) return;
    if (command === "continue_monitoring" && !continuationReady) return;
    const reason: CutterDraft = { signal, viewed: cursorTouched, direction, note: note.trim() };
    const cursorValues = Object.fromEntries(signals.map((item) => [item.field, numeric(currentSample[item.field]) ?? null]));
    const currentPlan: InspectionPlan = {
      planId: `CUTTER-PLAN-${sessionId}`,
      sessionId,
      plannerId: plannerId.trim(),
      selectedSignal: signal,
      syncedCursor: {
        sampleIndex: sampleNumber,
        channels: signals.map((item) => item.field),
        values: cursorValues,
      },
      inspectionWindow: { startSample: start, endSample: end },
      direction,
      note: note.trim(),
      status: command === "confirm_maintenance" ? "confirmed" : "pending_confirmation",
    };
    const data: Record<string, unknown> = {
      aggregateType: "cutter_health_review_session",
      reviewId: `CUTTER-REVIEW-${sessionId}`,
      taskVersion: props.selected.version + 1,
      sessionId,
      source: {
        summaryDatasetRows: props.datasetRowCount,
        waveformArtifact: "waveform.csv",
        sampleCount: waveformRows.length,
        channels: signals.map((item) => ({ field: item.field })),
      },
      decision: command === "schedule_night_inspection" ? "schedule_inspection" : command === "confirm_maintenance" ? "confirm_inspection" : "continue_sampling",
      serverValidationRequired: true,
    };
    if (command === "schedule_night_inspection") data.inspectionPlan = currentPlan;
    if (command === "confirm_maintenance") {
      data.inspectionPlan = restoredPlan;
      data.supervisorConfirmation = {
        supervisorId: supervisorId.trim(),
        confirmedPlanId: text(restoredPlan.planId),
        note: supervisorNote.trim(),
        decision: "confirm",
      };
    }
    if (command === "continue_monitoring") {
      data.continuation = {
        additionalSamples: numeric(additionalSamples),
        reason: continuationReason.trim(),
        status: "requested",
      };
    }
    props.onCommand(command, `cutter-review:${JSON.stringify(reason)}`, {
      actorId: command === "confirm_maintenance" ? supervisorId.trim() : plannerId.trim(),
      data,
      evidenceIds: [
        `session:${sessionId}:summary`,
        ...(waveformRows.length ? [`waveform:${sessionId}:samples-${waveformRows.length}`, `waveform:${sessionId}:cursor-${sampleNumber}`] : []),
      ],
      idempotencyKey: `case-B017:session:${sessionId}:${command}:v${props.selected.version}`,
    });
  }

  function reset() {
    setQuery("");
    setPriorityOnly(false);
    setSignal("cutter_motor_torque");
    setCursorIndex(defaultCursorIndex(waveformRows.length));
    setCursorTouched(false);
    setWindowStart(defaultWindowStart(waveformRows.length));
    setWindowEnd(defaultWindowEnd(waveformRows.length));
    setNote("");
    setSupervisorNote("");
    setContinuationReason("");
    props.onReset();
  }

  const scheduleCommand = props.commands.find((command) => command.id === "schedule_night_inspection");
  const confirmCommand = props.commands.find((command) => command.id === "confirm_maintenance");
  const continueCommand = props.commands.find((command) => command.id === "continue_monitoring");

  return <main className={styles.root} aria-label="包装切刀会话复核台">
    <header className={styles.header}>
      <div className={styles.brand}>
        <h1>包装切刀会话复核</h1>
        <span>当前会话</span>
        <strong>{sessionId}</strong>
        <em data-attention={attention}>{props.selected.state}</em>
      </div>
      <div className={styles.headerActions}>
        <label><UserRound size={18} /><span className={styles.srOnly}>当前操作角色</span><select aria-label="当前操作角色" value={props.actorRole} onChange={(event) => props.onActorRoleChange(event.target.value)}>{props.roles.map((role) => <option value={role} key={role}>{roleLabel(role)}</option>)}</select></label>
        <button type="button" aria-label="恢复案例 B017" title="恢复案例 B017" onClick={reset}><RefreshCw size={18} /></button>
      </div>
    </header>

    <aside className={styles.nav} aria-label="设备会话检索">
      <div className={styles.navHeading}><strong>会话选择</strong><span>{waveformObjects.length} 个含波形会话</span></div>
      <label className={styles.search}><Search size={18} /><input aria-label="搜索设备会话" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索会话编号" /></label>
      <div className={styles.filters} aria-label="复核层级">
        <span>复核层级</span>
        <button type="button" data-active={!priorityOnly} onClick={() => setPriorityOnly(false)}>全部</button>
        <button type="button" data-active={priorityOnly} onClick={() => setPriorityOnly(true)}>需关注</button>
      </div>
      <div className={styles.sessionList}>
        {filtered.map((item) => {
          const itemSessionId = text(item.payload.session_id);
          const sessionWaveform = rowsForSession(itemSessionId);
          return <button type="button" key={item.objectId} aria-pressed={item.objectId === props.selected.objectId} onClick={() => props.onSelect(item.objectId)}>
            <span className={styles.sessionState} data-attention={text(item.payload.rule_review_level) !== "常规"} />
            <span><strong>{itemSessionId}</strong><small>{text(item.payload.rule_review_level)}</small></span>
            <svg viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
              <polyline data-tone="torque" points={waveformPoints(sessionWaveform, "cutter_motor_torque", 2, 13, 100)} />
              <polyline data-tone="film" points={waveformPoints(sessionWaveform, "film_follow_error", 17, 28, 100)} />
            </svg>
            <ChevronRight size={18} />
          </button>;
        })}
        {!filtered.length ? <p className={styles.noResults}>没有匹配的波形会话</p> : null}
      </div>
      <div className={styles.sourceCounts}>
        <div><Database size={17} /><span><strong>{props.datasetRowCount}</strong> 摘要行</span></div>
        <div><Waves size={17} /><span><strong>{waveformSessions.size}</strong> 波形会话</span></div>
        <div><ShieldCheck size={17} /><span><strong>{reviewQueueCount}</strong> 规则队列</span></div>
      </div>
    </aside>

    <section className={styles.workspace} aria-label="三路同步波形工作区">
      <section className={styles.metrics} aria-label="当前会话规则摘要">
        <article data-tone="danger"><Gauge size={24} /><span>健康偏差<strong>{format(row.health_deviation_index)}</strong></span></article>
        <article data-tone="blue"><ShieldCheck size={24} /><span>规则线<strong>{format(row.rule_threshold)}</strong></span></article>
        <article data-tone="signal"><Activity size={24} /><span>主导信号<strong>{text(row.dominant_deviation_signal)}</strong></span></article>
      </section>

      <section className={styles.waveform} aria-label="三路真实波形">
        {waveformRows.length ? <>
          <svg viewBox="0 0 1000 510" preserveAspectRatio="none" role="img" aria-label={`${sessionId} 三通道原始波形`}>
            <defs>
              <filter id="cutter-cursor-glow" x="-50%" y="-20%" width="200%" height="140%"><feGaussianBlur stdDeviation="5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            </defs>
            {signals.map((item, index) => {
              const top = index * 170;
              return <g key={item.field} data-track={item.tone}>
                <rect x="0" y={top + 1} width="1000" height="158" rx="8" />
                <rect className={styles.windowFill} x={windowX} y={top + 1} width={windowWidth} height="158" />
                {[40, 80, 120].map((offset) => <line key={offset} className={styles.gridLine} x1="0" x2="1000" y1={top + offset} y2={top + offset} />)}
                <line className={styles.windowEdge} x1={windowX} x2={windowX} y1={top + 1} y2={top + 159} />
                <line className={styles.windowEdge} x1={windowX + windowWidth} x2={windowX + windowWidth} y1={top + 1} y2={top + 159} />
                <polyline data-tone={item.tone} points={waveformPoints(waveformRows, item.field, top + 22, top + 142)} />
                <line data-cursor={item.tone} className={styles.cursorLine} x1={cursorX} x2={cursorX} y1={top + 1} y2={top + 159} />
              </g>;
            })}
          </svg>
          <div className={styles.trackLabels}>
            {signals.map((item) => <button type="button" key={item.field} data-tone={item.tone} data-active={signal === item.field} onClick={() => reviewSignal(item.field)}>
              <i />
              <span><strong>{item.label}</strong><small>{item.channel} · 来源未标单位</small></span>
              <em>游标 {format(currentSample[item.field], 4)}</em>
            </button>)}
          </div>
          <div className={styles.cursorBadge} style={{ left: `${cursorX / 10}%` }}>样本 {sampleNumber}</div>
          <div className={styles.windowBadge} style={{ left: `${(windowX + windowWidth / 2) / 10}%` }}>排检窗口 {validWindow ? `${start}—${end}` : "待修正"}</div>
        </> : <p className={styles.empty}><AlertTriangle size={22} />当前会话只有摘要，没有可核对的本地波形。</p>}
      </section>

      <section className={styles.transport}>
        <label><span>三通道同步游标</span><input aria-label="三通道同步游标" type="range" min="0" max={Math.max(0, waveformRows.length - 1)} value={cursorIndex} onChange={(event) => moveCursor(event.target.value)} disabled={!waveformRows.length} /><strong>样本 {sampleNumber} / {waveformRows.length || 0}</strong></label>
        <span><i />排检窗口</span><span><i />当前游标</span>
      </section>
    </section>

    <aside className={styles.review} aria-label="切刀复核流程">
      <div className={styles.reviewTitle}>
        <div><h2>{props.actorRole === "supervisor" ? "主管确认" : "排检计划"}</h2><p>{planPersisted ? text(restoredPlan.planId) : "用同一游标核对三路原始值"}</p></div>
        <span data-persisted={planPersisted}>{planPersisted ? "已保存" : "待保存"}</span>
      </div>

      {props.actorRole === "maintenance_planner" && !planPersisted ? <section className={styles.form} aria-label="维护计划员排检表单">
        <label>排检方向<select aria-label="排检方向" value={direction} onChange={(event) => setDirection(event.target.value)}><option>切刀转矩与薄膜跟随性能</option><option>切刀跟随误差与传动间隙</option><option>继续采样观察</option></select></label>
        <label>计划员<input aria-label="维护计划员账号" value={plannerId} onChange={(event) => setPlannerId(event.target.value)} /></label>
        <div className={styles.windowInputs}>
          <label>窗口起点<input aria-label="检查窗口起点" type="number" min="1" max={Math.max(1, waveformRows.length)} value={windowStart} onChange={(event) => setWindowStart(event.target.value)} /></label>
          <label>窗口终点<input aria-label="检查窗口终点" type="number" min="1" max={Math.max(1, waveformRows.length)} value={windowEnd} onChange={(event) => setWindowEnd(event.target.value)} /></label>
        </div>
        <label>复核说明<textarea aria-label="切刀复核说明" value={note} onChange={(event) => setNote(event.target.value)} maxLength={200} placeholder="记录窗口内三路波形的可见特征，不写故障结论" /><small>{note.length} / 200</small></label>
        {!cursorTouched ? <p className={styles.hint}><CircleHelp size={16} />请先移动游标或选择一条信号。</p> : !validWindow || !cursorInsideWindow ? <p className={styles.hint}><AlertTriangle size={16} />窗口需包含当前游标，且起点小于终点。</p> : null}
        {scheduleCommand ? <button className={styles.primaryAction} type="button" disabled={props.busy || !plannerReady} onClick={() => runCommand(scheduleCommand.id)}><Wrench size={18} />{props.busy ? "正在保存…" : "保存排检计划"}</button> : null}
      </section> : null}

      {props.actorRole === "maintenance_planner" && planPersisted ? <section className={styles.savedPlan} aria-label="已保存排检计划">
        <CheckCircle2 size={36} />
        <h3>计划已保存</h3>
        <p>等待另一名维护主管核对同一会话、游标和窗口。</p>
        <dl>
          <div><dt>计划员</dt><dd>{text(restoredPlan.plannerId)}</dd></div>
          <div><dt>同步游标</dt><dd>样本 {text(restoredCursor.sampleIndex)}</dd></div>
          <div><dt>排检窗口</dt><dd>{text(restoredWindow.startSample)}—{text(restoredWindow.endSample)}</dd></div>
        </dl>
        <button type="button" onClick={() => props.onActorRoleChange("supervisor")}>切换维护主管 <ChevronRight size={18} /></button>
      </section> : null}

      {props.actorRole === "supervisor" ? <section className={styles.form} aria-label="维护主管确认表单">
        {planPersisted ? <>
          <div className={styles.planSummary}>
            <span>会话<strong>{text(restoredPlan.sessionId)}</strong></span>
            <span>计划员<strong>{text(restoredPlan.plannerId)}</strong></span>
            <span>同步游标<strong>样本 {text(restoredCursor.sampleIndex)}</strong></span>
            <span>排检窗口<strong aria-label="已保存检查窗口">{text(restoredWindow.startSample)}—{text(restoredWindow.endSample)}</strong></span>
          </div>
          <label>主管账号<input aria-label="维护主管账号" value={supervisorId} onChange={(event) => setSupervisorId(event.target.value)} /></label>
          <label>确认说明<textarea aria-label="维护主管确认说明" value={supervisorNote} onChange={(event) => setSupervisorNote(event.target.value)} maxLength={200} placeholder="核对会话、游标与窗口后记录确认意见" /><small>{supervisorNote.length} / 200</small></label>
          {supervisorId.trim() === text(restoredPlan.plannerId, "") ? <p className={styles.hint}><AlertTriangle size={16} />主管账号必须与计划员不同。</p> : null}
          {confirmCommand ? <button className={styles.primaryAction} type="button" disabled={props.busy || !supervisorReady} onClick={() => runCommand(confirmCommand.id)}><CheckCircle2 size={18} />{props.busy ? "正在确认…" : "确认排检候选"}</button> : null}
        </> : <div className={styles.locked}><ShieldCheck size={38} /><h3>等待计划员保存</h3><p>主管不能确认尚未持久化的排检计划。</p></div>}
      </section> : null}

      {props.actorRole === "maintenance_planner" && continueCommand ? <details className={styles.continuePanel} open={!scheduleCommand}>
        <summary>当前证据不足？继续采样</summary>
        <label>追加样本<input aria-label="继续采样数量" type="number" min="128" max="8192" step="128" value={additionalSamples} onChange={(event) => setAdditionalSamples(event.target.value)} /></label>
        <label>采样理由<textarea aria-label="继续采样理由" value={continuationReason} onChange={(event) => setContinuationReason(event.target.value)} placeholder="说明现有切片为什么不足" /></label>
        <button type="button" disabled={props.busy || !continuationReady} onClick={() => runCommand(continueCommand.id)}>请求继续采样</button>
      </details> : null}

      <section className={styles.boundary}>
        <ShieldCheck size={19} />
        <div><strong>偏差不等于设备故障</strong><p>当前数据不含换刀史、产品质量、排产窗口或停机代价。</p></div>
      </section>
      {props.receipt ? <p className={styles.receipt} role="status">已持久化：{props.receipt.event.fromState} → {props.receipt.event.toState}</p> : null}
      {props.error ? <p className={styles.error} role="alert"><span>{props.error}</span><button type="button" onClick={() => props.onSelect(props.selected.objectId)}>刷新当前会话</button></p> : null}
    </aside>

    <footer className={styles.statusbar}>
      <span><Waves size={18} /><strong>本地波形 {waveformRows.length || 0} 点固定切片</strong></span>
      <span><Database size={18} /><strong>源会话摘要 {format(row.source_samples, 0)} 点</strong></span>
      <span><Activity size={18} /><strong>三路信号未提供工程单位</strong></span>
      <span><ShieldCheck size={18} /><strong>规则偏差只形成排检候选</strong></span>
    </footer>
  </main>;
}
