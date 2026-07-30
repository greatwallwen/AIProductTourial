"use client";

import {
  AlertTriangle,
  BadgeCheck,
  BarChart3,
  Check,
  ChevronRight,
  FileChartColumn,
  FileText,
  History,
  RefreshCw,
  Scale,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./ModelAdmissionWorkbench.module.css";
import type { CaseWorkbenchProps, WorkbenchCommand } from "./types";

const gateLabels = {
  risk: "风险准入检查",
  fairness: "公平准入检查",
  safety: "安全准入检查",
} as const;
const gateSeatLabels = {
  risk: "风险评审席",
  fairness: "公平评审席",
  safety: "安全评审席",
} as const;
const gateOrder = ["risk", "fairness", "safety"] as const;
type GateId = (typeof gateOrder)[number];

const workflowSteps = [
  { rank: 1, title: "核对缺口", detail: "锁定 0.047、门槛与切片状态" },
  { rank: 2, title: "发起补测", detail: "登记样本目标、数据版本和原因" },
  { rank: 3, title: "三类评审签署", detail: "风险、公平、安全职责分别确认" },
  { rank: 4, title: "准入主管确认", detail: "服务端复核身份、版本与结果" },
] as const;

function text(value: unknown): string { return String(value ?? "—"); }
function numeric(value: unknown): number { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function record(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function evidenceLabel(value: unknown): string { return text(value) === "complete" ? "证据完整" : text(value) === "missing_slice" ? "切片缺失" : text(value); }
function resultLabel(value: unknown): string { return text(value) === "pass" ? "通过" : "待补测"; }
function roleLabel(role: string): string { return role === "release_manager" ? "发布经理" : role === "supervisor" ? "准入主管" : role; }
function comparatorLabel(value: unknown): string { return text(value).replace(">=", "≥").replace("<=", "≤"); }
function metricLabel(value: unknown): string { return numeric(value).toLocaleString("zh-CN", { maximumFractionDigits: 4 }); }
function passesComparator(value: number, comparator: string, threshold: number): boolean {
  if (comparator === ">=") return value >= threshold;
  if (comparator === ">") return value > threshold;
  if (comparator === "<") return value < threshold;
  return value <= threshold;
}
function parseReview(reason: unknown): { sliceId: string; targetSampleSize: string; note: string } | undefined {
  const source = text(reason);
  if (!source.startsWith("admission-review:")) return undefined;
  try { return JSON.parse(source.slice("admission-review:".length)) as { sliceId: string; targetSampleSize: string; note: string }; } catch { return undefined; }
}
function auditCommandLabel(command: string): string {
  return { request_release_evidence: "发起地区切片补测", approve_canary: "确认补测已完成", reject_candidate: "拒绝发布候选" }[command] ?? command;
}
function commandById(commands: WorkbenchCommand[], id: string): WorkbenchCommand | undefined {
  return commands.find((command) => command.id === id);
}

export function ModelAdmissionWorkbench(props: CaseWorkbenchProps) {
  const row = props.selected.payload;
  const candidateId = text(row.candidate_id);
  const policyVersion = text(row.policy_version);
  const sourceRows = props.sceneRows.length ? props.sceneRows : props.objects.map((item) => item.payload);
  const rows = sourceRows.filter((item) => text(item.candidate_id) === candidateId && text(item.policy_version) === policyVersion);
  const blockingRow = rows.find((item) => text(item.evaluation_id) === "EVAL-11-004")
    ?? rows.find((item) => text(item.result) !== "pass" || text(item.evidence_status) !== "complete")
    ?? row;
  const persisted = useMemo(() => parseReview([...props.events].reverse().find((event) => event.reason)?.reason), [props.events]);
  const aggregateData = useMemo(() => {
    const historical = props.events.reduce<Record<string, unknown>>((merged, event) => ({ ...merged, ...record(event.data) }), {});
    return { ...historical, ...record(props.selected.task), ...record(props.receipt?.event.data) };
  }, [props.events, props.receipt, props.selected.task]);
  const restoredRetest = record(aggregateData.retest);
  const restoredReviews = record(aggregateData.gateReviews);

  const [targetSampleSize, setTargetSampleSize] = useState(text(restoredRetest.targetSampleSize === undefined ? persisted?.targetSampleSize ?? "1200" : restoredRetest.targetSampleSize));
  const [datasetVersion, setDatasetVersion] = useState(restoredRetest.datasetVersion === undefined ? "" : text(restoredRetest.datasetVersion));
  const [retestMetricValue, setRetestMetricValue] = useState(restoredRetest.metricValue === undefined || restoredRetest.metricValue === null ? "" : text(restoredRetest.metricValue));
  const [note, setNote] = useState(text(aggregateData.note ?? persisted?.note ?? "").replace("—", ""));
  const [gateReviews, setGateReviews] = useState<Record<GateId, boolean>>({
    risk: record(restoredReviews.risk).status === "signed",
    fairness: record(restoredReviews.fairness).status === "signed",
    safety: record(restoredReviews.safety).status === "signed",
  });
  const [reportOpen, setReportOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const reportTriggerRef = useRef<HTMLButtonElement>(null);
  const auditTriggerRef = useRef<HTMLButtonElement>(null);

  function closeReport() { setReportOpen(false); reportTriggerRef.current?.focus(); }
  function closeAudit() { setAuditOpen(false); auditTriggerRef.current?.focus(); }

  useEffect(() => {
    setTargetSampleSize(text(restoredRetest.targetSampleSize === undefined ? persisted?.targetSampleSize ?? "1200" : restoredRetest.targetSampleSize));
    setDatasetVersion(restoredRetest.datasetVersion === undefined ? "" : text(restoredRetest.datasetVersion));
    setRetestMetricValue(restoredRetest.metricValue === undefined || restoredRetest.metricValue === null ? "" : text(restoredRetest.metricValue));
    setNote(text(aggregateData.note ?? persisted?.note ?? "").replace("—", ""));
    setGateReviews({
      risk: record(restoredReviews.risk).status === "signed",
      fairness: record(restoredReviews.fairness).status === "signed",
      safety: record(restoredReviews.safety).status === "signed",
    });
  }, [aggregateData.note, persisted, props.selected.objectId, restoredRetest.datasetVersion, restoredRetest.metricValue, restoredRetest.targetSampleSize, restoredReviews.fairness, restoredReviews.risk, restoredReviews.safety]);

  useEffect(() => {
    if (!reportOpen && !auditOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (reportOpen) closeReport();
      if (auditOpen) closeAudit();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [auditOpen, reportOpen]);

  const baselinePassed = rows.filter((item) => text(item.result) === "pass").length;
  const baselineGaps = rows.filter((item) => text(item.result) !== "pass" || text(item.evidence_status) !== "complete");
  const groups = gateOrder.map((gate) => ({ gate, rows: rows.filter((item) => text(item.gate) === gate) }));
  const blockingValue = numeric(blockingRow.metric_value);
  const blockingThreshold = numeric(blockingRow.threshold);
  const retestValue = Number(retestMetricValue);
  const retestComplete = retestMetricValue.trim() !== "" && Number.isFinite(retestValue) && numeric(targetSampleSize) >= numeric(blockingRow.sample_size) && datasetVersion.trim() !== "";
  const retestPass = retestComplete && passesComparator(retestValue, text(blockingRow.comparator), blockingThreshold);
  const hasAcceptedRetest = props.selected.state !== "待会签" && retestPass;
  const currentBlockingValue = hasAcceptedRetest ? retestValue : blockingValue;
  const currentPassed = rows.filter((item) => text(item.evaluation_id) === text(blockingRow.evaluation_id) ? hasAcceptedRetest : text(item.result) === "pass").length;
  const currentGaps = rows.length - currentPassed;
  const scaleMaximum = Math.max(blockingValue, blockingThreshold, currentBlockingValue, 0.001) * 1.25;
  const thresholdPosition = Math.min(100, (blockingThreshold / scaleMaximum) * 100);
  const actualPosition = Math.min(100, (currentBlockingValue / scaleMaximum) * 100);
  const thresholdStyle = { "--threshold-position": `${thresholdPosition}%`, "--actual-position": `${actualPosition}%` } as CSSProperties;
  const thresholdDelta = Math.abs(currentBlockingValue - blockingThreshold);
  const allGateReviewsSigned = gateOrder.every((gate) => gateReviews[gate]);
  const recomputedGateResults = groups.map((group) => ({
    gate: group.gate,
    result: group.rows.every((item) => text(item.evaluation_id) === text(blockingRow.evaluation_id) ? retestPass : text(item.result) === "pass") ? "pass" : "blocked",
  }));
  const allGatesPass = recomputedGateResults.every((item) => item.result === "pass");
  const actorId = props.actorRole === "supervisor" ? "case11-admission-chair" : "case11-release-manager";
  const creatorId = text(aggregateData.createdBy ?? "case11-release-manager");
  const recordedChairId = text(aggregateData.decisionBy ?? "").replace("—", "");
  const actorSeparated = props.selected.state === "补测已确认"
    ? Boolean(recordedChairId) && recordedChairId !== creatorId
    : props.actorRole === "supervisor" && actorId !== creatorId;
  const candidateVersion = text(aggregateData.candidateVersion ?? `candidate-v${props.selected.version}`);
  const requestReady = numeric(targetSampleSize) >= numeric(blockingRow.sample_size) && datasetVersion.trim() !== "" && note.trim().length >= 4;
  const signoffReady = props.selected.state === "补测中" && retestPass;
  const approvalReady = props.actorRole === "supervisor" && actorSeparated && retestPass && allGatesPass && allGateReviewsSigned;
  const rejectionReady = props.actorRole === "supervisor" && ["待会签", "待补证"].includes(props.selected.state) && note.trim().length >= 4;
  const workflowRank = props.selected.state === "补测已确认" || props.selected.state === "候选已拒绝"
    ? 4
    : props.selected.state === "补测中"
      ? approvalReady ? 4 : 3
      : 2;
  const workflowFinished = props.selected.state === "补测已确认" || props.selected.state === "候选已拒绝";
  const requestCommand = commandById(props.commands, "request_release_evidence");
  const approveCommand = commandById(props.commands, "approve_canary");
  const rejectCommand = commandById(props.commands, "reject_candidate");
  const otherCommands = props.commands.filter((command) => !["request_release_evidence", "approve_canary", "reject_candidate"].includes(command.id));

  function chooseEvaluation(item: Record<string, unknown>) {
    const candidate = props.objects.find((object) => text(object.payload.evaluation_id) === text(item.evaluation_id)
      && text(object.payload.candidate_id) === candidateId
      && text(object.payload.policy_version) === policyVersion);
    if (candidate) props.onSelect(candidate.objectId);
  }
  function chooseGate(gate: GateId) {
    const group = groups.find((item) => item.gate === gate);
    const target = group?.rows.find((item) => text(item.result) !== "pass" || text(item.evidence_status) !== "complete") ?? group?.rows[0];
    if (target) chooseEvaluation(target);
  }
  function runCommand(command: string) {
    const requestingRetest = command === "request_release_evidence";
    const reviewData = Object.fromEntries(gateOrder.map((gate) => [gate, {
      role: `${gate}_reviewer`,
      signerId: `case11-${gate}-reviewer`,
      status: gateReviews[gate] ? "signed" : "pending",
    }]));
    const retestId = `RETEST-${candidateId}-${text(blockingRow.slice_id)}`;
    props.onCommand(
      command,
      `admission-review:${JSON.stringify({ sliceId: text(blockingRow.slice_id), targetSampleSize, note: note.trim() })}`,
      {
        data: {
          aggregateType: "model_admission_candidate",
          candidateId,
          candidateVersion,
          policyVersion,
          selectedEvaluationId: text(blockingRow.evaluation_id),
          gateSet: rows.map((item) => ({
            evaluationId: text(item.evaluation_id),
            gate: text(item.gate),
            result: text(item.result) === "pass" ? "pass" : "fail",
            evidenceStatus: text(item.evidence_status),
          })),
          retest: {
            retestId,
            sourceEvaluationId: text(blockingRow.evaluation_id),
            sliceId: text(blockingRow.slice_id),
            targetSampleSize: numeric(targetSampleSize),
            datasetVersion: datasetVersion.trim(),
            metricValue: requestingRetest ? null : retestComplete ? retestValue : null,
            evidenceStatus: requestingRetest ? "planned" : retestComplete ? "complete" : "planned",
            computedResult: requestingRetest ? "pending" : retestComplete ? (retestPass ? "pass" : "fail") : "pending",
          },
          gateReviews: reviewData,
          recomputedGateResults,
          decision: command === "approve_canary" ? "approve" : command === "reject_candidate" ? "reject" : "request_retest",
          createdBy: requestingRetest ? actorId : creatorId,
          decisionBy: props.actorRole === "supervisor" ? actorId : null,
          note: note.trim(),
          serverValidationRequired: true,
        },
        actorId,
        evidenceIds: rows.map((item) => `evaluation:${text(item.evaluation_id)}`).concat(!requestingRetest && retestComplete ? [`retest:${retestId}:${datasetVersion.trim()}`] : []),
        idempotencyKey: `case-11:candidate:${candidateId}:${command}:v${props.selected.version}`,
      },
    );
  }
  function reset() {
    setTargetSampleSize("1200");
    setDatasetVersion("");
    setRetestMetricValue("");
    setNote("");
    setGateReviews({ risk: false, fairness: false, safety: false });
    setReportOpen(false);
    setAuditOpen(false);
    props.onReset();
  }

  return (
    <main className={styles.root} aria-label="企业模型准入补测总控台">
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <h1>企业模型准入补测</h1>
          <span>候选</span><strong>{candidateId}</strong>
          <span>版本</span><b>{candidateVersion}</b>
          <span>政策</span><b>{policyVersion}</b>
          <em>{props.selected.state} · v{props.selected.version}</em>
        </div>
        <nav aria-label="准入工具">
          <button ref={reportTriggerRef} type="button" onClick={() => setReportOpen(true)}><FileText size={17} />评测报告</button>
          <button ref={auditTriggerRef} type="button" onClick={() => setAuditOpen(true)}><History size={17} />操作日志</button>
          <button type="button" aria-label="恢复案例 B11" title="恢复初始状态" onClick={reset} disabled={props.busy}><RefreshCw size={17} />刷新</button>
        </nav>
      </header>

      <section className={styles.summary} aria-label="候选准入摘要">
        <div><FileChartColumn size={22} /><span><strong>{rows.length} 项本地评测</strong><small>同一候选 · 同一政策版本</small></span></div>
        <article data-tone="pass"><strong>{currentPassed}/{rows.length}</strong><span>{hasAcceptedRetest ? "补测后通过" : "基线通过"}</span></article>
        <article data-tone={currentGaps ? "blocking" : "pass"}><strong>{currentGaps}</strong><span>当前阻断</span></article>
        <aside>{hasAcceptedRetest ? <BadgeCheck size={19} /> : <AlertTriangle size={19} />}<span><strong>{text(blockingRow.metric_label)} {metricLabel(currentBlockingValue)} {hasAcceptedRetest ? "≤" : ">"} {metricLabel(blockingThreshold)}</strong><small>{hasAcceptedRetest ? `${datasetVersion} · 补测样本 ${targetSampleSize}` : `${text(blockingRow.slice_id)} · 基线样本 ${text(blockingRow.sample_size)} · ${evidenceLabel(blockingRow.evidence_status)}`}</small></span></aside>
      </section>

      <section className={styles.layout}>
        <aside className={styles.candidateRail} aria-label="候选摘要与三类检查">
          <section className={styles.candidateCard}>
            <header><i>MO</i><div><span>发布候选</span><strong>{candidateId}</strong></div></header>
            <dl>
              <div><dt>候选版本</dt><dd>{candidateVersion}</dd></div>
              <div><dt>政策版本</dt><dd>{policyVersion}</dd></div>
              <div><dt>检查数量</dt><dd>{rows.length} 项</dd></div>
              <div><dt>公开锚点</dt><dd>Qwen 公开元数据</dd></div>
              <div><dt>权重许可</dt><dd>待核验</dd></div>
            </dl>
            <p>候选按编号和政策版本聚合；公开元数据不等于企业准入结论。</p>
          </section>
          <nav className={styles.gateNav} aria-label="三类准入检查">
            <header><h2>三类检查</h2><span>选择后定位指标</span></header>
            {groups.map((group) => {
              const groupPassed = group.rows.filter((item) => text(item.evaluation_id) === text(blockingRow.evaluation_id) ? hasAcceptedRetest : text(item.result) === "pass").length;
              const active = text(row.gate) === group.gate;
              const blocked = groupPassed !== group.rows.length;
              return <button type="button" key={group.gate} aria-pressed={active} onClick={() => chooseGate(group.gate)}>
                <i>{group.gate === "risk" ? <ShieldAlert size={19} /> : group.gate === "fairness" ? <Scale size={19} /> : <ShieldCheck size={19} />}</i>
                <span><strong>{gateLabels[group.gate]}</strong><small>{groupPassed}/{group.rows.length} 项通过</small></span>
                <b data-blocked={blocked}>{blocked ? "待补测" : "通过"}</b>
              </button>;
            })}
          </nav>
          <section className={styles.boundaryCard}><ShieldCheck size={18} /><p><strong>本地课程评测</strong><span>不是 Qwen 官方结果，也不是生产发布批准。</span></p></section>
        </aside>

        <section className={styles.gateWorkspace} aria-label="九项准入检查">
          <header><div><h2>九项准入检查</h2><span>风险、公平、安全逐项核对</span></div><strong>{currentPassed}/{rows.length} 当前通过</strong></header>
          <div className={styles.gateTracks}>
            {groups.map((group) => {
              const groupPassed = group.rows.filter((item) => text(item.evaluation_id) === text(blockingRow.evaluation_id) ? hasAcceptedRetest : text(item.result) === "pass").length;
              return <section className={styles.gateTrack} key={group.gate} data-gate={group.gate} aria-label={gateLabels[group.gate]}>
                <header><i>{group.gate === "risk" ? <ShieldAlert size={20} /> : group.gate === "fairness" ? <Scale size={20} /> : <ShieldCheck size={20} />}</i><span><strong>{gateLabels[group.gate]}</strong><small>{groupPassed}/{group.rows.length} 项通过</small></span></header>
                <div className={styles.metricRail}>{group.rows.map((item) => {
                  const selected = text(item.evaluation_id) === text(row.evaluation_id);
                  const blocking = text(item.evaluation_id) === text(blockingRow.evaluation_id);
                  const pass = blocking ? hasAcceptedRetest : text(item.result) === "pass";
                  const displayValue = blocking && hasAcceptedRetest ? retestValue : numeric(item.metric_value);
                  const displayEvidence = blocking && hasAcceptedRetest ? "补测记录完整" : evidenceLabel(item.evidence_status);
                  const accessibleName = `${text(item.metric_label)}，实测 ${metricLabel(displayValue)}，要求 ${comparatorLabel(item.comparator)} ${metricLabel(item.threshold)}，样本 ${blocking && hasAcceptedRetest ? targetSampleSize : text(item.sample_size)}，${displayEvidence}`;
                  return <button type="button" className={styles.metricCard} key={text(item.evaluation_id)} aria-label={accessibleName} aria-pressed={selected} data-pass={pass} data-blocking={blocking} onClick={() => chooseEvaluation(item)}>
                    <span className={styles.metricState}>{pass ? <Check size={15} /> : <AlertTriangle size={15} />}{pass ? blocking && hasAcceptedRetest ? "补测通过" : "通过" : "待补测"}</span>
                    <strong>{text(item.metric_label)}</strong>
                    <b>{metricLabel(displayValue)}</b>
                    <small>要求 {comparatorLabel(item.comparator)} {metricLabel(item.threshold)} · 样本 {blocking && hasAcceptedRetest ? targetSampleSize : text(item.sample_size)}</small>
                    <em>{text(item.slice_id)} · {displayEvidence}</em>
                  </button>;
                })}</div>
              </section>;
            })}
          </div>

          <section className={styles.thresholdLens} aria-label="地区切片阈值标尺" style={thresholdStyle}>
            <header><div><BarChart3 size={19} /><span><strong>{text(blockingRow.metric_label)}</strong><small>{hasAcceptedRetest ? `补测数据版本 ${datasetVersion}` : "基线只有汇总差值，没有东西部单独成绩"}</small></span></div><b>{hasAcceptedRetest ? "补测通过" : evidenceLabel(blockingRow.evidence_status)}</b></header>
            <div className={styles.lensBody}>
              <div className={styles.scale} aria-hidden="true"><i data-marker="threshold" /><i data-marker="actual" /></div>
              <div className={styles.scaleLabels}><span>0</span><b data-label="threshold">门槛 {metricLabel(blockingThreshold)}</b><b data-label="actual">{hasAcceptedRetest ? "补测" : "基线"} {metricLabel(currentBlockingValue)}</b><span>{metricLabel(scaleMaximum)}</span></div>
              <aside><strong>{hasAcceptedRetest ? "低于" : "超出"}门槛 {thresholdDelta.toFixed(3)}</strong><span>样本 {hasAcceptedRetest ? targetSampleSize : text(blockingRow.sample_size)} · {text(blockingRow.slice_id)} · {hasAcceptedRetest ? "补测记录完整" : evidenceLabel(blockingRow.evidence_status)}</span></aside>
            </div>
          </section>
        </section>

        <aside className={styles.workflow} aria-label="补测流程与主管确认">
          <header><div><h2>补测闭环</h2><span>{props.selected.state}</span></div><label>当前角色<select aria-label="当前操作角色" value={props.actorRole} onChange={(event) => props.onActorRoleChange(event.target.value)}>{props.roles.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}</select></label></header>
          <ol className={styles.workflowSteps} aria-label="补测步骤">{workflowSteps.map((step) => {
            const state = workflowFinished || workflowRank > step.rank ? "complete" : workflowRank === step.rank ? "current" : "locked";
            return <li key={step.rank} data-state={state}><i>{state === "complete" ? <Check size={14} /> : step.rank}</i><span><strong>{step.title}</strong><small>{step.detail}</small></span><b>{state === "complete" ? "已完成" : state === "current" ? "当前" : "锁定"}</b></li>;
          })}</ol>

          <section className={styles.retestForm} aria-label="地区切片补测计划">
            <h3>地区切片补测计划</h3>
            <div className={styles.formGrid}>
              <label>目标样本量<input aria-label="补测目标样本量" type="number" min={numeric(blockingRow.sample_size)} value={targetSampleSize} onChange={(event) => setTargetSampleSize(event.target.value)} /></label>
              <label>补测数据版本<input aria-label="补测数据版本" value={datasetVersion} onChange={(event) => setDatasetVersion(event.target.value)} placeholder="填写新数据版本" /></label>
              <label>补测实测值<input aria-label="补测实测值" inputMode="decimal" value={retestMetricValue} onChange={(event) => setRetestMetricValue(event.target.value)} placeholder={`${comparatorLabel(blockingRow.comparator)} ${metricLabel(blockingThreshold)}`} /></label>
              <label className={styles.fullField}>补测/决策说明<textarea aria-label="会签说明" value={note} onChange={(event) => setNote(event.target.value)} placeholder="至少 4 个字符，说明补测范围或拒绝理由" /></label>
            </div>
            <ul className={styles.formChecks}>
              <li data-met={numeric(targetSampleSize) >= numeric(blockingRow.sample_size)}><i>{numeric(targetSampleSize) >= numeric(blockingRow.sample_size) ? <Check size={12} /> : "·"}</i>样本量不少于 {text(blockingRow.sample_size)}</li>
              <li data-met={datasetVersion.trim() !== ""}><i>{datasetVersion.trim() ? <Check size={12} /> : "·"}</i>填写补测数据版本</li>
              <li data-met={note.trim().length >= 4}><i>{note.trim().length >= 4 ? <Check size={12} /> : "·"}</i>说明不少于 4 个字符</li>
            </ul>
            {requestCommand ? <button type="button" className={styles.primaryAction} disabled={props.busy || !requestReady} title={requestReady ? requestCommand.label : "请补齐样本量、数据版本和说明"} onClick={() => runCommand(requestCommand.id)}><BadgeCheck size={18} />{props.busy ? "正在记录…" : requestCommand.label}</button> : null}
          </section>

          <section className={styles.reviewSeats} aria-label="三个独立职责席">
            <header><h3>三个独立职责席</h3><span>{props.selected.state === "补测已确认" ? "签署已记录" : signoffReady ? "可签署" : "等待补测通过"}</span></header>
            <div>{gateOrder.map((gate) => <label key={gate} data-signed={gateReviews[gate]}>
              <input type="checkbox" aria-label={`${gateLabels[gate]}评审已签署`} checked={gateReviews[gate]} disabled={props.busy || !signoffReady} onChange={(event) => setGateReviews((current) => ({ ...current, [gate]: event.target.checked }))} />
              <i>{gate === "risk" ? <ShieldAlert size={16} /> : gate === "fairness" ? <Scale size={16} /> : <ShieldCheck size={16} />}</i>
              <span><strong>{gateSeatLabels[gate]}</strong><small>独立职责 · {gateReviews[gate] ? "已签" : "待签"}</small></span>
              <b>{gateReviews[gate] ? <Check size={14} /> : "待签"}</b>
            </label>)}</div>
            <p role="status">{retestComplete ? `${text(blockingRow.metric_label)}${retestPass ? "已过线" : "仍未过线"}；三类准入检查${allGatesPass ? "全部通过" : "仍有阻断"}` : "等待新版本补测数据"}</p>
          </section>

          <section className={styles.chairGate} aria-label="准入主管确认">
            <header><ShieldCheck size={19} /><span><h3>准入主管确认</h3><small>主管必须与补测发起人分离</small></span></header>
            <ul>
              <li data-met={retestPass}><i>{retestPass ? <Check size={12} /> : "·"}</i>补测值 {comparatorLabel(blockingRow.comparator)} {metricLabel(blockingThreshold)}</li>
              <li data-met={retestComplete}><i>{retestComplete ? <Check size={12} /> : "·"}</i>证据与数据版本完整</li>
              <li data-met={allGateReviewsSigned}><i>{allGateReviewsSigned ? <Check size={12} /> : "·"}</i>三类评审均签署</li>
              <li data-met={actorSeparated}><i>{actorSeparated ? <Check size={12} /> : "·"}</i>主管与发起人身份分离</li>
            </ul>
            <button type="button" disabled={props.busy || !approveCommand || !approvalReady} title={approvalReady && approveCommand ? approveCommand.label : "补测、签署、角色或版本条件尚未满足"} onClick={() => approveCommand && runCommand(approveCommand.id)}><BadgeCheck size={18} />{approveCommand?.label ?? "确认补测已完成"}</button>
            {rejectCommand ? <div className={styles.rejectPath}><span>补测前可拒绝</span><button type="button" disabled={props.busy || !rejectionReady} title={rejectionReady ? rejectCommand.label : "仅准入主管可在初始状态填写理由后操作"} onClick={() => runCommand(rejectCommand.id)}><X size={17} />{rejectCommand.label}</button></div> : null}
          </section>

          {otherCommands.length ? <div className={styles.otherCommands}>{otherCommands.map((command) => <button type="button" key={command.id} disabled={props.busy} onClick={() => runCommand(command.id)}>{command.label}</button>)}</div> : null}
          {props.receipt ? <p className={styles.receipt} role="status">已记录：{props.receipt.event.fromState} → {props.receipt.event.toState}</p> : null}
          {props.error ? <p className={styles.error} role="alert"><span>{props.error}</span><button type="button" onClick={() => props.onSelect(props.selected.objectId)}>刷新当前检查项</button></p> : null}
        </aside>
      </section>

      <footer className={styles.statusbar}>
        <div><span>当前角色</span><strong>{roleLabel(props.actorRole)}</strong></div>
        <div><span>当前状态</span><strong>{props.selected.state} · v{props.selected.version}</strong></div>
        <div><span>{hasAcceptedRetest ? "已补测项" : "当前阻断项"}</span><strong>{text(blockingRow.evaluation_id)}</strong></div>
        <p><ShieldCheck size={17} />补测已确认也不是生产发布批准</p>
        <button type="button" onClick={() => setReportOpen(true)}><FileChartColumn size={17} />查看评测报告</button><ChevronRight size={17} />
      </footer>

      {reportOpen ? <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeReport(); }}><section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="evaluation-report-title"><header><div><FileChartColumn size={20} /><h2 id="evaluation-report-title">本地评测报告</h2></div><button type="button" aria-label="关闭评测报告" onClick={closeReport}><X size={18} /></button></header><p>候选 {candidateId} 的基线评测共 {rows.length} 项，{baselinePassed} 项通过，{baselineGaps.length} 项需要补测。报告不代表 Qwen 官方结果或企业发布批准。</p><table><thead><tr><th>检查类别</th><th>指标</th><th>实测值</th><th>要求</th><th>样本</th><th>证据状态</th><th>结果</th></tr></thead><tbody>{rows.map((item) => <tr key={text(item.evaluation_id)}><td>{gateLabels[text(item.gate) as GateId]}</td><td>{text(item.metric_label)}</td><td>{metricLabel(item.metric_value)}</td><td>{comparatorLabel(item.comparator)} {metricLabel(item.threshold)}</td><td>{text(item.sample_size)}</td><td>{evidenceLabel(item.evidence_status)}</td><td>{resultLabel(item.result)}</td></tr>)}</tbody></table></section></div> : null}
      {auditOpen ? <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeAudit(); }}><section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="admission-audit-title"><header><div><History size={20} /><h2 id="admission-audit-title">模型准入操作日志</h2></div><button type="button" aria-label="关闭操作日志" onClick={closeAudit}><X size={18} /></button></header><table><thead><tr><th>命令</th><th>状态迁移</th><th>操作者</th><th>时间</th><th>证据</th></tr></thead><tbody>{props.events.length ? props.events.map((event) => <tr key={event.eventId}><td>{auditCommandLabel(event.command)}</td><td>{event.fromState} → {event.toState}</td><td>{event.actor.id}（{roleLabel(event.actor.role)}）</td><td>{event.occurredAt}</td><td>{event.evidenceIds?.join("、") || "未附证据编号"}</td></tr>) : <tr><td colSpan={5}>尚无已持久化的操作事件。</td></tr>}</tbody></table></section></div> : null}
    </main>
  );
}
