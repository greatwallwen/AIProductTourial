"use client";

import {
  AlertTriangle,
  Check,
  ChevronRight,
  Clock3,
  RefreshCw,
  ShieldAlert,
  UserRound,
  Wind,
} from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import styles from "./FlotationReviewWorkbench.module.css";
import type { CaseWorkbenchProps } from "./types";

type HypothesisKey = "air_balance" | "reagent" | "pulp" | "instrument";
type ReviewDraft = {
  taskId: string;
  eventId?: string;
  hours: string;
  note: string;
  hypothesis: HypothesisKey;
  assignee: string;
  dueAt: string;
  windowStart: string;
  windowEnd: string;
  rowCount: number;
  evidenceItems: string[];
  selectedChecks?: string[];
  priorityCellIds?: string[];
  createdBy: string;
};
type EventRow = Record<string, unknown> & {
  event_id?: string;
  start_hour?: string;
  end_hour?: string;
  duration_hours?: string | number;
  dominant_deviation?: string;
};

const hypothesisLabels: Record<HypothesisKey, string> = {
  air_balance: "逐列核对风量与液位",
  reagent: "核对药剂投加记录",
  pulp: "核对矿浆来料条件",
  instrument: "核对测点与仪表状态",
};
const emptyEvents: EventRow[] = [];

function text(value: unknown, fallback = "—"): string {
  const result = String(value ?? "").trim();
  return result || fallback;
}
function numeric(value: unknown): number {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}
function format(value: unknown, digits = 2): string {
  return numeric(value).toLocaleString("zh-CN", { maximumFractionDigits: digits });
}
function shortHour(value: unknown): string {
  return text(value).slice(5, 16);
}
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
function parseReviewData(value: unknown): ReviewDraft | undefined {
  const source = record(value);
  const task = record(source.processReview ?? source);
  if (typeof task.taskId !== "string" || typeof task.hypothesis !== "string") return undefined;
  return {
    taskId: text(task.taskId),
    eventId: typeof task.eventId === "string" ? task.eventId : undefined,
    hours: text(task.hours),
    note: text(task.note, ""),
    hypothesis: task.hypothesis as HypothesisKey,
    assignee: text(task.assignee, ""),
    dueAt: text(task.dueAt, ""),
    windowStart: text(task.windowStart),
    windowEnd: text(task.windowEnd),
    rowCount: numeric(task.rowCount),
    evidenceItems: stringArray(task.evidenceItems),
    selectedChecks: stringArray(task.selectedChecks),
    priorityCellIds: stringArray(task.priorityCellIds),
    createdBy: text(task.createdBy),
  };
}
function parseReview(reason: unknown): Partial<ReviewDraft> | undefined {
  const source = text(reason, "");
  if (!source.startsWith("flotation-review:")) return undefined;
  try {
    return JSON.parse(source.slice("flotation-review:".length)) as Partial<ReviewDraft>;
  } catch {
    return undefined;
  }
}
function chartPoints(rows: Record<string, unknown>[], field: string, band: number): string {
  if (!rows.length) return "0,0";
  const values = rows.map((item) => numeric(item[field]));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return values.map((value, index) => {
    const x = (index / Math.max(1, values.length - 1)) * 1000;
    const y = band + 58 - ((value - min) / span) * 46;
    return `${x},${y}`;
  }).join(" ");
}
function roleLabel(role: string): string {
  return role === "process_engineer" ? "工艺工程师" : role === "supervisor" ? "生产主管" : role;
}
function priorityCellIds(event: EventRow): number[] {
  const source = text(event.dominant_deviation, "");
  const ids = source.split("|").map((item) => Number(item.match(/(\d+)号/u)?.[1])).filter(Number.isFinite);
  return ids.length ? ids.slice(0, 3) : [3, 1, 2];
}

export function FlotationReviewWorkbench(props: CaseWorkbenchProps) {
  const row = props.selected.payload;
  const rows = useMemo(
    () => (props.sceneRows.length ? props.sceneRows : [row])
      .slice()
      .sort((left, right) => text(left.monitor_hour).localeCompare(text(right.monitor_hour))),
    [props.sceneRows, row],
  );
  const sourceEvents = (props.supportingArtifacts["events.csv"] ?? emptyEvents) as EventRow[];
  const selectedEventId = text(row.event_id, props.selected.objectId.replace(/^14-/u, ""));
  const currentEvent = useMemo(() => sourceEvents.find((item) => text(item.event_id) === selectedEventId) ?? ({
    event_id: selectedEventId,
    start_hour: text(row.start_hour ?? rows[Math.max(0, rows.length - 39)]?.monitor_hour),
    end_hour: text(row.end_hour ?? row.monitor_hour),
    duration_hours: text(row.duration_hours ?? row.consecutive_high_hours ?? 39),
    dominant_deviation: "3号浮选柱风量|1号浮选柱风量|2号浮选柱风量",
  } satisfies EventRow), [selectedEventId, row.consecutive_high_hours, row.monitor_hour, rows, sourceEvents]);
  const eventId = text(currentEvent.event_id, selectedEventId);
  const priorityIds = useMemo(() => priorityCellIds(currentEvent), [currentEvent]);
  const eventQueue = useMemo(() => {
    return sourceEvents
      .slice()
      .sort((left, right) => text(right.end_hour).localeCompare(text(left.end_hour)));
  }, [sourceEvents]);
  const persisted = useMemo(() => {
    const fromProjection = parseReviewData(props.selected.task);
    if (fromProjection) return fromProjection;
    const latest = [...props.events].reverse().find((event) => event.objectId === props.selected.objectId);
    return parseReviewData(latest?.data) ?? parseReview(latest?.reason);
  }, [props.events, props.selected.objectId, props.selected.task]);
  const persistedTask = useMemo(() => parseReviewData(props.selected.task), [props.selected.task]);
  const [windowHours, setWindowHours] = useState(persisted?.hours ?? "72");
  const [hypothesis, setHypothesis] = useState<HypothesisKey>(persisted?.hypothesis ?? "air_balance");
  const [assignee, setAssignee] = useState(persisted?.assignee ?? "当班工艺工程师");
  const [dueAt, setDueAt] = useState(persisted?.dueAt ?? "2026-07-30");
  const [note, setNote] = useState(persisted?.note ?? "");
  const [supervisorNote, setSupervisorNote] = useState("");
  const [selectedChecks, setSelectedChecks] = useState<string[]>(persisted?.selectedChecks?.length ? persisted.selectedChecks : priorityIds.map(String));

  useEffect(() => {
    setWindowHours(persisted?.hours ?? "72");
    setHypothesis(persisted?.hypothesis ?? "air_balance");
    setAssignee(persisted?.assignee ?? "当班工艺工程师");
    setDueAt(persisted?.dueAt ?? "2026-07-30");
    setNote(persisted?.note ?? "");
    setSupervisorNote("");
    setSelectedChecks(persisted?.selectedChecks?.length ? persisted.selectedChecks : priorityIds.map(String));
  }, [persisted, priorityIds, props.selected.objectId]);

  const effectiveHours = props.actorRole === "supervisor" && persistedTask ? persistedTask.hours : windowHours;
  const eventStartHour = text(currentEvent.start_hour);
  const eventEndHour = text(currentEvent.end_hour);
  const windowRows = useMemo(() => {
    const hours = Number(effectiveHours) || 72;
    // 以 end_hour 为终点截取 hours 小时窗口（匹配原始 sceneRowsFor 设计）。
    // sceneRows 现在包含全部 720 行，需按事件时间窗口截取。
    if (eventEndHour && eventEndHour !== "—") {
      const afterEndIdx = rows.findIndex((item) => text(item.monitor_hour) > eventEndHour);
      const endIdx = afterEndIdx === -1 ? rows.length - 1 : afterEndIdx - 1;
      if (endIdx >= 0) {
        const start = Math.max(0, endIdx - hours + 1);
        return rows.slice(start, endIdx + 1);
      }
    }
    // 回退：按 start/end 区间过滤
    if (eventStartHour && eventStartHour !== "—" && eventEndHour && eventEndHour !== "—") {
      const startIdx = rows.findIndex((item) => text(item.monitor_hour) >= eventStartHour);
      const endIdx = rows.findIndex((item) => text(item.monitor_hour) > eventEndHour);
      const end = endIdx === -1 ? rows.length : endIdx;
      const start = startIdx === -1 ? Math.max(0, rows.length - hours) : startIdx;
      return rows.slice(start, end);
    }
    return rows.slice(-Math.min(hours, rows.length));
  }, [rows, eventStartHour, eventEndHour, effectiveHours]);
  const columns = Array.from({ length: 7 }, (_, index) => ({
    id: index + 1,
    air: numeric(row[`column_${index + 1}_air_mean`]),
    level: numeric(row[`column_${index + 1}_level_mean`]),
  }));
  const workflowRank = props.selected.state === "核查已下发" || props.selected.state === "调参已阻断"
    ? 4
    : props.selected.state === "工艺复核中"
      ? 3
      : 1;

  function toggleCheck(id: string) {
    setSelectedChecks((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function runCommand(command: string) {
    const actorId = props.actorRole === "supervisor" ? "case14-production-supervisor" : "case14-process-engineer";
    const commandNote = props.actorRole === "supervisor" ? supervisorNote.trim() : note.trim();
    const processReview: ReviewDraft = persistedTask ?? {
      taskId: `FLOT-${eventId}`,
      eventId,
      hours: windowHours,
      note: note.trim() || supervisorNote.trim(),
      hypothesis,
      assignee: assignee.trim(),
      dueAt,
      windowStart: text(windowRows[0]?.monitor_hour),
      windowEnd: text(windowRows.at(-1)?.monitor_hour),
      rowCount: windowRows.length,
      evidenceItems: [
        `event:${eventId}`,
        `trend:${text(windowRows[0]?.monitor_hour)}:${text(windowRows.at(-1)?.monitor_hour)}`,
        ...selectedChecks.map((id) => `cell-air:${id}`),
        `quality:${text(windowRows.at(-1)?.monitor_hour)}`,
      ],
      selectedChecks,
      priorityCellIds: selectedChecks,
      createdBy: actorId,
    };
    props.onCommand(command, commandNote, {
      actorId,
      data: {
        processReview,
        ...(props.actorRole === "supervisor" ? {
          supervisorDecision: { taskId: processReview.taskId, supervisorId: actorId, note: commandNote },
        } : {}),
      },
      evidenceIds: processReview.evidenceItems,
    });
  }

  function reset() {
    setWindowHours("72");
    setHypothesis("air_balance");
    setAssignee("当班工艺工程师");
    setDueAt("2026-07-30");
    setNote("");
    setSupervisorNote("");
    setSelectedChecks(priorityIds.map(String));
    props.onReset();
  }

  return (
    <main className={styles.root} aria-label="连续高硅事件调查台">
      <header className={styles.header}>
        <div className={styles.brand}>
          <AlertTriangle aria-hidden="true" size={22} />
          <strong>连续高硅事件调查台</strong>
          <span>高硅质事件</span>
          <b>{eventId}</b>
        </div>
        <div className={styles.eventMeta}>
          <span>{shortHour(currentEvent.start_hour)} 至 {shortHour(currentEvent.end_hour)}</span>
          <b>持续 {text(currentEvent.duration_hours, "39")} 小时</b>
          <em>数据完整</em>
        </div>
        <div className={styles.roleSwitch}>
          <UserRound size={16} />
          <label>当前角色<select aria-label="当前操作角色" value={props.actorRole} onChange={(event) => props.onActorRoleChange(event.target.value)}>{props.roles.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}</select></label>
          <button type="button" aria-label="恢复案例 B14" onClick={reset} disabled={props.busy}><RefreshCw size={16} /></button>
        </div>
      </header>

      <section className={styles.layout}>
        <aside className={styles.events} aria-label="连续事件">
          <header><div><span>连续事件</span><b>{sourceEvents.length || 59}</b></div><small>公开测量经课程规则派生</small></header>
          <div className={styles.eventList}>
            {eventQueue.map((item, index) => {
              const active = text(item.event_id) === eventId;
              const targetObjectId = `14-${text(item.event_id)}`;
              return <article key={text(item.event_id, String(index))} data-active={active} role="button" tabIndex={0}
                onClick={() => props.onSelect(targetObjectId)}
                onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); props.onSelect(targetObjectId); } }}>
                <div><i /><strong>{text(item.event_id)}</strong><span>{text(item.duration_hours)} 小时</span></div>
                <p>{shortHour(item.start_hour)} 至 {shortHour(item.end_hour)}</p>
                <small>{active ? "当前调查事件" : "较早事件"}</small>
                <ChevronRight size={15} />
              </article>;
            })}
          </div>
          <section className={styles.sourceNote}>
            <strong>数据说明</strong>
            <p>720 条小时聚合记录中存在一次 319 小时间断；本事件使用的 72 小时窗口连续完整。</p>
          </section>
        </aside>

        <section className={styles.center}>
          <section className={styles.process} aria-label="七列浮选工艺示意">
            <header><div><strong>工艺示意</strong><span>测点位置只用于课堂定位</span></div><dl><div><dt>精矿硅</dt><dd>{format(row.concentrate_silica_mean)}%</dd></div><div><dt>矿浆流量</dt><dd>{format(row.pulp_flow_mean)} m³/h</dd></div><div><dt>矿浆 pH</dt><dd>{format(row.pulp_ph_mean, 3)}</dd></div></dl></header>
            <div className={styles.scene}>
              <img src="/case-assets/case-14/scene.png" alt="七列浮选工艺示意" suppressHydrationWarning />
              <svg viewBox="0 0 1000 420" preserveAspectRatio="none" aria-hidden="true"><path d="M74 328 H920" /><circle cx="74" cy="328" r="5" /></svg>
              <div className={styles.feed}><span>给矿</span><strong>{format(row.pulp_flow_mean)} m³/h</strong></div>
              {columns.map((column, index) => {
                const priority = priorityIds.includes(column.id);
                return <article key={column.id} className={styles.cell} data-priority={priority} style={{ "--cell-x": `${18 + index * 10.8}%` } as CSSProperties}>
                  {priority ? <b>优先核对</b> : null}
                  <strong>{column.id} 号槽</strong>
                  <span><Wind size={13} />{format(column.air, 1)} m³/h</span>
                  <small>液位 {format(column.level, 1)} mm</small>
                </article>;
              })}
              <div className={styles.output}><span>精矿</span><strong>硅 {format(row.concentrate_silica_mean)}%</strong></div>
            </div>
          </section>

          <section className={styles.trends} aria-label={`${effectiveHours} 小时趋势`}>
            <header><div><strong>趋势分析（{effectiveHours} 小时）</strong><span>{shortHour(windowRows[0]?.monitor_hour)} 至 {shortHour(windowRows.at(-1)?.monitor_hour)} · {windowRows.length} 个连续点</span></div><label>窗口<select aria-label="趋势时间范围" value={effectiveHours} disabled={props.actorRole === "supervisor" && Boolean(persistedTask)} onChange={(event) => setWindowHours(event.target.value)}><option value="24">24 小时</option><option value="48">48 小时</option><option value="72">72 小时</option></select></label></header>
            <div className={styles.chart}>
              <aside><span data-line="silica">精矿硅 <b>{format(row.concentrate_silica_mean)}%</b></span><span data-line="flow">矿浆流量 <b>{format(row.pulp_flow_mean)} m³/h</b></span><span data-line="ph">矿浆 pH <b>{format(row.pulp_ph_mean, 3)}</b></span></aside>
              <svg viewBox="0 0 1000 210" preserveAspectRatio="none" role="img" aria-label="精矿硅、矿浆流量与矿浆 pH 趋势"><g>{[0,70,140,210].map((y) => <line key={y} x1="0" x2="1000" y1={y} y2={y} />)}</g><polyline data-line="silica" points={chartPoints(windowRows, "concentrate_silica_mean", 0)} /><polyline data-line="flow" points={chartPoints(windowRows, "pulp_flow_mean", 70)} /><polyline data-line="ph" points={chartPoints(windowRows, "pulp_ph_mean", 140)} /></svg>
            </div>
          </section>
        </section>

        <aside className={styles.review} aria-label="调查流程">
          <header><strong>调查流程</strong><span>{props.selected.state}</span></header>
          <ol className={styles.steps}>{[
            ["发现连续事件", `${eventId} · ${text(currentEvent.duration_hours)} 小时`],
            ["核对逐列基线", "3、1、2 号槽优先，不等于根因"],
            ["形成核查单", "冻结窗口、事项、负责人和期限"],
            ["生产主管下发", "只下发人工核查或阻断自动调参"],
          ].map(([title, detail], index) => <li key={title} data-active={workflowRank === index + 1} data-complete={workflowRank > index + 1}><i>{workflowRank > index + 1 ? <Check size={14} /> : index + 1}</i><div><strong>{title}</strong><span>{detail}</span></div></li>)}</ol>

          <section className={styles.checks}>
            <header><strong>核查事项</strong><span>来自 {eventId} 事件记录</span></header>
            {priorityIds.map((id) => <label key={id}><input type="checkbox" checked={selectedChecks.includes(String(id))} disabled={props.actorRole === "supervisor"} onChange={() => toggleCheck(String(id))} /><i>{selectedChecks.includes(String(id)) ? <Check size={13} /> : null}</i><span>{id} 号槽风量与液位</span></label>)}
          </section>

          <section className={styles.form}>
            <label>核查方向<select aria-label="优先核查假设" value={hypothesis} disabled={props.actorRole === "supervisor"} onChange={(event) => setHypothesis(event.target.value as HypothesisKey)}>{Object.entries(hypothesisLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <div><label>负责人<input aria-label="核查负责人" value={assignee} disabled={props.actorRole === "supervisor"} onChange={(event) => setAssignee(event.target.value)} /></label><label>完成日期<input aria-label="核查完成日期" type="date" value={dueAt} disabled={props.actorRole === "supervisor"} onChange={(event) => setDueAt(event.target.value)} /></label></div>
            {props.actorRole === "supervisor"
              ? <label>主管意见<textarea aria-label="主管核查意见" value={supervisorNote} onChange={(event) => setSupervisorNote(event.target.value)} placeholder="记录下发或阻断理由" /></label>
              : <label>补充说明<textarea aria-label="工艺核查说明" value={note} onChange={(event) => setNote(event.target.value)} placeholder="填写需要现场补取的信息" /></label>}
          </section>

          <section className={styles.boundary}><ShieldAlert size={17} /><div><strong>禁止自动调参</strong><span>共变只决定先查什么，不直接判定根因。</span></div></section>
          {props.receipt ? <p role="status" className={styles.receipt}>已保存：{props.receipt.event.fromState} → {props.receipt.event.toState}</p> : null}
          {props.error ? <p role="alert" className={styles.error}>{props.error}<button type="button" onClick={() => props.onSelect(props.selected.objectId)}>刷新当前事件</button></p> : null}
          <section className={styles.actions}>{props.commands.length ? props.commands.map((command) => {
            const supervisorReady = supervisorNote.trim().length >= 4;
            const requiredChecksSelected = priorityIds.every((id) => selectedChecks.includes(String(id))) && selectedChecks.length === priorityIds.length;
            const engineerReady = note.trim().length >= 4 && assignee.trim() && dueAt && requiredChecksSelected && windowRows.length === Number(windowHours);
            const enabled = props.actorRole === "supervisor" ? supervisorReady : Boolean(engineerReady);
            return <button type="button" key={command.id} data-tone={command.tone} disabled={props.busy || !enabled || (command.id === "dispatch_instrument_check" && !persistedTask)} onClick={() => runCommand(command.id)}>{props.busy ? "正在保存…" : command.label}</button>;
          }) : <p>当前状态没有待执行动作。</p>}</section>
        </aside>
      </section>
    </main>
  );
}
