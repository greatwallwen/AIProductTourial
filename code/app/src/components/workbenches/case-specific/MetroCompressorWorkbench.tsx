"use client";

import {
  Activity,
  BookOpenCheck,
  Check,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  CircleCheck,
  ClipboardList,
  Database,
  FileSearch,
  Gauge,
  RefreshCw,
  Search,
  ShieldCheck,
  Thermometer,
  Wrench,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import styles from "./MetroCompressorWorkbench.module.css";
import type { CaseWorkbenchProps } from "./types";

const primaryTraces = [
  { key: "TP2", label: "TP2 排气压力", shortLabel: "TP2 排气压力", color: "#2085f3", unit: "bar", position: [49, 24], icon: Gauge },
  { key: "Oil_temperature", label: "油温", shortLabel: "油温", color: "#ef7e36", unit: "℃", position: [58, 58], icon: Thermometer },
  { key: "Motor_current", label: "电机电流", shortLabel: "电机电流", color: "#22a997", unit: "A", position: [25, 78], icon: Zap },
] as const;

const checklistItems = [
  "核对五分钟窗口与故障边界",
  "核对传感字段、样本数与来源",
  "确认现场检查不触发设备控制",
] as const;

const MAX_CONTIGUOUS_SAMPLE_GAP_SECONDS = 120;
const FAILURE_BOUNDARY = "2020-04-18 00:00:00";

type TraceKey = (typeof primaryTraces)[number]["key"];
type WindowKind = "boundary" | "gap" | "recovered";
type RetrievalResult = {
  id: string;
  title: string;
  score: number;
  stance: "support" | "constraint";
  source: string;
  version: string;
};
type RetrievalTask = {
  investigationId: string;
  question: string;
  query: string;
  activeTrace: string;
  timestamp: string;
  windowStart: string;
  windowEnd: string;
  rankedResults: RetrievalResult[];
  createdBy: string;
};
type GapInfo = { seconds: number; index: number };
type InvestigationWindow = {
  id: string;
  kind: WindowKind;
  label: string;
  rows: Record<string, unknown>[];
  gap: GapInfo;
};

function text(value: unknown, fallback = "—"): string {
  return value === undefined || value === null || value === "" ? fallback : String(value);
}
function numeric(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
function formatNumber(value: unknown): string {
  return numeric(value).toFixed(3).replace(/\.?0+$/u, "");
}
function shortTime(value: unknown): string {
  const source = text(value, "");
  return source.length >= 19 ? source.slice(11, 19) : source || "—";
}
function timestampMillis(value: unknown): number | undefined {
  const match = text(value, "").match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/u);
  if (!match) return undefined;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6]));
}
function roleLabel(role: string): string {
  return role === "supervisor" ? "检修主管" : role === "engineer" ? "值班工程师" : role;
}
function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}
function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(record) : [];
}
function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
function parseReview(reason: unknown): { checked: string[]; note: string; activeTrace?: string } | undefined {
  const source = text(reason, "");
  if (!source.startsWith("inspection-review:")) return undefined;
  try {
    return JSON.parse(source.slice("inspection-review:".length)) as { checked: string[]; note: string; activeTrace?: string };
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
    const legacy = parseReview(event.reason);
    if (legacy) Object.assign(merged, { inspection: legacy });
  }
  if (props.receipt?.event.data) Object.assign(merged, props.receipt.event.data);
  if (props.selected.task) Object.assign(merged, props.selected.task);
  return merged;
}
function gapInfo(rows: Record<string, unknown>[]): GapInfo {
  return rows.slice(1).reduce<GapInfo>((largest, row, offset) => {
    const before = timestampMillis(rows[offset]?.timestamp);
    const after = timestampMillis(row.timestamp);
    if (before === undefined || after === undefined) return largest;
    const seconds = Math.round((after - before) / 1_000);
    return seconds > largest.seconds ? { seconds, index: offset } : largest;
  }, { seconds: 0, index: 0 });
}
function windowKind(rows: Record<string, unknown>[]): WindowKind {
  const gap = gapInfo(rows);
  if (gap.seconds > MAX_CONTIGUOUS_SAMPLE_GAP_SECONDS) return "gap";
  const start = text(rows[0]?.timestamp, "");
  const end = text(rows[rows.length - 1]?.timestamp, "");
  return start <= FAILURE_BOUNDARY && end >= FAILURE_BOUNDARY ? "boundary" : "recovered";
}
function windowLabel(kind: WindowKind): string {
  return kind === "gap" ? "遥测断档" : kind === "boundary" ? "故障区间起点" : "恢复后连续窗口";
}
function deriveWindows(sourceRows: Record<string, unknown>[]): InvestigationWindow[] {
  const sorted = sourceRows.slice().sort((left, right) => text(left.timestamp, "").localeCompare(text(right.timestamp, "")));
  const grouped = new Map<string, Record<string, unknown>[]>();
  for (const row of sorted) {
    const id = text(row.investigation_id, "");
    if (!id) continue;
    grouped.set(id, [...(grouped.get(id) ?? []), row]);
  }

  let candidates: Array<{ id: string; rows: Record<string, unknown>[] }>;
  if (grouped.size >= 2) {
    candidates = [...grouped.entries()].map(([id, rows]) => ({ id, rows }));
  } else {
    const ranges = [
      { id: "fault-boundary", start: "2020-04-17 23:57:30", end: "2020-04-18 00:02:30" },
      { id: "telemetry-gap", start: "2020-04-18 00:17:30", end: "2020-04-18 00:24:30" },
      { id: "recovered-window", start: "2020-04-18 00:23:59", end: "2020-04-18 00:29:00" },
    ];
    candidates = ranges
      .map((range) => ({ id: range.id, rows: sorted.filter((row) => text(row.timestamp, "") >= range.start && text(row.timestamp, "") <= range.end) }))
      .filter((item) => item.rows.length > 0);
  }

  const rank: Record<WindowKind, number> = { boundary: 0, gap: 1, recovered: 2 };
  return candidates.map((candidate) => {
    const kind = windowKind(candidate.rows);
    return { id: candidate.id, kind, label: windowLabel(kind), rows: candidate.rows, gap: gapInfo(candidate.rows) };
  }).sort((left, right) => rank[left.kind] - rank[right.kind]);
}
function queryFor(traceLabel: string, hasGap: boolean, question: string): string {
  return `${traceLabel} ${hasGap ? "采样断档" : "连续窗口"} 现场检查 ${question}`.trim();
}
function rankedKnowledge(
  knowledge: Record<string, unknown>[],
  query: string,
  activeTrace: TraceKey,
  traceLabel: string,
): RetrievalResult[] {
  const tokens = [...new Set([
    activeTrace,
    traceLabel,
    ...query.split(/[\s，。；、？：]+/u).filter((item) => item.length >= 2),
  ])];
  return knowledge.map((item) => {
    const haystack = `${text(item.title)} ${text(item.content)} ${text(item.boundary)} ${text(item.type)}`.toLocaleLowerCase("zh-CN");
    const lexical = tokens.reduce((score, token) => score + (haystack.includes(token.toLocaleLowerCase("zh-CN")) ? 3 : 0), 0);
    const type = text(item.type);
    const stance: RetrievalResult["stance"] = type.includes("approval") ? "constraint" : "support";
    const typeBoost = type.includes("field") ? 6 : type.includes("inspection") ? 4 : type.includes("source") ? 2 : 1;
    return {
      id: text(item.id),
      title: text(item.title),
      score: lexical + typeBoost,
      stance,
      source: text(item.source ?? item.source_id),
      version: text(item.version),
    };
  }).sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));
}
function restoredResults(retrieval: Record<string, unknown>): RetrievalResult[] {
  return records(retrieval.rankedResults).map((item) => ({
    id: text(item.id),
    title: text(item.title),
    score: numeric(item.score),
    stance: text(item.stance) === "constraint" ? "constraint" : "support",
    source: text(item.source),
    version: text(item.version),
  }));
}

export function MetroCompressorWorkbench(props: CaseWorkbenchProps) {
  const sourceRows = props.sceneRows.length ? props.sceneRows : props.objects.map((item) => item.payload);
  const windows = useMemo(() => deriveWindows(sourceRows), [sourceRows]);
  const restored = useMemo(
    () => restoredTask(props),
    [props.events, props.receipt, props.selected.objectId, props.selected.task, props.selected.version],
  );
  const restoredRetrieval = record(restored.retrieval);
  const restoredInspection = record(restored.inspection);
  const restoredHold = record(restored.hold);
  const persistedInvestigationId = text(
    restoredInspection.investigationId ?? restoredRetrieval.investigationId ?? restoredHold.investigationId,
    "",
  );
  const selectedInvestigationId = persistedInvestigationId || text(props.selected.payload.investigation_id, "");
  const selectedWindow = windows.find((item) => item.id === selectedInvestigationId)
    ?? windows.find((item) => item.kind === "gap")
    ?? windows[0];
  const [activeWindowId, setActiveWindowId] = useState(selectedWindow?.id ?? "");
  const activeWindow = windows.find((item) => item.id === activeWindowId) ?? selectedWindow;
  const rows = activeWindow?.rows ?? [props.selected.payload];
  const hasSamplingGap = (activeWindow?.gap.seconds ?? 0) > MAX_CONTIGUOUS_SAMPLE_GAP_SECONDS;
  const gapEdge = activeWindow?.gap.index ?? 0;
  const before = rows[Math.min(gapEdge, rows.length - 1)] ?? props.selected.payload;
  const after = rows[Math.min(gapEdge + 1, rows.length - 1)] ?? before;
  const knowledge = props.supportingArtifacts["knowledge.jsonl"] ?? [];
  const restoredTrace = text(restoredRetrieval.activeTrace ?? restoredInspection.activeTrace, "TP2") as TraceKey;
  const [activeTrace, setActiveTrace] = useState<TraceKey>(primaryTraces.some((item) => item.key === restoredTrace) ? restoredTrace : "TP2");
  const activeMeta = primaryTraces.find((item) => item.key === activeTrace) ?? primaryTraces[0];
  const defaultQuestion = `当前片段中的${activeMeta.label}变化需要补充哪些现场检查记录？`;
  const [question, setQuestion] = useState(text(restoredRetrieval.question, defaultQuestion));
  const [checked, setChecked] = useState<string[]>(stringArray(restoredInspection.checked));
  const [note, setNote] = useState(text(restoredInspection.note, ""));
  const [showDocuments, setShowDocuments] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const generatedQuery = queryFor(activeMeta.label, hasSamplingGap, question);
  const persistedResults = restoredResults(restoredRetrieval);
  const generatedResults = useMemo(
    () => rankedKnowledge(knowledge, generatedQuery, activeTrace, activeMeta.label),
    [activeMeta.label, activeTrace, generatedQuery, knowledge],
  );
  const retrievalComplete = persistedResults.length > 0;
  const effectiveResults = retrievalComplete ? persistedResults : generatedResults;
  const defaultSupport = effectiveResults.find((item) => item.stance === "support")?.id;
  const defaultChallenge = effectiveResults.find((item) => item.stance === "constraint")?.id;
  const [supportCitationIds, setSupportCitationIds] = useState<string[]>(
    stringArray(restoredInspection.supportCitationIds).length
      ? stringArray(restoredInspection.supportCitationIds)
      : defaultSupport ? [defaultSupport] : [],
  );
  const [challengeCitationIds, setChallengeCitationIds] = useState<string[]>(
    stringArray(restoredInspection.challengeCitationIds).length
      ? stringArray(restoredInspection.challengeCitationIds)
      : defaultChallenge ? [defaultChallenge] : [],
  );

  useEffect(() => {
    if (selectedWindow?.id) setActiveWindowId(selectedWindow.id);
  }, [props.selected.objectId, selectedWindow?.id]);
  useEffect(() => {
    const nextTrace = text(restoredRetrieval.activeTrace ?? restoredInspection.activeTrace, "TP2") as TraceKey;
    const safeTrace = primaryTraces.some((item) => item.key === nextTrace) ? nextTrace : "TP2";
    setActiveTrace(safeTrace);
    const meta = primaryTraces.find((item) => item.key === safeTrace) ?? primaryTraces[0];
    setQuestion(text(restoredRetrieval.question, `当前片段中的${meta.label}变化需要补充哪些现场检查记录？`));
    setChecked(stringArray(restoredInspection.checked));
    setNote(text(restoredInspection.note, ""));
    const results = restoredResults(restoredRetrieval);
    const support = stringArray(restoredInspection.supportCitationIds);
    const challenge = stringArray(restoredInspection.challengeCitationIds);
    setSupportCitationIds(support.length ? support : results.find((item) => item.stance === "support")?.id ? [results.find((item) => item.stance === "support")!.id] : []);
    setChallengeCitationIds(challenge.length ? challenge : results.find((item) => item.stance === "constraint")?.id ? [results.find((item) => item.stance === "constraint")!.id] : []);
  }, [props.selected.objectId, props.selected.version, restored]);
  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!media) return undefined;
    const update = () => setPrefersReducedMotion(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  const actorId = props.actorRole === "supervisor" ? "case09-maintenance-supervisor" : "case09-duty-engineer";
  const retrievalCreator = text(restoredRetrieval.createdBy, "");
  const inspectionSubmitted = props.selected.state === "检查申请已提交";
  const allChecked = checklistItems.every((item) => checked.includes(item));
  const inspectionReady = !hasSamplingGap
    && retrievalComplete
    && allChecked
    && note.trim().length >= 6
    && supportCitationIds.length > 0
    && challengeCitationIds.length > 0
    && props.actorRole === "supervisor"
    && retrievalCreator !== actorId;
  const publicDocuments = knowledge.filter((item) => ["source-fact", "field-definition"].includes(text(item.type)));
  const courseDocuments = knowledge.filter((item) => !["source-fact", "field-definition"].includes(text(item.type)));

  function chooseWindow(window: InvestigationWindow) {
    setActiveWindowId(window.id);
    setActiveTrace("TP2");
    setQuestion("当前片段中的TP2 排气压力变化需要补充哪些现场检查记录？");
    setChecked([]);
    setNote("");
    setSupportCitationIds([]);
    setChallengeCitationIds([]);
    const target = props.objects.find((item) => text(item.payload.investigation_id, "") === window.id);
    if (target) props.onSelect(target.objectId);
  }
  function chooseTrace(nextTrace: TraceKey) {
    const previousDefault = `当前片段中的${activeMeta.label}变化需要补充哪些现场检查记录？`;
    setActiveTrace(nextTrace);
    if (question === previousDefault) {
      const next = primaryTraces.find((item) => item.key === nextTrace) ?? primaryTraces[0];
      setQuestion(`当前片段中的${next.label}变化需要补充哪些现场检查记录？`);
    }
  }
  function toggleChecked(item: string) {
    setChecked((items) => items.includes(item) ? items.filter((value) => value !== item) : [...items, item]);
  }
  function toggleCitation(id: string, stance: RetrievalResult["stance"]) {
    const setter = stance === "support" ? setSupportCitationIds : setChallengeCitationIds;
    setter((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }
  function commandReady(command: string): boolean {
    if (command === "run_retrieval") return question.trim().length >= 8 && generatedResults.length > 0;
    if (command === "hold_investigation") return note.trim().length >= 6;
    if (command === "create_inspection_order") return inspectionReady;
    return true;
  }
  function commandHint(command: string): string {
    if (command === "create_inspection_order" && hasSamplingGap) return "采样连续性未通过，只能先补设备记录";
    if (command === "create_inspection_order" && !retrievalComplete) return "先由值班工程师核对本地资料";
    if (command === "create_inspection_order" && !allChecked) return "请完成三项人工核对";
    if (command === "hold_investigation" && note.trim().length < 6) return "请先写明需要补充的记录";
    return "";
  }
  function runCommand(command: string) {
    if (!commandReady(command) || !activeWindow) return;
    const currentTimestamp = text(restoredRetrieval.timestamp, text(before.timestamp));
    const activeQuery = retrievalComplete ? text(restoredRetrieval.query, generatedQuery) : generatedQuery;
    if (command === "run_retrieval") {
      const retrieval: RetrievalTask = {
        investigationId: activeWindow.id,
        question: question.trim(),
        query: generatedQuery,
        activeTrace,
        timestamp: text(before.timestamp),
        windowStart: text(rows[0]?.timestamp),
        windowEnd: text(rows[rows.length - 1]?.timestamp),
        rankedResults: generatedResults,
        createdBy: actorId,
      };
      props.onCommand(command, `inspection-review:${JSON.stringify({ checked, note: note.trim(), activeTrace, timestamp: retrieval.timestamp })}`, {
        actorId,
        data: { retrieval },
        evidenceIds: generatedResults.map((item) => `${item.id}@${item.version}`),
        idempotencyKey: `case-09:${props.selected.objectId}:${command}:v${props.selected.version}:${activeWindow.id}:${activeTrace}`,
      });
      return;
    }
    if (command === "create_inspection_order") {
      const inspection = {
        investigationId: activeWindow.id,
        query: activeQuery,
        activeTrace,
        timestamp: currentTimestamp,
        supportCitationIds,
        challengeCitationIds,
        checked,
        note: note.trim(),
        requestedAction: "on_site_visual_inspection",
        reviewedBy: actorId,
      };
      props.onCommand(command, `inspection-review:${JSON.stringify({ checked, note: inspection.note, activeTrace, timestamp: inspection.timestamp })}`, {
        actorId,
        data: { inspection },
        evidenceIds: [...new Set([...supportCitationIds, ...challengeCitationIds])],
        idempotencyKey: `case-09:${props.selected.objectId}:${command}:v${props.selected.version}:${activeWindow.id}:${activeTrace}`,
      });
      return;
    }
    if (command === "hold_investigation") {
      props.onCommand(command, note.trim(), {
        actorId,
        data: {
          hold: {
            investigationId: activeWindow.id,
            query: activeQuery,
            activeTrace,
            timestamp: currentTimestamp,
            windowStart: text(rows[0]?.timestamp),
            windowEnd: text(rows[rows.length - 1]?.timestamp),
            reason: note.trim(),
            missingEvidenceIds: challengeCitationIds,
            reviewedBy: actorId,
          },
        },
        evidenceIds: [...new Set([...supportCitationIds, ...challengeCitationIds])],
        idempotencyKey: `case-09:${props.selected.objectId}:${command}:v${props.selected.version}:${activeWindow.id}:${activeTrace}`,
      });
      return;
    }
    props.onCommand(command, undefined);
  }
  function reset() {
    setActiveWindowId(selectedWindow?.id ?? "");
    setActiveTrace("TP2");
    setQuestion("当前片段中的TP2 排气压力变化需要补充哪些现场检查记录？");
    setChecked([]);
    setNote("");
    setShowDocuments(false);
    setSupportCitationIds([]);
    setChallengeCitationIds([]);
    props.onReset();
  }

  if (!activeWindow) return null;

  const continuityLabel = hasSamplingGap ? `${activeWindow.gap.seconds} 秒无记录` : "记录连续";
  const recordRange = `${text(before.source_row_index)}—${text(after.source_row_index)}`;
  const actions = props.commands;
  const hasInspectionCommand = actions.some((item) => item.id === "create_inspection_order");

  return (
    <main className={styles.root} aria-label="空压机遥测断档调查">
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <h1>空压机遥测断档调查</h1>
          <span><ClipboardList size={16} />记录 {recordRange}</span>
          <span><Activity size={16} />{shortTime(rows[0]?.timestamp)}—{shortTime(rows[rows.length - 1]?.timestamp)}</span>
          <span><Database size={16} />公开历史切片</span>
        </div>
        <div className={styles.headerTools}>
          <span className={styles.motionState}><Activity size={15} />{prefersReducedMotion ? "减弱动效：开" : "标准动效"}</span>
          <label>当前角色<select aria-label="当前操作角色" value={props.actorRole} onChange={(event) => props.onActorRoleChange(event.target.value)}>{props.roles.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}</select></label>
          <button type="button" aria-label="恢复案例 B09" title="恢复初始状态" onClick={reset} disabled={props.busy}><RefreshCw size={18} /></button>
        </div>
      </header>

      <nav className={styles.windowSwitch} aria-label="调查片段">
        {windows.map((window) => (
          <button type="button" key={window.id} aria-label={window.label} aria-pressed={window.id === activeWindow.id} onClick={() => chooseWindow(window)}>
            <span>{window.label}</span>
            <small>{shortTime(window.rows[0]?.timestamp)}—{shortTime(window.rows[window.rows.length - 1]?.timestamp)}</small>
            <b>{window.rows.length} 条记录 · 最大间隔 {window.gap.seconds} 秒</b>
          </button>
        ))}
      </nav>

      <section className={styles.layout}>
        <section className={styles.visualColumn}>
          <section className={styles.equipment} aria-label="空压机设备信息图">
            <header><span>设备位置示意 · 非真实几何</span><b>{activeMeta.label}</b></header>
            <img src="/case-assets/case-09/scene.png" alt="空压机与管路的课程示意场景" suppressHydrationWarning />
            <div className={styles.sceneShade} />
            <svg className={styles.dataFlow} viewBox="0 0 1000 520" preserveAspectRatio="none" aria-hidden="true">
              <path d="M250 410 C410 406 472 332 560 292 S760 220 940 220" />
            </svg>
            <div className={styles.markers}>
              {primaryTraces.map((trace) => {
                const Icon = trace.icon;
                return (
                  <button
                    type="button"
                    key={trace.key}
                    aria-label={`选择${trace.label === "TP2 排气压力" ? " TP2 排气压力" : trace.label}`}
                    aria-pressed={activeTrace === trace.key}
                    onClick={() => chooseTrace(trace.key)}
                    style={{ "--x": `${trace.position[0]}%`, "--y": `${trace.position[1]}%`, "--trace": trace.color } as CSSProperties}
                  >
                    <i><Icon size={19} /></i><span>{trace.shortLabel}<strong>{formatNumber(before[trace.key])} {trace.unit}</strong></span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className={styles.comparison} aria-label="断档前后数据对照">
            <article className={styles.beforeCard}>
              <header>断档前 {shortTime(before.timestamp)}</header>
              {primaryTraces.map((trace) => <p key={trace.key}><span>{trace.shortLabel}</span><strong>{formatNumber(before[trace.key])}</strong><small>{trace.unit}</small></p>)}
            </article>
            <article key={activeWindow.id} className={hasSamplingGap ? styles.gapCard : styles.continuousCard}>
              <header>{continuityLabel}</header>
              <div>{hasSamplingGap ? <CircleAlert size={38} /> : <CircleCheck size={38} />}<strong>{hasSamplingGap ? activeWindow.gap.seconds : activeWindow.gap.seconds}</strong><span>{hasSamplingGap ? "秒无记录" : "秒最大间隔"}</span></div>
              <small>{hasSamplingGap ? "中间变化未知，不连接曲线" : "该片段采样连续"}</small>
            </article>
            <article className={styles.afterCard}>
              <header>{hasSamplingGap ? "恢复后" : "片段末尾"} {shortTime(after.timestamp)}</header>
              {primaryTraces.map((trace) => <p key={trace.key}><span>{trace.shortLabel}</span><strong>{formatNumber(after[trace.key])}</strong><small>{trace.unit}</small></p>)}
            </article>
          </section>
        </section>

        <aside className={styles.decision} aria-label="数据连续性门禁">
          <header className={styles.decisionTitle}><div><span>申请前检查</span><h2>数据连续性门禁</h2></div><b data-pass={!hasSamplingGap}>{hasSamplingGap ? "未通过" : inspectionSubmitted ? "已提交" : "可继续"}</b></header>
          <ol className={styles.gates}>
            <li data-state={hasSamplingGap ? "failed" : "passed"}>
              <i>1</i><div><strong>窗口与样本</strong><span>最大间隔 {activeWindow.gap.seconds} 秒</span></div><b>{hasSamplingGap ? "未通过" : "已通过"}</b>
            </li>
            <li data-state={retrievalComplete ? "passed" : "waiting"}>
              <i>2</i><div><strong>资料来源</strong><span>公开字段说明 + 课程检查规则</span></div><b>{retrievalComplete ? "已通过" : "待核对"}</b>
            </li>
            <li data-state={hasSamplingGap ? "waiting" : inspectionSubmitted || inspectionReady ? "passed" : "waiting"}>
              <i>3</i><div><strong>人工复核</strong><span>{hasSamplingGap ? "先补设备记录" : inspectionSubmitted ? "现场检查申请已留痕" : retrievalComplete ? "由检修主管复核" : "等待资料核对"}</span></div><b>{inspectionSubmitted ? "已提交" : inspectionReady ? "可提交" : "等待中"}</b>
            </li>
          </ol>

          <button type="button" className={styles.documentsToggle} aria-expanded={showDocuments} onClick={() => setShowDocuments((value) => !value)}>
            <span><BookOpenCheck size={18} />本地资料 {knowledge.length}</span>{showDocuments ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          {showDocuments ? (
            <section className={styles.documents} aria-label="本地资料清单">
              {[{ title: "公开数据事实", items: publicDocuments }, { title: "课程检查规则", items: courseDocuments }].map((group) => (
                <div key={group.title}><h3>{group.title}</h3>{group.items.map((item) => {
                  const result = effectiveResults.find((candidate) => candidate.id === text(item.id));
                  const stance = result?.stance ?? (text(item.type).includes("approval") ? "constraint" : "support");
                  const selected = stance === "support" ? supportCitationIds.includes(text(item.id)) : challengeCitationIds.includes(text(item.id));
                  return <label key={text(item.id)}><input type="checkbox" checked={selected} onChange={() => toggleCitation(text(item.id), stance)} /><span><strong>{text(item.title)}</strong><small>{text(item.boundary)}</small></span></label>;
                })}</div>
              ))}
            </section>
          ) : null}

          <section className={styles.localReview}>
            <label>资料核对问题<textarea aria-label="资料核对问题" value={question} onChange={(event) => setQuestion(event.target.value)} rows={2} /></label>
          </section>

          <section className={styles.application} aria-label="现场检查申请">
            <header><FileSearch size={18} /><h3>现场检查申请</h3><span>{hasSamplingGap ? "已锁定" : inspectionSubmitted ? "已提交" : retrievalComplete ? "待人工复核" : "待资料核对"}</span></header>
            <label>检查范围<select aria-label="检查范围" disabled={hasSamplingGap || !retrievalComplete || inspectionSubmitted} defaultValue="visual"><option value="visual">现场目视检查</option></select></label>
            <label>申请说明<textarea aria-label="申请说明" value={note} disabled={inspectionSubmitted} onChange={(event) => setNote(event.target.value)} placeholder={hasSamplingGap ? "写明需要补充的记录" : "记录现场核对范围"} /></label>
            <label>复核人<select aria-label="复核人" disabled={hasSamplingGap || !retrievalComplete || props.actorRole !== "supervisor" || inspectionSubmitted} defaultValue={inspectionSubmitted ? "supervisor" : props.actorRole}><option value={inspectionSubmitted ? "supervisor" : props.actorRole}>{inspectionSubmitted ? "检修主管" : roleLabel(props.actorRole)}</option></select></label>
            {!hasSamplingGap && retrievalComplete ? <div className={styles.checklist}>{checklistItems.map((item) => <label key={item}><input type="checkbox" checked={checked.includes(item)} disabled={inspectionSubmitted} onChange={() => toggleChecked(item)} /><i><Check size={13} /></i><span>{item}</span></label>)}</div> : null}
            <p className={hasSamplingGap ? styles.lockReason : styles.readyReason}>{hasSamplingGap ? "状态变化过程缺失，申请暂不可提交。" : inspectionSubmitted ? "检修主管已完成三项核对，申请已记录，等待现场执行。" : retrievalComplete ? "数据连续，完成三项人工核对后可以提交。" : "先由值班工程师核对本地资料。"}</p>
          </section>
          {props.receipt ? <p className={styles.receipt} role="status">已记录：{props.receipt.event.fromState} → {props.receipt.event.toState}</p> : null}
          {props.error ? <p className={styles.error} role="alert">{props.error}<button type="button" onClick={() => props.onSelect(props.selected.objectId)}>刷新当前记录</button></p> : null}
        </aside>
      </section>

      <footer className={styles.actionBar}>
        <div><ShieldCheck size={22} /><span>只申请现场目视检查，不诊断、不停机、不控制设备</span></div>
        <section>
          {actions.map((command) => {
            const ready = commandReady(command.id);
            return <button type="button" key={command.id} data-command={command.id} disabled={props.busy || !ready} title={ready ? command.label : commandHint(command.id)} onClick={() => runCommand(command.id)}>{command.id === "run_retrieval" ? <Search size={20} /> : command.id === "create_inspection_order" ? <FileSearch size={20} /> : <Wrench size={20} />}{props.busy ? "正在记录…" : command.label}</button>;
          })}
          {hasSamplingGap && !hasInspectionCommand ? <button type="button" data-command="create_inspection_order" disabled><FileSearch size={20} />提交现场检查申请</button> : null}
        </section>
      </footer>
    </main>
  );
}
