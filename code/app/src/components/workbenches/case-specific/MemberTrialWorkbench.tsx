"use client";

import {
  BadgeCheck,
  Check,
  CircleAlert,
  Eye,
  RotateCcw,
  Send,
  ShoppingBag,
  ShoppingCart,
  TicketPercent,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { CaseWorkbenchProps } from "./types";
import styles from "./MemberTrialWorkbenchV3.module.css";

type BehaviourKey = "view_count" | "cart_count" | "buy_count";

const shell: CSSProperties = {
  minHeight: "100%",
  padding: "8px 14px",
  color: "#243746",
  background: "linear-gradient(135deg, #fffdf8 0%, #f8fbfc 44%, #f5f9fb 100%)",
  fontFamily: "var(--font-geist-sans, Arial, sans-serif)",
};

const card: CSSProperties = {
  border: "1px solid #e1e8eb",
  borderRadius: 13,
  background: "rgba(255,255,255,.94)",
  boxShadow: "0 10px 28px rgba(29, 66, 82, .055)",
};

const segmentColours: Record<string, string> = {
  观察: "#159f9f",
  成长: "#2586c7",
  活跃: "#6f63d8",
  核心: "#f5ad00",
};

function numeric(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roleLabel(role: string): string {
  if (role === "supervisor") return "会员运营主管";
  if (role === "operator") return "会员运营专员";
  return role;
}

function workflowStep(state: string): number {
  if (state === "首批名单已确认") return 3;
  if (state === "试投待审") return 2;
  return 1;
}

function statusLabel(state: string): string {
  if (state === "试投待审") return "等待主管审核";
  if (state === "首批名单已确认") return "名单已确认，尚未投放";
  if (state === "名单待调整") return "名单待调整";
  return "尚未投放";
}

type StoredTrialPlan = {
  sampleSize: number;
  budget: number;
  stopCount: number;
  stopBudget: number;
  planName: string;
  note: string;
  behaviour: BehaviourKey;
  minimum: number;
  segment: string;
  seed: string;
  treatmentPercent: number;
  hypothesis: string;
  primaryMetric: string;
  guardrailMetric: string;
  observationDays: number;
  treatmentUserIds: string[];
  controlUserIds: string[];
};

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function restoredTrialPlan(
  task: Record<string, unknown> | undefined,
  events: CaseWorkbenchProps["events"],
  objectId: string,
): StoredTrialPlan | undefined {
  const merged: Record<string, unknown> = {};
  for (const event of events.filter((item) => item.objectId === objectId).sort((left, right) => left.version - right.version)) {
    if (event.data) Object.assign(merged, event.data);
    if (!event.data && event.reason?.startsWith("trial-plan:")) {
      try { Object.assign(merged, JSON.parse(event.reason.slice("trial-plan:".length))); } catch { /* legacy reason is optional */ }
    }
  }
  if (task) Object.assign(merged, record(task.trialPlan ?? task));
  if (merged.task) Object.assign(merged, record(merged.task));
  if (typeof merged.planName !== "string" || !merged.planName.trim()) return undefined;
  const cohort = record(merged.cohort);
  const assignment = record(merged.assignment);
  const measurement = record(merged.measurement);
  const budgetBlock = record(merged.budget);
  const stopRule = record(merged.stopRule);
  const behaviour = String(cohort.behaviourKey ?? merged.behaviour ?? "view_count") as BehaviourKey;
  const treatmentUserIds = strings(assignment.treatmentUserIds);
  const controlUserIds = strings(assignment.controlUserIds);
  const assignedCount = treatmentUserIds.length + controlUserIds.length;
  return {
    sampleSize: numeric(assignment.sampleSize ?? merged.sampleSize),
    budget: numeric(budgetBlock.ceilingCny ?? merged.budget),
    stopCount: numeric(stopRule.maxTreatments ?? merged.stopCount),
    stopBudget: numeric(stopRule.maxBudgetCny ?? merged.stopBudget),
    planName: String(merged.planName),
    note: String(merged.note ?? ""),
    behaviour: ["view_count", "cart_count", "buy_count"].includes(behaviour) ? behaviour : "view_count",
    minimum: numeric(cohort.minimum ?? merged.minimum),
    segment: String(cohort.segment ?? merged.segment ?? "全部"),
    seed: String(assignment.seed ?? merged.seed ?? "coupon-2026-q3-v1"),
    treatmentPercent: numeric(assignment.treatmentPercent ?? merged.treatmentPercent)
      || (assignedCount ? Math.round(treatmentUserIds.length / assignedCount * 100) : 80),
    hypothesis: String(merged.hypothesis ?? ""),
    primaryMetric: String(measurement.primaryMetric ?? merged.primaryMetric ?? "7 日核销率"),
    guardrailMetric: String(measurement.guardrailMetric ?? merged.guardrailMetric ?? "客诉率不高于对照组"),
    observationDays: numeric(measurement.observationDays ?? merged.observationDays) || 7,
    treatmentUserIds,
    controlUserIds,
  };
}

function stableScore(id: string, seed: string): number {
  let hash = 2166136261;
  for (const character of `${seed}:${id}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function MemberTrialWorkbench(props: CaseWorkbenchProps) {
  const rows = props.sceneRows.length ? props.sceneRows : props.objects.map((item) => item.payload);
  const restored = restoredTrialPlan(props.selected.task, props.events, props.selected.objectId);
  const defaultSampleSize = Math.min(300, rows.length);
  const [behaviour, setBehaviour] = useState<BehaviourKey>(restored?.behaviour ?? "view_count");
  const [minimum, setMinimum] = useState(restored?.minimum ?? 0);
  const [segment, setSegment] = useState(restored?.segment ?? "全部");
  const [sampleSize, setSampleSize] = useState(restored?.sampleSize || defaultSampleSize);
  const [budget, setBudget] = useState(restored?.budget ?? 3000);
  const [stopCount, setStopCount] = useState(restored?.stopCount || Math.max(1, Math.ceil(defaultSampleSize / 2)));
  const [stopBudget, setStopBudget] = useState(restored?.stopBudget ?? 3000);
  const [planName, setPlanName] = useState(restored?.planName ?? "8 元券首批试投");
  const [note, setNote] = useState(restored?.note ?? "");
  const [seed, setSeed] = useState(restored?.seed ?? "coupon-2026-q3-v1");
  const [treatmentPercent, setTreatmentPercent] = useState(restored?.treatmentPercent ?? 80);
  const [hypothesis, setHypothesis] = useState(restored?.hypothesis ?? "向高参与会员发放 8 元券，会提高 7 日核销率");
  const [primaryMetric, setPrimaryMetric] = useState(restored?.primaryMetric ?? "7 日核销率");
  const [guardrailMetric, setGuardrailMetric] = useState(restored?.guardrailMetric ?? "客诉率不高于对照组");
  const [observationDays, setObservationDays] = useState(restored?.observationDays ?? 7);
  const [visibleGroup, setVisibleGroup] = useState<"treatment" | "control" | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const step = workflowStep(props.selected.state);
  const restorationKey = `${props.selected.objectId}|${props.selected.version}|${JSON.stringify(restored)}`;

  useEffect(() => {
    if (!restored) {
      setBehaviour("view_count");
      setMinimum(0);
      setSegment("全部");
      setSampleSize(defaultSampleSize);
      setBudget(3000);
      setStopCount(Math.max(1, Math.ceil(defaultSampleSize / 2)));
      setStopBudget(3000);
      setPlanName("8 元券首批试投");
      setNote("");
      setSeed("coupon-2026-q3-v1");
      setTreatmentPercent(80);
      setHypothesis("向高参与会员发放 8 元券，会提高 7 日核销率");
      setPrimaryMetric("7 日核销率");
      setGuardrailMetric("客诉率不高于对照组");
      setObservationDays(7);
      return;
    }
    setBehaviour(restored.behaviour);
    setMinimum(restored.minimum);
    setSegment(restored.segment);
    setSampleSize(restored.sampleSize || defaultSampleSize);
    setBudget(restored.budget);
    setStopCount(restored.stopCount || 1);
    setStopBudget(restored.stopBudget);
    setPlanName(restored.planName);
    setNote(restored.note);
    setSeed(restored.seed);
    setTreatmentPercent(restored.treatmentPercent);
    setHypothesis(restored.hypothesis);
    setPrimaryMetric(restored.primaryMetric);
    setGuardrailMetric(restored.guardrailMetric);
    setObservationDays(restored.observationDays);
  }, [restorationKey]);

  const segments = useMemo(
    () => Array.from(new Set(rows.map((row) => String(row.value_segment ?? "未分层")))).sort(
      (left, right) => ["观察", "成长", "活跃", "核心"].indexOf(left) - ["观察", "成长", "活跃", "核心"].indexOf(right),
    ),
    [rows],
  );
  const thresholdRows = useMemo(
    () => rows.filter((row) => numeric(row[behaviour]) >= minimum),
    [behaviour, minimum, rows],
  );
  const filteredRows = useMemo(
    () => thresholdRows.filter((row) => segment === "全部" || String(row.value_segment) === segment),
    [segment, thresholdRows],
  );
  const distribution = useMemo(
    () => segments.map((label) => ({
      label,
      count: filteredRows.filter((row) => String(row.value_segment) === label).length,
      colour: segmentColours[label] ?? "#64748b",
    })),
    [filteredRows, segments],
  );
  const selectedRow = props.selected.payload;
  const boundedSample = Math.min(Math.max(sampleSize, 0), filteredRows.length);
  const sampledRows = useMemo(
    () => [...filteredRows]
      .sort((left, right) => stableScore(String(left.user_id), seed) - stableScore(String(right.user_id), seed))
      .slice(0, boundedSample),
    [boundedSample, filteredRows, seed],
  );
  const assignment = useMemo(() => {
    if (sampledRows.length < 2) return { treatment: sampledRows, control: [] };
    const ranked = [...sampledRows].sort(
      (left, right) => stableScore(String(left.user_id), `${seed}:assignment`) - stableScore(String(right.user_id), `${seed}:assignment`),
    );
    const treatmentCount = Math.max(
      1,
      Math.min(ranked.length - 1, Math.round(ranked.length * treatmentPercent / 100)),
    );
    return {
      treatment: ranked.slice(0, treatmentCount),
      control: ranked.slice(treatmentCount),
    };
  }, [sampledRows, seed, treatmentPercent]);
  const estimatedCost = assignment.treatment.length * 8;
  const budgetUsage = budget > 0 ? estimatedCost / budget * 100 : estimatedCost > 0 ? 100 : 0;
  const treatmentIds = useMemo(
    () => new Set(assignment.treatment.map((member) => String(member.user_id))),
    [assignment.treatment],
  );
  const visibleMembers = visibleGroup ? assignment[visibleGroup] : sampledRows;
  const constellationMembers = visibleMembers.slice(0, 18);
  const selectedMember = visibleMembers.find((member) => String(member.user_id) === selectedMemberId)
    ?? visibleMembers[0];
  const selectedMemberGroup = selectedMember && treatmentIds.has(String(selectedMember.user_id)) ? "treatment" : "control";
  const groupBalanceGap = Math.abs(assignment.treatment.length - assignment.control.length);
  const draftIssues = [
    !planName.trim() ? "填写方案名称" : "",
    !hypothesis.trim() ? "填写实验假设" : "",
    !primaryMetric.trim() ? "填写主指标" : "",
    !guardrailMetric.trim() ? "填写护栏指标" : "",
    !seed.trim() ? "填写分组种子" : "",
    boundedSample < 2 ? "样本至少 2 人" : "",
    assignment.treatment.length < 1 || assignment.control.length < 1 ? "处理组和对照组都要有人" : "",
    estimatedCost > budget ? "券面预算超过上限" : "",
    stopCount < 1 || stopCount > assignment.treatment.length ? "人数停止线不能超过处理组" : "",
    stopBudget < 1 || stopBudget > budget ? "预算停止线不能超过预算" : "",
    observationDays < 1 ? "观察窗口至少 1 天" : "",
  ].filter(Boolean);
  const invalidDraft = draftIssues.length > 0;
  const trialData = {
    planName: planName.trim(),
    hypothesis: hypothesis.trim(),
    note: note.trim(),
    cohort: {
      behaviourKey: behaviour,
      minimum,
      segment,
      eligibleCount: filteredRows.length,
    },
    assignment: {
      seed: seed.trim(),
      treatmentPercent,
      sampleSize: sampledRows.length,
      treatmentUserIds: assignment.treatment.map((row) => String(row.user_id)),
      controlUserIds: assignment.control.map((row) => String(row.user_id)),
    },
    measurement: {
      primaryMetric: primaryMetric.trim(),
      guardrailMetric: guardrailMetric.trim(),
      observationDays,
    },
    budget: {
      couponValueCny: 8,
      ceilingCny: budget,
      estimatedCny: estimatedCost,
    },
    stopRule: {
      maxTreatments: stopCount,
      maxBudgetCny: stopBudget,
    },
  };
  const trialPlanReason = `trial-plan:${JSON.stringify({
    sampleSize: sampledRows.length,
    budget,
    stopCount,
    stopBudget,
    planName: planName.trim(),
    note: note.trim(),
    task: trialData,
  })}`;
  const assignmentKey = stableScore(
    [...trialData.assignment.treatmentUserIds, ...trialData.assignment.controlUserIds].join("|"),
    seed,
  ).toString(16).padStart(8, "0");

  function runCommand(commandId: string) {
    if (commandId !== "design_trial") {
      props.onCommand(commandId, undefined);
      return;
    }
    props.onCommand(commandId, trialPlanReason, {
      data: trialData,
      evidenceIds: ["DATA-02", `cohort:${assignmentKey}`, `selected:${String(selectedRow.user_id ?? props.selected.objectId)}`],
      idempotencyKey: `case-02:${props.selected.objectId}:design_trial:v${props.selected.version}:${assignmentKey}`,
    });
  }

  return (
    <main className={styles.shell} style={shell} aria-label="8 元券试投方案工作台">
      <header style={{ display: "grid", gridTemplateColumns: "1fr minmax(620px, .9fr) auto", alignItems: "center", gap: 24, minHeight: 56, marginBottom: 8 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 style={{ margin: 0, color: "#172833", fontSize: 25, letterSpacing: "-.035em" }}>8 元券首批试投</h1>
            <span style={{ padding: "6px 11px", borderRadius: 999, color: step === 2 ? "#946100" : "#b26c00", background: "#fff2d7", fontSize: 11, fontWeight: 850 }}>{statusLabel(props.selected.state)}</span>
          </div>
          <p style={{ margin: "7px 0 0", color: "#60727d", fontSize: 12 }}>本地行为记录 {props.datasetRowCount.toLocaleString("zh-CN")} 条 · 单张优惠券 ¥8</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", alignItems: "center" }} aria-label="试投流程">
          {["方案编排", "方案审核", "试投执行"].map((label, index) => <div key={label} style={{ display: "flex", alignItems: "center", color: index + 1 <= step ? "#202d35" : "#80909a", fontSize: 12, fontWeight: index + 1 === step ? 850 : 650 }}><i style={{ display: "grid", width: 28, height: 28, flex: "0 0 28px", placeItems: "center", marginRight: 8, borderRadius: 999, color: index + 1 <= step ? "#fff" : "#55646e", background: index + 1 <= step ? "#f5b400" : "#fff", boxShadow: index + 1 <= step ? "0 5px 14px rgba(245,180,0,.24)" : "inset 0 0 0 1px #dbe2e6", fontStyle: "normal", fontWeight: 850 }}>{index + 1 < step ? <Check aria-hidden="true" size={14} /> : index + 1}</i><span style={{ whiteSpace: "nowrap" }}>{label}</span>{index < 2 ? <span style={{ height: 1, flex: 1, margin: "0 14px", background: index + 1 < step ? "#f5b400" : "#dfe5e8" }} /> : null}</div>)}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <button type="button" onClick={props.onReset} disabled={props.busy} aria-label="恢复会员试投初始状态" title="恢复初始状态" style={{ display: "grid", width: 39, height: 39, placeItems: "center", border: "1px solid #dce5e8", borderRadius: 9, color: "#536c78", background: "#fff" }}><RotateCcw aria-hidden="true" size={16} /></button>
          <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#425965", fontSize: 11, fontWeight: 800 }}><UserRoundCheck aria-hidden="true" size={17} />{roleLabel(props.actorRole)}</span>
        </div>
      </header>

      <section className={styles.workspace} style={{ display: "grid", minHeight: "calc(100vh - 164px)", gridTemplateColumns: "minmax(320px, .78fr) minmax(560px, 1.18fr) minmax(350px, .88fr)", gap: 14 }}>
        <aside className={styles.cohortRail} style={{ ...card, padding: 16 }} aria-label="目标人群构建">
          <header><strong style={{ display: "block", color: "#1b303c", fontSize: 16 }}>目标人群构建</strong><small style={{ display: "block", marginTop: 5, color: "#70818a", fontSize: 10 }}>只用已有行为字段筛选，不生成消费能力标签</small></header>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", marginTop: 15, overflow: "hidden", border: "1px solid #dfe7e9", borderRadius: 8 }}>
            {([
              ["view_count", "浏览", Eye],
              ["cart_count", "加购", ShoppingCart],
              ["buy_count", "购买", ShoppingBag],
            ] as const).map(([key, label, Icon]) => <button key={key} type="button" onClick={() => setBehaviour(key)} aria-pressed={behaviour === key} style={{ minHeight: 46, border: 0, borderRight: key === "buy_count" ? 0 : "1px solid #e1e8ea", color: behaviour === key ? "#fff" : "#334a57", background: behaviour === key ? "#059b98" : "#fff", fontSize: 12, fontWeight: 800 }}><Icon aria-hidden="true" size={17} style={{ marginRight: 6, verticalAlign: "-4px" }} />{label}</button>)}
          </div>

          <section style={{ marginTop: 17 }}>
            <strong style={{ fontSize: 12 }}>行为条件</strong>
            <label style={{ display: "grid", gridTemplateColumns: "90px 1fr", alignItems: "center", gap: 10, marginTop: 11, color: "#566b76", fontSize: 11 }}><span>{behaviour === "view_count" ? "浏览次数" : behaviour === "cart_count" ? "加购次数" : "购买次数"}</span><span style={{ display: "grid", gridTemplateColumns: "84px 1fr", gap: 7 }}><select aria-label="行为比较方式" style={{ padding: "8px 9px", border: "1px solid #dce5e8", borderRadius: 7, color: "#415966", background: "#fff", fontSize: 11 }}><option>不少于</option></select><input aria-label="行为次数下限" type="number" min="0" value={minimum} onChange={(event) => setMinimum(Math.max(0, Number(event.target.value)))} style={{ minWidth: 0, padding: "8px 9px", border: "1px solid #dce5e8", borderRadius: 7, color: "#273e49", background: "#fff" }} /></span></label>
            <label style={{ display: "grid", gridTemplateColumns: "90px 1fr", alignItems: "center", gap: 10, marginTop: 10, color: "#566b76", fontSize: 11 }}><span>价值分层</span><select aria-label="会员价值分层" value={segment} onChange={(event) => setSegment(event.target.value)} style={{ padding: "8px 9px", border: "1px solid #dce5e8", borderRadius: 7, color: "#415966", background: "#fff", fontSize: 11 }}><option>全部</option>{segments.map((item) => <option key={item}>{item}</option>)}</select></label>
          </section>

          <section className={styles.funnelPanel} aria-label="筛选收敛路径">
            <header><strong>筛选收敛路径</strong><small>每一关都可由当前记录复算</small></header>
            <ol className={styles.funnel} aria-label="人群筛选漏斗">
              <li aria-label={`全部记录：${rows.length}`}><span><b>全部记录</b><strong>{rows.length.toLocaleString("zh-CN")}</strong></span><i><em style={{ width: "100%" }} /></i></li>
              <li aria-label={`阈值命中：${thresholdRows.length}`}><span><b>行为阈值命中</b><strong>{thresholdRows.length.toLocaleString("zh-CN")}</strong></span><i><em style={{ width: `${rows.length ? thresholdRows.length / rows.length * 100 : 0}%` }} /></i></li>
              <li aria-label={`分层命中：${filteredRows.length}`}><span><b>价值分层命中</b><strong>{filteredRows.length.toLocaleString("zh-CN")}</strong></span><i><em style={{ width: `${thresholdRows.length ? filteredRows.length / thresholdRows.length * 100 : 0}%` }} /></i></li>
              <li className={styles.pendingFunnel} aria-label="排除字段：待补"><span><b>黑名单 / 活动冲突</b><strong>待补</strong></span><i><em style={{ width: "100%" }} /></i><small>会员平台未提供字段，不能按 0 人处理</small></li>
              <li aria-label={`可抽样：${filteredRows.length}`}><span><b>当前可抽样</b><strong>{filteredRows.length.toLocaleString("zh-CN")}</strong></span><i><em style={{ width: "100%" }} /></i></li>
            </ol>
          </section>
        </aside>

        <section className={styles.memberWorkspace} aria-label="首批试投名单">
          <article style={{ ...card, overflow: "hidden" }}>
            <header className={styles.memberHeader}>
              <span><strong>人群分组图</strong><small>筛选、抽样与固定种子分组随参数实时变化</small></span>
              <span className={styles.segmentLegend}>{distribution.map((item) => <b key={item.label}><i style={{ background: item.colour }} />{item.label} {item.count}</b>)}</span>
            </header>

            <section className={styles.kpiStrip} aria-label="试投运行概览">
              <div aria-label="候选人数"><span>候选人数</span><strong key={`eligible-${filteredRows.length}`} className={styles.metricValue}>{filteredRows.length.toLocaleString("zh-CN")}</strong></div>
              <div aria-label="抽样人数"><span>抽样人数</span><strong key={`sample-${sampledRows.length}`} className={styles.metricValue}>{sampledRows.length.toLocaleString("zh-CN")}</strong></div>
              <div aria-label="处理组人数"><span>处理组人数</span><strong key={`treatment-${assignment.treatment.length}`} className={styles.metricValue}>{assignment.treatment.length.toLocaleString("zh-CN")}</strong></div>
              <div aria-label="券面预算"><span>券面预算</span><strong key={`cost-${estimatedCost}`} className={styles.metricValue}>¥{estimatedCost.toLocaleString("zh-CN")}</strong></div>
              <div aria-label="预算使用率"><span>预算使用率</span><strong key={`usage-${budgetUsage.toFixed(1)}`} className={styles.metricValue}>{budgetUsage.toFixed(1)}%</strong></div>
              <div aria-label="人数差"><span>人数差</span><strong key={`gap-${groupBalanceGap}`} className={styles.metricValue}>{groupBalanceGap}</strong></div>
            </section>

            <section className={styles.groupControls} aria-label="确定性实验分组">
              <button type="button" aria-label="查看全部名单" aria-pressed={visibleGroup === null} onClick={() => { setVisibleGroup(null); setSelectedMemberId(String(sampledRows[0]?.user_id ?? "")); }}>查看全部名单 <b>{sampledRows.length}</b></button>
              <button type="button" aria-label="查看处理组名单" aria-pressed={visibleGroup === "treatment"} onClick={() => { setVisibleGroup("treatment"); setSelectedMemberId(String(assignment.treatment[0]?.user_id ?? "")); }}>查看处理组名单 <b>{assignment.treatment.length}</b></button>
              <button type="button" aria-label="查看对照组名单" aria-pressed={visibleGroup === "control"} onClick={() => { setVisibleGroup("control"); setSelectedMemberId(String(assignment.control[0]?.user_id ?? "")); }}>查看对照组名单 <b>{assignment.control.length}</b></button>
              <div aria-hidden="true" className={styles.splitBar}><i style={{ width: `${sampledRows.length ? assignment.treatment.length / sampledRows.length * 100 : 0}%` }} /><i /></div>
            </section>

            <section className={styles.constellationStage} aria-label="人群分组图">
              <div className={styles.layerStack} aria-hidden="true">
                <i /><i /><i /><i />
              </div>
              <div className={styles.layerLabels} aria-hidden="true">
                <span>初始人群 <strong>{rows.length.toLocaleString("zh-CN")}</strong></span>
                <span>行为命中 <strong>{thresholdRows.length.toLocaleString("zh-CN")}</strong></span>
                <span>分层命中 <strong>{filteredRows.length.toLocaleString("zh-CN")}</strong></span>
                <span>当前样本 <strong>{sampledRows.length.toLocaleString("zh-CN")}</strong></span>
              </div>
              <div className={styles.constellationCanvas}>
                <span className={styles.constellationCore} aria-hidden="true">{sampledRows.length}</span>
                {constellationMembers.map((member, index) => {
                  const id = String(member.user_id);
                  const memberGroup = treatmentIds.has(id) ? "treatment" : "control";
                  const groupLabel = memberGroup === "treatment" ? "处理组" : "对照组";
                  const active = id === String(selectedMember?.user_id);
                  const angle = ((index * 137.5) + stableScore(id, "angle") % 31) * Math.PI / 180;
                  const radius = 20 + stableScore(id, "radius") % 27;
                  const nodeStyle = {
                    "--node-x": `${50 + Math.cos(angle) * radius * 1.34}%`,
                    "--node-y": `${51 + Math.sin(angle) * radius * .76}%`,
                    "--node-size": `${10 + Math.min(14, numeric(member.engagement_score) / 12)}px`,
                  } as CSSProperties;
                  return <button
                    key={`${visibleGroup ?? "all"}-${id}`}
                    type="button"
                    className={styles.memberNode}
                    data-group={memberGroup}
                    data-active={active || undefined}
                    style={nodeStyle}
                    aria-label={`会员 ${id} · ${groupLabel}`}
                    aria-pressed={active}
                    onClick={() => setSelectedMemberId(id)}
                  ><span>{id}</span></button>;
                })}
              </div>
              <footer className={styles.constellationFooter}>
                <span><UsersRound aria-hidden="true" size={15} />图中显示 {constellationMembers.length} / {visibleMembers.length} 人</span>
                <div aria-label="试投预算联动">处理组 {assignment.treatment.length} 人 × ¥8 = <strong>¥{estimatedCost.toLocaleString("zh-CN")}</strong></div>
                <div aria-label="名单状态" data-warning={invalidDraft || undefined}><strong>{invalidDraft ? "待调整" : "预算内，可提交"}</strong> · 余额 ¥{Math.max(0, budget - estimatedCost).toLocaleString("zh-CN")}</div>
              </footer>
            </section>

            {selectedMember ? <article className={styles.memberDetail} aria-label="成员入组说明">
              <header><strong>{String(selectedMember.user_id)} · {selectedMemberGroup === "treatment" ? "处理组" : "对照组"}</strong><span>{String(selectedMember.value_segment ?? "未分层")}</span></header>
              <p>满足当前浏览次数、加购次数与购买次数筛选；确定性分组种子 {seed} 将该成员稳定分入{selectedMemberGroup === "treatment" ? "处理组" : "对照组"}。黑名单与活动冲突字段仍待会员平台补齐。</p>
              <dl><div><dt>浏览</dt><dd>{numeric(selectedMember.view_count)}</dd></div><div><dt>加购</dt><dd>{numeric(selectedMember.cart_count)}</dd></div><div><dt>购买</dt><dd>{numeric(selectedMember.buy_count)}</dd></div><div><dt>行为分</dt><dd>{numeric(selectedMember.engagement_score)}</dd></div><div><dt>分组权益</dt><dd>{selectedMemberGroup === "treatment" ? "¥8" : "¥0"}</dd></div></dl>
            </article> : null}
          </article>

          <details className={styles.dataBoundary}>
            <summary>数据使用边界</summary>
            <p>当前记录只有浏览、加购、购买、参与度与价值分层；没有绝对事件时间、消费金额和优惠券历史，因此不展示购买力、预计增量、转化或 GMV。</p>
          </details>
        </section>

        <aside className={styles.settingsRail} style={{ ...card, padding: 17 }} aria-label="实验护栏">
          <header><strong style={{ display: "block", fontSize: 16 }}>实验护栏</strong><small style={{ display: "block", marginTop: 5, color: "#71828b", fontSize: 10 }}>先锁定预算、指标与停止线，再提交审批</small></header>
          <section style={{ display: "grid", gridTemplateColumns: "108px 1fr", alignItems: "stretch", minHeight: 85, marginTop: 15, overflow: "hidden", border: "1px solid #f3c45c", borderRadius: 9, background: "#fffdf7" }}><div style={{ display: "grid", placeItems: "center", alignContent: "center", color: "#fff", background: "linear-gradient(135deg,#ffb400,#f29d00)" }}><small style={{ fontSize: 11 }}>单张</small><strong style={{ fontSize: 34 }}>¥8</strong></div><div style={{ display: "flex", alignItems: "center", padding: 17, color: "#263944", fontSize: 15, fontWeight: 850 }}><TicketPercent aria-hidden="true" size={22} style={{ marginRight: 9, color: "#e99b00" }} />8 元无门槛券</div></section>

          <section style={{ marginTop: 17 }}><strong style={{ fontSize: 12 }}>确定性分组</strong><label style={{ display: "grid", gridTemplateColumns: "82px 1fr", alignItems: "center", gap: 8, marginTop: 10, color: "#5a6e78", fontSize: 10 }}><span>处理组比例</span><span style={{ display: "grid", gridTemplateColumns: "1fr 34px" }}><input aria-label="处理组比例" type="number" min="10" max="90" step="5" value={treatmentPercent} onChange={(event) => setTreatmentPercent(Math.min(90, Math.max(10, Number(event.target.value))))} style={{ minWidth: 0, padding: "8px 9px", border: "1px solid #dce5e8", borderRadius: "7px 0 0 7px" }} /><i style={{ display: "grid", placeItems: "center", border: "1px solid #dce5e8", borderLeft: 0, borderRadius: "0 7px 7px 0", fontStyle: "normal" }}>%</i></span></label><label style={{ display: "grid", gridTemplateColumns: "82px 1fr", alignItems: "center", gap: 8, marginTop: 9, color: "#5a6e78", fontSize: 10 }}><span>分组种子</span><input aria-label="确定性分组种子" value={seed} onChange={(event) => setSeed(event.target.value)} style={{ minWidth: 0, padding: "8px 9px", border: "1px solid #dce5e8", borderRadius: 7 }} /></label><p style={{ margin: "7px 0 0 90px", color: "#73858d", fontSize: 9 }}>同一人群、比例与种子会生成同一处理组和对照组。</p></section>

          <section style={{ marginTop: 17 }}><strong style={{ fontSize: 12 }}>预算与规模</strong><label style={{ display: "grid", gridTemplateColumns: "82px 1fr", alignItems: "center", gap: 8, marginTop: 11, color: "#5a6e78", fontSize: 10 }}><span>样本规模</span><span style={{ display: "grid", gridTemplateColumns: "1fr 34px" }}><input aria-label="试投样本规模" type="number" min="1" max={Math.max(filteredRows.length, 1)} value={sampleSize} onChange={(event) => setSampleSize(Math.max(0, Number(event.target.value)))} style={{ minWidth: 0, padding: "8px 9px", border: "1px solid #dce5e8", borderRadius: "7px 0 0 7px" }} /><i style={{ display: "grid", placeItems: "center", border: "1px solid #dce5e8", borderLeft: 0, borderRadius: "0 7px 7px 0", fontStyle: "normal" }}>人</i></span></label><label style={{ display: "grid", gridTemplateColumns: "82px 1fr", alignItems: "center", gap: 8, marginTop: 9, color: "#5a6e78", fontSize: 10 }}><span>预算上限</span><span style={{ display: "grid", gridTemplateColumns: "1fr 34px" }}><input aria-label="试投预算上限" type="number" min="0" value={budget} onChange={(event) => setBudget(Math.max(0, Number(event.target.value)))} style={{ minWidth: 0, padding: "8px 9px", border: "1px solid #dce5e8", borderRadius: "7px 0 0 7px" }} /><i style={{ display: "grid", placeItems: "center", border: "1px solid #dce5e8", borderLeft: 0, borderRadius: "0 7px 7px 0", fontStyle: "normal" }}>元</i></span></label><p style={{ margin: "8px 0 0 90px", color: estimatedCost > budget ? "#c16b00" : "#5c7b74", fontSize: 9 }}>{estimatedCost > budget ? `按每人 8 元计算需 ¥${estimatedCost.toLocaleString("zh-CN")}，已超过预算` : `券面预算约 ¥${estimatedCost.toLocaleString("zh-CN")}，未超过上限`}</p></section>

          <section style={{ marginTop: 17 }}><strong style={{ fontSize: 12 }}>停止规则</strong><label style={{ display: "grid", gridTemplateColumns: "82px 1fr", alignItems: "center", gap: 8, marginTop: 10, color: "#5a6e78", fontSize: 10 }}><span>名单人数</span><span style={{ display: "grid", gridTemplateColumns: "1fr 56px" }}><input aria-label="按样本规模停止" type="number" min="1" value={stopCount} onChange={(event) => setStopCount(Math.max(0, Number(event.target.value)))} style={{ minWidth: 0, padding: "8px 9px", border: "1px solid #dce5e8", borderRadius: "7px 0 0 7px" }} /><i style={{ display: "grid", placeItems: "center", border: "1px solid #dce5e8", borderLeft: 0, borderRadius: "0 7px 7px 0", fontStyle: "normal" }}>人停止</i></span></label><label style={{ display: "grid", gridTemplateColumns: "82px 1fr", alignItems: "center", gap: 8, marginTop: 9, color: "#5a6e78", fontSize: 10 }}><span>预算消耗</span><span style={{ display: "grid", gridTemplateColumns: "1fr 56px" }}><input aria-label="按预算上限停止" type="number" min="0" value={stopBudget} onChange={(event) => setStopBudget(Math.max(0, Number(event.target.value)))} style={{ minWidth: 0, padding: "8px 9px", border: "1px solid #dce5e8", borderRadius: "7px 0 0 7px" }} /><i style={{ display: "grid", placeItems: "center", border: "1px solid #dce5e8", borderLeft: 0, borderRadius: "0 7px 7px 0", fontStyle: "normal" }}>元停止</i></span></label></section>

          <section className={styles.measurementSettings} aria-label="观测指标">
            <strong>观测指标</strong><label><span>实验假设</span><textarea aria-label="实验假设" value={hypothesis} onChange={(event) => setHypothesis(event.target.value)} rows={2} /></label><label><span>主指标</span><input aria-label="试投主指标" value={primaryMetric} onChange={(event) => setPrimaryMetric(event.target.value)} /></label><label><span>护栏指标</span><input aria-label="试投护栏指标" value={guardrailMetric} onChange={(event) => setGuardrailMetric(event.target.value)} /></label><label><span>观察窗口</span><span className={styles.unitInput}><input aria-label="试投观察天数" type="number" min="1" value={observationDays} onChange={(event) => setObservationDays(Math.max(0, Number(event.target.value)))} /><i>天</i></span></label>
          </section>

          <details className={styles.moreSettings}>
            <summary>方案信息与结果边界</summary>
            <section><strong>方案信息</strong><label><span>方案名称</span><input aria-label="试投方案名称" value={planName} onChange={(event) => setPlanName(event.target.value)} /></label><label><span>备注</span><span><textarea aria-label="试投方案备注" value={note} maxLength={100} onChange={(event) => setNote(event.target.value)} placeholder="记录这次试投要验证的问题" /><small>{note.length}/100</small></span></label></section>
            <section className={styles.resultBoundary}><strong><CircleAlert aria-hidden="true" size={17} />结果尚未发生</strong><p>名单获批并真实投放后，才能记录触达、领取、核销和对照组结果。</p></section>
          </details>

          <section className={styles.actionDock} aria-label="试投提交操作">
            <label>操作角色<select aria-label="当前操作角色" value={props.actorRole} onChange={(event) => props.onActorRoleChange(event.target.value)}>{props.roles.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}</select></label>
            <div className={styles.commandGrid}>
              {props.commands.map((command) => { const disabled = props.busy || (command.id === "design_trial" && invalidDraft) || (command.id !== "design_trial" && !restored); return <button key={command.id} type="button" onClick={() => runCommand(command.id)} disabled={disabled} title={disabled && !props.busy ? "请先补齐并持久化试投任务" : command.label} data-tone={command.id === "stop_trial" ? "warning" : "primary"}><Send aria-hidden="true" size={14} />{props.busy ? "正在记录…" : command.label}</button>; })}
            </div>
            {invalidDraft && props.commands.some((command) => command.id === "design_trial") ? <p role="alert" className={styles.warning}>待补：{draftIssues.join("；")}。</p> : null}
            {props.receipt ? <p role="status" className={styles.success}><BadgeCheck aria-hidden="true" size={13} />已持久化：{props.receipt.event.fromState} → {props.receipt.event.toState}</p> : null}
            {props.error ? <p role="alert" className={styles.error}>{props.error} <button type="button" onClick={() => props.onSelect(props.selected.objectId)}>刷新当前会员</button></p> : null}
          </section>
        </aside>
      </section>
    </main>
  );
}
