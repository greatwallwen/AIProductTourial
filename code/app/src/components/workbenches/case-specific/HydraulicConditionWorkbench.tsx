"use client";

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardCheck,
  Droplets,
  Fan,
  Gauge,
  Info,
  RefreshCw,
  ShieldCheck,
  UserRound,
  Waves,
  Wrench,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { SceneErrorBoundary } from "../../spatial/SceneErrorBoundary";
import styles from "./HydraulicConditionWorkbench.module.css";
import taskStyles from "./HydraulicConditionWorkbenchTask.module.css";
import v3Styles from "./HydraulicConditionWorkbenchV3.module.css";
import type { CaseWorkbenchProps } from "./types";

const HydraulicPowerUnitScene = dynamic(
  () => import("../../spatial/HydraulicPowerUnitScene"),
  { ssr: false, loading: () => null },
);

const componentDefinitions = [
  { key: "pump", label: "泵", state: "pump_state", severity: "pump_severity", condition: "pump_condition", x: 31, y: 59, icon: Droplets },
  { key: "valve", label: "比例阀", state: "valve_state", severity: "valve_severity", condition: "valve_condition", x: 51, y: 39, icon: Gauge },
  { key: "cooler", label: "冷却器", state: "cooler_state", severity: "cooler_severity", condition: "cooler_condition", x: 25, y: 22, icon: Fan },
  { key: "accumulator", label: "蓄能器", state: "accumulator_state", severity: "accumulator_severity", condition: "accumulator_condition", x: 66, y: 68, icon: Activity },
] as const;

type ComponentKey = (typeof componentDefinitions)[number]["key"];
type InspectionOrderItem = {
  component: ComponentKey;
  position: number;
  label: string;
  state: string;
  severity: string;
  conditionCode: string;
};
type HydraulicTask = {
  taskId?: string;
  cycleId?: string;
  focused?: ComponentKey;
  reviewed?: ComponentKey[];
  inspectionOrder?: InspectionOrderItem[];
  orderConfirmed?: boolean;
  evidenceBasis?: string[];
  owner?: string;
  dueAt?: string;
  reviewerId?: string;
  reviewNote?: string;
  supervisorId?: string;
  supervisorNote?: string;
  decision?: "confirmed";
};

const evidenceOptions = [
  ["cycle-condition-flags", "本循环部件状态", "四个部件的状态、等级与状态码"],
  ["sensor-trend-20", "最近 20 次循环趋势", "压力、流量、油温与振动变化"],
  ["component-state-model", "公开状态标注", "UCI 数据中的部件状态标签"],
] as const;

function text(value: unknown): string {
  return value == null || value === "" ? "—" : String(value);
}

function numeric(value: unknown): number | undefined {
  if (value === "" || value == null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function format(value: unknown, digits = 3): string {
  const parsed = numeric(value);
  return parsed == null
    ? "—"
    : parsed.toLocaleString("zh-CN", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function roleLabel(role: string): string {
  if (role === "reliability_engineer") return "可靠性工程师";
  if (role === "supervisor") return "维护主管";
  return role;
}

function isComponentKey(value: unknown): value is ComponentKey {
  return typeof value === "string" && componentDefinitions.some((item) => item.key === value);
}

function restoreTask(props: CaseWorkbenchProps): HydraulicTask {
  const eventData = props.events.reduce<HydraulicTask>(
    (current, event) => ({ ...current, ...(event.data ?? {}) }),
    {},
  );
  return { ...eventData, ...(props.selected.task ?? {}) } as HydraulicTask;
}

function defaultInspectionOrder(row: Record<string, unknown>): ComponentKey[] {
  return componentDefinitions
    .map((item, sourceIndex) => ({ key: item.key, sourceIndex, severity: severityRank(row[item.severity]) }))
    .sort((left, right) => right.severity - left.severity || left.sourceIndex - right.sourceIndex)
    .map((item) => item.key);
}

function validActorId(value: string): boolean {
  return value.length > 1 && value.length <= 80 && /^[\w.@-]+$/u.test(value);
}

function severityRank(value: unknown): number {
  const severity = text(value).toLowerCase();
  return severity === "critical" ? 3 : severity === "warning" ? 2 : severity === "normal" ? 1 : 0;
}

function linePoints(
  rows: Record<string, unknown>[],
  field: string,
  top: number,
  bottom: number,
): string {
  const values = rows.map((item) => numeric(item[field]));
  const present = values.filter((item): item is number => item != null);
  if (!present.length) return "";
  const minimum = Math.min(...present);
  const maximum = Math.max(...present);
  const span = maximum - minimum || 1;
  return values.map((value, index) => {
    const x = (index / Math.max(1, values.length - 1)) * 1000;
    const y = value == null ? (top + bottom) / 2 : bottom - ((value - minimum) / span) * (bottom - top);
    return `${x},${y}`;
  }).join(" ");
}

export function HydraulicConditionWorkbench(props: CaseWorkbenchProps) {
  const row = props.selected.payload;
  const restoredTask = useMemo(() => restoreTask(props), [props.events, props.selected.task]);
  const [focused, setFocused] = useState<ComponentKey>(isComponentKey(restoredTask.focused) ? restoredTask.focused : "pump");
  const [reviewed, setReviewed] = useState<ComponentKey[]>(restoredTask.reviewed?.filter(isComponentKey) ?? []);
  const [inspectionOrder, setInspectionOrder] = useState<ComponentKey[]>(restoredTask.inspectionOrder?.map((item) => item.component).filter(isComponentKey) ?? defaultInspectionOrder(row));
  const [orderConfirmed, setOrderConfirmed] = useState(Boolean(restoredTask.orderConfirmed));
  const [evidenceBasis, setEvidenceBasis] = useState<string[]>(restoredTask.evidenceBasis ?? []);
  const [owner, setOwner] = useState(restoredTask.owner ?? "");
  const [dueAt, setDueAt] = useState(restoredTask.dueAt ?? "");
  const [reviewerId, setReviewerId] = useState(restoredTask.reviewerId ?? "");
  const [note, setNote] = useState(restoredTask.reviewNote ?? "");
  const [supervisorId, setSupervisorId] = useState(restoredTask.supervisorId ?? "");
  const [supervisorNote, setSupervisorNote] = useState(restoredTask.supervisorNote ?? "");
  const [webglAvailable, setWebglAvailable] = useState(false);
  const [sceneMode, setSceneMode] = useState<"static-fallback" | "webgl">("static-fallback");
  const [sceneFailed, setSceneFailed] = useState(false);
  const [threeDRequested, setThreeDRequested] = useState(false);

  const componentRecords = useMemo(() => componentDefinitions.map((item, sourceIndex) => ({
    ...item,
    sourceIndex,
    stateValue: text(row[item.state]),
    severityValue: text(row[item.severity]),
    conditionValue: text(row[item.condition]),
  })), [row]);
  const components = useMemo(() => inspectionOrder
    .map((key) => componentRecords.find((item) => item.key === key))
    .filter((item): item is NonNullable<typeof item> => Boolean(item)), [componentRecords, inspectionOrder]);

  const sortedObjects = useMemo(() => [...props.objects]
    .sort((left, right) => (numeric(left.payload.cycle_id) ?? 0) - (numeric(right.payload.cycle_id) ?? 0)), [props.objects]);
  const selectableObjects = sortedObjects.some((item) => item.objectId === props.selected.objectId)
    ? sortedObjects
    : [props.selected, ...sortedObjects];
  const selectedIndex = selectableObjects.findIndex((item) => item.objectId === props.selected.objectId);
  const previousObject = selectedIndex > 0 ? selectableObjects[selectedIndex - 1] : undefined;
  const nextObject = selectedIndex >= 0 && selectedIndex < selectableObjects.length - 1
    ? selectableObjects[selectedIndex + 1]
    : undefined;

  const currentCycle = numeric(row.cycle_id) ?? Number.MAX_SAFE_INTEGER;
  const trendRows = useMemo(() => {
    const rows = props.sceneRows.length ? props.sceneRows : [row];
    return rows
      .filter((item) => (numeric(item.cycle_id) ?? Number.MAX_SAFE_INTEGER) <= currentCycle)
      .sort((left, right) => (numeric(left.cycle_id) ?? 0) - (numeric(right.cycle_id) ?? 0))
      .slice(-20);
  }, [currentCycle, props.sceneRows, row]);

  const affected = Math.max(1, numeric(row.affected_component_count) ?? 1);
  const requiredKeys = components.filter((item) => severityRank(item.severityValue) >= 2).map((item) => item.key);
  const reviewedRequired = requiredKeys.every((key) => reviewed.includes(key));
  const taskId = restoredTask.taskId ?? `HYD-${text(row.cycle_id)}-v1`;
  const inspectionOrderItems: InspectionOrderItem[] = components.map((item, index) => ({
    component: item.key,
    position: index + 1,
    label: item.label,
    state: item.stateValue,
    severity: item.severityValue,
    conditionCode: item.conditionValue,
  }));
  const taskPersisted = Boolean(restoredTask.taskId && restoredTask.inspectionOrder?.length);
  const taskConfirmed = props.selected.state === "检查顺序已确认";
  const submissionReady = reviewedRequired
    && reviewed.length >= affected
    && orderConfirmed
    && evidenceBasis.length >= 2
    && owner.trim().length >= 2
    && dueAt.length >= 16
    && validActorId(reviewerId.trim())
    && note.trim().length >= 6;
  const supervisorReady = taskPersisted
    && validActorId(supervisorId.trim())
    && supervisorNote.trim().length >= 6;
  const reviewedPriorityCount = reviewed.filter((key) => requiredKeys.includes(key)).length;
  const trendStart = text(trendRows[0]?.cycle_id);
  const trendEnd = text(trendRows.at(-1)?.cycle_id);

  useEffect(() => {
    setFocused(isComponentKey(restoredTask.focused) ? restoredTask.focused : "pump");
    setReviewed(restoredTask.reviewed?.filter(isComponentKey) ?? []);
    setInspectionOrder(restoredTask.inspectionOrder?.map((item) => item.component).filter(isComponentKey) ?? defaultInspectionOrder(row));
    setOrderConfirmed(Boolean(restoredTask.orderConfirmed));
    setEvidenceBasis(restoredTask.evidenceBasis ?? []);
    setOwner(restoredTask.owner ?? "");
    setDueAt(restoredTask.dueAt ?? "");
    setReviewerId(restoredTask.reviewerId ?? "");
    setNote(restoredTask.reviewNote ?? "");
    setSupervisorId(restoredTask.supervisorId ?? "");
    setSupervisorNote(restoredTask.supervisorNote ?? "");
  }, [props.selected.objectId, props.selected.version, restoredTask, row]);

  useEffect(() => {
    if (typeof window.WebGLRenderingContext === "undefined") return;
    try {
      const canvas = document.createElement("canvas");
      const supported = Boolean(
        canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: true })
        || canvas.getContext("webgl", { failIfMajorPerformanceCaveat: true }),
      );
      setWebglAvailable(supported);
    } catch {
      setWebglAvailable(false);
    }
  }, []);

  function inspectComponent(key: ComponentKey) {
    setFocused(key);
    setReviewed((current) => current.includes(key) ? current : [...current, key]);
  }

  function toggleEvidenceBasis(value: string) {
    setEvidenceBasis((current) => current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value]);
  }

  function moveComponent(key: ComponentKey, direction: -1 | 1) {
    setInspectionOrder((current) => {
      const source = current.indexOf(key);
      const target = source + direction;
      if (source < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[source], next[target]] = [next[target]!, next[source]!];
      return next;
    });
    setFocused(key);
    setOrderConfirmed(false);
  }

  function runCommand(command: string) {
    if (command === "submit_maintenance_review") {
      props.onCommand(command, note.trim(), {
        actorId: reviewerId.trim(),
        idempotencyKey: `hydraulic-check:${props.selected.objectId}:${props.selected.version}:submit`,
        evidenceIds: [
          `cycle:${text(row.cycle_id)}`,
          ...inspectionOrderItems.map((item) => `component:${item.component}:condition:${item.conditionCode}`),
          ...evidenceBasis.map((item) => `basis:${item}`),
        ],
        data: {
          taskId,
          cycleId: text(row.cycle_id),
          focused,
          reviewed,
          inspectionOrder: inspectionOrderItems,
          orderConfirmed,
          evidenceBasis,
          owner: owner.trim(),
          dueAt,
          reviewerId: reviewerId.trim(),
          reviewNote: note.trim(),
        },
      });
      return;
    }
    if (command === "confirm_check_order") {
      props.onCommand(command, supervisorNote.trim(), {
        actorId: supervisorId.trim(),
        idempotencyKey: `hydraulic-check:${props.selected.objectId}:${props.selected.version}:confirm`,
        evidenceIds: [`maintenance-task:${taskId}`, `cycle:${text(row.cycle_id)}`],
        data: {
          taskId,
          inspectionOrder: restoredTask.inspectionOrder ?? inspectionOrderItems,
          supervisorId: supervisorId.trim(),
          supervisorNote: supervisorNote.trim(),
          decision: "confirmed",
        },
      });
      return;
    }
    if (command === "continue_sampling") {
      props.onCommand(command, note.trim(), {
        actorId: reviewerId.trim(),
        idempotencyKey: `hydraulic-check:${props.selected.objectId}:${props.selected.version}:continue`,
        evidenceIds: [`cycle:${text(row.cycle_id)}`],
        data: {
          cycleId: text(row.cycle_id),
          observationReason: note.trim(),
          owner: owner.trim(),
          dueAt,
        },
      });
    }
  }

  function reset() {
    setFocused("pump");
    setReviewed([]);
    setInspectionOrder(defaultInspectionOrder(row));
    setOrderConfirmed(false);
    setEvidenceBasis([]);
    setOwner("");
    setDueAt("");
    setReviewerId("");
    setNote("");
    setSupervisorId("");
    setSupervisorNote("");
    props.onReset();
  }

  return (
    <main className={styles.root} aria-label="液压动力单元检查台">
      <header className={styles.header}>
        <div className={styles.identity}>
          <span className={styles.mark}><Waves aria-hidden="true" size={21} /></span>
          <div><h1>液压动力单元检查排序</h1><p>第 {text(row.cycle_id)} 次测量循环 · {props.selected.state}</p></div>
        </div>

        <nav className={styles.cycleNav} aria-label="测量循环导航">
          <button type="button" aria-label="上一条可选循环" disabled={!previousObject} onClick={() => previousObject && props.onSelect(previousObject.objectId)}><ArrowLeft aria-hidden="true" size={19} /></button>
          <label><span>测量循环</span><select aria-label="测量循环列表" value={props.selected.objectId} onChange={(event) => props.onSelect(event.target.value)}>{selectableObjects.map((item) => <option key={item.objectId} value={item.objectId}>{text(item.payload.cycle_id)} · {text(item.payload.overall_severity_label)}</option>)}</select></label>
          <button type="button" aria-label="下一条可选循环" disabled={!nextObject} onClick={() => nextObject && props.onSelect(nextObject.objectId)}><ArrowRight aria-hidden="true" size={19} /></button>
          <small>{props.datasetRowCount.toLocaleString("zh-CN")} 个测量循环</small>
        </nav>

        <div className={styles.statusPair} aria-label="本循环总体状态">
          <span><small>总体等级</small><strong data-tone="critical">{text(row.overall_severity_label)}</strong></span>
          <span><small>运行稳定性</small><strong data-tone="normal">{text(row.stability_label)}</strong></span>
          <em>维度不同</em>
        </div>

        <p className={styles.notice}><Info aria-hidden="true" size={16} />循环编号不是时间；页面不显示站点和资产号</p>

        <div className={styles.headerTools}>
          <label className={styles.role}><UserRound aria-hidden="true" size={16} /><select aria-label="当前操作角色" value={props.actorRole} onChange={(event) => props.onActorRoleChange(event.target.value)}>{props.roles.map((role) => <option value={role} key={role}>{roleLabel(role)}</option>)}</select></label>
          <button type="button" aria-label="恢复案例 B019" title="恢复案例 B019" onClick={reset} disabled={props.busy}><RefreshCw aria-hidden="true" size={17} /></button>
        </div>
      </header>

      <section className={styles.workspace}>
        <section className={styles.visualColumn}>
          <section className={`${styles.scene} ${v3Styles.sceneV3}`} aria-label="液压动力单元现场" data-render-mode={sceneMode}>
            <img src="/case-assets/case-B019/scene.png" alt="液压动力单元设备语境示意（非来源现场）" suppressHydrationWarning />
            <div className={styles.sceneShade} aria-hidden="true" />
            {webglAvailable && threeDRequested && !sceneFailed ? (
              <SceneErrorBoundary onError={() => {
                setSceneFailed(true);
                setSceneMode("static-fallback");
                setThreeDRequested(false);
              }}>
                <HydraulicPowerUnitScene
                  selectedComponent={focused}
                  inspectionOrder={inspectionOrder}
                  onSelectComponent={inspectComponent}
                  onReady={() => setSceneMode("webgl")}
                />
              </SceneErrorBoundary>
            ) : null}

            <div className={v3Styles.sceneModeControl} aria-label="现场视图模式">
              <div>
                <button type="button" aria-label="现场示意" aria-pressed={!threeDRequested} onClick={() => {
                  setThreeDRequested(false);
                  setSceneMode("static-fallback");
                }}>现场示意</button>
                <button type="button" aria-label="近似三维定位" aria-pressed={threeDRequested} disabled={!webglAvailable || sceneFailed} onClick={() => {
                  setThreeDRequested(true);
                  setSceneMode("static-fallback");
                }}>近似三维定位</button>
              </div>
              <strong>仅用于部件选取；非测量、非真实管路</strong>
              <span>{sceneMode === "webgl" ? "近似三维定位 · 点击只改变检查焦点" : "静态场景 · 热点与检查顺序仍可操作"}</span>
            </div>

            <aside className={styles.metrics} aria-label="本循环汇总">
              <header><strong>本循环汇总</strong><small>第 {text(row.cycle_id)} 次</small></header>
              <div>{[
                ["主压力", "main_pressure_mean", "bar"],
                ["回油压力", "return_pressure_mean", "bar"],
                ["系统压力", "system_pressure_mean", "bar"],
                ["电机功率", "motor_power_mean", "W"],
                ["主流量", "main_flow_mean", "L/min"],
                ["油温", "tank_temperature_mean", "℃"],
                ["振动", "system_vibration_mean", "mm/s"],
              ].map(([label, field, unit]) => <p key={field}><span>{label}</span><strong>{format(row[field])}</strong><small>{unit}</small></p>)}</div>
            </aside>

            <div className={styles.hotspots}>
              {componentDefinitions.map((definition) => {
                const item = components.find((component) => component.key === definition.key)!;
                const Icon = definition.icon;
                return <button type="button" key={definition.key} aria-label={`检查${definition.label}：${item.stateValue}`} data-severity={item.severityValue} data-active={focused === definition.key} data-reviewed={reviewed.includes(definition.key)} onClick={() => inspectComponent(definition.key)} style={{ "--x": `${definition.x}%`, "--y": `${definition.y}%` } as CSSProperties}><i><Icon aria-hidden="true" size={15} /></i><span><b>{inspectionOrder.indexOf(definition.key) + 1}</b>{definition.label}</span><small>状态码 {item.conditionValue}</small><strong>{item.stateValue}</strong><em>{reviewed.includes(definition.key) ? <Check aria-label="已核对" size={15} /> : <AlertTriangle aria-label="待核对" size={15} />}</em></button>;
              })}
            </div>

            <section className={styles.orderDock} aria-label="人工检查顺序">
              <header><div><h2>部件检查顺序</h2><span>{affected} / 4 受影响</span></div><p>三项同为最高关注级；同级、尚未人工确认</p></header>
              <ol>{components.map((item, index) => {
                const Icon = item.icon;
                return <li key={item.key} className={v3Styles.orderRow} data-severity={item.severityValue} data-active={focused === item.key}>
                  <button type="button" className={v3Styles.orderItem} aria-label={`核对部件：${item.label}`} onClick={() => inspectComponent(item.key)} aria-pressed={focused === item.key}><b>{index + 1}</b><Icon aria-hidden="true" size={16} /><span><strong>{item.label}</strong><small>{item.stateValue}</small></span>{reviewed.includes(item.key) ? <Check aria-label="已核对" size={16} /> : <ArrowRight aria-label="进入核对" size={16} />}</button>
                  <span className={v3Styles.orderMoves}><button type="button" aria-label={`上移${item.label}`} title={`上移${item.label}`} onClick={() => moveComponent(item.key, -1)} disabled={index === 0}>↑</button><button type="button" aria-label={`下移${item.label}`} title={`下移${item.label}`} onClick={() => moveComponent(item.key, 1)} disabled={index === components.length - 1}>↓</button></span>
                </li>;
              })}</ol>
            </section>
          </section>

          <section className={styles.trend} aria-label="最近二十次循环趋势">
            <header><div><h2>最近 20 次循环趋势</h2><span>当前载入 {trendRows.length} 次 · 四项独立量纲</span></div><strong>记录序号 {trendStart}–{trendEnd}，不是时间</strong></header>
            <div className={styles.trendGrid}>{[
              ["主压力", "main_pressure_mean", "bar", "pressure"],
              ["主流量", "main_flow_mean", "L/min", "flow"],
              ["油温", "tank_temperature_mean", "℃", "temperature"],
              ["振动", "system_vibration_mean", "mm/s", "vibration"],
            ].map(([label, field, unit, tone]) => <article key={field} data-tone={tone}><header><span>{label}<small>{unit}</small></span><strong>{format(row[field])}</strong></header><svg viewBox="0 0 1000 96" preserveAspectRatio="none" role="img" aria-label={`${label}最近20次循环`}><g><line x1="0" x2="1000" y1="18" y2="18" /><line x1="0" x2="1000" y1="78" y2="78" /></g><polyline points={linePoints(trendRows, field, 12, 84)} /></svg><footer><span>{trendStart}</span><span>{trendEnd}</span></footer></article>)}</div>
          </section>
        </section>

        <aside className={styles.review} aria-label="维护复核操作区">
          <header className={styles.reviewHeader}><div><ClipboardCheck aria-hidden="true" size={22} /><h2>{taskConfirmed ? "检查顺序已确认" : taskPersisted ? "主管确认检查顺序" : "提交检查顺序"}</h2></div><p>重点部件 {reviewedPriorityCount}/{requiredKeys.length} · 依据 {evidenceBasis.length}/2 · {orderConfirmed ? "顺序已确认" : "顺序未确认"}</p></header>

          <section className={styles.form}>
            {!taskPersisted ? <>
              <fieldset className={taskStyles.basis}><legend>证据与依据选择</legend>{evidenceOptions.map(([id, label, detail]) => <label key={id}><input type="checkbox" checked={evidenceBasis.includes(id)} onChange={() => toggleEvidenceBasis(id)} /><span><b>{label}</b><small>{detail}</small></span></label>)}</fieldset>
              <div className={taskStyles.taskFields}>
                <label>负责人<input aria-label="液压检查负责人" value={owner} onChange={(event) => setOwner(event.target.value)} /></label>
                <label>完成期限<input aria-label="液压检查截止时间" type="text" inputMode="numeric" pattern="\d{4}-\d{2}-\d{2}T\d{2}:\d{2}" placeholder="2026-07-28T08:00" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></label>
                <label className={taskStyles.fullField}>提交人 ID<input aria-label="液压复核提交人ID" value={reviewerId} onChange={(event) => setReviewerId(event.target.value)} /></label>
              </div>
              <label className={styles.noteField}>检查说明<textarea aria-label="液压检查说明" value={note} onChange={(event) => setNote(event.target.value)} placeholder="写明人工顺序依据，不写维修结论" /></label>
            </> : <>
              <section className={taskStyles.taskSummary} aria-label="已提交维护检查任务"><header><strong>{taskId}</strong><span>{taskConfirmed ? "顺序已确认" : "待主管确认"}</span></header><dl><div><dt>负责人</dt><dd>{restoredTask.owner}</dd></div><div><dt>截止时间</dt><dd>{restoredTask.dueAt}</dd></div><div><dt>检查顺序</dt><dd>{restoredTask.inspectionOrder?.map((item) => `${item.position}.${item.label}`).join(" → ")}</dd></div><div><dt>检查依据</dt><dd>{restoredTask.evidenceBasis?.join("、")}</dd></div></dl></section>
              <label className={taskStyles.supervisorField}>主管 ID<input aria-label="液压维护主管ID" value={supervisorId} disabled={taskConfirmed} onChange={(event) => setSupervisorId(event.target.value)} placeholder="maintenance-supervisor-01" /></label>
              <label className={styles.noteField}>主管复核意见<textarea aria-label="液压主管复核意见" value={supervisorNote} disabled={taskConfirmed} onChange={(event) => setSupervisorNote(event.target.value)} placeholder="核对顺序、依据、负责人和期限" /></label>
            </>}

            <label className={styles.confirm}><input type="checkbox" checked={orderConfirmed} disabled={taskPersisted} onChange={(event) => setOrderConfirmed(event.target.checked)} /><i>{orderConfirmed ? <Check aria-hidden="true" size={15} /> : null}</i><span>我已按当前循环记录核对检查顺序</span></label>
          </section>

          <section className={styles.actions} aria-label="可执行动作">
            {props.commands.length ? props.commands.map((command) => {
              const ready = command.id === "submit_maintenance_review"
                ? submissionReady
                : command.id === "confirm_check_order"
                  ? supervisorReady
                  : command.id === "continue_sampling"
                    ? validActorId(reviewerId.trim()) && note.trim().length >= 6
                    : true;
              return <button type="button" key={command.id} data-tone={command.tone} disabled={props.busy || !ready} onClick={() => runCommand(command.id)}>{command.id === "continue_sampling" ? <Activity aria-hidden="true" size={17} /> : command.id === "confirm_check_order" ? <ClipboardCheck aria-hidden="true" size={17} /> : <Wrench aria-hidden="true" size={17} />}{props.busy ? "正在记录…" : command.label}</button>;
            }) : <p>当前角色没有可执行动作。</p>}
          </section>

          <section className={styles.boundary}><ShieldCheck aria-hidden="true" size={19} /><div><strong>状态等级不是维修结论</strong><p>只记录人工检查顺序，不生成维修结论。</p></div></section>
          {props.receipt ? <p className={styles.receipt} role="status">已持久化：{props.receipt.event.fromState} → {props.receipt.event.toState}</p> : null}
          {props.error ? <p className={styles.error} role="alert"><span>{props.error}</span><button type="button" onClick={() => props.onSelect(props.selected.objectId)}>刷新当前循环</button></p> : null}
        </aside>
      </section>
    </main>
  );
}
