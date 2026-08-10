"use client";

import {
  Archive,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileText,
  Filter,
  Quote,
  RefreshCcw,
  Search,
  Scale,
  ShieldCheck,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { MetricCards, ReceiptNote, WorkbenchFrame } from "./WorkbenchFrame";
import styles from "./ReviewResearchWorkbench.module.css";
import type { CaseWorkbenchProps } from "./types";

const aspects = [
  { key: "Service#Hospitality", label: "接待态度", keywords: ["服务员", "态度", "没人理", "没空", "质问", "冷漠"] },
  { key: "Service#Queue", label: "排队", keywords: ["排队", "等位", "等号", "先来后到", "发牌号"] },
  { key: "Service#Timely", label: "上菜时效", keywords: ["上菜慢", "等了半天", "没上", "才开始上菜", "40多分钟"] },
  { key: "Food#Taste", label: "餐食品质", keywords: ["口味", "味道", "不新鲜", "难吃", "柴", "油而不香"] },
] as const;

type AspectKey = (typeof aspects)[number]["key"];
type SentimentFilter = "全部" | "负向" | "正向";
type EvidenceLane = "supportEvidenceIds" | "counterEvidenceIds";

type ReviewValidationTask = {
  taskId: string;
  aspectKey: AspectKey;
  aspectLabel: string;
  supportEvidenceIds: string[];
  counterEvidenceIds: string[];
  testableQuestion: string;
  researchMethod: string;
  sampleSize: number;
  owner: string;
  dueDate: string;
  observationWindow: string;
  successCriteria: string;
};

type ReviewValidationDraft = Omit<ReviewValidationTask, "sampleSize"> & { sampleSize: string };

function text(value: unknown, fallback = "—"): string {
  return value == null || value === "" ? fallback : String(value);
}

function numeric(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function sentiment(value: unknown): "negative" | "positive" | "neutral" | "unmentioned" {
  const parsed = numeric(value);
  if (parsed === -1) return "negative";
  if (parsed === 1) return "positive";
  if (parsed === 0) return "neutral";
  return "unmentioned";
}

function sentimentLabel(value: unknown): string {
  const state = sentiment(value);
  if (state === "negative") return "负向";
  if (state === "positive") return "正向";
  if (state === "neutral") return "中性";
  return "未提及";
}

function reviewOf(row: Record<string, unknown>): string {
  return text(row.review ?? row.text ?? row.content, "该记录未提供评论正文");
}

function reviewId(row: Record<string, unknown>, fallback: string): string {
  return text(row.id, fallback.replace(/^03-/, ""));
}

function aspectFor(key: AspectKey) {
  return aspects.find((item) => item.key === key) ?? aspects[0];
}

function isAspectKey(value: unknown): value is AspectKey {
  return aspects.some((item) => item.key === value);
}

function stringArray(value: unknown): string[] | undefined {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
    : undefined;
}

function taskPatch(value: unknown): Partial<ReviewValidationTask> {
  if (!value || typeof value !== "object") return {};
  const source = value as Record<string, unknown>;
  const nested = source.validationTask;
  const data = nested && typeof nested === "object" ? nested as Record<string, unknown> : source;
  const patch: Partial<ReviewValidationTask> = {};
  const aspectKey = data.aspectKey ?? data.topic;
  const sampleSize = numeric(data.sampleSize);
  if (typeof data.taskId === "string") patch.taskId = data.taskId;
  if (isAspectKey(aspectKey)) patch.aspectKey = aspectKey;
  if (typeof data.aspectLabel === "string") patch.aspectLabel = data.aspectLabel;
  patch.supportEvidenceIds = stringArray(data.supportEvidenceIds ?? data.supportingEvidenceIds);
  patch.counterEvidenceIds = stringArray(data.counterEvidenceIds ?? data.counterexampleIds);
  if (typeof (data.testableQuestion ?? data.question) === "string") patch.testableQuestion = String(data.testableQuestion ?? data.question);
  if (typeof (data.researchMethod ?? data.method) === "string") patch.researchMethod = String(data.researchMethod ?? data.method);
  if (sampleSize !== undefined) patch.sampleSize = sampleSize;
  if (typeof (data.owner ?? data.assignee) === "string") patch.owner = String(data.owner ?? data.assignee);
  if (typeof (data.dueDate ?? data.deadline) === "string") patch.dueDate = String(data.dueDate ?? data.deadline);
  if (typeof (data.observationWindow ?? data.window) === "string") patch.observationWindow = String(data.observationWindow ?? data.window);
  if (typeof (data.successCriteria ?? data.successCriterion) === "string") patch.successCriteria = String(data.successCriteria ?? data.successCriterion);
  return patch;
}

function restoredTaskPatch(props: CaseWorkbenchProps): Partial<ReviewValidationTask> {
  return [...props.events.map((event) => event.data), props.receipt?.event.data, props.selected.task]
    .reduce<Partial<ReviewValidationTask>>((merged, candidate) => ({ ...merged, ...taskPatch(candidate) }), {});
}

function reviewEvidenceId(row: Record<string, unknown>, fallback: string): string {
  return `review:${reviewId(row, fallback)}`;
}

function draftFrom(
  restored: Partial<ReviewValidationTask>,
  selectedId: string,
  row: Record<string, unknown>,
  aspectKey: AspectKey,
  counterId?: string,
): ReviewValidationDraft {
  const aspect = aspectFor(restored.aspectKey ?? aspectKey);
  const selectedIsNegative = sentiment(row[aspect.key]) === "negative" && (numeric(row.star) ?? 5) < 4;
  return {
    taskId: restored.taskId ?? `RR-${reviewId(row, selectedId)}-${aspect.key.replace("#", "-")}`,
    aspectKey: aspect.key,
    aspectLabel: restored.aspectLabel ?? aspect.label,
    supportEvidenceIds: restored.supportEvidenceIds ?? (selectedIsNegative ? [reviewEvidenceId(row, selectedId)] : []),
    counterEvidenceIds: restored.counterEvidenceIds ?? (counterId ? [counterId] : []),
    testableQuestion: restored.testableQuestion ?? `${aspect.label}负向体验是否会在同主题样本中稳定重复出现？`,
    researchMethod: restored.researchMethod ?? "评论分层复核 + 半结构化访谈",
    sampleSize: restored.sampleSize == null ? "" : String(restored.sampleSize),
    owner: restored.owner ?? "",
    dueDate: restored.dueDate ?? "",
    observationWindow: restored.observationWindow ?? "连续 14 天",
    successCriteria: restored.successCriteria ?? "",
  };
}

function completeTask(draft: ReviewValidationDraft): ReviewValidationTask | undefined {
  const sampleSize = numeric(draft.sampleSize);
  if (
    draft.supportEvidenceIds.length < 1 ||
    draft.counterEvidenceIds.length < 1 ||
    draft.testableQuestion.trim().length < 8 ||
    draft.researchMethod.trim().length < 2 ||
    sampleSize == null || sampleSize < 1 ||
    draft.owner.trim().length < 2 ||
    !draft.dueDate ||
    draft.observationWindow.trim().length < 2 ||
    draft.successCriteria.trim().length < 8
  ) return undefined;
  return {
    ...draft,
    sampleSize,
    testableQuestion: draft.testableQuestion.trim(),
    researchMethod: draft.researchMethod.trim(),
    owner: draft.owner.trim(),
    observationWindow: draft.observationWindow.trim(),
    successCriteria: draft.successCriteria.trim(),
  };
}

function highlightedReview(review: string, activeKey: AspectKey): ReactNode[] {
  const keywords = [...aspectFor(activeKey).keywords]
    .filter((keyword) => review.includes(keyword))
    .sort((left, right) => right.length - left.length);
  if (!keywords.length) return [review];
  const escaped = keywords.map((keyword) => keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return review.split(new RegExp(`(${escaped.join("|")})`, "g")).map((piece, index) => (
    keywords.some((keyword) => keyword === piece) ? <mark key={`${piece}-${index}`}>{piece}</mark> : piece
  ));
}

export function ReviewResearchWorkbench(props: CaseWorkbenchProps) {
  const row = props.selected.payload;
  const firstNegative = aspects.find((item) => sentiment(row[item.key]) === "negative")?.key ?? aspects[0].key;
  const restored = useMemo(() => restoredTaskPatch(props), [props.events, props.receipt, props.selected.task]);
  const restoredAspect = restored.aspectKey ?? firstNegative;
  const sourceRows = props.sceneRows.length ? props.sceneRows : props.objects.map((item) => item.payload);
  const restoredCounter = sourceRows.find((item) => sentiment(item[restoredAspect]) === "positive");
  const restoredCounterId = restoredCounter ? reviewEvidenceId(restoredCounter, "counter") : undefined;
  const [activeAspect, setActiveAspect] = useState<AspectKey>(restoredAspect);
  const [query, setQuery] = useState("");
  const [sentimentFilter, setSentimentFilter] = useState<SentimentFilter>("全部");
  const [draft, setDraft] = useState<ReviewValidationDraft>(() => draftFrom(
    restored,
    props.selected.objectId,
    row,
    restoredAspect,
    restoredCounterId,
  ));
  const [supervisorReason, setSupervisorReason] = useState("");

  const active = aspectFor(activeAspect);
  const reviewText = reviewOf(row);
  const star = numeric(row.star ?? row.rating ?? row.stars);
  const createCommand = props.commands.find((command) => command.id === "create_validation_task");
  const supervisorCommands = props.commands.filter((command) => command.id === "accept_backlog" || command.id === "archive_signal");
  const evidenceRows = sourceRows.filter((item) => sentiment(item[activeAspect]) !== "unmentioned");
  const supportCandidates = evidenceRows.filter((item) => sentiment(item[activeAspect]) === "negative").slice(0, 5);
  const counterCandidates = evidenceRows.filter((item) => sentiment(item[activeAspect]) === "positive").slice(0, 5);
  const validationTask = completeTask(draft);
  const persistedTask = restored.taskId
    ? completeTask(draftFrom(restored, props.selected.objectId, row, restoredAspect, restoredCounterId))
    : undefined;

  const filtered = useMemo(() => props.objects.filter((item) => {
    const content = reviewOf(item.payload);
    const value = sentiment(item.payload[activeAspect]);
    const matchesQuery = content.toLocaleLowerCase("zh-CN").includes(query.trim().toLocaleLowerCase("zh-CN"));
    const matchesSentiment = sentimentFilter === "全部"
      ? value !== "unmentioned"
      : sentimentFilter === "负向" ? value === "negative" : value === "positive";
    return matchesQuery && matchesSentiment;
  }), [activeAspect, props.objects, query, sentimentFilter]);

  useEffect(() => {
    setActiveAspect(restoredAspect);
    setDraft(draftFrom(restored, props.selected.objectId, row, restoredAspect, restoredCounterId));
    setSupervisorReason("");
  }, [props.selected.objectId, props.selected.version, restored, restoredAspect, restoredCounterId, row]);

  function updateDraft<Key extends keyof ReviewValidationDraft>(key: Key, value: ReviewValidationDraft[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function chooseAspect(key: AspectKey) {
    setActiveAspect(key);
    if (restored.taskId) return;
    const nextAspect = aspectFor(key);
    const nextCounter = sourceRows.find((item) => sentiment(item[key]) === "positive");
    setDraft((current) => ({
      ...current,
      taskId: `RR-${reviewId(row, props.selected.objectId)}-${key.replace("#", "-")}`,
      aspectKey: key,
      aspectLabel: nextAspect.label,
      supportEvidenceIds: sentiment(row[key]) === "negative" && (star ?? 5) < 4
        ? [reviewEvidenceId(row, props.selected.objectId)]
        : [],
      counterEvidenceIds: nextCounter ? [reviewEvidenceId(nextCounter, "counter")] : [],
      testableQuestion: `${nextAspect.label}负向体验是否会在同主题样本中稳定重复出现？`,
    }));
  }

  function toggleEvidence(field: EvidenceLane, evidenceId: string) {
    setDraft((current) => ({
      ...current,
      [field]: current[field].includes(evidenceId)
        ? current[field].filter((item) => item !== evidenceId)
        : [...current[field], evidenceId],
    }));
  }

  function createValidationTask() {
    if (!createCommand || !validationTask) return;
    props.onCommand(createCommand.id, validationTask.testableQuestion, {
      data: validationTask,
      evidenceIds: [...new Set([...validationTask.supportEvidenceIds, ...validationTask.counterEvidenceIds])],
      idempotencyKey: `case-03:${props.selected.objectId}:${createCommand.id}:v${props.selected.version}`,
    });
  }

  function runSupervisorCommand(commandId: string) {
    const reason = supervisorReason.trim();
    if (!persistedTask || reason.length < 4) return;
    props.onCommand(commandId, reason, {
      data: {
        validationTask: persistedTask,
        taskId: persistedTask.taskId,
        supervisorDecision: commandId === "accept_backlog" ? "accepted" : "archived",
        supervisorReason: reason,
      },
      evidenceIds: [...new Set([...persistedTask.supportEvidenceIds, ...persistedTask.counterEvidenceIds])],
      idempotencyKey: `case-03:${props.selected.objectId}:${commandId}:v${props.selected.version}:${persistedTask.taskId}`,
    });
  }

  return (
    <WorkbenchFrame
      props={props}
      kicker="本地生活 · 评论质检"
      title="顾客评论研究室"
      subtitle="从一条顾客原话出发，用支持样本和反例把模糊抱怨改写成可执行的研究任务。"
      tone="review"
      hideGenericActions
    >
      <MetricCards items={[
        { label: "中文评论", value: props.datasetRowCount.toLocaleString("zh-CN"), note: "本地公开数据" },
        ...props.metrics.slice(0, 3).map((metric) => ({ label: metric.label, value: metric.value, note: metric.note })),
      ]} />

      <div className={styles.hearingShell} style={{ minHeight: 0, overflow: 'hidden' }}>
        <aside className={styles.topicRail} aria-label="主题与筛选">
          <header className={styles.railTitle}>
            <Scale aria-hidden="true" size={20} />
            <div><strong>评论调查台</strong><span>选择要核查的主题</span></div>
          </header>
          <nav className={styles.topicList} aria-label="评论主题">
            {aspects.map((item) => {
              const negativeCount = sourceRows.filter((record) => sentiment(record[item.key]) === "negative").length;
              return (
                <button key={item.key} type="button" aria-pressed={activeAspect === item.key} onClick={() => chooseAspect(item.key)}>
                  <span>{item.label}</span><b>{negativeCount}</b>
                </button>
              );
            })}
          </nav>
          <div className={styles.searchBox}>
            <Search aria-hidden="true" size={15} />
            <input aria-label="搜索评论原话" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜评论原话" />
          </div>
          <div className={styles.filterTabs} aria-label="情绪筛选">
            {(["全部", "负向", "正向"] as const).map((item) => (
              <button key={item} type="button" aria-pressed={sentimentFilter === item} onClick={() => setSentimentFilter(item)}>{item}</button>
            ))}
          </div>
          <div className={styles.reviewQueue}>
            {filtered.slice(0, 8).map((item) => (
              <button
                key={item.objectId}
                type="button"
                aria-label={`评论 #${reviewId(item.payload, item.objectId)}：${reviewOf(item.payload)}`}
                aria-pressed={item.objectId === props.selected.objectId}
                onClick={() => props.onSelect(item.objectId)}
              >
                <span>{reviewOf(item.payload)}</span>
                <small>#{reviewId(item.payload, item.objectId)} · {sentimentLabel(item.payload[activeAspect])}</small>
              </button>
            ))}
          </div>
        </aside>

        <section className={styles.hearingWorkarea} role="complementary" aria-label="主题摘要与验证" style={{ minHeight: 0, overflow: 'hidden' }}>
        <section className={styles.evidenceStage} aria-label="评论证据研究" style={{ overflow: 'auto', minHeight: 0 }}>
          <section className={styles.sourceCard} aria-label="评论原文与出处">
            <header>
              <div><Quote aria-hidden="true" size={18} /><strong>评论摘要</strong></div>
              <span>来源 {text(row.source_id, "未标注")} · 评论 #{reviewId(row, props.selected.objectId)} · {star == null ? "评分未提供" : `${star} 星`}</span>
            </header>
            <p className={styles.reviewLead}>{highlightedReview(reviewText, activeAspect)}</p>
            <details>
              <summary>查看完整评论原文</summary>
              <blockquote>{highlightedReview(reviewText, activeAspect)}</blockquote>
            </details>
          </section>

          <section className={styles.hypothesisCard} aria-label="要查清的问题">
            <span>主题摘要：{active.label}</span>
            <strong>{draft.testableQuestion}</strong>
            <small>由“{active.label}”标签定位样本；标签不是原因，也不是结论。</small>
          </section>

          <div className={styles.evidenceSeats}>
            <fieldset className={styles.supportSeat} aria-label="支持这个判断的原话">
              <legend><span>支持这个判断的原话</span><b>已选 {draft.supportEvidenceIds.length}</b></legend>
              {supportCandidates.map((item) => {
                const evidenceId = reviewEvidenceId(item, props.selected.objectId);
                return (
                  <label key={evidenceId}>
                    <input type="checkbox" aria-label={`${evidenceId} 支持证据`} checked={draft.supportEvidenceIds.includes(evidenceId)} onChange={() => toggleEvidence("supportEvidenceIds", evidenceId)} />
                    <span>{reviewOf(item)}</span><small>证据 {evidenceId}</small>
                  </label>
                );
              })}
              {!supportCandidates.length ? <p>当前加载样本没有同主题负向原话。</p> : null}
            </fieldset>

            <fieldset className={styles.counterSeat} aria-label="不支持这个判断的原话">
              <legend><span>不支持这个判断的原话</span><b>已选 {draft.counterEvidenceIds.length}</b></legend>
              {counterCandidates.map((item) => {
                const evidenceId = reviewEvidenceId(item, "counter");
                return (
                  <label key={evidenceId}>
                    <input type="checkbox" aria-label={`${evidenceId} 反例`} checked={draft.counterEvidenceIds.includes(evidenceId)} onChange={() => toggleEvidence("counterEvidenceIds", evidenceId)} />
                    <span>{reviewOf(item)}</span><small>证据 {evidenceId}</small>
                  </label>
                );
              })}
              {!counterCandidates.length ? <p>没有同主题正向样本，暂时不能提交研究任务。</p> : null}
            </fieldset>
          </div>

          <section className={styles.comparisonStrip} aria-label="同主题评论对照">
            <header><strong>同主题评论对照</strong><span>数据没有餐厅标识，不做门店排名</span></header>
            <div>
              {filtered.filter((item) => item.objectId !== props.selected.objectId).slice(0, 3).map((item) => (
                <button key={item.objectId} type="button" onClick={() => props.onSelect(item.objectId)}>
                  <span>{reviewOf(item.payload)}</span><small>#{reviewId(item.payload, item.objectId)}</small>
                </button>
              ))}
            </div>
          </section>
        </section>

        <aside className={styles.taskPanel} aria-label="研究任务" style={{ minHeight: 0 }}>
          <header>
            <div><ClipboardCheck aria-hidden="true" size={18} /><strong>研究任务</strong></div>
            <button type="button" onClick={() => props.onSelect(props.selected.objectId)} disabled={props.busy}>
              <RefreshCcw aria-hidden="true" size={15} />刷新当前记录
            </button>
          </header>

          {createCommand ? (
            <section className={styles.taskForm} aria-label="验证任务表单">
              <div className={styles.taskIdentity}>
                <span>任务编号</span><strong>{draft.taskId}</strong>
                <small>正反证据齐备后，再补齐执行条件。</small>
              </div>
              <label>
                <span>要查清的问题</span>
                <textarea aria-label="要查清的问题" rows={3} value={draft.testableQuestion} onChange={(event) => updateDraft("testableQuestion", event.target.value)} />
              </label>
              <label>
                <span>研究方法</span>
                <select aria-label="研究方法" value={draft.researchMethod} onChange={(event) => updateDraft("researchMethod", event.target.value)}>
                  <option>评论分层复核 + 半结构化访谈</option>
                  <option>评论编码复核 + 现场观察</option>
                  <option>小范围服务流程对照测试</option>
                </select>
              </label>
              <details className={styles.executionFields} open>
                <summary><Filter aria-hidden="true" size={14} />执行约束</summary>
                <div>
                  <label><span>样本规模</span><input aria-label="样本规模" type="number" min={1} value={draft.sampleSize} onChange={(event) => updateDraft("sampleSize", event.target.value)} /></label>
                  <label><span>负责人</span><input aria-label="负责人" value={draft.owner} onChange={(event) => updateDraft("owner", event.target.value)} /></label>
                  <label><span>期限</span><input aria-label="期限" type="date" value={draft.dueDate} onChange={(event) => updateDraft("dueDate", event.target.value)} /></label>
                  <label><span>观察窗</span><input aria-label="观察窗" value={draft.observationWindow} onChange={(event) => updateDraft("observationWindow", event.target.value)} /></label>
                </div>
                <label><span>什么结果算问题成立</span><textarea aria-label="什么结果算问题成立" rows={3} value={draft.successCriteria} onChange={(event) => updateDraft("successCriteria", event.target.value)} /></label>
              </details>
              <section className={styles.researchBoundary}>
                <ShieldCheck aria-hidden="true" size={17} />
                <div><strong>研究判断</strong><p>标签用于找样本，不是普遍原因，也不能替代访谈、观察或对照测试。</p></div>
              </section>
              <button className={styles.submitTask} aria-label="提交结构化验证任务" type="button" disabled={props.busy || !validationTask} onClick={createValidationTask}>
                <CheckCircle2 aria-hidden="true" size={17} />{props.busy ? "正在记录…" : createCommand.label}<ChevronRight aria-hidden="true" size={16} />
              </button>
              {!validationTask ? <p className={styles.taskHint} role="status">至少选择一条支持原话和一条相反原话，并补齐样本、负责人、期限与判断条件。</p> : null}
            </section>
          ) : null}

          {persistedTask || supervisorCommands.length ? (
            <section className={styles.supervisorPanel} aria-label="已保存的调查任务">
              <h2>已保存的调查任务</h2>
              {persistedTask ? (
                <dl>
                  <div><dt>任务编号</dt><dd>{persistedTask.taskId}</dd></div>
                  <div><dt>要查清的问题</dt><dd>{persistedTask.testableQuestion}</dd></div>
                  <div><dt>样本与观察窗</dt><dd>{persistedTask.sampleSize} 条 · {persistedTask.observationWindow}</dd></div>
                  <div><dt>负责人 / 期限</dt><dd>{persistedTask.owner} · {persistedTask.dueDate}</dd></div>
                  <div><dt>什么结果算问题成立</dt><dd>{persistedTask.successCriteria}</dd></div>
                  <div><dt>支持原话编号</dt><dd>{persistedTask.supportEvidenceIds.join("、")}</dd></div>
                  <div><dt>相反原话编号</dt><dd>{persistedTask.counterEvidenceIds.join("、")}</dd></div>
                </dl>
              ) : <p role="status">尚未从任务投影或历史事件恢复出完整任务。</p>}
              {supervisorCommands.length ? <label><span>主管处理说明</span><textarea aria-label="主管处理说明" rows={3} value={supervisorReason} onChange={(event) => setSupervisorReason(event.target.value)} /></label> : null}
              {supervisorCommands.map((command) => (
                <button
                  key={command.id}
                  type="button"
                  aria-label={command.id === "archive_signal" ? "暂不安排这项调查" : "安排这项调查"}
                  disabled={!persistedTask || supervisorReason.trim().length < 4 || props.busy}
                  onClick={() => runSupervisorCommand(command.id)}
                >
                  {command.id === "archive_signal" ? <Archive aria-hidden="true" size={16} /> : <FileText aria-hidden="true" size={16} />}
                  {command.label}
                </button>
              ))}
            </section>
          ) : null}

          {props.error ? <p className={styles.commandError}>核对服务端持久化状态后再试。</p> : null}
          <ReceiptNote props={props} />
        </aside>
        </section>
      </div>
    </WorkbenchFrame>
  );
}
