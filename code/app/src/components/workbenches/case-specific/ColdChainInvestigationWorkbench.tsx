"use client";

import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  RefreshCw,
  Search,
  ShieldCheck,
  Thermometer,
  Truck,
  UserRound,
  WifiOff,
} from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import styles from "./ColdChainInvestigationWorkbench.module.css";
import type { CaseWorkbenchProps } from "./types";

const evidenceGapLabels: Record<string, string> = {
  handoff_record: "交接记录",
  route_record: "路线记录",
  calibration_record: "校准记录",
  logger_offline_record: "记录仪离线说明",
};

type RouteSummary = {
  object: CaseWorkbenchProps["objects"][number];
  investigationId: string;
  routeId: string;
  province: string;
  county: string;
  maxTemp: number;
  excursionCount: number;
  handoffGap: boolean;
  deviceGap: boolean;
  offlinePeak: number;
};

function text(value: unknown): string {
  return String(value ?? "—");
}

function clean(value: unknown): string {
  return text(value).replace("—", "");
}

function numeric(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function time(value: unknown): string {
  return text(value).slice(11, 16);
}

function roleLabel(role: string): string {
  if (role === "quality_reviewer") return "质量复核员";
  if (role === "supervisor") return "质量主管";
  return role;
}

function displayState(state: string): string {
  if (state === "质量已会签") return "调查已复核";
  if (state === "批次暂缓") return "等待补证";
  return state;
}

function displayCommand(command: string): string {
  if (command === "open_investigation") return "启动运输记录调查";
  if (command === "quality_cosign") return "完成调查复核";
  if (command === "hold_batch") return "等待补证";
  return command;
}

function parseReview(reason: unknown): { windowStart: string; windowEnd: string; note: string } | undefined {
  const source = text(reason);
  if (!source.startsWith("cold-chain-review:")) return undefined;
  try {
    return JSON.parse(source.slice("cold-chain-review:".length)) as {
      windowStart: string;
      windowEnd: string;
      note: string;
    };
  } catch {
    return undefined;
  }
}

function yForTemperature(value: number): number {
  const bounded = Math.max(0, Math.min(12, value));
  return 208 - (bounded / 12) * 174;
}

function eventX(index: number, count: number): number {
  return 38 + (index / Math.max(1, count - 1)) * 924;
}

function routeRowsFor(
  rows: Record<string, unknown>[],
  investigationId: string,
  routeId: string,
): Record<string, unknown>[] {
  return rows
    .filter((item) => text(item.investigation_id) === investigationId && text(item.route_id) === routeId)
    .sort((left, right) => text(left.event_time).localeCompare(text(right.event_time)));
}

export function ColdChainInvestigationWorkbench(props: CaseWorkbenchProps) {
  const row = props.selected.payload;
  const investigationId = text(row.investigation_id);
  const routeId = text(row.route_id);
  const persisted = useMemo(
    () => parseReview([...props.events].reverse().find((event) => event.reason)?.reason),
    [props.events],
  );
  const aggregateData = useMemo(() => {
    const historical = props.events.reduce<Record<string, unknown>>(
      (merged, event) => ({ ...merged, ...record(event.data) }),
      {},
    );
    return { ...historical, ...record(props.selected.task), ...record(props.receipt?.event.data) };
  }, [props.events, props.receipt, props.selected.task]);
  const restoredEvidence = record(aggregateData.supplementalEvidence);

  const selectedRows = useMemo(
    () => routeRowsFor(props.sceneRows, investigationId, routeId),
    [investigationId, props.sceneRows, routeId],
  );
  const rows = selectedRows.length ? selectedRows : [row];
  const anomalyRows = rows.filter((item) => numeric(item.temperature_c) > 8);
  const maxTemp = Math.max(...rows.map((item) => numeric(item.temperature_c)));
  const offlinePeak = Math.max(...rows.map((item) => numeric(item.offline_minutes)));
  const calibrationOk = rows.every((item) => text(item.calibration_status) === "valid");
  const routeComplete = rows.every((item) => text(item.route_record_status) === "complete");
  const handoffComplete = rows.every((item) => text(item.handoff_status) === "complete");
  const actualStart = time(rows[0]?.event_time);
  const actualEnd = time(rows.at(-1)?.event_time);

  const routeObjects = useMemo(() => {
    const representatives = new Map<string, CaseWorkbenchProps["objects"][number]>();
    for (const item of props.objects) {
      const key = `${text(item.payload.investigation_id)}::${text(item.payload.route_id)}`;
      const current = representatives.get(key);
      if (!current || numeric(item.payload.temperature_c) > numeric(current.payload.temperature_c)) {
        representatives.set(key, item);
      }
    }
    return Array.from(representatives.values());
  }, [props.objects]);

  const routeSummaries = useMemo<RouteSummary[]>(() => routeObjects.map((item) => {
    const id = text(item.payload.investigation_id);
    const route = text(item.payload.route_id);
    const sourceRows = routeRowsFor(props.sceneRows, id, route);
    const aggregateRows = sourceRows.length ? sourceRows : [item.payload];
    return {
      object: item,
      investigationId: id,
      routeId: route,
      province: text(item.payload.province),
      county: text(item.payload.county),
      maxTemp: Math.max(...aggregateRows.map((entry) => numeric(entry.temperature_c))),
      excursionCount: aggregateRows.filter((entry) => numeric(entry.temperature_c) > 8).length,
      handoffGap: aggregateRows.some((entry) => text(entry.handoff_status) !== "complete"),
      deviceGap: aggregateRows.some((entry) => text(entry.calibration_status) !== "valid" || text(entry.route_record_status) !== "complete"),
      offlinePeak: Math.max(...aggregateRows.map((entry) => numeric(entry.offline_minutes))),
    };
  }).sort((left, right) => left.investigationId.localeCompare(right.investigationId, "zh-CN")), [props.sceneRows, routeObjects]);

  const [query, setQuery] = useState("");
  const [anomalyType, setAnomalyType] = useState("全部调查");
  const [windowStart, setWindowStart] = useState(clean(aggregateData.windowStart ?? persisted?.windowStart ?? time(anomalyRows[0]?.event_time)));
  const [windowEnd, setWindowEnd] = useState(clean(aggregateData.windowEnd ?? persisted?.windowEnd ?? time(anomalyRows.at(-1)?.event_time)));
  const [note, setNote] = useState(clean(aggregateData.note ?? persisted?.note));
  const [evidenceType, setEvidenceType] = useState(text(restoredEvidence.type ?? "handoff_record"));
  const [evidenceId, setEvidenceId] = useState(clean(restoredEvidence.evidenceId));
  const [evidenceSummary, setEvidenceSummary] = useState(clean(restoredEvidence.summary));
  const [evidenceAtEventId, setEvidenceAtEventId] = useState(text(restoredEvidence.recordedAtEventId ?? row.event_id));
  const [evidenceVerified, setEvidenceVerified] = useState(restoredEvidence.verificationStatus === "verified");
  const [selectedEventId, setSelectedEventId] = useState(text(row.event_id));
  const [windowRevision, setWindowRevision] = useState(0);

  useEffect(() => {
    const first = anomalyRows[0];
    const last = anomalyRows.at(-1);
    setWindowStart(clean(aggregateData.windowStart ?? persisted?.windowStart ?? time(first?.event_time)));
    setWindowEnd(clean(aggregateData.windowEnd ?? persisted?.windowEnd ?? time(last?.event_time)));
    setNote(clean(aggregateData.note ?? persisted?.note));
    setEvidenceType(text(restoredEvidence.type ?? "handoff_record"));
    setEvidenceId(clean(restoredEvidence.evidenceId));
    setEvidenceSummary(clean(restoredEvidence.summary));
    setEvidenceAtEventId(text(restoredEvidence.recordedAtEventId ?? row.event_id));
    setEvidenceVerified(restoredEvidence.verificationStatus === "verified");
    setSelectedEventId(text(row.event_id));
    setWindowRevision(0);
  }, [
    aggregateData.note,
    aggregateData.windowEnd,
    aggregateData.windowStart,
    investigationId,
    persisted,
    restoredEvidence.evidenceId,
    restoredEvidence.recordedAtEventId,
    restoredEvidence.summary,
    restoredEvidence.type,
    restoredEvidence.verificationStatus,
    row.event_id,
  ]);

  const filteredSummaries = routeSummaries.filter((summary) => {
    const needle = query.trim().toLowerCase();
    const matchesQuery = !needle || [
      summary.investigationId,
      summary.routeId,
      summary.province,
      summary.county,
    ].some((value) => value.toLowerCase().includes(needle));
    const matchesType = anomalyType === "全部调查"
      || (anomalyType === "温度偏差" && summary.excursionCount > 0)
      || (anomalyType === "交接缺失" && summary.handoffGap)
      || (anomalyType === "记录仪离线" && summary.offlinePeak > 0)
      || (anomalyType === "常规核对" && summary.excursionCount === 0 && !summary.handoffGap && !summary.deviceGap && summary.offlinePeak === 0);
    return matchesQuery && matchesType;
  });

  const evidenceGaps = [
    handoffComplete ? undefined : "handoff_record",
    routeComplete ? undefined : "route_record",
    calibrationOk ? undefined : "calibration_record",
    offlinePeak > 0 ? "logger_offline_record" : undefined,
  ].filter((item): item is string => Boolean(item));
  const windowValid = Boolean(windowStart && windowEnd && windowStart <= windowEnd && windowStart >= actualStart && windowEnd <= actualEnd);
  const supplementComplete = evidenceId.trim() !== ""
    && evidenceSummary.trim() !== ""
    && rows.some((item) => text(item.event_id) === evidenceAtEventId)
    && evidenceVerified;
  const selectedEvent = rows.find((item) => text(item.event_id) === selectedEventId) ?? rows[0];
  const windowStartIndex = Math.max(0, rows.findIndex((item) => time(item.event_time) >= windowStart));
  const candidateEndIndex = rows.findLastIndex((item) => time(item.event_time) <= windowEnd);
  const windowEndIndex = candidateEndIndex >= 0 ? candidateEndIndex : rows.length - 1;
  const windowLeft = eventX(windowStartIndex, rows.length);
  const windowRight = eventX(windowEndIndex, rows.length);
  const chartPoints = rows.map((item, index) => `${eventX(index, rows.length)},${yForTemperature(numeric(item.temperature_c))}`).join(" ");
  const waitingForEvidence = props.selected.state === "批次暂缓"
    || props.selected.state === "等待补证"
    || (props.selected.state === "调查中" && evidenceGaps.length > 0 && !supplementComplete);

  function changeWindow(boundary: "start" | "end", value: string) {
    if (boundary === "start") setWindowStart(value);
    else setWindowEnd(value);
    setWindowRevision((current) => current + 1);
  }

  function runCommand(command: string) {
    const actorId = props.actorRole === "supervisor" ? "case12-quality-supervisor" : "case12-quality-reviewer";
    props.onCommand(
      command,
      `cold-chain-review:${JSON.stringify({ windowStart, windowEnd, note: note.trim() })}`,
      {
        actorId,
        data: {
          aggregateType: "cold_chain_investigation",
          investigationId,
          routeId,
          routeEventIds: rows.map((item) => text(item.event_id)),
          investigationWindow: {
            start: windowStart,
            end: windowEnd,
            sourceTimeRange: { start: actualStart, end: actualEnd },
          },
          observations: {
            maxTemperatureC: maxTemp,
            excursionEventIds: anomalyRows.map((item) => text(item.event_id)),
            handoffStatus: handoffComplete ? "complete" : "missing",
            routeRecordStatus: routeComplete ? "complete" : "missing",
            calibrationStatus: calibrationOk ? "valid" : "invalid",
            offlineMinutes: offlinePeak,
          },
          evidenceGaps,
          supplementalEvidence: evidenceId.trim() ? {
            evidenceId: evidenceId.trim(),
            type: evidenceType,
            summary: evidenceSummary.trim(),
            recordedAtEventId: evidenceAtEventId,
            verificationStatus: evidenceVerified ? "verified" : "pending",
          } : null,
          qualityDecision: command === "quality_cosign" ? "cosign" : command === "hold_batch" ? "freeze" : "investigate",
          createdBy: text(aggregateData.createdBy ?? (props.actorRole === "supervisor" ? "case12-quality-reviewer" : actorId)),
          decisionBy: props.actorRole === "supervisor" ? actorId : null,
          freezeScope: command === "hold_batch" ? {
            scope: "investigation_route",
            investigationId,
            routeId,
            batchId: null,
            batchIdStatus: "not_available_in_dataset",
          } : null,
          note: note.trim(),
          serverValidationRequired: true,
        },
        evidenceIds: rows.map((item) => `route-event:${text(item.event_id)}`).concat(evidenceId.trim() ? [`supplement:${evidenceId.trim()}`] : []),
        idempotencyKey: `case-12:investigation:${investigationId}:route:${routeId}:${command}:v${props.selected.version}`,
      },
    );
  }

  function reset() {
    setQuery("");
    setAnomalyType("全部调查");
    setNote("");
    setEvidenceType("handoff_record");
    setEvidenceId("");
    setEvidenceSummary("");
    setEvidenceAtEventId(text(row.event_id));
    setEvidenceVerified(false);
    props.onReset();
  }

  return (
    <main className={styles.root} aria-label="县域冷链运输记录调查">
      <header className={styles.header}>
        <div className={styles.brand}>
          <span><ClipboardCheck size={22} /></span>
          <div>
            <h1>县域冷链运输记录调查</h1>
            <p>只核对运输记录与证据完整性</p>
          </div>
        </div>
        <dl className={styles.identity}>
          <div><dt>当前调查单</dt><dd>{investigationId}</dd></div>
          <div><dt>路线</dt><dd>{routeId}</dd></div>
          <div><dt>记录范围</dt><dd>{actualStart}—{actualEnd}</dd></div>
          <div><dt>记录数</dt><dd>{rows.length} 条</dd></div>
        </dl>
        <div className={styles.headerTools}>
          <span className={styles.statePill} data-waiting={waitingForEvidence}>{displayState(props.selected.state)}</span>
          <span className={styles.role}><UserRound size={16} />{roleLabel(props.actorRole)}</span>
          <button type="button" aria-label="恢复案例 B12" onClick={reset} disabled={props.busy}><RefreshCw size={17} /></button>
        </div>
      </header>

      <section className={styles.workspace}>
        <aside className={styles.directory} aria-label="调查列表">
          <header>
            <div><h2>调查单</h2><span>{routeSummaries.length}</span></div>
            <label className={styles.search}><Search size={16} /><input aria-label="搜索调查" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="调查单 / 路线 / 县域" /></label>
            <div className={styles.filters} role="group" aria-label="异常类型筛选">
              {["全部调查", "温度偏差", "交接缺失", "记录仪离线", "常规核对"].map((item) => (
                <button type="button" key={item} aria-pressed={anomalyType === item} onClick={() => setAnomalyType(item)}>{item}</button>
              ))}
            </div>
            <span className={styles.resultCount}>当前显示 {filteredSummaries.length} 张调查单</span>
          </header>
          <div className={styles.directoryList}>
            {filteredSummaries.map((summary) => {
              const selected = summary.object.objectId === props.selected.objectId;
              const reason = summary.excursionCount > 0 && summary.handoffGap
                ? "温度偏差 · 交接待补"
                : summary.excursionCount > 0
                  ? "温度偏差"
                  : summary.handoffGap
                    ? "交接待补"
                    : summary.offlinePeak > 0
                      ? `离线 ${summary.offlinePeak} 分钟`
                      : "常规核对";
              return (
                <button type="button" key={summary.object.objectId} aria-pressed={selected} onClick={() => props.onSelect(summary.object.objectId)}>
                  <div><strong>{summary.province} · {summary.county}</strong><ChevronRight size={16} /></div>
                  <span>{summary.investigationId}</span>
                  <span>{summary.routeId}</span>
                  <footer><em data-alert={summary.excursionCount > 0 || summary.handoffGap || summary.offlinePeak > 0}>{reason}</em><b>{summary.maxTemp.toFixed(1)}℃</b></footer>
                </button>
              );
            })}
          </div>
        </aside>

        <section className={styles.evidenceTimeline}>
          <header className={styles.timelineHeader}>
            <div>
              <span>运输记录时间证据带</span>
              <h2>{actualStart}—{actualEnd} · {rows.length} 条五分钟记录</h2>
            </div>
            <dl>
              <div><dt>最高温度</dt><dd data-alert={maxTemp > 8}>{maxTemp.toFixed(1)}℃</dd></div>
              <div><dt>越界记录</dt><dd data-alert={anomalyRows.length > 0}>{anomalyRows.length} 条</dd></div>
              <div><dt>最长离线</dt><dd data-alert={offlinePeak > 0}>{offlinePeak} 分钟</dd></div>
            </dl>
          </header>

          <section className={styles.eventStrip} aria-label="五分钟事件带">
            {rows.map((item, index) => {
              const eventId = text(item.event_id);
              const excursion = numeric(item.temperature_c) > 8;
              return (
                <button
                  type="button"
                  key={eventId}
                  aria-label={`${time(item.event_time)}，${eventId}，${numeric(item.temperature_c).toFixed(1)}℃`}
                  aria-pressed={selectedEventId === eventId}
                  data-excursion={excursion}
                  onClick={() => setSelectedEventId(eventId)}
                >
                  <i />
                  <span>{index % 3 === 0 || excursion ? time(item.event_time) : ""}</span>
                </button>
              );
            })}
          </section>

          <section className={styles.chartCard} aria-label="温度记录与调查窗口">
            <header>
              <div><Thermometer size={18} /><h3>温度记录</h3><span>2–8℃ 参考带</span></div>
              <div className={styles.legend}><span><i data-line="temperature" />温度</span><span><i data-dot="excursion" />越界记录</span><span><i data-window="selected" />调查窗口</span></div>
            </header>
            <div className={styles.chartPlot}>
              <svg role="img" aria-label={`温度曲线，最高 ${maxTemp.toFixed(1)}℃，${anomalyRows.length} 条记录高于 8℃`} viewBox="0 0 1000 240" preserveAspectRatio="none">
                <rect className={styles.referenceBand} x="38" y={yForTemperature(8)} width="924" height={yForTemperature(2) - yForTemperature(8)} />
                {[2, 4, 6, 8, 10, 12].map((tick) => <g key={tick}><line className={styles.gridLine} x1="38" x2="962" y1={yForTemperature(tick)} y2={yForTemperature(tick)} /><text x="4" y={yForTemperature(tick) + 4}>{tick}</text></g>)}
                {windowValid ? <rect className={styles.windowBand} x={windowLeft} y="24" width={Math.max(8, windowRight - windowLeft)} height="190" /> : null}
                <polyline className={styles.temperatureLine} points={chartPoints} />
                {rows.map((item, index) => {
                  const eventId = text(item.event_id);
                  const excursion = numeric(item.temperature_c) > 8;
                  return <circle key={eventId} className={styles.temperaturePoint} data-excursion={excursion} data-selected={selectedEventId === eventId} cx={eventX(index, rows.length)} cy={yForTemperature(numeric(item.temperature_c))} r={selectedEventId === eventId ? 6 : excursion ? 4.5 : 2.5} />;
                })}
              </svg>
              {windowRevision > 0 && windowValid ? <span key={windowRevision} className={styles.windowScan} style={{ "--scan-left": `${(windowLeft / 10).toFixed(2)}%`, "--scan-width": `${Math.max(1, (windowRight - windowLeft) / 10).toFixed(2)}%` } as CSSProperties} aria-hidden="true" /> : null}
              <article className={styles.selectedEvent} aria-label="当前记录详情">
                <header><span>当前记录</span><b data-alert={numeric(selectedEvent.temperature_c) > 8}>{numeric(selectedEvent.temperature_c).toFixed(1)}℃</b></header>
                <strong>{text(selectedEvent.event_id)} · {time(selectedEvent.event_time)}</strong>
                <dl>
                  <div><dt>交接</dt><dd data-alert={text(selectedEvent.handoff_status) !== "complete"}>{text(selectedEvent.handoff_status) === "complete" ? "完整" : "待补"}</dd></div>
                  <div><dt>路线记录</dt><dd data-alert={text(selectedEvent.route_record_status) !== "complete"}>{text(selectedEvent.route_record_status) === "complete" ? "完整" : "缺失"}</dd></div>
                  <div><dt>离线</dt><dd data-alert={numeric(selectedEvent.offline_minutes) > 0}>{numeric(selectedEvent.offline_minutes)} 分钟</dd></div>
                  <div><dt>校准</dt><dd data-alert={text(selectedEvent.calibration_status) !== "valid"}>{text(selectedEvent.calibration_status) === "valid" ? "有效" : "待核"}</dd></div>
                </dl>
              </article>
            </div>
            <footer className={styles.windowControls}>
              <div>
                <label>调查开始<input type="time" aria-label="调查开始时间" value={windowStart} min={actualStart} max={actualEnd} onChange={(event) => changeWindow("start", event.target.value)} /></label>
                <span>—</span>
                <label>调查结束<input type="time" aria-label="调查结束时间" value={windowEnd} min={actualStart} max={actualEnd} onChange={(event) => changeWindow("end", event.target.value)} /></label>
              </div>
              <p data-valid={windowValid}>{windowValid ? `已选 ${windowStart}—${windowEnd}，位于真实记录范围内` : `窗口必须位于 ${actualStart}—${actualEnd} 且起止有序`}</p>
            </footer>
          </section>

          <section className={styles.investigationNote}>
            <label>调查说明<textarea aria-label="调查说明" value={note} onChange={(event) => setNote(event.target.value)} placeholder="记录需要核对的运输事实与证据缺口" /></label>
            <div>
              <span><Truck size={15} />{text(row.vehicle_code)}</span>
              <span><ClipboardCheck size={15} />{text(row.container_code)}</span>
              <span><CircleDot size={15} />{text(row.logger_code)}</span>
            </div>
          </section>

          {props.receipt ? <p className={styles.receipt} role="status"><CheckCircle2 size={17} />调查记录已保存：{displayState(props.receipt.event.fromState)} → {displayState(props.receipt.event.toState)}</p> : null}
          {props.error ? <p className={styles.error} role="alert">{props.error}<button type="button" onClick={() => props.onSelect(props.selected.objectId)}>刷新当前调查</button></p> : null}
        </section>

        <aside className={styles.inspector} aria-label="证据核对与调查动作">
          <header>
            <div><h2>记录核对</h2><span>{evidenceGaps.length ? supplementComplete ? `${evidenceGaps.length} 项已补录` : `${evidenceGaps.length} 项待补` : "记录已齐"}</span></div>
            <p>温度、设备与路线、交接分别核对</p>
          </header>

          <section className={styles.gates} aria-label="运输记录核对结果">
            <article data-tone={anomalyRows.length ? "attention" : "good"}>
              <i><Thermometer size={18} /></i>
              <div><strong>温度记录</strong><span>{anomalyRows.length ? `${anomalyRows.length} 条高于 8℃` : "均在参考带内"}</span></div>
              <b>{maxTemp.toFixed(1)}℃</b>
            </article>
            <article data-tone={calibrationOk && routeComplete && offlinePeak === 0 ? "good" : "attention"}>
              <i>{offlinePeak > 0 ? <WifiOff size={18} /> : <Truck size={18} />}</i>
              <div><strong>设备与路线</strong><span>校准{calibrationOk ? "有效" : "待核"} · 路线{routeComplete ? "完整" : "缺失"}</span></div>
              <b>{offlinePeak ? `离线 ${offlinePeak} 分` : "无离线"}</b>
            </article>
            <article data-tone={handoffComplete || supplementComplete ? "good" : "missing"} data-verified={supplementComplete}>
              <i>{handoffComplete || supplementComplete ? <Check size={18} /> : <AlertTriangle size={18} />}</i>
              <div><strong>交接记录</strong><span>{handoffComplete ? "原始记录完整" : supplementComplete ? "补录证据已核验" : "原始记录未提供"}</span></div>
              <b>{handoffComplete || supplementComplete ? "已核对" : "待补"}</b>
            </article>
          </section>

          <section className={styles.gapSummary} data-clear={evidenceGaps.length === 0 || supplementComplete}>
            <FileCheck2 size={18} />
            <div>
              <strong>{evidenceGaps.length && !supplementComplete ? "当前不能完成调查复核" : supplementComplete ? "补录材料可以提交复核" : "记录可以提交复核"}</strong>
              <p>{evidenceGaps.length
                ? supplementComplete
                  ? `${evidenceGaps.map((item) => evidenceGapLabels[item] ?? item).join("、")}已补录并核验，提交时仍会复核关联事件`
                  : `待补：${evidenceGaps.map((item) => evidenceGapLabels[item] ?? item).join("、")}`
                : "当前运输记录未发现材料缺口"}</p>
            </div>
          </section>

          <section className={styles.supplement} aria-label="证据缺口补录">
            <header><h3>补录证据</h3><span>{evidenceId ? "草稿已填写" : "待填写"}</span></header>
            <label>证据类型<select aria-label="补录证据类型" value={evidenceType} onChange={(event) => setEvidenceType(event.target.value)}><option value="handoff_record">交接记录</option><option value="route_record">路线记录</option><option value="calibration_record">校准记录</option><option value="logger_offline_record">记录仪离线说明</option></select></label>
            <label>证据编号<input aria-label="补录证据编号" value={evidenceId} onChange={(event) => setEvidenceId(event.target.value)} placeholder="例如 HANDOFF-CCI-001" /></label>
            <label>关联事件<select aria-label="补录关联事件" value={evidenceAtEventId} onChange={(event) => setEvidenceAtEventId(event.target.value)}>{rows.map((item) => <option key={text(item.event_id)} value={text(item.event_id)}>{text(item.event_id)} · {time(item.event_time)}</option>)}</select></label>
            <label>证据摘要<textarea aria-label="补录证据摘要" value={evidenceSummary} onChange={(event) => setEvidenceSummary(event.target.value)} placeholder="记录材料来源和核对结果" /></label>
            <label className={styles.verify}><input type="checkbox" aria-label="补录证据已由质量角色核验" checked={evidenceVerified} onChange={(event) => setEvidenceVerified(event.target.checked)} /><span><Check size={13} /></span>已由质量角色核验</label>
          </section>

          <section className={styles.actionPanel}>
            <label>当前操作角色<select aria-label="当前操作角色" value={props.actorRole} onChange={(event) => props.onActorRoleChange(event.target.value)}>{props.roles.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}</select></label>
            <div className={styles.roleSeparation}><span><UserRound size={14} />复核员发起调查</span><ChevronRight size={14} /><span><ShieldCheck size={14} />主管完成复核</span></div>
            <div className={styles.commandList}>
              {props.commands.length ? props.commands.map((command) => {
                const openBlocked = command.id === "open_investigation" && (!windowValid || !note.trim());
                const reviewBlocked = command.id === "quality_cosign" && (props.actorRole !== "supervisor" || !windowValid || (evidenceGaps.length > 0 && !supplementComplete));
                const waitBlocked = command.id === "hold_batch" && (props.actorRole !== "supervisor" || !note.trim());
                const blocked = props.busy || openBlocked || reviewBlocked || waitBlocked;
                return <button type="button" key={command.id} data-kind={command.id} disabled={blocked} onClick={() => runCommand(command.id)}>{command.id === "hold_batch" ? <Clock3 size={17} /> : <ShieldCheck size={17} />}{props.busy ? "正在保存…" : displayCommand(command.id)}</button>;
              }) : <p>当前角色没有可执行动作。</p>}
            </div>
            {waitingForEvidence ? <p className={styles.waiting}><Clock3 size={15} />调查处于等待补证状态，材料核验前不能完成复核。</p> : null}
          </section>

          <footer><ShieldCheck size={16} /><p>调查范围仅限当前运输记录。提交时仍会校验调查单版本、时间窗口、事件关联与操作角色。</p></footer>
        </aside>
      </section>
    </main>
  );
}
