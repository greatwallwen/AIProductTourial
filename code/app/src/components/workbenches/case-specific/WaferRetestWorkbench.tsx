"use client";

import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Database,
  FileCheck2,
  Filter,
  FlaskConical,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import styles from "./WaferRetestWorkbench.module.css";
import type { CaseWorkbenchProps } from "./types";

const sensors = [
  "sensor_021", "sensor_022", "sensor_024", "sensor_090", "sensor_158", "sensor_159",
  "sensor_160", "sensor_161", "sensor_162", "sensor_294", "sensor_295", "sensor_296",
] as const;

type RetestDraft = { channels: string[]; checks: Record<string, boolean>; note: string };
type RetestTask = {
  taskId: string;
  selectedSensorIds: string[];
  requestedChecks: Record<string, boolean>;
  requestedByRole: string;
  requestedByActorId: string;
  note: string;
  status: "requested";
};

const queuePageSize = 8;

function text(value: unknown): string { return value === "" || value == null ? "缺失" : String(value); }
function optionalText(value: unknown): string { return value === "" || value == null ? "" : String(value); }
function numeric(value: unknown): number | undefined {
  if (value === "" || value == null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
function format(value: unknown, digits = 4): string {
  const parsed = numeric(value);
  return parsed == null ? "缺失" : parsed.toLocaleString("zh-CN", { maximumFractionDigits: digits });
}
function roleLabel(role: string): string {
  return role === "quality_engineer" ? "质量工程师" : role === "supervisor" ? "质量主管" : role;
}
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
function sensorIds(value: unknown): string[] {
  return stringArray(value).filter((item) => (sensors as readonly string[]).includes(item));
}
function parseDraft(reason: unknown): RetestDraft | undefined {
  const source = String(reason ?? "");
  if (!source.startsWith("wafer-retest:")) return undefined;
  try { return JSON.parse(source.slice("wafer-retest:".length)) as RetestDraft; } catch { return undefined; }
}

function restoredAggregate(props: CaseWorkbenchProps): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  for (const event of props.events
    .filter((item) => item.objectId === props.selected.objectId)
    .sort((left, right) => left.version - right.version)) {
    const legacy = parseDraft(event.reason);
    if (legacy) {
      merged.retestTask = {
        taskId: `RETEST-${text(props.selected.payload.wafer_id)}-V${Math.max(1, event.version)}`,
        selectedSensorIds: legacy.channels,
        requestedChecks: legacy.checks,
        requestedByRole: event.actor.role,
        requestedByActorId: event.actor.id,
        note: legacy.note,
        status: "requested",
      } satisfies RetestTask;
    }
    if (event.data) Object.assign(merged, event.data);
  }
  Object.assign(merged, record(props.selected.task));
  if (props.receipt?.event.objectId === props.selected.objectId) Object.assign(merged, record(props.receipt.event.data));
  return merged;
}

export function WaferRetestWorkbench(props: CaseWorkbenchProps) {
  const row = props.selected.payload;
  const aggregateData = useMemo(
    () => restoredAggregate(props),
    [props.events, props.receipt, props.selected.objectId, props.selected.task, props.selected.version],
  );
  const restoredRetest = record(aggregateData.retestTask);
  const restoredSupervisorReview = record(aggregateData.supervisorReview);
  const initialMissing = sensors.filter((key) => row[key] === "" || row[key] == null);
  const restoredChannels = sensorIds(restoredRetest.selectedSensorIds);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [focusedSensor, setFocusedSensor] = useState<string>(initialMissing[0] ?? sensors[0]);
  const [selectedChannels, setSelectedChannels] = useState<string[]>(restoredChannels.length ? restoredChannels : initialMissing);
  const [checks, setChecks] = useState<Record<string, boolean>>(
    Object.keys(record(restoredRetest.requestedChecks)).length
      ? record(restoredRetest.requestedChecks) as Record<string, boolean>
      : { preserve: false, missing: false, manual: false },
  );
  const [note, setNote] = useState(optionalText(restoredSupervisorReview.note ?? restoredRetest.note));
  const ranking = props.supportingArtifacts["sensor-ranking.csv"] ?? [];
  const missingBySensor = new Map(ranking.map((item) => [text(item.sensor_id), numeric(item.missing_rows) ?? 0]));
  const rankBySensor = new Map(ranking.map((item, index) => [text(item.sensor_id), numeric(item.rank) ?? index + 1]));
  const missingSensors = sensors.filter((key) => row[key] === "" || row[key] == null);
  const filteredObjects = props.objects.filter((item) => {
    const failed = text(item.payload.quality_label) === "fail";
    const needle = query.trim().toLowerCase();
    return (status === "all" || (status === "failed" ? failed : !failed))
      && (!needle || [item.payload.wafer_id, item.payload.test_timestamp].some((value) => text(value).toLowerCase().includes(needle)));
  });
  const pageCount = Math.max(1, Math.ceil(filteredObjects.length / queuePageSize));
  const safePage = Math.min(page, pageCount);
  const visibleObjects = filteredObjects.slice((safePage - 1) * queuePageSize, safePage * queuePageSize);
  const failedMetric = props.metrics.find((item) => item.id === "failed");
  const focusedMissingRows = missingBySensor.get(focusedSensor) ?? 0;
  const focusedAvailableRows = Math.max(0, props.datasetRowCount - focusedMissingRows);
  const coverageRate = props.datasetRowCount ? (focusedAvailableRows / props.datasetRowCount) * 100 : 0;
  const focusedIsMissing = row[focusedSensor] === "" || row[focusedSensor] == null;
  const restoredTaskId = optionalText(restoredRetest.taskId);
  const hasPersistedRetest = restoredTaskId.length > 0 && sensorIds(restoredRetest.selectedSensorIds).length > 0;
  const requestReady = selectedChannels.length > 0
    && ["preserve", "missing", "manual"].every((key) => checks[key])
    && note.trim().length >= 6;
  const supervisorReady = props.actorRole === "supervisor" && note.trim().length >= 6;
  const completed = props.selected.state === "复测申请已确认" || props.selected.state === "记录已隔离";
  const confirmed = props.selected.state === "复测申请已确认";
  const steps = [
    { title: "核对原始记录", done: Boolean(checks.preserve) || hasPersistedRetest },
    { title: "选择复测通道", done: selectedChannels.length > 0 },
    { title: "提交具名复测任务", done: hasPersistedRetest },
    { title: "质量主管确认", done: completed },
  ];

  useEffect(() => {
    const nextMissing = sensors.filter((key) => row[key] === "" || row[key] == null);
    const nextChannels = sensorIds(restoredRetest.selectedSensorIds);
    const nextChecks = record(restoredRetest.requestedChecks);
    setFocusedSensor(nextChannels[0] ?? nextMissing[0] ?? sensors[0]);
    setSelectedChannels(nextChannels.length ? nextChannels : nextMissing);
    setChecks(Object.keys(nextChecks).length ? nextChecks as Record<string, boolean> : { preserve: false, missing: false, manual: false });
    setNote(optionalText(restoredSupervisorReview.note ?? restoredRetest.note));
  }, [props.selected.objectId, props.selected.version, restoredRetest.note, restoredRetest.requestedChecks, restoredRetest.selectedSensorIds, restoredSupervisorReview.note, row]);

  useEffect(() => { setPage(1); }, [query, status]);

  function toggleChannel(channel: string) {
    setFocusedSensor(channel);
    setSelectedChannels((current) => current.includes(channel)
      ? current.filter((item) => item !== channel)
      : [...current, channel]);
  }

  function runCommand(command: string) {
    if (command === "request_retest" && !requestReady) return;
    if (command === "release_batch" && (!supervisorReady || !hasPersistedRetest)) return;
    if (command === "quarantine_batch" && !supervisorReady) return;
    const waferObservationId = text(row.wafer_id);
    const actorId = command === "request_retest" ? "case15-quality-engineer" : "case15-quality-supervisor";
    const taskId = restoredTaskId || (command === "request_retest" ? `RETEST-${waferObservationId}-V${Math.max(1, props.selected.version + 1)}` : "");
    const retestTask: RetestTask | null = taskId ? {
      taskId,
      selectedSensorIds: selectedChannels,
      requestedChecks: checks,
      requestedByRole: optionalText(restoredRetest.requestedByRole) || props.actorRole,
      requestedByActorId: optionalText(restoredRetest.requestedByActorId) || actorId,
      note: command === "request_retest" ? note.trim() : optionalText(restoredRetest.note) || note.trim(),
      status: "requested",
    } : null;
    const sensorEvidence = selectedChannels.map((sensorId) => ({
      sensorId,
      rawValue: row[sensorId] === "" || row[sensorId] == null ? null : text(row[sensorId]),
      numericValue: numeric(row[sensorId]) ?? null,
      isMissing: row[sensorId] === "" || row[sensorId] == null,
      datasetMissingRows: missingBySensor.get(sensorId) ?? 0,
    }));
    const decision = command === "request_retest"
      ? "request_retest"
      : command === "release_batch" ? "confirm_retest_request" : "continue_quarantine";
    const supervisorReview = command === "request_retest" ? undefined : {
      decision,
      reviewerRole: props.actorRole,
      reviewerId: actorId,
      prerequisiteTaskId: command === "release_batch" || hasPersistedRetest ? taskId : null,
      note: note.trim(),
    };
    props.onCommand(command, `wafer-retest:${JSON.stringify({ channels: selectedChannels, checks, note: note.trim() })}`, {
      actorId,
      data: {
        aggregateType: "wafer_retest_case",
        waferObservationId,
        observationVersion: props.selected.version,
        sourceTimestamp: text(row.test_timestamp),
        originalQualityLabel: text(row.quality_label),
        reviewPriority: text(row.review_priority),
        sensorEvidence,
        retestTask,
        supervisorReview,
        decision,
        serverValidationRequired: true,
      },
      evidenceIds: [
        `wafer:${waferObservationId}`,
        ...sensorEvidence.map((item) => `sensor:${waferObservationId}:${item.sensorId}`),
        ...(taskId ? [`retest-task:${taskId}`] : []),
      ],
      idempotencyKey: `case-15:wafer:${waferObservationId}:${command}:v${props.selected.version}`,
    });
  }

  function reset() {
    setQuery("");
    setStatus("all");
    setPage(1);
    setFocusedSensor(missingSensors[0] ?? sensors[0]);
    setSelectedChannels(missingSensors);
    setChecks({ preserve: false, missing: false, manual: false });
    setNote("");
    props.onReset();
  }

  return (
    <main className={styles.root} aria-label="半导体生产观测复测台">
      <header className={styles.header}>
        <div className={styles.brand}>
          <FlaskConical size={24} />
          <div><h1>半导体生产观测复测</h1><span>匿名通道 · 复测申请</span></div>
        </div>
        <dl className={styles.metrics}>
          <div><dt>数据集</dt><dd>{props.datasetRowCount.toLocaleString("zh-CN")}</dd></div>
          <div><dt>未通过</dt><dd data-alert="true">{failedMetric?.value ?? "—"}</dd></div>
          <div><dt>演示队列</dt><dd>{props.objects.length}</dd></div>
          <div><dt>当前角色</dt><dd>{roleLabel(props.actorRole)}</dd></div>
        </dl>
        <button type="button" className={styles.reset} aria-label="恢复案例 B15" onClick={reset} disabled={props.busy}><RefreshCw size={17} /></button>
      </header>

      <section className={styles.layout}>
        <aside className={styles.queue} aria-label="演示观测队列">
          <header>
            <div><h2>异常观测</h2><span>演示队列 {props.objects.length} / 数据集 {props.datasetRowCount.toLocaleString("zh-CN")}</span></div>
            <label className={styles.search}><Search size={15} /><input aria-label="搜索生产观测" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="观测编号或时间" /><Filter size={14} /></label>
            <div className={styles.filters}>
              <button type="button" data-active={status === "all"} onClick={() => setStatus("all")}>全部</button>
              <button type="button" data-active={status === "failed"} onClick={() => setStatus("failed")}>未通过</button>
              <button type="button" data-active={status === "passed"} onClick={() => setStatus("passed")}>通过</button>
            </div>
          </header>
          <div className={styles.queueRows}>{visibleObjects.map((item) => {
            const failed = text(item.payload.quality_label) === "fail";
            const itemMissing = sensors.filter((sensor) => item.payload[sensor] === "" || item.payload[sensor] == null).length;
            return (
              <button type="button" key={item.objectId} aria-pressed={item.objectId === props.selected.objectId} onClick={() => props.onSelect(item.objectId)}>
                <div><strong>{text(item.payload.wafer_id)}</strong><em data-fail={failed}>{failed ? "未通过" : "通过"}</em></div>
                <span>{text(item.payload.test_timestamp).slice(0, 16)}</span>
                <small>{itemMissing ? `${itemMissing} 个通道缺失` : "12 个通道有值"}</small>
              </button>
            );
          })}</div>
          <footer>
            <button type="button" aria-label="上一页演示观测" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={16} /></button>
            <span>第 {safePage} / {pageCount} 页</span>
            <button type="button" aria-label="下一页演示观测" disabled={safePage >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}><ChevronRight size={16} /></button>
          </footer>
        </aside>

        <section className={styles.workspace}>
          <section className={styles.focus} aria-label="当前通道证据" data-missing={focusedIsMissing}>
            <header>
              <div><span>当前通道</span><h2>{focusedSensor}</h2></div>
              <strong data-missing={focusedIsMissing}>{focusedIsMissing ? "当前记录：缺失" : `当前原值：${format(row[focusedSensor])}`}</strong>
              <small>{text(row.wafer_id)} · {text(row.test_timestamp)}</small>
            </header>
            <div className={styles.focusGrid}>
              <div className={styles.coverageRing} style={{ "--coverage": `${coverageRate}%` } as CSSProperties}>
                <div><strong>{coverageRate.toFixed(1)}%</strong><span>覆盖率</span></div>
              </div>
              <dl className={styles.focusFacts}>
                <div><dt>全局缺失</dt><dd>{focusedMissingRows.toLocaleString("zh-CN")}</dd></div>
                <div><dt>有值记录</dt><dd>{focusedAvailableRows.toLocaleString("zh-CN")}</dd></div>
                <div><dt>关联排序</dt><dd>第 {rankBySensor.get(focusedSensor) ?? "—"} 位</dd></div>
                <div><dt>当前动作</dt><dd>{selectedChannels.includes(focusedSensor) ? "已列入复测" : "仅查看"}</dd></div>
              </dl>
              <div className={styles.truthCard}>
                <ShieldAlert size={24} />
                <div><strong>关联排序不等于根因</strong><p>通道没有设备、工序、单位和控制限映射。高缺失率会影响比较，只能形成复测申请。</p></div>
              </div>
            </div>
          </section>

          <section className={styles.matrix} aria-label="通道覆盖矩阵">
            <header><div><h2>12 个匿名通道</h2><span>点击通道可查看并加入或移出复测</span></div><strong>已选 {selectedChannels.length}</strong></header>
            <div>{sensors.map((sensor) => {
              const selectedChannel = selectedChannels.includes(sensor);
              const missing = row[sensor] === "" || row[sensor] == null;
              const missingRows = missingBySensor.get(sensor) ?? 0;
              const rate = props.datasetRowCount ? ((props.datasetRowCount - missingRows) / props.datasetRowCount) * 100 : 0;
              return (
                <button
                  type="button"
                  key={sensor}
                  aria-label={selectedChannel ? `从复测中移除 ${sensor}` : `将 ${sensor} 列入复测`}
                  aria-pressed={selectedChannel}
                  data-focused={focusedSensor === sensor}
                  data-missing={missing}
                  onClick={() => toggleChannel(sensor)}
                >
                  <span>{sensor.replace("sensor_", "")}</span>
                  {missing ? <AlertTriangle size={17} /> : <Check size={17} />}
                  <strong>{rate.toFixed(1)}%</strong>
                </button>
              );
            })}</div>
          </section>

          <section className={styles.context}>
            <div><Database size={18} /><span>公开数据</span><strong>UCI SECOM 固定切片</strong></div>
            <div><FileCheck2 size={18} /><span>当前观测</span><strong>{text(row.wafer_id)} · {text(row.quality_label) === "fail" ? "未通过" : "通过"}</strong></div>
            <div><ShieldCheck size={18} /><span>动作上限</span><strong>不能自动报废或放行</strong></div>
          </section>
        </section>

        <aside className={styles.flow} aria-label="复测任务流程">
          <header>
            <div><FileCheck2 size={20} /><h2>复测任务流程</h2></div>
            <span>{completed ? "四步已完成" : `已完成 ${steps.filter((step) => step.done).length} / 4`}</span>
          </header>
          <ol className={styles.steps}>{steps.map((step, index) => (
            <li key={step.title} data-done={step.done} data-current={!step.done && steps.slice(0, index).every((item) => item.done)}>
              <b>{step.done ? <Check size={14} /> : index + 1}</b><div><strong>{step.title}</strong><span>{step.done ? "已完成" : "待处理"}</span></div>
            </li>
          ))}</ol>

          <section className={styles.taskSummary}>
            <div><span>观测编号</span><strong>{text(row.wafer_id)}</strong></div>
            <div><span>质量标签</span><strong data-alert={text(row.quality_label) === "fail"}>{text(row.quality_label) === "fail" ? "未通过" : "通过"}</strong></div>
            <div><span>复测任务</span><strong>{restoredTaskId || "尚未提交"}</strong></div>
            <div><span>当前状态</span><strong>{props.selected.state}</strong></div>
          </section>

          <section className={styles.form}>
            {[{ id: "preserve", label: "保留原始记录与质量标签" }, { id: "missing", label: "核对缺失通道与全局缺失量" }, { id: "manual", label: "确认复测结果仍需人工复核" }].map(({ id, label }) => (
              <label key={id} className={styles.checkRow}><input type="checkbox" checked={Boolean(checks[id])} onChange={(event) => setChecks((current) => ({ ...current, [id]: event.target.checked }))} /><i>{checks[id] ? <Check size={13} /> : null}</i><span>{label}</span></label>
            ))}
            <label className={styles.note}>复测说明<textarea aria-label="复测说明" value={note} onChange={(event) => setNote(event.target.value)} placeholder="说明要核对的匿名通道与缺失情况" /></label>
            <label className={styles.role}><UserRound size={15} /><span>当前操作角色</span><select aria-label="当前操作角色" value={props.actorRole} onChange={(event) => props.onActorRoleChange(event.target.value)}>{props.roles.map((role) => <option value={role} key={role}>{roleLabel(role)}</option>)}</select></label>
          </section>

          <section className={styles.actions}>{props.commands.length ? props.commands.map((command) => {
            const blocked = command.id === "request_retest"
              ? !requestReady
              : command.id === "release_batch" ? !supervisorReady || !hasPersistedRetest : command.id === "quarantine_batch" ? !supervisorReady : false;
            const title = command.id === "request_retest"
              ? "至少选择一个通道，并完成三项核对与六字说明"
              : command.id === "release_batch" ? "需由质量主管复核已保存的复测任务" : "需由质量主管填写继续隔离理由";
            return <button type="button" key={command.id} data-tone={command.tone} disabled={props.busy || blocked} title={blocked ? title : command.label} onClick={() => runCommand(command.id)}>{command.id === "quarantine_batch" ? <ShieldAlert size={16} /> : <ShieldCheck size={16} />}{props.busy ? "正在记录…" : command.label}</button>;
          }) : <p className={styles.finalState}>{confirmed ? "复测申请已确认" : props.selected.state}</p>}</section>

          <p className={styles.boundary}><ShieldCheck size={16} /><span>主管确认的是复测申请，不是复测结果。</span></p>
          {props.receipt ? <p className={styles.receipt} role="status">已保存：{props.receipt.event.fromState} → {props.receipt.event.toState}</p> : null}
          {props.error ? <p className={styles.error} role="alert">{props.error}<button type="button" onClick={() => props.onSelect(props.selected.objectId)}>刷新当前观测</button></p> : null}
        </aside>
      </section>

      <footer className={styles.statusbar}>
        <span>角色</span><strong>{roleLabel(props.actorRole)}</strong>
        <span>状态</span><strong>{props.selected.state} · v{props.selected.version}</strong>
        <span>复测通道</span><strong>{selectedChannels.length} 个</strong>
        <span>任务编号</span><strong>{restoredTaskId || "尚未提交"}</strong>
        <em>数据没有设备、工序、单位或空间坐标映射</em>
      </footer>
    </main>
  );
}
