"use client";

import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileSearch,
  Filter,
  ListFilter,
  PackageCheck,
  Printer,
  RotateCcw,
  Search,
  ShieldAlert,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatBusinessRole } from "../../families/SharedPanels";
import type { CaseWorkbenchProps } from "./types";
import styles from "./ReturnEvidenceWorkbench.module.css";

type Candidate = { row: Record<string, unknown>; score: number; reasons: string[] };
type EvidenceKey = "original_order" | "payment_record" | "goods_relation" | "cancellation_reason";
type EvidenceStatus = Record<EvidenceKey, "received" | "missing">;
type ReturnEvidenceTask = {
  candidateId?: string;
  candidateDecision?: "no_match";
  requestedEvidence?: string[];
  assignee?: string;
  dueAt?: string;
  evidenceStatus?: Partial<EvidenceStatus>;
  reviewNote?: string;
  decisionReason?: string;
};
type CommandOptions = {
  data?: Record<string, unknown>;
  idempotencyKey?: string;
  evidenceIds?: string[];
  actorId?: string;
};

const evidenceOptions: Array<{ id: EvidenceKey; label: string; owner: string }> = [
  { id: "original_order", label: "原单或无原单查询回执", owner: "销售运营" },
  { id: "payment_record", label: "付款或结算凭证", owner: "财务对账" },
  { id: "goods_relation", label: "商品与取消单关系", owner: "订单运营" },
  { id: "cancellation_reason", label: "取消原因记录", owner: "售后运营" },
];
const requiredEvidence: EvidenceKey[] = ["original_order", "payment_record"];

function evidenceKey(value: string): value is EvidenceKey {
  return evidenceOptions.some((item) => item.id === value);
}
function taskFrom(task: Record<string, unknown> | undefined, events: CaseWorkbenchProps["events"], objectId: string): ReturnEvidenceTask {
  const eventTask = events.filter((event) => event.objectId === objectId).reduce<ReturnEvidenceTask>(
    (current, event) => ({ ...current, ...(event.data ?? {}) }),
    {},
  );
  return { ...eventTask, ...(task ?? {}) } as ReturnEvidenceTask;
}
function defaultDueAt(updatedAt: string): string {
  const date = new Date(`${updatedAt.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return "2026-07-31";
  date.setUTCDate(date.getUTCDate() + 3);
  return date.toISOString().slice(0, 10);
}
function text(value: unknown, fallback = "—"): string {
  const result = String(value ?? "").trim();
  return result || fallback;
}
function numeric(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
function money(value: unknown): string {
  const amount = Math.abs(numeric(value));
  const [integer, decimal] = amount.toFixed(2).split(".");
  return `¥${integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${decimal}`;
}
function sourceDescription(value: unknown): string {
  const raw = text(value, "未记录商品名称");
  return ({ Manual: "手工调整", Discount: "折扣调整", POSTAGE: "运费" } as Record<string, string>)[raw] ?? raw;
}
function timestamp(value: unknown): number {
  const match = text(value, "").match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return 0;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6]));
}
function candidateScore(claim: Record<string, unknown>, candidate: Record<string, unknown>): Candidate {
  const reasons: string[] = [];
  let score = 0;
  const sameCustomer = Boolean(text(claim.customer_id, "")) && text(claim.customer_id, "") === text(candidate.customer_id, "");
  const sameStock = text(claim.stock_code, "") === text(candidate.stock_code, "");
  const sameDescription = text(claim.description, "").toLowerCase() === text(candidate.description, "").toLowerCase();
  if (sameCustomer) { score += 45; reasons.push("同一客户号"); }
  if (sameStock) { score += 30; reasons.push("商品编码相同"); }
  if (sameDescription) { score += 10; reasons.push("商品名称相同"); }
  const claimAmount = Math.abs(numeric(claim.line_amount_cny));
  const candidateAmount = Math.abs(numeric(candidate.line_amount_cny));
  if (claimAmount > 0 && candidateAmount > 0) {
    const points = Math.round(Math.max(0, 1 - Math.abs(claimAmount - candidateAmount) / Math.max(claimAmount, candidateAmount)) * 10);
    score += points;
    if (points >= 6) reasons.push("金额接近");
  }
  const ageDays = Math.max(0, (timestamp(claim.invoice_at) - timestamp(candidate.invoice_at)) / 86_400_000);
  if (ageDays <= 90) {
    const points = Math.max(0, Math.round(10 - ageDays / 9));
    score += points;
    if (points >= 6) reasons.push("时间接近");
  }
  return { row: candidate, score: Math.min(100, score), reasons };
}
function roleLabel(role: string): string {
  return role === "supervisor" ? "业务主管" : formatBusinessRole(role);
}
function riskLabel(row: Record<string, unknown>): "高风险" | "中风险" | "低风险" {
  if (Math.abs(numeric(row.line_amount_cny)) >= 50_000 || !text(row.customer_id, "")) return "高风险";
  return Math.abs(numeric(row.line_amount_cny)) >= 5_000 ? "中风险" : "低风险";
}

export function ReturnEvidenceWorkbench(props: CaseWorkbenchProps) {
  const claim = props.selected.payload;
  const restoredTask = useMemo(
    () => taskFrom(props.selected.task, props.events, props.selected.objectId),
    [props.events, props.selected.objectId, props.selected.task],
  );
  const [query, setQuery] = useState("");
  const [risk, setRisk] = useState("全部");
  const [queuePage, setQueuePage] = useState(0);
  const [candidateId, setCandidateId] = useState(restoredTask.candidateId ?? "");
  const [noMatch, setNoMatch] = useState(restoredTask.candidateDecision === "no_match");
  const [requestedEvidence, setRequestedEvidence] = useState<EvidenceKey[]>((restoredTask.requestedEvidence ?? requiredEvidence).filter(evidenceKey));
  const [assignee, setAssignee] = useState(restoredTask.assignee ?? "财务对账");
  const [dueAt, setDueAt] = useState(restoredTask.dueAt ?? defaultDueAt(props.selected.updatedAt));
  const [evidenceStatus, setEvidenceStatus] = useState<EvidenceStatus>(() => ({
    original_order: restoredTask.evidenceStatus?.original_order ?? "missing",
    payment_record: restoredTask.evidenceStatus?.payment_record ?? "missing",
    goods_relation: restoredTask.evidenceStatus?.goods_relation ?? "missing",
    cancellation_reason: restoredTask.evidenceStatus?.cancellation_reason ?? "missing",
  }));
  const [reviewNote, setReviewNote] = useState(restoredTask.reviewNote ?? "");
  const [decisionReason, setDecisionReason] = useState(restoredTask.decisionReason ?? "");
  const [drawer, setDrawer] = useState<"help" | "candidate" | "evidence" | "queue" | null>(null);

  useEffect(() => {
    setCandidateId(restoredTask.candidateId ?? "");
    setNoMatch(restoredTask.candidateDecision === "no_match");
    setRequestedEvidence((restoredTask.requestedEvidence ?? requiredEvidence).filter(evidenceKey));
    setAssignee(restoredTask.assignee ?? "财务对账");
    setDueAt(restoredTask.dueAt ?? defaultDueAt(props.selected.updatedAt));
    setEvidenceStatus({
      original_order: restoredTask.evidenceStatus?.original_order ?? "missing",
      payment_record: restoredTask.evidenceStatus?.payment_record ?? "missing",
      goods_relation: restoredTask.evidenceStatus?.goods_relation ?? "missing",
      cancellation_reason: restoredTask.evidenceStatus?.cancellation_reason ?? "missing",
    });
    setReviewNote(restoredTask.reviewNote ?? "");
    setDecisionReason(restoredTask.decisionReason ?? "");
  }, [props.selected.objectId, props.selected.version, props.selected.updatedAt, restoredTask]);

  const candidates = useMemo<Candidate[]>(() => {
    const rows = (props.sceneRows.length ? props.sceneRows : props.objects.map((item) => item.payload))
      .filter((row) => text(row.invoice_id, "") !== text(claim.invoice_id, ""))
      .filter((row) => numeric(row.quantity) > 0)
      .filter((row) => timestamp(row.invoice_at) <= timestamp(claim.invoice_at));
    const bestByInvoice = new Map<string, Candidate>();
    for (const row of rows) {
      const item = candidateScore(claim, row);
      const id = text(row.invoice_id);
      const current = bestByInvoice.get(id);
      if (!current || item.score > current.score) bestByInvoice.set(id, item);
    }
    return [...bestByInvoice.values()]
      .sort((left, right) => right.score - left.score || timestamp(right.row.invoice_at) - timestamp(left.row.invoice_at))
      .slice(0, 4);
  }, [claim, props.objects, props.sceneRows]);

  const filteredQueue = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const source = props.objects.filter((item) => String(item.payload.is_cancellation_proxy).toLowerCase() === "true");
    return [...new Map((source.length ? source : props.objects).map((item) => [text(item.payload.invoice_id), item])).values()]
      .filter((item) => risk === "全部" || riskLabel(item.payload) === risk)
      .filter((item) => !normalized || [item.payload.invoice_id, item.payload.customer_id, item.payload.stock_code].some((value) => text(value, "").toLowerCase().includes(normalized)));
  }, [props.objects, query, risk]);
  const queuePageCount = Math.max(1, Math.ceil(filteredQueue.length / 8));
  const activeQueuePage = Math.min(queuePage, queuePageCount - 1);
  const queue = filteredQueue.slice(activeQueuePage * 8, activeQueuePage * 8 + 8);

  const selectedCandidate = candidates.find((item) => text(item.row.invoice_id) === candidateId);
  const focusedCandidate = selectedCandidate ?? candidates[0];
  const candidate = selectedCandidate?.row;
  const focus = focusedCandidate?.row;
  const sameStock = Boolean(candidate) && text(candidate?.stock_code) === text(claim.stock_code);
  const sameCustomer = Boolean(candidate) && text(candidate?.customer_id) === text(claim.customer_id);
  const focusChecks = {
    customer: Boolean(focus) && text(focus?.customer_id) === text(claim.customer_id),
    product: Boolean(focus) && text(focus?.stock_code) === text(claim.stock_code),
    amountDirection: Boolean(focus) && numeric(focus?.line_amount_cny) > 0 && numeric(claim.line_amount_cny) < 0,
    earlier: Boolean(focus) && timestamp(focus?.invoice_at) <= timestamp(claim.invoice_at),
  };
  const candidateDecisionMade = Boolean(candidateId) || noMatch;
  const requestedSet = new Set(requestedEvidence);
  const requestHasRequiredEvidence = requiredEvidence.every((item) => requestedSet.has(item));
  const requestReady = candidateDecisionMade && requestHasRequiredEvidence && Boolean(assignee) && Boolean(dueAt);
  const requestPersisted = Boolean(restoredTask.assignee && restoredTask.dueAt && restoredTask.requestedEvidence?.length);
  const reviewReady = requestedEvidence.length > 0 && requestedEvidence.every((item) => evidenceStatus[item] === "received") && reviewNote.trim().length >= 6;
  const evidence = [
    { label: "原始订单", ok: evidenceStatus.original_order === "received", value: evidenceStatus.original_order === "received" ? "已回传" : noMatch ? "待查询回执" : selectedCandidate ? "待原单" : "未作判断" },
    { label: "客户号", ok: Boolean(text(claim.customer_id, "")), value: text(claim.customer_id, "缺失") },
    { label: "付款或结算凭证", ok: evidenceStatus.payment_record === "received", value: evidenceStatus.payment_record === "received" ? "已回传" : "未回传" },
    { label: "商品明细关系", ok: sameStock || evidenceStatus.goods_relation === "received", value: sameStock ? "编码相同" : evidenceStatus.goods_relation === "received" ? "关系材料已回传" : "未确认" },
  ];
  const completeness = Math.round((evidence.filter((item) => item.ok).length / evidence.length) * 100);

  function selectCandidate(item: Candidate) {
    setCandidateId(text(item.row.invoice_id));
    setNoMatch(false);
    setDrawer("candidate");
  }
  function chooseNoMatch() { setCandidateId(""); setNoMatch(true); }
  function toggleRequestedEvidence(id: EvidenceKey) {
    setRequestedEvidence((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }
  function toggleEvidenceStatus(id: EvidenceKey) {
    setEvidenceStatus((current) => ({ ...current, [id]: current[id] === "received" ? "missing" : "received" }));
  }
  function runCommand(command: string) {
    const execute = props.onCommand as (command: string, reason?: string, options?: CommandOptions) => void;
    if (command === "create_evidence_request") {
      execute(command, `${noMatch ? "无可确认候选原单" : `候选原单 ${candidateId}`}；向${assignee}请求 ${requestedEvidence.length} 项材料，期限 ${dueAt}`, {
        data: { ...(noMatch ? { candidateDecision: "no_match" } : { candidateId }), requestedEvidence, assignee, dueAt, requesterId: "case01-evidence-analyst" },
        actorId: "case01-evidence-analyst",
        idempotencyKey: `return-evidence:${props.selected.objectId}:${props.selected.version}:request`,
        evidenceIds: [`cancellation:${text(claim.invoice_id)}`, noMatch ? "candidate-decision:no-match" : `candidate:${candidateId}`],
      });
      return;
    }
    if (command === "submit_manual_review") {
      execute(command, reviewNote.trim() || "补证材料已回传，提交独立人工复核", {
        data: { evidenceStatus, reviewNote: reviewNote.trim() },
        actorId: "case01-evidence-analyst",
        idempotencyKey: `return-evidence:${props.selected.objectId}:${props.selected.version}:review`,
        evidenceIds: requestedEvidence.map((item) => `returned-material:${item}`),
      });
      return;
    }
    if (command === "hold_refund") {
      execute(command, decisionReason.trim(), {
        data: { decisionReason: decisionReason.trim() },
        actorId: "case01-refund-supervisor",
        idempotencyKey: `return-evidence:${props.selected.objectId}:${props.selected.version}:hold`,
        evidenceIds: [`cancellation:${text(claim.invoice_id)}`, ...requestedEvidence.filter((item) => evidenceStatus[item] === "received").map((item) => `returned-material:${item}`)],
      });
    }
  }

  return (
    <main className={styles.console}>
      <header className={styles.taskbar}>
        <div>
          <span>售后异常核对</span>
          <strong>{text(claim.invoice_id)} · {money(claim.line_amount_cny)}</strong>
          <em data-risk={riskLabel(claim)}>{riskLabel(claim)}</em>
        </div>
        <nav aria-label="核对进度">
          <span data-current={!candidateDecisionMade}>1 找原单</span>
          <span data-current={candidateDecisionMade && !requestPersisted}>2 发起补证</span>
          <span data-current={requestPersisted && !reviewReady}>3 等待材料</span>
          <span data-current={reviewReady}>4 人工复核</span>
        </nav>
        <div>
          <button type="button" onClick={() => setDrawer("queue")}><ListFilter size={16} />查看取消单队列</button>
          <button type="button" aria-label="核对帮助" onClick={() => setDrawer("help")}><CircleHelp size={17} /></button>
          <button type="button" aria-label="打印当前案卷" onClick={() => window.print()}><Printer size={17} /></button>
        </div>
      </header>

      <div className={styles.workspace}>
        <section className={styles.claimCard} aria-label="当前取消单">
          <header><span>当前取消单</span><b>{props.selected.state}</b></header>
          <div className={styles.amount}><small>涉及金额</small><strong>{money(claim.line_amount_cny)}</strong><span>CNY · 负向交易</span></div>
          <dl>
            <div><dt>单号</dt><dd>{text(claim.invoice_id)}</dd></div>
            <div><dt>客户</dt><dd>{text(claim.customer_id, "缺失")}</dd></div>
            <div><dt>商品</dt><dd>{sourceDescription(claim.description)}</dd></div>
            <div><dt>编码</dt><dd>{text(claim.stock_code)}</dd></div>
            <div><dt>时间</dt><dd>{text(claim.invoice_at).slice(0, 16)}</dd></div>
          </dl>
          <div className={styles.guardrail}><ShieldAlert size={18} /><span><strong>退款动作尚未授权</strong><small>先找到原单，或留下“无可确认原单”的可追溯判断。</small></span></div>
          <button type="button" aria-pressed={noMatch} onClick={chooseNoMatch}>没有可确认原单</button>
        </section>

        <section className={styles.matchLens} role="region" aria-label="原单核对镜头">
          <header>
            <div><span>订单匹配镜头</span><h1>原单核对中</h1></div>
            <p>{focusedCandidate ? `正在查看候选 ${text(focus?.invoice_id)}` : "当前数据切片没有正向交易"}</p>
          </header>
          <div className={styles.compareStage}>
            <article data-side="cancel">
              <span>取消单</span><strong>{text(claim.invoice_id)}</strong><b>{money(claim.line_amount_cny)}</b><small>{text(claim.invoice_at).slice(0, 16)}</small>
            </article>
            <div className={styles.matchPath} aria-hidden="true"><i /><ArrowLeftRight size={23} /><i /></div>
            <article data-side="candidate">
              <span>候选原单</span><strong>{text(focus?.invoice_id, "尚无候选")}</strong><b>{focus ? money(focus.line_amount_cny) : "—"}</b><small>{text(focus?.invoice_at).slice(0, 16)}</small>
            </article>
          </div>
          <div className={styles.fieldChecks}>
            <article data-match={focusChecks.customer}>{focusChecks.customer ? <Check size={15} /> : <X size={15} />}<span><strong>客户一致</strong><small>{text(claim.customer_id, "缺失")} ↔ {text(focus?.customer_id, "缺失")}</small></span></article>
            <article data-match={focusChecks.product}>{focusChecks.product ? <Check size={15} /> : <X size={15} />}<span><strong>商品一致</strong><small>{text(claim.stock_code)} ↔ {text(focus?.stock_code)}</small></span></article>
            <article data-match={focusChecks.amountDirection}>{focusChecks.amountDirection ? <Check size={15} /> : <X size={15} />}<span><strong>金额方向相反</strong><small>取消为负，原单为正</small></span></article>
            <article data-match={focusChecks.earlier}><Clock3 size={15} /><span><strong>时间顺序成立</strong><small>候选交易早于取消记录</small></span></article>
          </div>
          <div className={styles.gaps}>
            <article><AlertTriangle size={16} /><span><strong>缺少付款记录</strong><small>金额相等不能替代付款或结算凭证</small></span></article>
            <article><AlertTriangle size={16} /><span><strong>缺少原单关系凭证</strong><small>当前字段只能形成线索，不能直接批准退款</small></span></article>
          </div>
          <div className={styles.candidateStrip} role="group" aria-label="切换候选原单">
            {candidates.map((item) => {
              const id = text(item.row.invoice_id);
              return <button type="button" key={id} aria-label={`选择候选原单 ${id}`} aria-pressed={candidateId === id} onClick={() => selectCandidate(item)}><span>{id}</span><strong>{money(item.row.line_amount_cny)}</strong><small>{item.reasons.slice(0, 2).join(" · ") || "需补证"}</small></button>;
            })}
          </div>
          <div className={styles.candidateDecision} data-complete={candidateDecisionMade}>
            <FileSearch size={16} /><span><strong>{noMatch ? "已记录：当前切片无可确认原单" : candidateId ? `已选择候选 ${candidateId}` : "尚未作出候选判断"}</strong><small>候选排序只用于缩小人工核对范围，不替代业务判断。</small></span>
          </div>
        </section>

        <aside className={styles.actionPanel} aria-label="补证与处理">
          <header><div><span>下一步</span><h2>补齐可核验材料</h2></div><b>{completeness}%</b></header>
          <section className={styles.requestBuilder} aria-label="补证案卷">
            <div className={styles.requestFields}>
              <label><span>负责人</span><select aria-label="补证负责人" value={assignee} disabled={requestPersisted} onChange={(event) => setAssignee(event.target.value)}><option>财务对账</option><option>销售运营</option><option>订单运营</option><option>售后运营</option></select></label>
              <label><span>期限</span><input aria-label="补证期限" type="date" value={dueAt} disabled={requestPersisted} onChange={(event) => setDueAt(event.target.value)} /></label>
            </div>
            <div className={styles.materialList} aria-label="补证材料">
              {evidenceOptions.filter((item) => !requestPersisted || requestedSet.has(item.id)).map((item) => {
                const requested = requestedSet.has(item.id);
                const received = evidenceStatus[item.id] === "received";
                return <div key={item.id} data-status={received ? "received" : requested ? "requested" : "idle"}>{requestPersisted ? <button type="button" aria-pressed={received} onClick={() => toggleEvidenceStatus(item.id)}>{received ? <Check size={14} /> : <X size={14} />}<span><strong>{item.label}</strong><small>{received ? "已回传，可用于复核" : `等待${item.owner}回传`}</small></span><b>{received ? "已回传" : "标记回传"}</b></button> : <label><input type="checkbox" checked={requested} onChange={() => toggleRequestedEvidence(item.id)} /><span><strong>{item.label}</strong><small>{item.owner}</small></span>{requiredEvidence.includes(item.id) ? <b>必需</b> : null}</label>}</div>;
              })}
            </div>
            {!requestPersisted && !requestHasRequiredEvidence ? <p role="alert">原单回执和付款凭证是必需项。</p> : null}
            {requestPersisted ? <p>{requestedEvidence.filter((item) => evidenceStatus[item] === "received").length}/{requestedEvidence.length} 项材料已回传。</p> : null}
            {requestPersisted ? <label className={styles.noteField}><span>复核说明</span><textarea aria-label="人工复核说明" value={reviewNote} maxLength={180} onChange={(event) => setReviewNote(event.target.value)} placeholder="说明材料来源与仍需核对的关系" /></label> : null}
            {props.commands.some((command) => command.id === "hold_refund") ? <label className={styles.noteField}><span>暂缓理由</span><textarea aria-label="暂缓退款理由" value={decisionReason} maxLength={180} onChange={(event) => setDecisionReason(event.target.value)} placeholder="写明仍缺少的证据" /></label> : null}
          </section>
          <label className={styles.roleSelect}><span>操作角色</span><select aria-label="当前操作角色" value={props.actorRole} onChange={(event) => props.onActorRoleChange(event.target.value)}>{props.roles.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}</select></label>
          <div className={styles.commands}>
            {props.commands.map((command) => {
              const disabled = props.busy || (command.id === "create_evidence_request" && !requestReady) || (command.id === "submit_manual_review" && !reviewReady) || (command.id === "hold_refund" && !decisionReason.trim());
              return <button key={command.id} type="button" disabled={disabled} onClick={() => runCommand(command.id)}>{command.id === "hold_refund" ? <ShieldAlert size={18} /> : <PackageCheck size={18} />}<span><strong>{command.label}</strong><small>{disabled ? "完成当前核对后可执行" : "写入状态、回执与活动时间线"}</small></span><ArrowRight size={17} /></button>;
            })}
          </div>
          <button className={styles.evidenceLink} type="button" onClick={() => setDrawer("evidence")}>查看当前证据状态</button>
          {props.receipt ? <p className={styles.receipt} role="status">已记录 {props.receipt.receiptId.slice(0, 8)} · v{props.receipt.projection.version}</p> : null}
          {props.error ? <p className={styles.error} role="alert">{props.error}</p> : null}
        </aside>
      </div>

      <footer className={styles.footer}><span>{props.selected.objectId} · {props.selected.state}</span><button type="button" aria-label={`恢复案例 B${props.definition.id}`} onClick={props.onReset} disabled={props.busy}><RotateCcw size={16} />恢复案例</button></footer>

      {drawer ? <div className={styles.drawerBackdrop} role="presentation" onMouseDown={() => setDrawer(null)}><aside className={styles.drawer} role="dialog" aria-modal="true" aria-label={drawer === "queue" ? "取消单队列" : drawer === "candidate" ? "候选原单详情" : drawer === "evidence" ? "证据详情" : "核对帮助"} onMouseDown={(event) => event.stopPropagation()}><header><strong>{drawer === "queue" ? "取消单队列" : drawer === "candidate" ? "候选原单详情" : drawer === "evidence" ? "证据详情" : "怎么核对"}</strong><button type="button" aria-label="关闭" onClick={() => setDrawer(null)}><X size={18} /></button></header>
        {drawer === "queue" ? <div className={styles.queueDrawer}><label><Search size={15} /><input value={query} onChange={(event) => { setQuery(event.target.value); setQueuePage(0); }} placeholder="搜索单号、客户或商品" /></label><div><Filter size={14} /><select aria-label="风险筛选" value={risk} onChange={(event) => { setRisk(event.target.value); setQueuePage(0); }}><option>全部</option><option>高风险</option><option>中风险</option><option>低风险</option></select><span>{props.datasetRowCount.toLocaleString("zh-CN")} 条本地记录</span></div><section>{queue.map((item) => <button key={item.objectId} type="button" aria-pressed={item.objectId === props.selected.objectId} onClick={() => { props.onSelect(item.objectId); setDrawer(null); }}><span>{riskLabel(item.payload)}</span><strong>{text(item.payload.invoice_id)}</strong><b>{money(item.payload.line_amount_cny)}</b><small>{text(item.payload.customer_id, "客户缺失")}</small></button>)}</section><footer><button type="button" aria-label="上一页" disabled={activeQueuePage === 0} onClick={() => setQueuePage((page) => Math.max(0, page - 1))}><ChevronLeft size={16} /></button><span>{activeQueuePage + 1} / {queuePageCount}</span><button type="button" aria-label="下一页" disabled={activeQueuePage >= queuePageCount - 1} onClick={() => setQueuePage((page) => Math.min(queuePageCount - 1, page + 1))}><ChevronRight size={16} /></button></footer></div> : null}
        {drawer === "candidate" ? <div className={styles.drawerContent}><h3>{text(candidate?.invoice_id)}</h3><p>入选线索：{selectedCandidate?.reasons.join("、") || "只有弱线索"}。本次选择会写入补证任务，但不会直接批准退款。</p><dl><div><dt>客户</dt><dd>{text(candidate?.customer_id, "缺失")}</dd></div><div><dt>商品</dt><dd>{text(candidate?.stock_code)}</dd></div><div><dt>时间</dt><dd>{text(candidate?.invoice_at)}</dd></div><div><dt>人民币金额</dt><dd>{candidate ? money(candidate.line_amount_cny) : "—"}</dd></div></dl></div> : null}
        {drawer === "evidence" ? <div className={styles.drawerContent}><p>这里只显示当前本地数据与已回传材料。付款、签收、仓检等未接入内容保持缺失。</p>{evidence.map((item) => <p key={item.label}><b>{item.label}</b>：{item.value}</p>)}</div> : null}
        {drawer === "help" ? <div className={styles.drawerContent}><p>先比较客户、商品、金额方向和时间顺序，再决定候选原单。</p><p>字段关系只是线索。退款前仍要补齐原单关系和付款记录。</p></div> : null}
      </aside></div> : null}
    </main>
  );
}
