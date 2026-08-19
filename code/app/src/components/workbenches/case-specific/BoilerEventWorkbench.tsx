"use client";

import {
  AlertTriangle,
  Check,
  ChevronRight,
  Clock3,
  Database,
  Gauge,
  RefreshCw,
  ShieldAlert,
  Thermometer,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import styles from "./BoilerEventWorkbench.module.css";
import type { CaseWorkbenchProps } from "./types";

type SegmentId =
  | "outlet-temperature-chain"
  | "final-superheater-section"
  | "desuperheater-section";

type BoilerTask = {
  taskId: string;
  objectId: string;
  objectVersion: number;
  eventId: string;
  eventStartTime: string;
  eventEndTime: string;
  windowStartMinute: string;
  windowEndMinute: string;
  windowRowCount: number;
  monitorMinute: string;
  observedTemperatureC: number;
  segmentId: SegmentId;
  investigationReason: string;
  assignee: string;
  attachedEvidenceIds: string[];
  requestedSourceIds: string[];
  createdBy: string;
};

const segmentOptions: { id: SegmentId; title: string; detail: string }[] = [
  { id: "outlet-temperature-chain", title: "出口测温链路", detail: "先核对测点、采集与分钟聚合" },
  { id: "final-superheater-section", title: "末级过热器出口段", detail: "补取入口与出口分段温度" },
  { id: "desuperheater-section", title: "减温水调节段", detail: "补取阀位与流量变化" },
];

const requestedSources = [
  { id: "desuperheater-valve", title: "减温水阀位", source: "阀位记录" },
  { id: "desuperheater-flow", title: "减温水流量", source: "流量计记录" },
  { id: "section-temperatures", title: "分段温度", source: "过热器测点" },
];

function text(value: unknown, fallback = "—"): string {
  const result = String(value ?? "").trim();
  return result || fallback;
}

function numeric(value: unknown): number {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function parseTask(value: unknown): BoilerTask | undefined {
  const source = record(value);
  const task = record(source.boilerTask ?? source);
  if (typeof task.taskId !== "string" || typeof task.segmentId !== "string") return undefined;
  return {
    taskId: text(task.taskId),
    objectId: text(task.objectId),
    objectVersion: numeric(task.objectVersion),
    eventId: text(task.eventId),
    eventStartTime: text(task.eventStartTime),
    eventEndTime: text(task.eventEndTime),
    windowStartMinute: text(task.windowStartMinute),
    windowEndMinute: text(task.windowEndMinute),
    windowRowCount: numeric(task.windowRowCount),
    monitorMinute: text(task.monitorMinute),
    observedTemperatureC: numeric(task.observedTemperatureC),
    segmentId: task.segmentId as SegmentId,
    investigationReason: text(task.investigationReason, ""),
    assignee: text(task.assignee, ""),
    attachedEvidenceIds: stringArray(task.attachedEvidenceIds),
    requestedSourceIds: stringArray(task.requestedSourceIds),
    createdBy: text(task.createdBy),
  };
}

function roleLabel(role: string): string {
  if (role === "process_engineer") return "锅炉运行工程师";
  if (role === "supervisor") return "运行主管";
  return role;
}

function shortTime(value: unknown): string {
  return text(value).slice(11, 19);
}

function durationLabel(seconds: unknown): string {
  const value = numeric(seconds);
  return `${Math.floor(value / 60)} 分 ${String(value % 60).padStart(2, "0")} 秒`;
}

function chartGeometry(rows: Record<string, unknown>[]) {
  const values = rows.map((row) => numeric(row.steam_temperature_mean));
  const minimums = rows.map((row) => numeric(row.steam_temperature_min));
  const lower = Math.min(526, ...minimums) - 0.5;
  const upper = Math.max(531, ...values) + 0.5;
  const span = upper - lower || 1;
  const xFor = (index: number) => (index / Math.max(1, rows.length - 1)) * 1000;
  const yFor = (value: number) => 202 - ((value - lower) / span) * 174;
  const points = values.map((value, index) => `${xFor(index)},${yFor(value)}`).join(" ");
  const minimumIndex = minimums.indexOf(Math.min(...minimums));
  return {
    lower,
    upper,
    points,
    thresholdY: yFor(530),
    minimumIndex,
    minimumX: xFor(minimumIndex),
    minimumY: yFor(values[minimumIndex] ?? lower),
  };
}

export function BoilerEventWorkbench(props: CaseWorkbenchProps) {
  const row = props.selected.payload;
  const eventId = text(row.event_id, props.selected.objectId.replace(/^18-/u, ""));
  const rows = useMemo(
    () => (props.sceneRows.length ? props.sceneRows : [row])
      .slice()
      .sort((left, right) => text(left.monitor_minute).localeCompare(text(right.monitor_minute))),
    [props.sceneRows, row],
  );
  const persisted = useMemo(() => {
    const direct = parseTask(props.selected.task);
    if (direct) return direct;
    const latest = [...props.events]
      .reverse()
      .find((event) => event.objectId === props.selected.objectId);
    return parseTask(latest?.data);
  }, [props.events, props.selected.objectId, props.selected.task]);
  const queue = useMemo(() => {
    const current = props.objects.find((item) => item.objectId === props.selected.objectId);
    const others = props.objects
      .filter((item) => item.objectId !== props.selected.objectId)
      .sort((left, right) => text(right.payload.end_time).localeCompare(text(left.payload.end_time)));
    return [...(current ? [current] : []), ...others];
  }, [props.objects, props.selected.objectId]);
  const [segmentId, setSegmentId] = useState<SegmentId>(persisted?.segmentId ?? "outlet-temperature-chain");
  const [assignee, setAssignee] = useState(persisted?.assignee ?? "当班运行工程师");
  const [reason, setReason] = useState(persisted?.investigationReason ?? "");
  const [supervisorNote, setSupervisorNote] = useState("");
  const [requested, setRequested] = useState<string[]>(persisted?.requestedSourceIds ?? ["desuperheater-valve"]);

  useEffect(() => {
    setSegmentId(persisted?.segmentId ?? "outlet-temperature-chain");
    setAssignee(persisted?.assignee ?? "当班运行工程师");
    setReason(persisted?.investigationReason ?? "");
    setSupervisorNote("");
    setRequested(persisted?.requestedSourceIds ?? ["desuperheater-valve"]);
  }, [persisted, props.selected.objectId]);

  const eventStart = text(row.start_time);
  const eventEnd = text(row.end_time);
  // monitor_minute 格式为 16 字符（"YYYY-MM-DD HH:MM"），start_time/end_time 含秒（19 字符）。
  // 截取到 16 字符使字符串比较一致，否则前缀不匹配导致 findIndex 失败。
  const eventStartMinute = eventStart !== "—" ? eventStart.slice(0, 16) : "";
  const eventEndMinute = eventEnd !== "—" ? eventEnd.slice(0, 16) : "";
  const windowRows = useMemo(() => {
    if (eventStartMinute && eventEndMinute) {
      const startIdx = rows.findIndex((item) => text(item.monitor_minute) >= eventStartMinute);
      const endIdx = rows.findIndex((item) => text(item.monitor_minute) > eventEndMinute);
      const end = endIdx === -1 ? rows.length : endIdx;
      const start = startIdx === -1 ? 0 : startIdx;
      return rows.slice(start, end);
    }
    return rows.length > 25 ? rows.slice(0, 25) : rows;
  }, [rows, eventStartMinute, eventEndMinute]);
  const geometry = chartGeometry(windowRows);
  const windowStart = text(row.window_start_minute, text(windowRows[0]?.monitor_minute));
  const windowEnd = text(row.window_end_minute, text(windowRows.at(-1)?.monitor_minute));
  const observed = numeric(row.steam_temperature_mean);
  const attachedEvidenceIds = ["minute-temperature", "sample-integrity"];
  const workflowRank = props.selected.state === "检查已下发" || props.selected.state === "自动调节已阻断"
    ? 4
    : props.selected.state === "当班排查中"
      ? 3
      : 2;

  function toggleRequested(id: string) {
    if (props.actorRole === "supervisor" || persisted) return;
    setRequested((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id]);
  }

  function runCommand(command: string) {
    const supervisor = props.actorRole === "supervisor";
    const actorId = supervisor ? "case18-operation-supervisor" : "case18-boiler-engineer";
    const commandReason = supervisor ? supervisorNote.trim() : reason.trim();
    const task: BoilerTask = persisted ?? {
      taskId: `boiler-check:${props.selected.objectId}:v${props.selected.version + 1}`,
      objectId: props.selected.objectId,
      objectVersion: props.selected.version + 1,
      eventId,
      eventStartTime: eventStart,
      eventEndTime: eventEnd,
      windowStartMinute: windowStart,
      windowEndMinute: windowEnd,
      windowRowCount: windowRows.length,
      monitorMinute: text(row.monitor_minute),
      observedTemperatureC: observed,
      segmentId,
      investigationReason: commandReason,
      assignee: assignee.trim(),
      attachedEvidenceIds,
      requestedSourceIds: requested,
      createdBy: actorId,
    };
    const eventEvidence = `boiler-event:${eventId}`;
    const windowEvidence = `boiler-window:${windowStart}:${text(row.monitor_minute)}`;
    if (command === "dispatch_shift_check") {
      props.onCommand(command, commandReason, {
        actorId,
        data: task,
        evidenceIds: [eventEvidence, windowEvidence, ...attachedEvidenceIds],
      });
      return;
    }
    if (command === "confirm_segment") {
      props.onCommand(command, commandReason, {
        actorId,
        data: {
          segmentId: task.segmentId,
          prerequisiteTaskId: task.taskId,
          supervisorId: actorId,
          supervisorNote: commandReason,
        },
        evidenceIds: [eventEvidence, windowEvidence, `boiler-task:${task.taskId}`],
      });
      return;
    }
    props.onCommand(command, commandReason, {
      actorId,
      data: {
        segmentId: task.segmentId,
        investigationReason: commandReason,
        supervisorId: actorId,
      },
      evidenceIds: [eventEvidence, windowEvidence],
    });
  }

  function reset() {
    setSegmentId("outlet-temperature-chain");
    setAssignee("当班运行工程师");
    setReason("");
    setSupervisorNote("");
    setRequested(["desuperheater-valve"]);
    props.onReset();
  }

  return (
    <main className={styles.root} aria-label="主汽低温事件核查台">
      <header className={styles.header} data-tour="b18-context">
        <div className={styles.identity}>
          <AlertTriangle aria-hidden="true" size={21} />
          <strong>{eventId}</strong>
          <span>主汽低温事件</span>
        </div>
        <div className={styles.eventMeta}>
          <span><Clock3 size={15} />{eventStart} 至 {shortTime(eventEnd)}</span>
          <b>持续 {durationLabel(row.duration_seconds)}</b>
          <em>数据{ text(row.data_quality_state, "完整") }</em>
        </div>
        <div className={styles.roleSwitch} data-tour="b18-role">
          <UserRound size={16} />
          <label>当前角色
            <select aria-label="当前操作角色" value={props.actorRole} onChange={(event) => props.onActorRoleChange(event.target.value)}>
              {props.roles.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}
            </select>
          </label>
          <button type="button" aria-label="恢复案例 B18" onClick={reset} disabled={props.busy}><RefreshCw size={16} /></button>
        </div>
      </header>

      <section className={styles.layout}>
        <aside className={styles.queue} aria-label="主汽温度事件队列">
          <header><div><span>事件队列</span><b>{props.datasetRowCount.toLocaleString("zh-CN")} 分钟</b></div><small>当前事件置顶</small></header>
          <div className={styles.queueList}>
            {queue.map((item) => {
              const active = item.objectId === props.selected.objectId;
              return <article key={item.objectId} data-active={active} role="button" tabIndex={0}
                onClick={() => props.onSelect(item.objectId)}
                onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); props.onSelect(item.objectId); } }}>
                <div><strong>{text(item.payload.event_id, item.objectId)}</strong><span>{active ? "核查中" : "待复核"}</span></div>
                <p>{text(item.payload.direction, "温度偏离来源区间")}</p>
                <small>{shortTime(item.payload.start_time)} · {durationLabel(item.payload.duration_seconds)}</small>
                <ChevronRight size={15} aria-hidden="true" />
              </article>;
            })}
          </div>
          <section className={styles.boundaryNote}>
            <ShieldAlert size={17} />
            <div><strong>530–545℃ 是来源区间</strong><span>不是厂方控制限，不能直接触发自动调节。</span></div>
          </section>
        </aside>

        <section className={styles.center}>
          <section className={styles.scene} aria-label="锅炉工艺场景与资料缺口" data-tour="b18-scene">
            <header><div><strong>锅炉工艺场景</strong><span>场景用于定位检查段，不代表真实厂区几何</span></div><span>事件样本 {text(row.source_samples)} 条</span></header>
            <div className={styles.sceneCanvas}>
              <img src="/case-assets/case-18/boiler-plant-scene.png" alt="锅炉及主蒸汽管道场景" suppressHydrationWarning />
              <div className={styles.sceneShade} />
              <div className={styles.measurement}>
                <span>主蒸汽出口 · 实测</span>
                <strong>{observed.toFixed(3)}℃</strong>
                <small>第 {text(row.consecutive_deviation_minutes)} 个连续偏离分钟</small>
              </div>
              <div className={styles.path} aria-hidden="true"><i /><i /><i /><i /></div>
              <div className={styles.missingCards}>
                {requestedSources.map((source) => <article key={source.id}><span>{source.title}</span><b>未接入</b><small>{source.source}</small></article>)}
              </div>
              <div className={styles.sceneLegend}><span><i data-tone="known" />已知温度链路</span><span><i data-tone="missing" />待补资料</span></div>
            </div>
          </section>

          <section className={styles.trend} aria-label="主蒸汽出口温度趋势" data-tour="b18-trend">
            <header><div><strong>主蒸汽出口温度趋势</strong><span>{windowRows.length} 个连续分钟点 · 事件内原始采样 {text(row.source_samples)} 条</span></div><b>最低 {numeric(row.minimum_temperature).toFixed(2)}℃</b></header>
            <div className={styles.chart}>
              <aside><span>{Math.ceil(geometry.upper)}℃</span><span>530℃</span><span>{Math.floor(geometry.lower)}℃</span></aside>
              <svg viewBox="0 0 1000 230" preserveAspectRatio="none" role="img" aria-label="BT-0044 事件 25 分钟主蒸汽出口温度曲线">
                <defs><linearGradient id="boiler-temperature-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff675f" stopOpacity=".35" /><stop offset="1" stopColor="#ff675f" stopOpacity="0" /></linearGradient></defs>
                <g className={styles.grid}>{[28, 86, 144, 202].map((y) => <line key={y} x1="0" x2="1000" y1={y} y2={y} />)}</g>
                <line className={styles.threshold} x1="0" x2="1000" y1={geometry.thresholdY} y2={geometry.thresholdY} />
                <polygon className={styles.area} points={`0,210 ${geometry.points} 1000,210`} />
                <polyline className={styles.temperatureLine} points={geometry.points} />
                <line className={styles.minimumMarker} x1={geometry.minimumX} x2={geometry.minimumX} y1="18" y2="210" />
                <circle className={styles.minimumDot} cx={geometry.minimumX} cy={geometry.minimumY} r="7" />
              </svg>
              <div className={styles.chartLabels}><span>{shortTime(eventStart)}<b>事件开始</b></span><span style={{ "--marker-x": `${(geometry.minimumIndex / Math.max(1, windowRows.length - 1)) * 100}%` } as CSSProperties}>{shortTime(windowRows[geometry.minimumIndex]?.monitor_minute)}<b>分钟最低点</b></span><span>{shortTime(eventEnd)}<b>事件结束</b></span></div>
              <p><i />530℃ 虚线仅表示公开来源区间下界，不是控制设定值。</p>
            </div>
          </section>
        </section>

        <aside className={styles.workflow} aria-label="事件核查流程" data-tour="b18-investigation b18-dispatch b18-supervisor-action">
          <header data-tour="b18-result"><strong>事件核查</strong><span>{props.selected.state}</span></header>
          <ol className={styles.steps}>{[
            ["确认事件", `${eventId} · ${durationLabel(row.duration_seconds)}`],
            ["核对数据", `${windowRows.length} 个分钟点，完整性 ${text(row.data_completeness)}`],
            ["选择检查段", "一次只下发一个优先段"],
            ["主管下发", "人工检查，不自动调参"],
          ].map(([title, detail], index) => <li key={title} data-active={workflowRank === index + 1} data-complete={workflowRank > index + 1}><i>{workflowRank > index + 1 ? <Check size={13} /> : index + 1}</i><div><strong>{title}</strong><span>{detail}</span></div></li>)}</ol>

          <section className={styles.segmentPicker} data-tour="b18-segment">
            <header><strong>优先检查段</strong><span>单选</span></header>
            {segmentOptions.map((segment) => <label key={segment.id} data-selected={segmentId === segment.id}><input type="radio" name="boiler-segment" value={segment.id} checked={segmentId === segment.id} disabled={props.actorRole === "supervisor" && Boolean(persisted)} onChange={() => setSegmentId(segment.id)} /><i>{segmentId === segment.id ? <Check size={12} /> : null}</i><span><b>{segment.title}</b><small>{segment.detail}</small></span></label>)}
          </section>

          <section className={styles.evidence} data-tour="b18-evidence">
            <header><strong><Database size={15} />资料清单</strong><span>2 已有 · {requested.length} 待补</span></header>
            <div className={styles.attached}><span><Check size={12} />分钟温度序列</span><span><Check size={12} />采样完整性</span></div>
            <div className={styles.requests}>{requestedSources.map((source) => <label key={source.id} data-selected={requested.includes(source.id)}><input type="checkbox" checked={requested.includes(source.id)} disabled={props.actorRole === "supervisor" || Boolean(persisted)} onChange={() => toggleRequested(source.id)} /><i>{requested.includes(source.id) ? <Check size={11} /> : null}</i><span>{source.title}</span></label>)}</div>
          </section>

          <section className={styles.form}>
            {props.actorRole === "supervisor" ? <label>主管意见<textarea aria-label="主管核查意见" value={supervisorNote} onChange={(event) => setSupervisorNote(event.target.value)} placeholder="说明下发或阻断理由" /></label> : <><label>负责人<input aria-label="检查负责人" value={assignee} onChange={(event) => setAssignee(event.target.value)} /></label><label>排查说明<textarea aria-label="当班排查说明" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="写清为什么先查这一段" /></label></>}
          </section>

          {props.receipt ? <p role="status" className={styles.receipt}><Check size={14} />已保存：{props.receipt.event.fromState} → {props.receipt.event.toState}</p> : null}
          {props.error ? <p role="alert" className={styles.error}>{props.error}<button type="button" onClick={() => props.onSelect(props.selected.objectId)}>刷新事件</button></p> : null}
          <section className={styles.actions}>
            {props.commands.length ? props.commands.map((command) => {
              const supervisorReady = supervisorNote.trim().length >= 8;
              const engineerReady = reason.trim().length >= 8 && assignee.trim().length >= 2 && requested.length > 0 && windowRows.length === 25;
              const enabled = props.actorRole === "supervisor" ? supervisorReady : engineerReady;
              return <button type="button" key={command.id} data-tone={command.tone} disabled={props.busy || !enabled || (command.id === "confirm_segment" && !persisted)} onClick={() => runCommand(command.id)}>{command.id === "hold_control_change" ? <ShieldAlert size={16} /> : command.id === "dispatch_shift_check" ? <Gauge size={16} /> : <Thermometer size={16} />}{props.busy ? "正在保存…" : command.label}</button>;
            }) : <p>当前事件没有待执行动作。</p>}
          </section>
        </aside>
      </section>
    </main>
  );
}
