"use client";

import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CloudSun,
  Database,
  Factory,
  FileCheck2,
  Gauge,
  RefreshCw,
  ShieldCheck,
  Sun,
  ThermometerSun,
  UserRound,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import styles from "./PvLossWorkbench.module.css";
import taskStyles from "./PvLossWorkbenchTask.module.css";
import type { CaseWorkbenchProps } from "./types";

type Factor = "temperature" | "curtailment" | "equipment";
type RetrievalSourceId = "dispatch-curtailment-log" | "inverter-alert-log" | "maintenance-work-order";
type EvidenceSource = {
  sourceId: "station-day-aggregate" | RetrievalSourceId;
  label: string;
  status: "loaded" | "load_failed";
  evidenceId?: string;
  failureCode?: "source_not_in_dataset";
};
type DirectionJudgment = {
  code: Factor;
  label: string;
  status: "provisional";
  basis: {
    meanEfficiencyRatio: string;
    curtailmentSuspectedShare: string;
    temperatureDeratingShare: string;
  };
};
type PvTask = {
  taskId?: string;
  stationId?: string;
  date?: string;
  direction?: DirectionJudgment;
  evidenceSources?: EvidenceSource[];
  retrievalRequest?: {
    requestedSourceIds: RetrievalSourceId[];
    owner: string;
    dueAt: string;
    requesterId: string;
    note: string;
  };
  supervisorId?: string;
  supervisorNote?: string;
  decision?: "confirmed_for_field_investigation";
  blockReason?: string;
};

const retrievalSources = [
  ["dispatch-curtailment-log", "调度限电记录", "核对疑似时段是否存在调度指令"],
  ["inverter-alert-log", "逆变器告警", "核对告警与降载记录"],
  ["maintenance-work-order", "站端检修工单", "排除检修、停运与人工操作"],
] as const satisfies ReadonlyArray<readonly [RetrievalSourceId, string, string]>;

function displayText(value: unknown): string {
  return value == null || value === "" ? "—" : String(value);
}

function payloadText(value: unknown): string {
  return value == null ? "" : String(value);
}

function numeric(value: unknown): number | undefined {
  if (value === "" || value == null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatted(value: unknown, digits = 2, unit = ""): string {
  const parsed = numeric(value);
  if (parsed == null) return "—";
  const number = parsed.toLocaleString("zh-CN", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return `${number}${unit}`;
}

function percent(value: unknown): string {
  const parsed = numeric(value);
  return parsed == null ? "—" : `${(parsed * 100).toFixed(1)}%`;
}

function roleLabel(role: string): string {
  return role === "performance_engineer" ? "性能分析师" : role === "supervisor" ? "运维主管" : role;
}

function isFactor(value: unknown): value is Factor {
  return value === "temperature" || value === "curtailment" || value === "equipment";
}

function isRetrievalSourceId(value: unknown): value is RetrievalSourceId {
  return typeof value === "string" && retrievalSources.some(([id]) => id === value);
}

function restoreTask(props: CaseWorkbenchProps): PvTask {
  const eventData = props.events.reduce<PvTask>((current, event) => ({ ...current, ...(event.data ?? {}) }), {});
  return { ...eventData, ...(props.selected.task ?? {}) } as PvTask;
}

function validActorId(value: string): boolean {
  return value.length > 1 && value.length <= 80 && /^[\w.@-]+$/u.test(value);
}

function factorLabel(factor: Factor): string {
  return factor === "temperature" ? "温度影响" : factor === "equipment" ? "设备侧待核对" : "疑似限电";
}

function dayOrdinal(value: unknown): number | undefined {
  const parts = payloadText(value).split("-").map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part))) return undefined;
  return Date.UTC(parts[0]!, parts[1]! - 1, parts[2]!) / 86_400_000;
}

function trendSegments(rows: Record<string, unknown>[], field: string): string[] {
  const values = rows.map((item) => numeric(item[field]));
  const present = values.filter((value): value is number => value != null);
  if (!present.length) return [];
  const min = Math.min(...present);
  const max = Math.max(...present);
  const span = max - min || 1;
  const segments: string[][] = [];
  let active: string[] = [];
  values.forEach((value, index) => {
    const previousDay = index > 0 ? dayOrdinal(rows[index - 1]?.date) : undefined;
    const currentDay = dayOrdinal(rows[index]?.date);
    const calendarGap = previousDay != null && currentDay != null && currentDay - previousDay > 1;
    if (value == null || calendarGap) {
      if (active.length) segments.push(active);
      active = [];
    }
    if (value != null) {
      const x = (index / Math.max(1, values.length - 1)) * 1000;
      const y = 45 - ((value - min) / span) * 32;
      active.push(`${x},${y}`);
    }
  });
  if (active.length) segments.push(active);
  return segments.map((segment) => segment.length === 1 ? `${segment[0]} ${segment[0]}` : segment.join(" "));
}

export function PvLossWorkbench(props: CaseWorkbenchProps) {
  const row = props.selected.payload;
  const stationId = displayText(row.station_id);
  const currentDate = displayText(row.date);
  const stationFacts = props.supportingArtifacts["stations.csv"] ?? [];
  const restoredTask = useMemo(() => restoreTask(props), [props.events, props.selected.task]);
  const [factor, setFactor] = useState<Factor | null>(isFactor(restoredTask.direction?.code) ? restoredTask.direction.code : null);
  const [requestedSourceIds, setRequestedSourceIds] = useState<RetrievalSourceId[]>(restoredTask.retrievalRequest?.requestedSourceIds?.filter(isRetrievalSourceId) ?? []);
  const [owner, setOwner] = useState(restoredTask.retrievalRequest?.owner ?? "");
  const [dueAt, setDueAt] = useState(restoredTask.retrievalRequest?.dueAt ?? "");
  const [requesterId, setRequesterId] = useState(restoredTask.retrievalRequest?.requesterId ?? "");
  const [note, setNote] = useState(restoredTask.retrievalRequest?.note ?? "");
  const [supervisorId, setSupervisorId] = useState(restoredTask.supervisorId ?? "");
  const [supervisorNote, setSupervisorNote] = useState(restoredTask.supervisorNote ?? "");
  const [blockReason, setBlockReason] = useState(restoredTask.blockReason ?? "");

  const history = useMemo(() => {
    const byDate = new Map<string, Record<string, unknown>>();
    props.sceneRows
      .filter((item) => displayText(item.station_id) === stationId)
      .forEach((item) => byDate.set(displayText(item.date), item));
    return [...byDate.values()].sort((a, b) => displayText(a.date).localeCompare(displayText(b.date)));
  }, [props.sceneRows, stationId]);
  const sameDate = useMemo(() => props.sceneRows.filter((item) => displayText(item.date) === currentDate), [props.sceneRows, currentDate]);
  const availableStationIds = useMemo(() => new Set(sameDate.map((item) => displayText(item.station_id))), [sameDate]);
  const stations = stationFacts.length ? stationFacts : sameDate;
  const dates = history.map((item) => displayText(item.date));
  const dateIndex = Math.max(0, dates.indexOf(currentDate));
  const recentEnd = dates.indexOf(currentDate) >= 0 ? dates.indexOf(currentDate) + 1 : history.length;
  const recentHistory = history.slice(Math.max(0, recentEnd - 14), recentEnd);
  const currentTrendIndex = Math.max(0, recentHistory.findIndex((item) => displayText(item.date) === currentDate));
  const workflowRank = props.selected.state === "核查方向已确认" ? 4 : props.selected.state === "站端核查中" ? 3 : 2;
  const taskId = restoredTask.taskId ?? `PV-${stationId}-${currentDate.replaceAll("-", "")}-v1`;
  const direction: DirectionJudgment | undefined = factor ? {
    code: factor,
    label: factorLabel(factor),
    status: "provisional",
    basis: {
      meanEfficiencyRatio: payloadText(row.mean_efficiency_ratio),
      curtailmentSuspectedShare: payloadText(row.curtailment_suspected_share),
      temperatureDeratingShare: payloadText(row.mean_temperature_derating_pct),
    },
  } : undefined;
  const evidenceSources: EvidenceSource[] = [
    { sourceId: "station-day-aggregate", label: "公开站日汇总", status: "loaded", evidenceId: `station-day:${stationId}:${currentDate}` },
    ...retrievalSources.map(([sourceId, label]) => ({
      sourceId,
      label,
      status: "load_failed" as const,
      failureCode: "source_not_in_dataset" as const,
    })),
  ];
  const taskPersisted = Boolean(restoredTask.taskId && restoredTask.retrievalRequest);
  const taskConfirmed = props.selected.state === "核查方向已确认";
  const submissionReady = factor != null
    && requestedSourceIds.length === retrievalSources.length
    && owner.trim().length >= 2
    && dueAt.length >= 16
    && validActorId(requesterId.trim())
    && note.trim().length >= 6;
  const supervisorReady = taskPersisted
    && validActorId(supervisorId.trim())
    && supervisorNote.trim().length >= 6;
  const blockReady = validActorId((supervisorId || requesterId).trim()) && blockReason.trim().length >= 6;

  useEffect(() => {
    setFactor(isFactor(restoredTask.direction?.code) ? restoredTask.direction.code : null);
    setRequestedSourceIds(restoredTask.retrievalRequest?.requestedSourceIds?.filter(isRetrievalSourceId) ?? []);
    setOwner(restoredTask.retrievalRequest?.owner ?? "");
    setDueAt(restoredTask.retrievalRequest?.dueAt ?? "");
    setRequesterId(restoredTask.retrievalRequest?.requesterId ?? "");
    setNote(restoredTask.retrievalRequest?.note ?? "");
    setSupervisorId(restoredTask.supervisorId ?? "");
    setSupervisorNote(restoredTask.supervisorNote ?? "");
    setBlockReason(restoredTask.blockReason ?? "");
  }, [props.selected.objectId, props.selected.version, restoredTask]);

  function objectId(targetStation: string, targetDate: string): string | undefined {
    const loadedObject = props.objects.find(
      (item) => displayText(item.payload.station_id) === targetStation && displayText(item.payload.date) === targetDate,
    );
    if (loadedObject) return loadedObject.objectId;
    const existsInDataset = props.sceneRows.some(
      (item) => displayText(item.station_id) === targetStation && displayText(item.date) === targetDate,
    );
    return existsInDataset ? `20-${targetStation}-${targetDate}` : undefined;
  }

  function selectStation(targetStation: string) {
    const targetObjectId = objectId(targetStation, currentDate);
    if (targetObjectId) props.onSelect(targetObjectId);
  }

  function selectDate(targetDate: string) {
    const targetObjectId = objectId(stationId, targetDate);
    if (targetObjectId) props.onSelect(targetObjectId);
  }

  function toggleSource(value: RetrievalSourceId) {
    setRequestedSourceIds((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  function runCommand(command: string) {
    if (command === "submit_station_check") {
      if (!direction) return;
      props.onCommand(command, note.trim(), {
        actorId: requesterId.trim(),
        idempotencyKey: `pv-investigation:${props.selected.objectId}:${props.selected.version}:handoff`,
        evidenceIds: [`station-day:${stationId}:${currentDate}`, ...requestedSourceIds.map((id) => `load-failure:${id}`)],
        data: {
          taskId,
          stationId,
          date: currentDate,
          direction,
          evidenceSources,
          retrievalRequest: {
            requestedSourceIds,
            owner: owner.trim(),
            dueAt,
            requesterId: requesterId.trim(),
            note: note.trim(),
          },
        },
      });
      return;
    }
    if (command === "confirm_attribution") {
      const confirmedDirection = restoredTask.direction ?? direction;
      if (!confirmedDirection) return;
      props.onCommand(command, supervisorNote.trim(), {
        actorId: supervisorId.trim(),
        idempotencyKey: `pv-investigation:${props.selected.objectId}:${props.selected.version}:confirm`,
        evidenceIds: [`investigation-task:${taskId}`, `station-day:${stationId}:${currentDate}`],
        data: {
          taskId,
          direction: confirmedDirection,
          supervisorId: supervisorId.trim(),
          supervisorNote: supervisorNote.trim(),
          decision: "confirmed_for_field_investigation",
        },
      });
      return;
    }
    if (command === "hold_control_change") {
      const actorId = (supervisorId || requesterId).trim();
      props.onCommand(command, blockReason.trim(), {
        actorId,
        idempotencyKey: `pv-investigation:${props.selected.objectId}:${props.selected.version}:block`,
        evidenceIds: [`station-day:${stationId}:${currentDate}`, ...retrievalSources.map(([id]) => `load-failure:${id}`)],
        data: {
          taskId,
          stationId,
          date: currentDate,
          blockReason: blockReason.trim(),
          controlScope: "automatic-control",
          loadingFailures: retrievalSources.map(([id]) => id),
        },
      });
    }
  }

  function reset() {
    setFactor(null);
    setRequestedSourceIds([]);
    setOwner("");
    setDueAt("");
    setRequesterId("");
    setNote("");
    setSupervisorId("");
    setSupervisorNote("");
    setBlockReason("");
    props.onReset();
  }

  const factors = [
    { id: "temperature" as const, label: "温度影响", description: `平均气温 ${formatted(row.mean_air_temperature, 1, "℃")}`, value: percent(row.mean_temperature_derating_pct), detail: "温度降额派生线索", icon: ThermometerSun },
    { id: "curtailment" as const, label: "疑似限电", description: "需要调度记录核实", value: percent(row.curtailment_suspected_share), detail: "规则命中记录占比", icon: Zap },
    { id: "equipment" as const, label: "设备侧待核对", description: "告警与检修记录未包含", value: "待补取", detail: "没有设备异常结论", icon: Gauge },
  ];
  const facts = [
    { Icon: Factory, label: "装机容量", value: formatted(row.capacity_mw, 0, " MW"), aria: "装机容量值" },
    { Icon: FileCheck2, label: "有效记录数", value: formatted(row.source_records, 0, " 条"), aria: "有效记录数值" },
    { Icon: CloudSun, label: "平均辐照度", value: formatted(row.mean_irradiance, 2, " W/m²"), aria: "平均辐照度值" },
    { Icon: ThermometerSun, label: "平均气温", value: formatted(row.mean_air_temperature, 2, "℃"), aria: "平均气温值" },
    { Icon: Zap, label: "平均功率", value: formatted(row.mean_power_mw, 2, " MW"), aria: "平均功率值" },
    { Icon: Gauge, label: "归一化出力比", value: formatted(row.mean_efficiency_ratio, 3), aria: "归一化出力比值" },
  ];
  const trendLanes = [
    { field: "mean_irradiance", label: "辐照度", unit: "W/m²", tone: "source" },
    { field: "mean_power_mw", label: "平均功率", unit: "MW", tone: "power" },
    { field: "mean_efficiency_ratio", label: "归一化出力比", unit: "—", tone: "derived" },
  ];

  return <main className={styles.root} aria-label="光伏站端记录核查台">
    <header className={styles.header}>
      <div className={styles.brand}><span><Sun size={25} /></span><div><h1>光伏站端记录核查</h1><p>站日事实与资料补取</p></div></div>
      <div className={styles.businessState}><span>业务状态</span><strong>匿名 PV-{stationId.padStart(2, "0")}</strong><b>{currentDate}</b><em>{props.selected.state}</em></div>
      <div className={styles.headerMeta}><span><Database size={17} />5,327 个站点日</span><span><UserRound size={17} />{roleLabel(props.actorRole)}</span><button type="button" aria-label="恢复案例 B020" onClick={reset}><RefreshCw size={18} /></button></div>
    </header>

    <section className={styles.stationBar}>
      <div className={styles.stationLead}><div><strong>站点选择</strong><span>匿名 · 当日可用性</span></div><div className={styles.dateNav}><button type="button" aria-label="上一核查日期" disabled={dateIndex <= 0} onClick={() => selectDate(dates[dateIndex - 1])}><ChevronLeft size={18} /></button><label><CalendarDays size={17} /><select aria-label="核查日期" value={currentDate} onChange={(event) => selectDate(event.target.value)}>{dates.map((date) => <option key={date} value={date}>{date}</option>)}</select></label><button type="button" aria-label="下一核查日期" disabled={dateIndex >= dates.length - 1} onClick={() => selectDate(dates[dateIndex + 1])}><ChevronRight size={18} /></button></div></div>
      <aside className={styles.stationRail} aria-label="光伏电站列表">{stations.map((station) => { const id = displayText(station.station_id); const available = availableStationIds.has(id); return <button type="button" key={id} aria-pressed={id === stationId} disabled={!available} onClick={() => selectStation(id)}><strong>PV-{id.padStart(2, "0")}</strong><small>{formatted(station.capacity_mw, 0, " MW")}</small>{!available ? <em>当日无数据</em> : null}</button>; })}</aside>
    </section>

    <section className={styles.chain} aria-label="站端核查证据链">
      <article className={`${styles.panel} ${styles.facts}`} aria-label="光伏核查指标">
        <header><i>1</i><div><h2>站日事实</h2><p>公开日级汇总</p></div></header>
        <div className={styles.factList}>{facts.map(({ Icon, label, value, aria }) => <div key={label}><Icon size={19} /><span>{label}</span><strong aria-label={aria}>{value}</strong></div>)}</div>
        <p className={styles.loaded}><Check size={16} />公开站日汇总已装载</p>
      </article>

      <article className={`${styles.panel} ${styles.clues}`}>
        <header><i>2</i><div><h2>上游派生线索</h2><p>{taskConfirmed ? "核查方向已确认" : taskPersisted ? "已提交方向，等待主管确认" : "显式选择一个暂定重点"}</p></div></header>
        <div className={styles.factorList}>{factors.map((item) => <button type="button" key={item.id} aria-label={item.id === "equipment" ? "设备侧待核对" : undefined} aria-pressed={factor === item.id} data-tone={item.id} disabled={taskPersisted} onClick={() => setFactor(item.id)}><item.icon size={20} /><span><strong>{item.label}</strong><small>{item.description}</small><em>{item.detail}</em></span><b aria-label={item.id === "temperature" ? "温度降额线索值" : item.id === "curtailment" ? "疑似限电记录占比值" : undefined}>{item.value}</b></button>)}</div>
        <p className={styles.provisional}><AlertTriangle size={16} />派生，不是结论</p>
      </article>

      <article className={`${styles.panel} ${styles.gaps}`} aria-label="证据缺口">
        <header><i>3</i><div><h2>缺少记录</h2><p>勾选代表申请补取</p></div></header>
        <div className={taskStyles.sourcesGrid}>{retrievalSources.map(([id, label, detail]) => <label className={taskStyles.sourceCard} key={id}><input type="checkbox" checked={requestedSourceIds.includes(id)} disabled={taskPersisted} onChange={() => toggleSource(id)} /><span><strong>{label}</strong><small>{detail}</small><em>数据集未包含</em></span><b>{requestedSourceIds.includes(id) ? "已申请" : "申请补取"}</b></label>)}</div>
        <p className={styles.missing}><AlertTriangle size={16} />关键证据尚未取得</p>
      </article>

      <article className={`${styles.panel} ${styles.taskPanel}`}>
        <header><i>4</i><div><h2>人工核查任务</h2><p>{taskPersisted ? `任务 ${taskId}` : factor ? `暂定重点：${factorLabel(factor)}` : "先选择暂定核查重点"}</p></div></header>
        <div className={styles.taskBody}>{!taskPersisted ? <div className={taskStyles.taskFields}>
          <label>负责人<input aria-label="光伏证据补取负责人" value={owner} onChange={(event) => setOwner(event.target.value)} placeholder="输入负责团队或人员" /></label>
          <label>完成期限<input aria-label="光伏证据补取截止时间" type="text" inputMode="numeric" pattern="\d{4}-\d{2}-\d{2}T\d{2}:\d{2}" placeholder="2026-07-30T18:00" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></label>
          <label>提交人 ID<input aria-label="光伏核查提交人ID" value={requesterId} onChange={(event) => setRequesterId(event.target.value)} placeholder="输入可追溯提交人 ID" /></label>
          <label>当前角色<select aria-label="当前操作角色" value={props.actorRole} onChange={(event) => props.onActorRoleChange(event.target.value)}>{props.roles.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}</select></label>
          <label className={taskStyles.fullField}>补取说明<textarea aria-label="光伏核查说明" value={note} onChange={(event) => setNote(event.target.value)} placeholder="写明补取范围、时间窗口和核查目的" /></label>
        </div> : <>
          <section className={taskStyles.taskSummary} aria-label="已提交站端核查任务"><header><strong>{taskId}</strong><span>{taskConfirmed ? "方向已确认" : "方向待主管确认"}</span></header><dl><div><dt>核查方向</dt><dd>{restoredTask.direction?.label}{taskConfirmed ? "（已确认）" : "（暂定）"}</dd></div><div><dt>补取来源</dt><dd>{restoredTask.retrievalRequest?.requestedSourceIds.map((id) => retrievalSources.find(([sourceId]) => sourceId === id)?.[1] ?? id).join("、")}</dd></div><div><dt>负责人 / 期限</dt><dd>{restoredTask.retrievalRequest?.owner} · {restoredTask.retrievalRequest?.dueAt}</dd></div></dl></section>
          <div className={taskStyles.taskFields}><label>主管 ID<input aria-label="光伏核查主管ID" value={supervisorId} disabled={taskConfirmed} onChange={(event) => setSupervisorId(event.target.value)} placeholder="输入不同于提交人的主管 ID" /></label><label className={taskStyles.fullField}>主管意见<textarea aria-label="光伏核查主管意见" value={supervisorNote} disabled={taskConfirmed} onChange={(event) => setSupervisorNote(event.target.value)} placeholder="确认的是核查方向，不是少发根因" /></label><label>当前角色<select aria-label="当前操作角色" value={props.actorRole} onChange={(event) => props.onActorRoleChange(event.target.value)}>{props.roles.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}</select></label></div>
        </>}
        {props.commands.some((command) => command.id === "hold_control_change") ? <label className={styles.blockField}>登记理由<textarea aria-label="光伏禁止控制变更登记理由" value={blockReason} onChange={(event) => setBlockReason(event.target.value)} placeholder="说明证据缺口和平台内禁止变更范围" /></label> : null}
        {props.error ? <section className={styles.error} role="alert"><AlertTriangle size={17} /><div><strong>核查记录未写入</strong><p>{props.error}</p><button type="button" onClick={() => props.onSelect(props.selected.objectId)}>刷新当前站日</button></div></section> : null}
        {props.receipt ? <p className={styles.receipt} role="status">已持久化：{props.receipt.event.fromState} → {props.receipt.event.toState}</p> : null}</div>
        <section className={styles.actions}>{props.commands.length ? props.commands.map((command) => { const ready = command.id === "submit_station_check" ? submissionReady : command.id === "confirm_attribution" ? supervisorReady : command.id === "hold_control_change" ? blockReady : true; const label = command.id === "hold_control_change" ? "登记禁止控制变更" : command.label; return <button type="button" key={command.id} data-tone={command.tone} disabled={props.busy || !ready} onClick={() => runCommand(command.id)}>{command.id === "hold_control_change" ? <ShieldCheck size={17} /> : <FileCheck2 size={17} />}{props.busy ? "正在记录…" : label}</button>; }) : <p>当前角色没有可执行动作。</p>}</section>
      </article>
    </section>

    <section className={styles.lower}>
      <section className={styles.trend} aria-label={`PV-${stationId.padStart(2, "0")} 最近 14 个站日`} data-points={recentHistory.length}>
        <header><div><BarChart3 size={18} /><h2>PV-{stationId.padStart(2, "0")} 日级历史</h2><span>最近 {recentHistory.length} 个已观测日</span></div><p><i />有效记录 <b />缺测断线，不补零</p></header>
        <div className={styles.trendLanes}>{trendLanes.map((lane) => <div className={styles.trendLane} data-tone={lane.tone} key={lane.field}><div><strong>{lane.label}</strong><span>{lane.unit}</span></div><svg viewBox="0 0 1000 56" preserveAspectRatio="none" role="img" aria-label={`${lane.label}日级趋势`}><line x1="0" x2="1000" y1="45" y2="45" />{trendSegments(recentHistory, lane.field).map((segment, index) => <polyline key={`${lane.field}-${index}`} points={segment} />)}<path d={`M${(currentTrendIndex / Math.max(1, recentHistory.length - 1)) * 1000} 3V52`} /></svg></div>)}</div>
        <footer><span>{recentHistory[0] ? displayText(recentHistory[0].date) : currentDate}</span><strong>当前站日 {currentDate}</strong><span>{recentHistory.at(-1) ? displayText(recentHistory.at(-1)?.date) : currentDate}</span></footer>
      </section>
      <aside className={styles.boundary} aria-label="案例20使用限制"><header><AlertTriangle size={20} /><h2>使用限制</h2></header><ul><li>归一化出力比不是物理效率</li><li>疑似限电占比不是已确认限电</li><li>温度线索不是发电损失比例</li><li>未接入调度、告警和检修记录</li></ul><div><ShieldCheck size={18} /><span><strong>线索不等于少发原因</strong><b>平台不下发控制</b></span></div></aside>
    </section>

    <footer className={styles.footer}><span>当前对象 <strong>20-{stationId}-{currentDate}</strong></span><span>公开交付 <strong>8 个匿名站点</strong></span><span>站日数据 <strong>{props.datasetRowCount.toLocaleString("zh-CN")}</strong></span><span>状态 <strong>{props.selected.state} · v{props.selected.version}</strong></span><span>流程阶段 <strong>{workflowRank}/4</strong></span></footer>
  </main>;
}
