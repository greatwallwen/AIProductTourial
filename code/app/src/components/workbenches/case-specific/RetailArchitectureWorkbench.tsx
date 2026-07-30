"use client";

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Boxes,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  Database,
  GitBranch,
  PackageCheck,
  RadioTower,
  RefreshCcw,
  ShieldCheck,
  ShoppingCart,
  TimerReset,
  Truck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ReceiptNote, WorkbenchFrame } from "./WorkbenchFrame";
import styles from "./RetailArchitectureWorkbench.module.css";
import type { CaseWorkbenchProps } from "./types";

const domains = [
  { key: "订单接入", icon: ShoppingCart, tone: "blue" },
  { key: "库存", icon: Boxes, tone: "green" },
  { key: "履约", icon: PackageCheck, tone: "violet" },
  { key: "配送交接", icon: Truck, tone: "amber" },
] as const;

const fixedFacts = ["synthetic-domain-record", "source-boundary"];
const fixedConstraints = ["release-coupling", "operability"];
const fixedRisks = ["replay", "rollback"];
const defaultMissing = ["调用链", "容量曲线", "变更影响"];
const reviewerId = "case07-architecture-reviewer";

type DomainKey = (typeof domains)[number]["key"];
type MetricMode = "latency" | "release" | "recovery";
type ArchiveTab = "观察" | "假设" | "决定";
type ReviewWindow = {
  windowId: string;
  facilityCode: string;
  facilityLabel: string;
  scenarioDate: string;
  focusDomain: DomainKey;
};
type SelectedEvidence = {
  id: string;
  source: "synthetic-domain-record";
  domain: DomainKey;
  requestCount: number;
  p95LatencyMs: number;
  releaseCount: number;
  incidentMinutes: number;
  recoveryMinutes: number;
};
type Adr = {
  adrId: string;
  context: string;
  status: "proposed" | "accepted";
  decision?: "modular_monolith" | "event_contract_pilot";
  rationale?: string;
};
type EventContract = {
  eventName: string;
  producer: string;
  consumer: string;
  schemaVersion: string;
  idempotencyField: string;
  orderingKey: string;
  replayPolicy: string;
  rollbackPlan: string;
  owner: string;
  acceptanceCriteria: string;
};
type DecisionSignature = { signerId: string; statement: string };
type ArchitectureTask = {
  reviewWindow?: ReviewWindow;
  selectedEvidence?: SelectedEvidence[];
  missingObservability?: string[];
  facts?: string[];
  hypotheses?: string[];
  constraints?: string[];
  risks?: string[];
  adr?: Adr;
  eventContract?: EventContract;
  signature?: DecisionSignature;
  createdBy?: string;
};

const emptyContract: EventContract = {
  eventName: "FulfillmentRequested.v1",
  producer: "订单接入",
  consumer: "履约",
  schemaVersion: "1.0.0",
  idempotencyField: "event_id",
  orderingKey: "order_id",
  replayPolicy: "",
  rollbackPlan: "",
  owner: "",
  acceptanceCriteria: "",
};

function text(value: unknown, fallback = "—"): string {
  return value == null || value === "" ? fallback : String(value);
}

function displayLabel(value: unknown): string {
  return text(value).replaceAll("课程场景", "运行样本");
}

function numeric(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function integer(value: unknown): string {
  return Math.round(numeric(value)).toLocaleString("zh-CN");
}

function restoreTask(props: CaseWorkbenchProps): ArchitectureTask {
  const eventData = props.events
    .filter((event) => event.objectId === props.selected.objectId)
    .reduce<ArchitectureTask>((current, event) => ({ ...current, ...(event.data ?? {}) }), {});
  return { ...eventData, ...(props.selected.task ?? {}) } as ArchitectureTask;
}

function shortDate(value: string): string {
  return value.slice(5);
}

function evidenceRecord(item: Record<string, unknown>): SelectedEvidence {
  const facility = text(item.facility_code);
  const date = text(item.scenario_date);
  const domain = text(item.domain) as DomainKey;
  return {
    id: `ops:${facility}:${date}:${domain}`,
    source: "synthetic-domain-record",
    domain,
    requestCount: numeric(item.request_count),
    p95LatencyMs: numeric(item.p95_latency_ms),
    releaseCount: numeric(item.release_count),
    incidentMinutes: numeric(item.incident_minutes),
    recoveryMinutes: numeric(item.recovery_minutes),
  };
}

export function RetailArchitectureWorkbench(props: CaseWorkbenchProps) {
  const restoredTask = useMemo(() => restoreTask(props), [props.events, props.selected.objectId, props.selected.task]);
  const evidence = props.supportingArtifacts["operational-evidence.csv"] ?? [];
  const dates = useMemo(
    () => Array.from(new Set(evidence.map((item) => text(item.scenario_date, "")).filter(Boolean))).sort(),
    [evidence],
  );
  const facilities = useMemo(
    () => Array.from(new Map(evidence.map((item) => [text(item.facility_code), displayLabel(item.facility_label)])).entries()),
    [evidence],
  );
  const restoredDate = restoredTask.reviewWindow?.scenarioDate;
  const [selectedDate, setSelectedDate] = useState(() => restoredDate && dates.includes(restoredDate) ? restoredDate : dates.at(-1) ?? "");
  const [selectedFacility, setSelectedFacility] = useState(() => restoredTask.reviewWindow?.facilityCode ?? facilities[0]?.[0] ?? "");
  const [metricMode, setMetricMode] = useState<MetricMode>("latency");
  const [activeTab, setActiveTab] = useState<ArchiveTab>("观察");
  const [hypothesis, setHypothesis] = useState(restoredTask.hypotheses?.[0] ?? "履约域发布增加与恢复变慢同窗出现，但仍需调用链与容量证据核对原因。");
  const [missingObservability, setMissingObservability] = useState(restoredTask.missingObservability ?? defaultMissing);
  const [requesterId, setRequesterId] = useState("");
  const [requestNote, setRequestNote] = useState("");
  const [decisionRationale, setDecisionRationale] = useState(restoredTask.adr?.rationale ?? "");
  const [signerId, setSignerId] = useState(restoredTask.signature?.signerId ?? "");
  const [eventContract, setEventContract] = useState<EventContract>(restoredTask.eventContract ?? emptyContract);

  useEffect(() => {
    const nextDate = restoredTask.reviewWindow?.scenarioDate;
    const nextFacility = restoredTask.reviewWindow?.facilityCode;
    if (nextDate && dates.includes(nextDate)) setSelectedDate(nextDate);
    if (nextFacility && facilities.some(([code]) => code === nextFacility)) setSelectedFacility(nextFacility);
    setHypothesis(restoredTask.hypotheses?.[0] ?? "履约域发布增加与恢复变慢同窗出现，但仍需调用链与容量证据核对原因。");
    setMissingObservability(restoredTask.missingObservability ?? defaultMissing);
    setDecisionRationale(restoredTask.adr?.rationale ?? "");
    setSignerId(restoredTask.signature?.signerId ?? "");
    setEventContract(restoredTask.eventContract ?? emptyContract);
  }, [dates, facilities, props.selected.objectId, props.selected.version, restoredTask]);

  const facilityLabel = text(facilities.find(([code]) => code === selectedFacility)?.[1], selectedFacility);
  const windowId = `${selectedFacility}:${selectedDate}`;
  const reviewWindow: ReviewWindow = {
    windowId,
    facilityCode: selectedFacility,
    facilityLabel,
    scenarioDate: selectedDate,
    focusDomain: "履约",
  };
  const evidenceMap = useMemo(() => new Map(
    evidence
      .filter((item) => text(item.facility_code) === selectedFacility)
      .map((item) => [`${text(item.scenario_date)}:${text(item.domain)}`, item]),
  ), [evidence, selectedFacility]);
  const dailyEvidence = domains
    .map((domain) => evidenceMap.get(`${selectedDate}:${domain.key}`))
    .filter((item): item is Record<string, unknown> => Boolean(item));
  const selectedEvidence = (["订单接入", "履约"] as DomainKey[])
    .map((domain) => evidenceMap.get(`${selectedDate}:${domain}`))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map(evidenceRecord);
  const evidenceIds = [
    "public-order-slice:DATA-07",
    `ops:${selectedFacility}:${selectedDate}`,
    "source-boundary:public-plus-synthetic",
  ];
  const matchingTask = restoredTask.reviewWindow?.windowId === windowId ? restoredTask : undefined;
  const persistedCreatedBy = matchingTask?.createdBy ?? restoredTask.createdBy ?? reviewerId;
  const adr: Adr = matchingTask?.adr ?? {
    adrId: `ADR-07-${selectedFacility}-${selectedDate}`,
    context: `${facilityLabel} · ${selectedDate} · 履约`,
    status: "proposed",
  };
  const verifyCommand = props.commands.find((command) => command.id === "verify_evidence");
  const requestCommand = props.commands.find((command) => command.id === "request_observability_evidence");
  const keepCommand = props.commands.find((command) => command.id === "keep_modular_monolith");
  const pilotCommand = props.commands.find((command) => command.id === "start_event_contract_pilot");
  const verifyReady = selectedEvidence.length === 2 && hypothesis.trim().length >= 12;
  const requestReady = missingObservability.length > 0
    && requesterId.trim().length >= 2
    && requesterId.trim() !== persistedCreatedBy
    && requestNote.trim().length >= 8;
  const signatureReady = signerId.trim().length >= 2 && signerId.trim() !== persistedCreatedBy && decisionRationale.trim().length >= 8;
  const contractReady = eventContract.eventName.trim().length >= 2
    && eventContract.producer.trim().length >= 2
    && eventContract.consumer.trim().length >= 2
    && eventContract.schemaVersion.trim().length >= 2
    && eventContract.idempotencyField.trim().length >= 2
    && eventContract.orderingKey.trim().length >= 2
    && eventContract.idempotencyField.trim() !== eventContract.orderingKey.trim()
    && eventContract.replayPolicy.trim().length >= 12
    && eventContract.replayPolicy.includes("重放")
    && eventContract.rollbackPlan.trim().length >= 12
    && /(回退|停止|关闭)/.test(eventContract.rollbackPlan)
    && eventContract.owner.trim().length >= 2
    && eventContract.acceptanceCriteria.trim().length >= 12;
  const acceptedPilot = restoredTask.adr?.status === "accepted" && restoredTask.adr.decision === "event_contract_pilot";

  function toggleMissing(item: string) {
    setMissingObservability((current) => current.includes(item) ? current.filter((value) => value !== item) : [...current, item]);
  }

  function runVerify() {
    props.onCommand("verify_evidence", hypothesis.trim(), {
      actorId: reviewerId,
      idempotencyKey: `architecture-window:${windowId}:${props.selected.version}:verify`,
      evidenceIds,
      data: {
        reviewWindow,
        selectedEvidence,
        missingObservability,
        facts: fixedFacts,
        hypotheses: [hypothesis.trim()],
        constraints: fixedConstraints,
        risks: fixedRisks,
        adr,
        createdBy: reviewerId,
      },
    });
  }

  function runObservabilityRequest() {
    props.onCommand("request_observability_evidence", requestNote.trim(), {
      actorId: requesterId.trim(),
      idempotencyKey: `architecture-window:${windowId}:${props.selected.version}:observability`,
      evidenceIds,
      data: {
        request: {
          adrId: adr.adrId,
          requestedSignals: missingObservability,
          reason: requestNote.trim(),
          requestedBy: requesterId.trim(),
        },
      },
    });
  }

  function runDecision(command: "keep_modular_monolith" | "start_event_contract_pilot") {
    const decision = command === "keep_modular_monolith" ? "modular_monolith" : "event_contract_pilot";
    const acceptedAdr: Adr = { ...adr, status: "accepted", decision, rationale: decisionRationale.trim() };
    const signature: DecisionSignature = {
      signerId: signerId.trim(),
      statement: command === "keep_modular_monolith"
        ? "同意继续模块化观察并承担后续复核"
        : "同意批准单事件试点并承担验收复核",
    };
    props.onCommand(command, decisionRationale.trim(), {
      actorId: signerId.trim(),
      idempotencyKey: `architecture-window:${windowId}:${props.selected.version}:${decision}`,
      evidenceIds,
      data: command === "start_event_contract_pilot"
        ? { reviewWindow, adr: acceptedAdr, eventContract, signature }
        : { reviewWindow, adr: acceptedAdr, signature },
    });
  }

  const frameProps: CaseWorkbenchProps = { ...props, commands: [], error: undefined };

  return (
    <WorkbenchFrame
      props={frameProps}
      kicker="即时零售 · 架构评审"
      title="即时履约架构评审"
      subtitle="用同一设施的连续窗口比较发布、故障与恢复，再决定继续观察、补观测，或批准一条可回退的事件试点。"
      tone="architecture"
    >
      <div className={styles.workbench}>
        <aside className={styles.rail} aria-label="评审窗口">
          <section className={styles.railSection}>
            <header><span>评审对象（窗口）</span><Building2 aria-hidden="true" size={16} /></header>
            <select aria-label="评审设施" value={selectedFacility} onChange={(event) => setSelectedFacility(event.target.value)}>
              {facilities.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
            </select>
            <strong className={styles.facilityCode}>{selectedFacility}</strong>
          </section>

          <section className={styles.railSection}>
            <header><span>窗口天数</span><small>{dates.length} 天</small></header>
            <div className={styles.dateGrid}>{dates.map((date) => (
              <button
                type="button"
                key={date}
                aria-label={`选择评审日期 ${date}`}
                aria-current={date === selectedDate ? "date" : undefined}
                onClick={() => setSelectedDate(date)}
              >{shortDate(date)}</button>
            ))}</div>
          </section>

          <section className={styles.railSection}>
            <header><span>指标切换</span><Activity aria-hidden="true" size={15} /></header>
            <div className={styles.metricSwitch}>
              {([
                ["latency", "P95"],
                ["release", "发布"],
                ["recovery", "恢复"],
              ] as const).map(([mode, label]) => (
                <button type="button" key={mode} aria-label={`突出${label}`} aria-pressed={metricMode === mode} onClick={() => setMetricMode(mode)}>{label}</button>
              ))}
            </div>
          </section>

          <section className={styles.railSection}>
            <header><span>到达时点（源值）</span><Database aria-hidden="true" size={15} /></header>
            <div className={styles.sourceValue}>
              <span>源值口径</span>
              <strong>到达时点（源值）</strong>
              <small>未声明时间单位，不做峰段推断</small>
            </div>
          </section>

          <section className={styles.railSection}>
            <header><span>数据源</span><Database aria-hidden="true" size={15} /></header>
            <div className={styles.sourceCard}><ShoppingCart aria-hidden="true" size={17} /><span><b>公开订单切片</b><small>{props.datasetRowCount.toLocaleString("zh-CN")} 条；当前载入 {props.sceneRows.length} 条</small></span><Check size={15} /></div>
            <div className={styles.sourceCard}><Database aria-hidden="true" size={17} /><span><b>合成运营记录</b><small>{evidence.length} 条确定性记录</small></span><Check size={15} /></div>
          </section>
        </aside>

        <section className={styles.matrixPanel} aria-label="发布与恢复耦合矩阵">
          <header className={styles.matrixHeader}>
            <div><span className={styles.eyebrow}>发布 / 恢复耦合矩阵</span><strong>{selectedFacility} · {selectedDate}</strong></div>
            <span className={styles.statePill}><i />{props.selected.state}</span>
          </header>

          <section className={styles.daySummary} aria-label="当前日期领域摘要">
            {dailyEvidence.map((record) => {
              const domain = domains.find((item) => item.key === text(record.domain)) ?? domains[0];
              const Icon = domain.icon;
              return <article key={domain.key} data-tone={domain.tone}>
                <header><Icon aria-hidden="true" size={19} /><strong>{domain.key}</strong></header>
                <dl>
                  <div><dt>请求数</dt><dd>{integer(record.request_count)}</dd></div>
                  <div><dt>P95 延迟</dt><dd>{integer(record.p95_latency_ms)} ms</dd></div>
                  <div><dt>发布数</dt><dd>{integer(record.release_count)}</dd></div>
                  <div><dt>故障数</dt><dd>{integer(record.incident_minutes)}</dd></div>
                  <div><dt>恢复数</dt><dd>{integer(record.recovery_minutes)}</dd></div>
                </dl>
              </article>;
            })}
          </section>

          <section className={styles.matrixViewport}>
            <table aria-label="14 天四领域评审矩阵" className={styles.matrixTable}>
              <thead><tr><th>责任域 / 日期</th>{dates.map((date) => <th key={date} data-selected={date === selectedDate}><button type="button" aria-label={`选择矩阵日期 ${date}`} onClick={() => setSelectedDate(date)}>{shortDate(date)}</button></th>)}</tr></thead>
              <tbody>{domains.map((domain) => {
                const Icon = domain.icon;
                return <tr key={domain.key} data-tone={domain.tone}>
                  <th scope="row"><Icon aria-hidden="true" size={18} /><span>{domain.key}</span></th>
                  {dates.map((date) => {
                    const record = evidenceMap.get(`${date}:${domain.key}`);
                    return <td key={date} data-selected={date === selectedDate} data-emphasis={metricMode}>
                      <strong>{record ? `${integer(record.p95_latency_ms)} ms` : "—"}</strong>
                      <span className={styles.releaseMark}>▲ {record ? integer(record.release_count) : "—"}</span>
                      <span className={styles.incidentMark}>× {record ? integer(record.incident_minutes) : "—"}</span>
                      <span className={styles.recoveryMark}>◔ {record ? integer(record.recovery_minutes) : "—"}</span>
                    </td>;
                  })}
                </tr>;
              })}</tbody>
            </table>
          </section>

          <section className={styles.trendBands}>
            <div role="region" aria-label="发布标记带" data-emphasis={metricMode} className={styles.bandRow}><strong>发布标记</strong><div>{dates.map((date) => {
              const total = domains.reduce((sum, domain) => sum + numeric(evidenceMap.get(`${date}:${domain.key}`)?.release_count), 0);
              return <span key={date} data-selected={date === selectedDate} title={`${date} 发布 ${total}`}><i style={{ height: `${Math.max(4, total * 2)}px` }} /></span>;
            })}</div></div>
            <div role="region" aria-label="恢复分钟带" data-emphasis={metricMode} className={styles.bandRow}><strong>恢复分钟</strong><div>{dates.map((date) => {
              const total = domains.reduce((sum, domain) => sum + numeric(evidenceMap.get(`${date}:${domain.key}`)?.recovery_minutes), 0);
              return <span key={date} data-selected={date === selectedDate} title={`${date} 恢复分钟 ${total}`}><i style={{ width: `${Math.min(100, Math.max(8, total))}%` }} /></span>;
            })}</div></div>
          </section>

          <section className={styles.questionStrip}>
            <header><strong>发布增多与恢复变慢，同时出现了吗？</strong><small>只比较同窗记录，不推断因果</small></header>
            <div>
              <article data-tone="positive"><CheckCircle2 aria-hidden="true" size={18} /><span><strong>同窗出现</strong><small>07-12 至 07-14，发布数与恢复记录同时维持高位。</small></span></article>
              <article data-tone="warning"><CircleAlert aria-hidden="true" size={18} /><span><strong>仍缺调用链</strong><small>尚未观测跨服务因果路径，不能把同窗变化写成根因。</small></span></article>
            </div>
          </section>

          {acceptedPilot ? <section className={styles.pilotFollowUp} aria-label="已批准的单事件试点">
            <header><span><GitBranch aria-hidden="true" size={17} />已批准的单事件试点</span><strong>{restoredTask.eventContract?.eventName ?? eventContract.eventName}</strong></header>
            <div><span>订单接入</span><i aria-hidden="true" /><span>履约</span></div>
            <footer><CheckCircle2 aria-hidden="true" size={16} /><strong>正常 · 重复 · 乱序 · 重放回滚</strong><small>这是待验证场景清单，不是通过声明。</small></footer>
          </section> : null}
        </section>

        <aside className={styles.archive} aria-label="架构档案">
          <header className={styles.archiveHeader}><span><ClipboardCheck aria-hidden="true" size={18} />架构档案</span><small>{shortDate(selectedDate)}</small></header>
          <div role="tablist" aria-label="架构档案阶段" className={styles.tabs}>{(["观察", "假设", "决定"] as ArchiveTab[]).map((tab) => <button type="button" key={tab} role="tab" aria-selected={activeTab === tab} onClick={() => setActiveTab(tab)}>{tab}</button>)}</div>

          <section role="tabpanel" aria-label={`${activeTab}内容`} className={styles.tabPanel}>
            {activeTab === "观察" ? <>
              <p className={styles.panelLead}>基于所选 {shortDate(selectedDate)} 的事实</p>
              <div className={styles.factList}>{dailyEvidence.map((record) => <article key={text(record.domain)}><strong>{text(record.domain)}</strong><span>{integer(record.request_count)} / {integer(record.p95_latency_ms)}ms / 发布{integer(record.release_count)} / 故障{integer(record.incident_minutes)} / 恢复{integer(record.recovery_minutes)}</span></article>)}</div>
              <div className={styles.boundary}><TimerReset aria-hidden="true" size={17} /><span><strong>证据边界</strong><small>公开订单仅描述到达时点与商品集合；运营记录为确定性合成数据，不能证明调用链因果、拆分收益或生产 SLA。</small></span></div>
            </> : null}

            {activeTab === "假设" ? <>
              <label className={styles.field}>可证伪假设<textarea aria-label="可证伪假设" value={hypothesis} onChange={(event) => setHypothesis(event.target.value)} /></label>
              <div className={styles.hypothesisTags}><span>可证伪</span><span>单一假设</span></div>
              <fieldset className={styles.missingList}><legend>仍缺观测（阻塞验证）</legend>{defaultMissing.map((item) => <label key={item}><input type="checkbox" checked={missingObservability.includes(item)} onChange={() => toggleMissing(item)} /><span>{item}</span><em>{missingObservability.includes(item) ? "未就绪" : "暂不请求"}</em></label>)}</fieldset>
              {verifyCommand ? <button type="button" className={styles.secondaryAction} disabled={props.busy || !verifyReady} onClick={runVerify}><ShieldCheck aria-hidden="true" size={16} />{verifyCommand.label}</button> : null}
              {requestCommand ? <section className={styles.requestForm}>
                <label className={styles.field}>主管请求人<input aria-label="补观测请求人" value={requesterId} onChange={(event) => setRequesterId(event.target.value)} placeholder={`不能与记录人 ${persistedCreatedBy} 相同`} /></label>
                <label className={styles.field}>说明<textarea aria-label="补观测说明" value={requestNote} onChange={(event) => setRequestNote(event.target.value)} /></label>
                <button type="button" disabled={props.busy || !requestReady} onClick={runObservabilityRequest}><RadioTower aria-hidden="true" size={16} />{requestCommand.label}</button>
              </section> : null}
            </> : null}

            {activeTab === "决定" ? <>
              <section className={styles.adrCard}><header><span>ADR</span><strong>{adr.adrId}</strong></header><p>{adr.context}</p></section>
              <label className={styles.field}>决策理由<textarea aria-label="架构决策理由" value={decisionRationale} onChange={(event) => setDecisionRationale(event.target.value)} /></label>
              <label className={styles.field}>签署人<input aria-label="架构决策签署人" value={signerId} onChange={(event) => setSignerId(event.target.value)} placeholder="需与评审记录人不同" /></label>
              {pilotCommand ? <details className={styles.contract} open>
                <summary>单事件契约</summary>
                <div className={styles.contractGrid}>
                  <label className={styles.field}>事件<input aria-label="事件名称" value={eventContract.eventName} onChange={(event) => setEventContract((current) => ({ ...current, eventName: event.target.value }))} /></label>
                  <label className={styles.field}>版本<input aria-label="Schema 版本" value={eventContract.schemaVersion} onChange={(event) => setEventContract((current) => ({ ...current, schemaVersion: event.target.value }))} /></label>
                  <label className={styles.field}>生产领域<input aria-label="生产领域" value={eventContract.producer} onChange={(event) => setEventContract((current) => ({ ...current, producer: event.target.value }))} /></label>
                  <label className={styles.field}>消费领域<input aria-label="消费领域" value={eventContract.consumer} onChange={(event) => setEventContract((current) => ({ ...current, consumer: event.target.value }))} /></label>
                  <label className={styles.field}>幂等字段<input aria-label="幂等字段" value={eventContract.idempotencyField} onChange={(event) => setEventContract((current) => ({ ...current, idempotencyField: event.target.value }))} /></label>
                  <label className={styles.field}>排序键<input aria-label="排序键" value={eventContract.orderingKey} onChange={(event) => setEventContract((current) => ({ ...current, orderingKey: event.target.value }))} /></label>
                  <label className={`${styles.field} ${styles.fullField}`}>重放规则<textarea aria-label="重放规则" value={eventContract.replayPolicy} onChange={(event) => setEventContract((current) => ({ ...current, replayPolicy: event.target.value }))} /></label>
                  <label className={`${styles.field} ${styles.fullField}`}>回滚方案<textarea aria-label="回滚方案" value={eventContract.rollbackPlan} onChange={(event) => setEventContract((current) => ({ ...current, rollbackPlan: event.target.value }))} /></label>
                  <label className={styles.field}>负责人<input aria-label="契约负责人" value={eventContract.owner} onChange={(event) => setEventContract((current) => ({ ...current, owner: event.target.value }))} /></label>
                  <label className={styles.field}>验收标准<input aria-label="试点验收标准" value={eventContract.acceptanceCriteria} onChange={(event) => setEventContract((current) => ({ ...current, acceptanceCriteria: event.target.value }))} /></label>
                </div>
              </details> : null}
              <div className={styles.decisionActions}>
                {keepCommand ? <button type="button" aria-label={keepCommand.label} disabled={props.busy || !signatureReady} onClick={() => runDecision("keep_modular_monolith")}><ShieldCheck aria-hidden="true" size={16} /><span><strong>{keepCommand.label}</strong><small>继续观察，不增加跨进程依赖</small></span></button> : null}
                {pilotCommand ? <button type="button" aria-label={pilotCommand.label} data-primary disabled={props.busy || !signatureReady || !contractReady} onClick={() => runDecision("start_event_contract_pilot")}><GitBranch aria-hidden="true" size={16} /><span><strong>{pilotCommand.label}</strong><small>仅限订单接入 → 履约</small></span></button> : null}
              </div>
            </> : null}
          </section>

          <section className={styles.signatureBar}><span>主管签名</span><strong>{restoredTask.signature?.signerId || "待签名"}</strong></section>
          {props.error ? <section className={styles.errorBox}><AlertTriangle aria-hidden="true" size={17} /><span><strong>动作没有写入</strong><small>刷新当前持久化对象后重试。</small></span><button type="button" aria-label="刷新对象" onClick={() => props.onSelect(props.selected.objectId)} disabled={props.busy}><RefreshCcw aria-hidden="true" size={15} /></button></section> : null}
          <ReceiptNote props={props} />
        </aside>
      </div>
    </WorkbenchFrame>
  );
}
