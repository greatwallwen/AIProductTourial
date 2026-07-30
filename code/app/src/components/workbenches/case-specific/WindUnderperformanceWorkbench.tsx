"use client";

import {
  AlertCircle,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Database,
  FileWarning,
  Gauge,
  LocateFixed,
  RefreshCw,
  ShieldCheck,
  UserRoundCheck,
  Wind,
  Wrench,
} from "lucide-react";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { MetricCards, ReceiptNote, WorkbenchFrame } from "./WorkbenchFrame";
import styles from "./WindUnderperformanceWorkbench.module.css";
import type { CaseWorkbenchProps } from "./types";

const REASON_PREFIX = "wind-field-check:";

const reviewOptions = [
  "核对 SCADA 风速与功率完整性",
  "补充同群基线",
  "核对限电指令",
  "补充告警与维修结果",
] as const;

const evidenceKinds = [
  { id: "peer_baseline", label: "同群基线", refField: "peerBaselineRef", check: "补充同群基线" },
  { id: "curtailment_order", label: "限电指令", refField: "curtailmentOrderRef", check: "核对限电指令" },
  { id: "alarm_log", label: "告警记录", refField: "alarmLogRef", check: "补充告警与维修结果" },
  { id: "maintenance_result", label: "维修结果", refField: "maintenanceResultRef", check: "补充告警与维修结果" },
] as const;

type EvidenceStatus = "missing" | "requested" | "returned" | "verified";
type EvidenceKind = (typeof evidenceKinds)[number]["id"];

const evidenceStatusLabels: Record<EvidenceStatus, string> = {
  missing: "未提供",
  requested: "已申请",
  returned: "已回传",
  verified: "已核对",
};

type FieldInspection = {
  inspectorId: string;
  observedShift: string;
  peerBaselineRef: string;
  curtailmentOrderRef: string;
  alarmLogRef: string;
  maintenanceResultRef: string;
  finding: string;
};

type ReviewDraft = {
  turbineId: string;
  scope: "seven_operating_days";
  checks: string[];
  note: string;
  actorRole?: string;
  command?: string;
};

type FieldCheckTask = {
  aggregateType?: string;
  investigationId?: string;
  turbineId?: string;
  taskVersion?: number;
  request?: {
    requesterId?: string;
    assigneeId?: string;
    expectedShift?: string;
    checks?: string[];
    note?: string;
    status?: string;
  };
  evidence?: Partial<Record<EvidenceKind, { status?: EvidenceStatus; reference?: string }>>;
  fieldInspection?: Partial<FieldInspection> & { status?: string };
  supervisorConfirmation?: {
    supervisorId?: string;
    decision?: string;
    note?: string;
  };
};

function text(value: unknown, fallback = "—"): string {
  return value == null || value === "" ? fallback : String(value);
}

function numeric(value: unknown): number | undefined {
  if (value === "" || value == null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function restoredTask(props: CaseWorkbenchProps): FieldCheckTask {
  const fromEvents = props.events
    .filter((event) => event.objectId === props.selected.objectId)
    .reduce<Record<string, unknown>>((merged, event) => ({ ...merged, ...record(event.data) }), {});
  return {
    ...fromEvents,
    ...record(props.selected.task),
    ...record(props.receipt?.event.data),
  } as FieldCheckTask;
}

function inspectionFrom(value: unknown): FieldInspection {
  const source = record(value);
  return {
    inspectorId: text(source.inspectorId, ""),
    observedShift: text(source.observedShift, ""),
    peerBaselineRef: text(source.peerBaselineRef, ""),
    curtailmentOrderRef: text(source.curtailmentOrderRef, ""),
    alarmLogRef: text(source.alarmLogRef, ""),
    maintenanceResultRef: text(source.maintenanceResultRef, ""),
    finding: text(source.finding, ""),
  };
}

function formattedNumber(value: unknown, digits = 1): string {
  const parsed = numeric(value);
  return parsed == null
    ? "—"
    : parsed.toLocaleString("zh-CN", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });
}

function turbineKey(value: unknown): string {
  const source = text(value, "").replace(/^T/i, "");
  const parsed = Number(source);
  return Number.isFinite(parsed) ? String(parsed) : source;
}

function turbineLabel(value: unknown): string {
  const key = turbineKey(value);
  const parsed = Number(key);
  return Number.isFinite(parsed) ? `T${String(parsed).padStart(3, "0")}` : `T${key}`;
}

function isMarked(value: unknown): boolean {
  return numeric(value) === 1;
}

function average(rows: Record<string, unknown>[], field: string): number | undefined {
  const values = rows
    .map((row) => numeric(row[field]))
    .filter((value): value is number => value != null);
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : undefined;
}

function coverage(rows: Record<string, unknown>[], field: string): { valid: number; total: number; rate: number } {
  const total = rows.reduce((sum, row) => sum + (numeric(row.source_records) ?? 0), 0);
  const valid = rows.reduce((sum, row) => sum + (numeric(row[field]) ?? 0), 0);
  return { valid, total, rate: total ? (valid / total) * 100 : 0 };
}

function linePoints(rows: Record<string, unknown>[], field: string): Array<{ x: number; y: number }> {
  const values = rows.map((row) => numeric(row[field]));
  const present = values.filter((value): value is number => value != null);
  if (!present.length) return [];
  const minimum = Math.min(...present);
  const range = Math.max(...present) - minimum || 1;
  return values.map((value, index) => ({
    x: 5 + (index / Math.max(1, values.length - 1)) * 90,
    y: value == null ? 88 : 84 - ((value - minimum) / range) * 68,
  }));
}

function parseDraft(reason: unknown): ReviewDraft | undefined {
  const source = text(reason, "");
  if (!source.startsWith(REASON_PREFIX)) return undefined;
  try {
    const parsed = JSON.parse(source.slice(REASON_PREFIX.length)) as Partial<ReviewDraft>;
    if (parsed.scope !== "seven_operating_days" || !Array.isArray(parsed.checks)) return undefined;
    return {
      turbineId: text(parsed.turbineId, ""),
      scope: "seven_operating_days",
      checks: parsed.checks.map((item) => String(item)),
      note: text(parsed.note, ""),
      actorRole: parsed.actorRole,
      command: parsed.command,
    };
  } catch {
    return undefined;
  }
}

function defaultDraft(turbineId: string): ReviewDraft {
  return {
    turbineId,
    scope: "seven_operating_days",
    checks: [...reviewOptions],
    note: "现场核对功率测量链路、运行约束与机组状态。",
  };
}

export function WindUnderperformanceWorkbench(props: CaseWorkbenchProps) {
  const selectedRow = props.selected.payload;
  const selectedKey = turbineKey(selectedRow.turbine_id);
  const selectedLabel = turbineLabel(selectedRow.turbine_id);

  const operatingRows = useMemo(() => {
    const rows = props.sceneRows
      .filter((row) => turbineKey(row.turbine_id) === selectedKey)
      .sort((left, right) => (numeric(left.day) ?? 0) - (numeric(right.day) ?? 0));
    return (rows.length ? rows : [selectedRow]).slice(0, 7);
  }, [props.sceneRows, selectedKey, selectedRow]);

  const locations = useMemo(() => {
    const source = props.supportingArtifacts["turbine-locations.csv"] ?? props.sceneRows;
    const unique = new Map<string, Record<string, unknown>>();
    for (const row of source) {
      const key = turbineKey(row.turbine_id);
      if (key && !unique.has(key) && numeric(row.turbine_x) != null && numeric(row.turbine_y) != null) {
        unique.set(key, row);
      }
    }
    return [...unique.values()].sort(
      (left, right) => (numeric(left.turbine_id) ?? 0) - (numeric(right.turbine_id) ?? 0),
    );
  }, [props.sceneRows, props.supportingArtifacts]);

  const markedTurbines = useMemo(() => {
    const keys = new Set<string>();
    for (const row of props.sceneRows) {
      if (isMarked(row.underperformance_share)) keys.add(turbineKey(row.turbine_id));
    }
    return keys;
  }, [props.sceneRows]);

  const objectByTurbine = useMemo(() => {
    const result = new Map<string, CaseWorkbenchProps["selected"]>();
    for (const object of props.objects) {
      const key = turbineKey(object.payload.turbine_id);
      const previous = result.get(key);
      if (!previous || (numeric(object.payload.day) ?? 999) < (numeric(previous.payload.day) ?? 999)) {
        result.set(key, object);
      }
    }
    return result;
  }, [props.objects]);

  const persisted = useMemo(() => {
    const event = [...props.events]
      .reverse()
      .find((item) => item.objectId === props.selected.objectId && parseDraft(item.reason));
    return parseDraft(event?.reason);
  }, [props.events, props.selected.objectId]);
  const persistedSignature = JSON.stringify(persisted ?? null);
  const task = useMemo(() => restoredTask(props), [props.events, props.receipt, props.selected.objectId, props.selected.task]);
  const taskSignature = JSON.stringify(task);
  const restoredRequest = task.request ?? {};
  const restoredInspection = inspectionFrom(task.fieldInspection);

  const [draft, setDraft] = useState<ReviewDraft>(() => persisted ?? defaultDraft(selectedKey));
  const [requesterId, setRequesterId] = useState(text(restoredRequest.requesterId, "reliability-engineer-01"));
  const [assigneeId, setAssigneeId] = useState(text(restoredRequest.assigneeId, "field-team-01"));
  const [expectedShift, setExpectedShift] = useState(text(restoredRequest.expectedShift, "下一运行班"));
  const [inspection, setInspection] = useState<FieldInspection>(restoredInspection);
  const [supervisorId, setSupervisorId] = useState(text(task.supervisorConfirmation?.supervisorId, "supervisor-01"));
  const [supervisorNote, setSupervisorNote] = useState(text(task.supervisorConfirmation?.note, ""));

  useEffect(() => {
    const requestDraft = restoredRequest.checks?.length
      ? {
          turbineId: selectedKey,
          scope: "seven_operating_days" as const,
          checks: restoredRequest.checks,
          note: text(restoredRequest.note, ""),
        }
      : undefined;
    setDraft(requestDraft ?? persisted ?? defaultDraft(selectedKey));
    setRequesterId(text(restoredRequest.requesterId, "reliability-engineer-01"));
    setAssigneeId(text(restoredRequest.assigneeId, "field-team-01"));
    setExpectedShift(text(restoredRequest.expectedShift, "下一运行班"));
    setInspection(inspectionFrom(task.fieldInspection));
    setSupervisorId(text(task.supervisorConfirmation?.supervisorId, "supervisor-01"));
    setSupervisorNote(text(task.supervisorConfirmation?.note, ""));
  }, [persistedSignature, selectedKey, taskSignature]);

  const underperformanceDays = operatingRows.filter((row) => isMarked(row.underperformance_share)).length;
  const windCoverage = coverage(operatingRows, "valid_wind_records");
  const powerCoverage = coverage(operatingRows, "valid_power_records");
  const windPoints = linePoints(operatingRows, "mean_wind_speed");
  const powerPoints = linePoints(operatingRows, "mean_active_power");
  const xValues = locations.map((row) => numeric(row.turbine_x) ?? 0);
  const yValues = locations.map((row) => numeric(row.turbine_y) ?? 0);
  const minX = xValues.length ? Math.min(...xValues) : 0;
  const maxX = xValues.length ? Math.max(...xValues) : 1;
  const minY = yValues.length ? Math.min(...yValues) : 0;
  const maxY = yValues.length ? Math.max(...yValues) : 1;
  const hasRequest = restoredRequest.status === "requested"
    || restoredRequest.status === "returned"
    || props.selected.state === "现场核查中"
    || props.selected.state === "现场核查已提交";
  const inspectionComplete = Boolean(
    inspection.inspectorId.trim()
    && inspection.observedShift.trim()
    && inspection.finding.trim().length >= 6
    && evidenceKinds.every((item) => inspection[item.refField].trim()),
  );
  const requestReady = Boolean(
    props.actorRole === "reliability_engineer"
    && requesterId.trim()
    && assigneeId.trim()
    && requesterId.trim() !== assigneeId.trim()
    && expectedShift.trim()
    && draft.checks.length > 0
    && draft.note.trim().length >= 6,
  );
  const confirmationReady = Boolean(
    props.actorRole === "supervisor"
    && hasRequest
    && inspectionComplete
    && supervisorId.trim()
    && supervisorId.trim() !== requesterId.trim()
    && supervisorId.trim() !== inspection.inspectorId.trim()
    && supervisorNote.trim().length >= 6,
  );
  const holdReady = Boolean(props.actorRole === "supervisor" && draft.note.trim().length >= 6);
  const evidenceStatus = Object.fromEntries(evidenceKinds.map((item) => {
    const restored = task.evidence?.[item.id];
    const reference = inspection[item.refField].trim() || text(restored?.reference, "");
    let status: EvidenceStatus = restored?.status ?? (hasRequest ? "requested" : "missing");
    if (reference) status = "returned";
    if (props.selected.state === "现场核查已提交" || task.supervisorConfirmation?.decision === "confirm") status = "verified";
    return [item.id, { status, reference }];
  })) as Record<EvidenceKind, { status: EvidenceStatus; reference: string }>;

  function selectTurbine(key: string) {
    const object = objectByTurbine.get(key);
    props.onSelect(object?.objectId ?? `16-${key}-1`);
  }

  function toggleCheck(option: string) {
    setDraft((current) => ({
      ...current,
      checks: current.checks.includes(option)
        ? current.checks.filter((item) => item !== option)
        : [...current.checks, option],
    }));
  }

  function runCommand(command: string) {
    if (command === "submit_field_check" && !requestReady) return;
    if (command === "schedule_maintenance" && !confirmationReady) return;
    if (command === "hold_attribution" && !holdReady) return;
    const reason: ReviewDraft = {
      ...draft,
      turbineId: selectedKey,
      scope: "seven_operating_days",
      actorRole: props.actorRole,
      command,
    };
    const request = {
      requestId: `WIND-CHECK-${selectedKey}`,
      requesterId: requesterId.trim(),
      assigneeId: assigneeId.trim(),
      expectedShift: expectedShift.trim(),
      scope: "seven_operating_days",
      checks: draft.checks,
      note: draft.note.trim(),
      status: command === "submit_field_check" ? "requested" : inspectionComplete ? "returned" : text(restoredRequest.status, "requested"),
    };
    const evidence = Object.fromEntries(evidenceKinds.map((item) => {
      const current = evidenceStatus[item.id];
      const status: EvidenceStatus = command === "submit_field_check"
        ? draft.checks.includes(item.check) ? "requested" : "missing"
        : command === "schedule_maintenance" ? "verified" : current.status;
      return [item.id, { status, reference: current.reference || undefined }];
    }));
    const data: Record<string, unknown> = {
      aggregateType: "wind_underperformance_investigation",
      investigationId: `WIND-INV-${selectedKey}`,
      taskVersion: props.selected.version + 1,
      turbineId: selectedKey,
      operatingWindow: {
        scope: "seven_operating_days",
        dayIds: operatingRows.map((row) => text(row.day)),
        underperformanceDays,
        windCoverage: { valid: windCoverage.valid, total: windCoverage.total },
        powerCoverage: { valid: powerCoverage.valid, total: powerCoverage.total },
      },
      request,
      evidence,
      decision: command === "submit_field_check" ? "request_field_inspection" : command === "schedule_maintenance" ? "confirm_field_inspection" : "hold_for_evidence",
      serverValidationRequired: true,
    };
    if (inspectionComplete || command === "schedule_maintenance") data.fieldInspection = { ...inspection, status: "returned" };
    if (command === "schedule_maintenance") {
      data.supervisorConfirmation = {
        supervisorId: supervisorId.trim(),
        decision: "confirm",
        note: supervisorNote.trim() || draft.note.trim(),
      };
    }
    props.onCommand(command, `${REASON_PREFIX}${JSON.stringify(reason)}`, {
      actorId: command === "submit_field_check" ? requesterId.trim() : supervisorId.trim(),
      data,
      evidenceIds: [
        `wind-window:${selectedKey}:days-${operatingRows.map((row) => text(row.day)).join("-")}`,
        ...evidenceKinds.flatMap((item) => evidenceStatus[item.id].reference ? [`evidence:${item.id}:${evidenceStatus[item.id].reference}`] : []),
      ],
      idempotencyKey: `case-B016:turbine:${selectedKey}:${command}:v${props.selected.version}`,
    });
  }

  const frameProps: CaseWorkbenchProps = { ...props, commands: [], onCommand: runCommand };
  const workflowStep = props.selected.state === "现场核查已提交" ? 4 : hasRequest ? 3 : 2;

  return (
    <WorkbenchFrame
      props={frameProps}
      kicker="新能源 · 七日运行调查"
      title="风机出力下偏核查"
      subtitle={`${selectedLabel} 被指定为核查对象；七日数据用于发起调查，不用于判定故障或安排维修。`}
      tone="wind"
    >
      <MetricCards items={[
        { label: "核查对象", value: selectedLabel, note: "课程指定对象，并非最差机组" },
        { label: "日级下偏标记", value: `${underperformanceDays} / ${operatingRows.length} 个运行日`, note: "0 / 1 标记，不是概率", tone: "alert" },
        { label: "风速有效记录", value: `${formattedNumber(windCoverage.valid, 0)} / ${formattedNumber(windCoverage.total, 0)}`, note: `${formattedNumber(windCoverage.rate, 2)}%` },
        { label: "功率有效记录", value: `${formattedNumber(powerCoverage.valid, 0)} / ${formattedNumber(powerCoverage.total, 0)}`, note: `${formattedNumber(powerCoverage.rate, 2)}%` },
      ]} />

      <div className={styles.workspace}>
        <aside className={styles.locator} aria-label="风机筛选与选择">
          <header className={styles.panelTitle}>
            <span><LocateFixed aria-hidden="true" size={18} />相对位置选机</span>
            <b>{locations.length || 134} 台</b>
          </header>

          <label className={styles.turbineSelect}>
            <span>当前机组</span>
            <select aria-label="选择风机" value={selectedKey} onChange={(event) => selectTurbine(event.target.value)}>
              {(locations.length ? locations.map((row) => turbineKey(row.turbine_id)) : [...objectByTurbine.keys()]).map((key) => (
                <option key={key} value={key}>{turbineLabel(key)}</option>
              ))}
            </select>
          </label>

          <section className={styles.relativeField} aria-label="风机相对坐标示意">
            <div className={styles.axisX}><span>相对 X</span></div>
            <div className={styles.axisY}><span>相对 Y</span></div>
            {locations.map((row) => {
              const x = numeric(row.turbine_x) ?? minX;
              const y = numeric(row.turbine_y) ?? minY;
              const key = turbineKey(row.turbine_id);
              const selected = key === selectedKey;
              const style = {
                "--x": `${7 + ((x - minX) / Math.max(1, maxX - minX)) * 86}%`,
                "--y": `${8 + ((maxY - y) / Math.max(1, maxY - minY)) * 82}%`,
              } as CSSProperties;
              return (
                <button
                  type="button"
                  aria-label={`打开 ${turbineLabel(key)} 的首个运行日`}
                  className={`${styles.turbine} wind-relative-field__turbine`}
                  data-marked={markedTurbines.has(key)}
                  data-selected={selected}
                  key={key}
                  onClick={() => selectTurbine(key)}
                  style={style}
                  title={`${turbineLabel(key)} · 相对坐标 (${formattedNumber(x, 1)}, ${formattedNumber(y, 1)})`}
                >
                  <span />
                  {selected ? <b>{selectedLabel}</b> : null}
                </button>
              );
            })}
            <div className={styles.legend}>
              <span><i />公开位置</span>
              <span><i data-tone="marked" />含标记</span>
              <span><i data-tone="selected" />当前对象</span>
            </div>
            {!locations.length ? (
              <div className={styles.locationFallback}>
                <p>相对位置文件尚未载入，可先从已载入对象继续。</p>
                {[...objectByTurbine.entries()].map(([key, object]) => (
                  <button type="button" key={key} onClick={() => props.onSelect(object.objectId)}>打开 {turbineLabel(key)}</button>
                ))}
              </div>
            ) : null}
          </section>

          <section className={styles.selectedCard}>
            <div><span>调查单</span><strong>WIND-INV-{selectedKey}</strong></div>
            <div><span>窗口</span><strong>运行日 1—7</strong></div>
            <p>相对坐标，不是真实地图</p>
          </section>
        </aside>

        <section className={styles.evidenceStage} aria-label={`${selectedLabel} 七日调查证据`}>
          <header className={styles.stageHeader}>
            <div>
              <span>七日调查单</span>
              <h2>{selectedLabel} · 运行日 1—7</h2>
              <p>两个指标采用独立量纲展示；不能把风速与功率曲线的高度直接比较。</p>
            </div>
            <div className={styles.coverageBadge}><Database size={17} /><span>数据覆盖<strong>{formattedNumber(Math.min(windCoverage.rate, powerCoverage.rate), 2)}%</strong></span></div>
          </header>

          <EvidenceBand
            label="平均风速"
            unit="m/s"
            tone="wind"
            averageValue={formattedNumber(average(operatingRows, "mean_wind_speed"), 3)}
            field="mean_wind_speed"
            rows={operatingRows}
            points={windPoints}
          />
          <EvidenceBand
            label="平均有功功率"
            unit="kW"
            tone="power"
            averageValue={formattedNumber(average(operatingRows, "mean_active_power"), 3)}
            field="mean_active_power"
            rows={operatingRows}
            points={powerPoints}
          />

          <section className={styles.dayLedger} aria-label="七个运行日明细">
            {operatingRows.map((row, index) => (
              <article key={`${text(row.day)}-${index}`} data-marked={isMarked(row.underperformance_share)}>
                <header><span>运行日 {text(row.day)}</span><b>标记 {isMarked(row.underperformance_share) ? "1" : "0"}</b></header>
                <p><strong>{formattedNumber(row.mean_wind_speed, 3)}</strong> m/s</p>
                <p><strong>{formattedNumber(row.mean_active_power, 3)}</strong> kW</p>
              </article>
            ))}
          </section>

          <section className={styles.boundary}>
            <ShieldCheck aria-hidden="true" size={19} />
            <div><span>下偏不等于故障</span><strong>日级标记，不是故障概率</strong><p>当前数据只能说明七个运行日均出现下偏标记。是否存在设备问题，必须等待同群、限电、告警和维修记录。</p></div>
          </section>
        </section>

        <aside className={styles.workflow} aria-label="出力下偏核查案卷">
          <header className={styles.panelTitle}>
            <span><ClipboardCheck aria-hidden="true" size={18} />核查进度</span>
            <b>步骤 {workflowStep} / 4</b>
          </header>

          <ol className={styles.steps}>
            <li data-state="done"><b>1</b><span><strong>发现标记</strong><small>已锁定七日窗口</small></span><Check size={15} /></li>
            <li data-state={workflowStep >= 2 ? "active" : undefined}><b>2</b><span><strong>发起现场核查</strong><small>{hasRequest ? "任务已发出" : "补齐负责人和调取项"}</small></span>{hasRequest ? <Check size={15} /> : <Gauge size={15} />}</li>
            <li data-state={workflowStep >= 3 ? "active" : undefined}><b>3</b><span><strong>回传四类记录</strong><small>{inspectionComplete ? "回传已齐" : "等待现场回执"}</small></span>{inspectionComplete ? <Check size={15} /> : <FileWarning size={15} />}</li>
            <li data-state={workflowStep >= 4 ? "done" : undefined}><b>4</b><span><strong>主管收件</strong><small>只确认材料完整</small></span>{workflowStep >= 4 ? <Check size={15} /> : <ShieldCheck size={15} />}</li>
          </ol>

          <section className={styles.evidenceList} aria-label="四类待调取资料">
            {evidenceKinds.map((item) => (
              <div key={item.id} data-state={evidenceStatus[item.id].status}>
                <span>{item.label}</span><b>{evidenceStatusLabels[evidenceStatus[item.id].status]}</b>
              </div>
            ))}
          </section>

          <section className={styles.currentAction} aria-label="当前核查步骤">
            <header>
              {props.actorRole === "supervisor" ? <UserRoundCheck size={18} /> : <Gauge size={18} />}
              <div><span>当前操作</span><strong>{props.actorRole === "supervisor" ? (hasRequest ? "核对回传并收件" : "等待材料或请求补充") : "发起现场核查"}</strong></div>
            </header>

            {props.actorRole === "reliability_engineer" ? (
              <fieldset className={styles.form}>
                <legend>调查任务</legend>
                <div className={styles.fieldGrid}>
                  <Field label="发起人" htmlFor="wind-requester"><input id="wind-requester" aria-label="现场核查发起人" value={requesterId} onChange={(event) => setRequesterId(event.target.value)} /></Field>
                  <Field label="现场负责人" htmlFor="wind-assignee"><input id="wind-assignee" aria-label="现场核查负责人" value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)} /></Field>
                </div>
                <Field label="预计回传班次" htmlFor="wind-shift"><input id="wind-shift" aria-label="预计回传班次" value={expectedShift} onChange={(event) => setExpectedShift(event.target.value)} /></Field>
                <div className={styles.checkGrid}>
                  {reviewOptions.map((option) => (
                    <label key={option}><input aria-label={option} type="checkbox" checked={draft.checks.includes(option)} onChange={() => toggleCheck(option)} /><span>{option}</span></label>
                  ))}
                </div>
                <Field label="现场说明" htmlFor="wind-note"><textarea id="wind-note" aria-label="现场核查说明" rows={2} value={draft.note} onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))} /></Field>
                {(persisted || hasRequest) ? <p className={styles.restored}><RefreshCw size={14} />{persisted ? "已从最近一次核查事件恢复说明" : "已恢复最近一次核查任务"}</p> : null}
              </fieldset>
            ) : hasRequest ? (
              <fieldset className={styles.form}>
                <legend>现场回传与主管收件</legend>
                <div className={styles.fieldGrid}>
                  <Field label="核查发起人" htmlFor="wind-requester-context"><input id="wind-requester-context" aria-label="现场核查发起人" value={requesterId} readOnly /></Field>
                  <Field label="现场负责人" htmlFor="wind-assignee-context"><input id="wind-assignee-context" aria-label="现场核查负责人" value={assigneeId} readOnly /></Field>
                  <Field label="现场人员" htmlFor="wind-inspector"><input id="wind-inspector" aria-label="现场检查人员" value={inspection.inspectorId} onChange={(event) => setInspection((current) => ({ ...current, inspectorId: event.target.value }))} /></Field>
                  <Field label="检查班次" htmlFor="wind-observed-shift"><input id="wind-observed-shift" aria-label="现场检查班次" value={inspection.observedShift} onChange={(event) => setInspection((current) => ({ ...current, observedShift: event.target.value }))} /></Field>
                  {evidenceKinds.map((item) => <Field label={`${item.label}回执`} htmlFor={`wind-${item.id}`} key={item.id}><input id={`wind-${item.id}`} aria-label={`${item.label}回执`} value={inspection[item.refField]} onChange={(event) => setInspection((current) => ({ ...current, [item.refField]: event.target.value }))} /></Field>)}
                </div>
                <Field label="现场发现" htmlFor="wind-finding"><textarea id="wind-finding" aria-label="现场检查发现" rows={2} value={inspection.finding} onChange={(event) => setInspection((current) => ({ ...current, finding: event.target.value }))} /></Field>
                <div className={styles.fieldGrid}>
                  <Field label="主管账号" htmlFor="wind-supervisor"><input id="wind-supervisor" aria-label="核查主管账号" value={supervisorId} onChange={(event) => setSupervisorId(event.target.value)} /></Field>
                  <Field label="确认说明" htmlFor="wind-supervisor-note"><input id="wind-supervisor-note" aria-label="主管确认说明" value={supervisorNote} onChange={(event) => setSupervisorNote(event.target.value)} /></Field>
                </div>
              </fieldset>
            ) : (
              <fieldset className={styles.form}>
                <legend>补充材料说明</legend>
                <Field label="现场核查说明" htmlFor="wind-hold-note"><textarea id="wind-hold-note" aria-label="现场核查说明" rows={3} value={draft.note} onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))} /></Field>
                <p className={styles.hint}>尚未生成现场任务，主管不能确认收件，只能请求补充材料。</p>
              </fieldset>
            )}

            <div className={styles.actions} role="region" aria-label="核查任务动作" data-sticky-actions="false">
              {props.commands.map((command) => {
                const blocked = command.id === "submit_field_check" ? !requestReady : command.id === "schedule_maintenance" ? !confirmationReady : command.id === "hold_attribution" ? !holdReady : true;
                return (
                  <button type="button" key={command.id} data-tone={command.tone} disabled={props.busy || blocked} title={blocked ? "请补齐当前步骤的必填信息和角色条件" : undefined} onClick={() => runCommand(command.id)}>
                    {command.id === "schedule_maintenance" ? <CheckCircle2 size={17} /> : <Wrench size={17} />}
                    {props.busy ? "正在记录…" : command.label}
                  </button>
                );
              })}
            </div>
          </section>

          {props.error ? (
            <section className={styles.recovery} aria-label="错误恢复">
              <AlertCircle aria-hidden="true" size={18} />
              <div><strong>提交未完成</strong><p>{props.error}</p><button type="button" onClick={() => props.onSelect(props.selected.objectId)}><RefreshCw size={15} />重新载入 {selectedLabel}</button></div>
            </section>
          ) : null}
          <ReceiptNote props={props} />
        </aside>
      </div>
    </WorkbenchFrame>
  );
}

function EvidenceBand({
  label,
  unit,
  tone,
  averageValue,
  field,
  rows,
  points,
}: {
  label: string;
  unit: string;
  tone: "wind" | "power";
  averageValue: string;
  field: string;
  rows: Record<string, unknown>[];
  points: Array<{ x: number; y: number }>;
}) {
  return (
    <section className={styles.evidenceBand} data-tone={tone}>
      <header><div><span>{label}</span><strong>{averageValue} <small>{unit}</small></strong></div><em>七日平均</em></header>
      <div className={styles.chart}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`${label}七日趋势，单位 ${unit}`}>
          {[20, 42, 64, 86].map((y) => <line key={y} x1="4" x2="96" y1={y} y2={y} />)}
          <polyline points={points.map((point) => `${point.x},${point.y}`).join(" ")} />
          {points.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="1.45" />)}
        </svg>
        <div className={styles.chartValues}>{rows.map((row, index) => <span key={index}><b>{formattedNumber(row[field], 2)}</b><small>日 {text(row.day)}</small></span>)}</div>
      </div>
    </section>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return <label className={styles.field} htmlFor={htmlFor}><span>{label}</span>{children}</label>;
}
