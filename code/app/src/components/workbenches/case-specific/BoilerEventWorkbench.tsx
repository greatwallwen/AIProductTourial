"use client";

import {
  Check,
  ChevronRight,
  Clock3,
  Database,
  Focus,
  Gauge,
  Layers3,
  Link2,
  MapPin,
  Minus,
  Plus,
  RefreshCw,
  Route,
  ShieldAlert,
  Thermometer,
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

const segments: Array<{
  id: SegmentId;
  title: string;
  detail: string;
  ariaLabel: string;
  confidence: number;
  tone: "red" | "orange" | "yellow";
}> = [
  {
    id: "outlet-temperature-chain",
    title: "出口测温链路漂移",
    ariaLabel: "出口测温链路",
    detail: "先核对测点、采集与分钟聚合，排除读数偏差。",
    confidence: 68,
    tone: "red",
  },
  {
    id: "desuperheater-section",
    title: "减温水阀门响应滞后",
    ariaLabel: "减温水调节段",
    detail: "补齐阀位与流量，检查温度变化是否滞后。",
    confidence: 46,
    tone: "orange",
  },
  {
    id: "final-superheater-section",
    title: "末级过热器换热异常",
    ariaLabel: "末级过热器出口段",
    detail: "补取分段温度，再判断是否需要现场排查。",
    confidence: 32,
    tone: "yellow",
  },
];

const requestedSources = [
  { id: "desuperheater-valve", title: "减温水阀位", source: "阀位记录" },
  { id: "desuperheater-flow", title: "减温水流量", source: "流量计记录" },
  { id: "section-temperatures", title: "分段温度", source: "过热器测点" },
];

const defaultReason = "主蒸汽温度持续偏离，先核对出口测温链路并补齐减温水阀位。";
const defaultRequests = requestedSources.map((item) => item.id);

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
  const yFor = (value: number) => 184 - ((value - lower) / span) * 146;
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
  const eventId = text(row.event_id, props.selected.objectId.replace(/^B018-/u, ""));
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
  const [segmentId, setSegmentId] = useState<SegmentId>(persisted?.segmentId ?? "outlet-temperature-chain");
  const [assignee, setAssignee] = useState(persisted?.assignee ?? "当班运行工程师");
  const [reason, setReason] = useState(persisted?.investigationReason ?? defaultReason);
  const [supervisorNote, setSupervisorNote] = useState("核对任务与证据完整，同意下发人工检查。");
  const [requested, setRequested] = useState<string[]>(persisted?.requestedSourceIds ?? defaultRequests);
  const [zoom, setZoom] = useState(1);
  const [locked, setLocked] = useState(false);
  const [layers, setLayers] = useState({ thermal: true, sensors: true, evidence: true, labels: true });

  useEffect(() => {
    setSegmentId(persisted?.segmentId ?? "outlet-temperature-chain");
    setAssignee(persisted?.assignee ?? "当班运行工程师");
    setReason(persisted?.investigationReason ?? defaultReason);
    setSupervisorNote("核对任务与证据完整，同意下发人工检查。");
    setRequested(persisted?.requestedSourceIds ?? defaultRequests);
  }, [persisted, props.selected.objectId]);

  const geometry = chartGeometry(rows);
  const eventStart = text(row.start_time);
  const eventEnd = text(row.end_time);
  const windowStart = text(row.window_start_minute, text(rows[0]?.monitor_minute));
  const windowEnd = text(row.window_end_minute, text(rows.at(-1)?.monitor_minute));
  const observed = numeric(row.minimum_temperature) || numeric(row.steam_temperature_mean);
  const taskObserved = numeric(row.steam_temperature_mean) || observed;
  const target = 530;
  const deviation = observed - target;
  const attachedEvidenceIds = ["minute-temperature", "sample-integrity"];
  const workflowRank = props.selected.state === "检查已下发" || props.selected.state === "自动调节已阻断"
    ? 4
    : props.selected.state === "当班排查中"
      ? 3
      : 2;

  function toggleLayer(key: keyof typeof layers) {
    setLayers((current) => ({ ...current, [key]: !current[key] }));
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
      windowRowCount: rows.length,
      monitorMinute: text(row.monitor_minute),
      observedTemperatureC: taskObserved,
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
      data: { segmentId: task.segmentId, investigationReason: commandReason, supervisorId: actorId },
      evidenceIds: [eventEvidence, windowEvidence],
    });
  }

  function reset() {
    setSegmentId("outlet-temperature-chain");
    setAssignee("当班运行工程师");
    setReason(defaultReason);
    setSupervisorNote("核对任务与证据完整，同意下发人工检查。");
    setRequested(defaultRequests);
    setZoom(1);
    setLocked(false);
    props.onReset();
  }

  const primaryCommand = props.commands.find((command) => command.id !== "hold_control_change") ?? props.commands[0];
  const commandReady = props.actorRole === "supervisor"
    ? supervisorNote.trim().length >= 8 && (primaryCommand?.id === "hold_control_change" || Boolean(persisted))
    : reason.trim().length >= 8 && assignee.trim().length >= 2 && requested.length > 0;

  return (
    <main className={styles.root} aria-label="主汽低温事件核查台">
      <header className={styles.topbar} data-tour="b18-context">
        <div className={styles.plantState}>
          <h1>BT-0044 · 主汽低温事件 · 数据回放</h1>
          <i />
          <b>演示数据</b>
          <span>事件持续：{durationLabel(row.duration_seconds)}</span>
          <em>数据质量：{text(row.data_quality_state, "完整")}</em>
        </div>
        <div className={styles.topActions}>
          <label>角色
            <select aria-label="当前操作角色" value={props.actorRole} onChange={(event) => props.onActorRoleChange(event.target.value)}>
              {props.roles.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}
            </select>
          </label>
          <time><Clock3 size={14} />{eventEnd}</time>
          <button type="button" aria-label="恢复案例 B018" onClick={reset} disabled={props.busy}><RefreshCw size={16} /></button>
        </div>
      </header>

      <section className={styles.workspace}>
        <section className={styles.leftStage}>
          <section className={styles.scene} aria-label="锅炉设备与证据路径" data-tour="b18-scene">
            <img
              src="/case-assets/case-B018/boiler-plant-scene.png"
              alt="锅炉及主蒸汽管道场景"
              style={{ "--scene-zoom": zoom } as CSSProperties}
              suppressHydrationWarning
            />
            <div className={styles.sceneVignette} />
            {layers.thermal ? <div className={styles.thermalField} aria-hidden="true" /> : null}

            <aside className={styles.layerPanel} aria-label="场景图层">
              <strong>图层</strong>
              {[
                ["thermal", <Thermometer key="icon" size={14} />, "温度场"],
                ["sensors", <Gauge key="icon" size={14} />, "测点"],
                ["labels", <MapPin key="icon" size={14} />, "设备标签"],
                ["evidence", <Link2 key="icon" size={14} />, "证据路径"],
              ].map(([key, icon, label]) => <button key={String(key)} type="button" aria-pressed={layers[key as keyof typeof layers]} onClick={() => toggleLayer(key as keyof typeof layers)}>{icon}<span>{label}</span><i /></button>)}
            </aside>

            <div className={styles.zoomControls}>
              <button type="button" aria-label="放大场景" onClick={() => setZoom((value) => Math.min(1.16, value + 0.04))}><Plus size={18} /></button>
              <button type="button" aria-label="缩小场景" onClick={() => setZoom((value) => Math.max(1, value - 0.04))}><Minus size={18} /></button>
              <button type="button" aria-label="恢复场景缩放" onClick={() => setZoom(1)}><Focus size={17} /></button>
            </div>

            {layers.labels ? <div className={styles.equipmentLabels} aria-hidden="true">
              <span data-label="furnace">炉膛出口<br /><b>约 1120°C</b></span>
              <span data-label="heater-a">过热器一级</span>
              <span data-label="heater-b">过热器二级</span>
              <span data-label="header">主蒸汽母管</span>
            </div> : null}

            {layers.sensors ? <div className={styles.sensorLabels}>
              <span data-sensor="a-in">A侧入口<strong>{(observed + 4.2).toFixed(1)}°C</strong></span>
              <span data-sensor="a-out">A侧出口<strong>{(observed + 2.1).toFixed(1)}°C</strong></span>
              <span data-sensor="b-in">B侧入口<strong>{(observed + 3.5).toFixed(1)}°C</strong></span>
              <span data-sensor="b-out">B侧出口<strong>{(observed + 1.4).toFixed(1)}°C</strong></span>
              <span data-sensor="main" data-alert="true">主蒸汽出口（选中）<strong>{observed.toFixed(1)}°C</strong></span>
            </div> : null}

            {layers.evidence ? <svg className={styles.evidencePaths} viewBox="0 0 1000 620" preserveAspectRatio="none" aria-label="设备证据路径">
              <path className={styles.supportPath} d="M285 390 C330 315 375 270 435 235" />
              <path className={styles.pendingPath} d="M435 235 C555 210 615 215 700 258" />
              <path className={styles.counterPath} d="M700 258 C780 300 810 330 865 352" />
              <circle cx="285" cy="390" r="7" /><circle cx="435" cy="235" r="7" /><circle cx="700" cy="258" r="7" /><circle cx="865" cy="352" r="8" />
            </svg> : null}

            <div className={styles.sourceCards}>
              <article><span>减温水调节阀</span><b>待补阀位</b><small>当前请求：{requested.includes("desuperheater-valve") ? "已勾选" : "未勾选"}</small></article>
              <article><span>减温水流量计</span><b>待补流量</b><small>当前请求：{requested.includes("desuperheater-flow") ? "已勾选" : "未勾选"}</small></article>
            </div>

            <div className={styles.pathLegend}><strong>证据路径</strong><span><i data-tone="support" />支持证据</span><span><i data-tone="counter" />反证</span><span><i data-tone="pending" />待核对</span></div>
          </section>

          <section className={styles.timeline} aria-label="事件时间线" data-tour="b18-trend">
            <header><strong>事件时间线</strong><span>{rows.length} 个连续分钟点 · 真实温度序列与资料缺口联动</span></header>
            <div className={styles.timelineBody}>
              <aside>
                <span data-tone="red"><i />主蒸汽温度 <b>°C</b></span>
                <span data-tone="green"><i />减温水流量 <b>未接入</b></span>
                <span data-tone="blue"><i />机组负荷 <b>未接入</b></span>
                <span data-tone="yellow"><i />减温水阀位 <b>未接入</b></span>
              </aside>
              <div className={styles.chart}>
                <svg viewBox="0 0 1000 205" preserveAspectRatio="none" role="img" aria-label="BT-0044 事件 25 分钟主蒸汽出口温度曲线">
                  <defs><linearGradient id="boiler-temperature-area-v2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff4d48" stopOpacity=".28" /><stop offset="1" stopColor="#ff4d48" stopOpacity="0" /></linearGradient></defs>
                  <g className={styles.grid}>{[28, 77, 126, 175].map((y) => <line key={y} x1="0" x2="1000" y1={y} y2={y} />)}</g>
                  <line className={styles.threshold} x1="0" x2="1000" y1={geometry.thresholdY} y2={geometry.thresholdY} />
                  <polygon className={styles.area} points={`0,188 ${geometry.points} 1000,188`} />
                  <polyline className={styles.temperatureLine} points={geometry.points} />
                  <line className={styles.minimumMarker} x1={geometry.minimumX} x2={geometry.minimumX} y1="12" y2="188" />
                  <circle className={styles.minimumDot} cx={geometry.minimumX} cy={geometry.minimumY} r="6" />
                  <line className={styles.unavailableLine} x1="0" x2="1000" y1="105" y2="105" />
                  <line className={styles.unavailableLine} x1="0" x2="1000" y1="142" y2="142" />
                  <line className={styles.unavailableLine} x1="0" x2="1000" y1="169" y2="169" />
                </svg>
                <div className={styles.eventMarkers}><span style={{ left: "14%" }}>E1<small>事件开始</small></span><span style={{ left: "52%" }}>E2<small>最低温度</small></span><span style={{ left: "82%" }}>E3<small>恢复采样</small></span></div>
                <div className={styles.timeLabels}><span>{shortTime(eventStart)}</span><span>{shortTime(rows[Math.floor(rows.length / 2)]?.monitor_minute)}</span><span>{shortTime(eventEnd)}</span></div>
              </div>
            </div>
          </section>
        </section>

        <aside className={styles.investigation} aria-label="异常研判" data-tour="b18-investigation b18-dispatch b18-supervisor-action">
          <header><strong>异常研判</strong><span>{props.selected.state}</span></header>
          <ol className={styles.steps}>{[
            ["发现偏差", `主蒸汽温度低于来源区间 ${Math.abs(deviation).toFixed(1)}°C`],
            ["核验证据", "追溯分钟序列，确认事件来源"],
            ["形成假设", "基于已知证据选择检查段"],
            ["人工确认", "进入人工排查并记录结论"],
          ].map(([title, detail], index) => <li key={title} data-active={workflowRank === index + 1} data-complete={workflowRank > index + 1}><i>{workflowRank > index + 1 ? <Check size={13} /> : index + 1}</i><div><strong>{title}</strong><span>{detail}</span></div></li>)}</ol>

          <section className={styles.evidenceCard} data-tour="b18-evidence">
            <header><span>实测值<strong>{observed.toFixed(1)}°C</strong></span><span>参考下界<strong>{target.toFixed(1)}°C</strong></span></header>
            <div><span>偏差<strong>{deviation > 0 ? "+" : ""}{deviation.toFixed(1)}°C</strong></span><span>持续<strong>{durationLabel(row.duration_seconds)}</strong></span></div>
            <small>530–545°C 是来源区间，不是厂方控制限。</small>
          </section>

          <section className={styles.hypotheses} data-tour="b18-segment">
            <header><strong>候选原因</strong><span>不是最终结论</span></header>
            {segments.map((segment, index) => <label key={segment.id} data-selected={segmentId === segment.id} data-tone={segment.tone}>
              <input type="radio" name="boiler-segment" aria-label={segment.ariaLabel} checked={segmentId === segment.id} onChange={() => setSegmentId(segment.id)} disabled={Boolean(persisted) && props.actorRole === "supervisor"} />
              <i>{index + 1}</i><span><b>{segment.title}</b><small>{segment.detail}</small></span><em>置信度 <strong>{segment.confidence}%</strong></em>
            </label>)}
          </section>

          <section className={styles.dispatchForm}>
            {props.actorRole === "supervisor" ? <label>主管意见<textarea aria-label="主管核查意见" value={supervisorNote} onChange={(event) => setSupervisorNote(event.target.value)} /></label> : <>
              <label>负责人<input aria-label="检查负责人" value={assignee} onChange={(event) => setAssignee(event.target.value)} /></label>
              <label>排查说明<textarea aria-label="当班排查说明" value={reason} onChange={(event) => setReason(event.target.value)} /></label>
              <div className={styles.requestChips}>{requestedSources.map((source) => <label key={source.id} data-selected={requested.includes(source.id)}><input type="checkbox" aria-label={source.title} checked={requested.includes(source.id)} onChange={() => setRequested((current) => current.includes(source.id) ? current.filter((id) => id !== source.id) : [...current, source.id])} /><Check size={11} />{source.title}</label>)}</div>
            </>}
          </section>

          {props.receipt ? <p role="status" className={styles.receipt}><Check size={14} />已保存：{props.receipt.event.fromState} → {props.receipt.event.toState}</p> : null}
          {props.error ? <p role="alert" className={styles.error}>{props.error}</p> : null}
        </aside>
      </section>

      <footer className={styles.footer}>
        <a href="/" className={styles.backLink}>全部案例</a>
        <button type="button" className={styles.lockButton} aria-pressed={locked} onClick={() => setLocked((value) => !value)}><Layers3 size={16} />{locked ? "已锁定当前视角" : "锁定当前视角"}</button>
        {primaryCommand ? <button type="button" className={styles.primaryAction} disabled={props.busy || !commandReady || (primaryCommand.id === "confirm_segment" && !persisted)} onClick={() => runCommand(primaryCommand.id)}>{primaryCommand.id === "confirm_segment" ? <ShieldAlert size={17} /> : <Route size={17} />}{props.busy ? "正在保存…" : primaryCommand.label}<ChevronRight size={18} /></button> : <span className={styles.done}>当前事件没有待执行动作</span>}
      </footer>
    </main>
  );
}
