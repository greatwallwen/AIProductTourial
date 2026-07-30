"use client";

import {
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  FileCheck2,
  FileClock,
  FileText,
  FolderOpen,
  History,
  IdCard,
  MapPin,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import styles from "./CreditMaterialWorkbench.module.css";
import type { CaseWorkbenchProps } from "./types";

type QueueFilter = "all" | "incomplete" | "supplement" | "advanced";
type MaterialKey = "identity" | "income" | "consent" | "consistency";
type MaterialStatus = Record<MaterialKey, "received" | "missing">;
type ReturnReceipt = {
  sourceRef: string;
  receiptId: string;
  actorId: string;
};

type CreditReviewTask = {
  requestedMaterials?: MaterialKey[];
  assignee?: string;
  dueAt?: string;
  requestNote?: string;
  requesterId?: string;
  materialStatus?: Partial<MaterialStatus>;
  returnReceipts?: Partial<Record<MaterialKey, ReturnReceipt>>;
  secondReviewerId?: string;
  reviewNote?: string;
  separationConfirmed?: boolean;
  decisionReason?: string;
};

const materialKeys: MaterialKey[] = ["identity", "income", "consent", "consistency"];
const pageSize = 7;

function isMaterialKey(value: unknown): value is MaterialKey {
  return typeof value === "string" && materialKeys.includes(value as MaterialKey);
}

function restoreTask(props: CaseWorkbenchProps): CreditReviewTask {
  const eventData = props.events
    .filter((event) => event.objectId === props.selected.objectId)
    .sort((left, right) => left.version - right.version)
    .reduce<CreditReviewTask>((current, event) => {
      const next = (event.data ?? {}) as CreditReviewTask;
      return {
        ...current,
        ...next,
        materialStatus: { ...current.materialStatus, ...next.materialStatus },
        returnReceipts: { ...current.returnReceipts, ...next.returnReceipts },
      };
    }, {});
  const selectedTask = (props.selected.task ?? {}) as CreditReviewTask;
  return {
    ...eventData,
    ...selectedTask,
    materialStatus: { ...eventData.materialStatus, ...selectedTask.materialStatus },
    returnReceipts: { ...eventData.returnReceipts, ...selectedTask.returnReceipts },
  };
}

function text(value: unknown, fallback = "—"): string {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function moneyFromFen(value: unknown): string {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY" }).format(amount / 100)
    : "—";
}

function time(value: unknown): string {
  return text(value, "时间未记录").replace("T", " ").replace(/\+08:00$/, "");
}

function roleLabel(role: string): string {
  if (role === "supervisor") return "复核主管";
  if (role === "reviewer") return "材料复核员";
  return role;
}

function isComplete(payload: Record<string, unknown>): boolean {
  return payload.identity_verification_status === "verified"
    && payload.income_evidence_status === "complete"
    && payload.consent_status === "confirmed"
    && payload.application_consistency === "consistent";
}

function missingMaterialKeys(payload: Record<string, unknown>): MaterialKey[] {
  return [
    payload.identity_verification_status === "verified" ? undefined : "identity",
    payload.income_evidence_status === "complete" ? undefined : "income",
    payload.consent_status === "confirmed" ? undefined : "consent",
    payload.application_consistency === "consistent" ? undefined : "consistency",
  ].filter(isMaterialKey);
}

function materialStatusFromSource(
  payload: Record<string, unknown>,
  restored: Partial<MaterialStatus> | undefined,
): MaterialStatus {
  return {
    identity: payload.identity_verification_status === "verified" ? "received" : restored?.identity ?? "missing",
    income: payload.income_evidence_status === "complete" ? "received" : restored?.income ?? "missing",
    consent: payload.consent_status === "confirmed" ? "received" : restored?.consent ?? "missing",
    consistency: payload.application_consistency === "consistent" ? "received" : restored?.consistency ?? "missing",
  };
}

function commandLabel(command: string): string {
  if (command === "request_material") return "已创建补件任务";
  if (command === "record_material_return") return "已登记材料回传";
  if (command === "start_human_review") return "已进入双岗复核";
  if (command === "hold_application") return "申请已暂缓";
  return command;
}

export function CreditMaterialWorkbench(props: CaseWorkbenchProps) {
  const row = props.selected.payload;
  const restoredTask = useMemo(
    () => restoreTask(props),
    [props.events, props.selected.objectId, props.selected.task],
  );
  const sourceMissing = useMemo(() => missingMaterialKeys(row), [row]);
  const [filter, setFilter] = useState<QueueFilter>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [activeMaterial, setActiveMaterial] = useState<MaterialKey>(sourceMissing[0] ?? "income");
  const [requestedMaterials, setRequestedMaterials] = useState<MaterialKey[]>(
    restoredTask.requestedMaterials?.filter(isMaterialKey) ?? sourceMissing,
  );
  const [assignee, setAssignee] = useState(restoredTask.assignee ?? "客户材料岗");
  const [dueAt, setDueAt] = useState(restoredTask.dueAt ?? "2026-08-01");
  const [requestNote, setRequestNote] = useState(restoredTask.requestNote ?? "");
  const [requesterId, setRequesterId] = useState(restoredTask.requesterId ?? "credit-reviewer-01");
  const [materialStatus, setMaterialStatus] = useState<MaterialStatus>(
    materialStatusFromSource(row, restoredTask.materialStatus),
  );
  const [returnMaterialKey, setReturnMaterialKey] = useState<MaterialKey>(
    restoredTask.requestedMaterials?.find((key) => isMaterialKey(key) && restoredTask.materialStatus?.[key] !== "received")
      ?? sourceMissing[0]
      ?? "income",
  );
  const [returnSourceRef, setReturnSourceRef] = useState("");
  const [returnReceiptId, setReturnReceiptId] = useState("");
  const [returnActorId, setReturnActorId] = useState("credit-material-01");
  const [secondReviewerId, setSecondReviewerId] = useState(restoredTask.secondReviewerId ?? "credit-reviewer-02");
  const [reviewNote, setReviewNote] = useState(restoredTask.reviewNote ?? "");
  const [separationConfirmed, setSeparationConfirmed] = useState(Boolean(restoredTask.separationConfirmed));
  const [decisionReason, setDecisionReason] = useState(restoredTask.decisionReason ?? "");
  const applicationId = text(row.application_id, props.selected.objectId);

  useEffect(() => {
    const missing = missingMaterialKeys(row);
    setActiveMaterial(missing[0] ?? "income");
    setRequestedMaterials(restoredTask.requestedMaterials?.filter(isMaterialKey) ?? missing);
    setAssignee(restoredTask.assignee ?? "客户材料岗");
    setDueAt(restoredTask.dueAt ?? "2026-08-01");
    setRequestNote(restoredTask.requestNote ?? "");
    setRequesterId(restoredTask.requesterId ?? "credit-reviewer-01");
    setMaterialStatus(materialStatusFromSource(row, restoredTask.materialStatus));
    setReturnMaterialKey(
      restoredTask.requestedMaterials?.find((key) => isMaterialKey(key) && restoredTask.materialStatus?.[key] !== "received")
        ?? missing[0]
        ?? "income",
    );
    setReturnSourceRef("");
    setReturnReceiptId("");
    setReturnActorId("credit-material-01");
    setSecondReviewerId(restoredTask.secondReviewerId ?? "credit-reviewer-02");
    setReviewNote(restoredTask.reviewNote ?? "");
    setSeparationConfirmed(Boolean(restoredTask.separationConfirmed));
    setDecisionReason(restoredTask.decisionReason ?? "");
  }, [props.selected.objectId, props.selected.version, restoredTask, row]);

  useEffect(() => setPage(0), [filter, query]);

  const materials = useMemo(() => [
    {
      key: "identity" as const,
      label: "身份材料",
      ok: materialStatus.identity === "received",
      status: row.identity_verification_status === "verified" ? "身份已核验" : materialStatus.identity === "received" ? "身份材料已回传" : "身份待核验",
      detail: "只使用源记录中的核验状态，原始个人资料不进入工作台。",
      field: "identity_verification_status",
      icon: IdCard,
    },
    {
      key: "income" as const,
      label: "收入材料",
      ok: materialStatus.income === "received",
      status: row.income_evidence_status === "complete" ? "收入材料完整" : materialStatus.income === "received" ? "收入材料已回传" : "收入证明缺失",
      detail: row.income_evidence_status === "complete" || materialStatus.income === "received" ? "收入材料状态已登记，等待下一岗位核对。" : "源记录标记为缺失，需要创建补件任务。",
      field: "income_evidence_status",
      icon: FileText,
    },
    {
      key: "consent" as const,
      label: "授权材料",
      ok: materialStatus.consent === "received",
      status: row.consent_status === "confirmed" ? "授权已确认" : materialStatus.consent === "received" ? "授权材料已回传" : "授权未确认",
      detail: "只核对授权状态，不展示签署内容或账户信息。",
      field: "consent_status",
      icon: FileCheck2,
    },
    {
      key: "consistency" as const,
      label: "申请信息一致性",
      ok: materialStatus.consistency === "received",
      status: row.application_consistency === "consistent" ? "申请信息一致" : materialStatus.consistency === "received" ? "一致性说明已回传" : "信息需要举证",
      detail: "比较申请字段与材料摘要，不据此产生信用结论。",
      field: "application_consistency",
      icon: ClipboardCheck,
    },
  ], [materialStatus, row]);
  const selectedMaterial = materials.find((item) => item.key === activeMaterial) ?? materials[0];

  const filteredObjects = useMemo(() => props.objects.filter((item) => {
    if (filter === "incomplete" && isComplete(item.payload)) return false;
    if (filter === "supplement" && item.state !== "待补件" && item.state !== "待补正") return false;
    if (filter === "advanced" && !item.state.includes("人工复核") && !item.state.includes("暂缓")) return false;
    const needle = query.trim().toLocaleLowerCase("zh-CN");
    if (!needle) return true;
    return [item.payload.application_id, item.payload.city_name]
      .some((value) => text(value, "").toLocaleLowerCase("zh-CN").includes(needle));
  }), [filter, props.objects, query]);
  const pageCount = Math.max(1, Math.ceil(filteredObjects.length / pageSize));
  const visibleObjects = filteredObjects.slice(page * pageSize, page * pageSize + pageSize);
  const currentEvents = props.events
    .filter((event) => event.objectId === props.selected.objectId)
    .sort((left, right) => left.version - right.version);

  const requestPersisted = Boolean(
    restoredTask.requestedMaterials?.length
    && restoredTask.assignee
    && restoredTask.dueAt,
  );
  const requestUsesMissingOnly = requestedMaterials.every((key) => sourceMissing.includes(key));
  const requestReady = requestedMaterials.length > 0
    && requestUsesMissingOnly
    && assignee.trim().length >= 2
    && dueAt.length === 10
    && requestNote.trim().length >= 6
    && requesterId.trim().length >= 2;
  const allRequestedReceived = requestedMaterials.length > 0
    && requestedMaterials.every((key) => materialStatus[key] === "received");
  const secondIdentityReady = secondReviewerId.trim().length >= 2
    && secondReviewerId.trim() !== requesterId.trim()
    && separationConfirmed;
  const hasReturnCommand = props.commands.some((command) => command.id === "record_material_return");
  const reviewSubmitted = props.selected.state === "风险人工审查中" || props.selected.state === "人工复核中";
  const reviewReady = requestPersisted
    && allRequestedReceived
    && secondIdentityReady
    && reviewNote.trim().length >= 6;
  const reviewStatusTitle = reviewSubmitted
    ? "已进入风险人工审查"
    : reviewReady
      ? "可交给第二身份复核"
    : !requestPersisted
      ? sourceMissing.length ? "先锁定真实缺件" : "源记录没有材料缺口"
      : !allRequestedReceived
        ? "等待请求项全部回传"
        : !secondIdentityReady
          ? "等待第二身份确认"
          : "补充第二身份复核说明";
  const reviewStatusDetail = reviewSubmitted
    ? "补件回执与双岗复核记录已保存，后续风险判断不在本页完成。"
    : requestPersisted
    ? !allRequestedReceived
      ? `${requestedMaterials.filter((item) => materialStatus[item] === "received").length}/${requestedMaterials.length} 项已回传${hasReturnCommand ? "，每项回执单独留痕。" : "，提交复核时统一持久化。"}`
      : !secondIdentityReady
        ? "回传材料已齐，请确认初审与第二复核由不同身份完成。"
        : reviewNote.trim().length < 6
          ? "写明已核对的材料来源、范围和仍存疑点。"
          : "材料、身份分离和复核说明已齐备。"
    : "负责人、期限和说明会随任务一起记录。";
  const returnReady = requestPersisted
    && requestedMaterials.includes(returnMaterialKey)
    && materialStatus[returnMaterialKey] !== "received"
    && returnSourceRef.trim().length >= 2
    && returnReceiptId.trim().length >= 2
    && returnActorId.trim().length >= 2;

  function toggleRequestedMaterial(key: MaterialKey) {
    if (!sourceMissing.includes(key)) return;
    setRequestedMaterials((current) => current.includes(key)
      ? current.filter((item) => item !== key)
      : [...current, key]);
  }

  function toggleMaterialReceived(key: MaterialKey) {
    setMaterialStatus((current) => ({
      ...current,
      [key]: current[key] === "received" ? "missing" : "received",
    }));
  }

  function runCommand(command: string) {
    if (command === "request_material") {
      props.onCommand(command, requestNote.trim(), {
        actorId: requesterId.trim(),
        idempotencyKey: `credit-material:${props.selected.objectId}:${props.selected.version}:request`,
        evidenceIds: [`application:${applicationId}`],
        data: {
          requestedMaterials,
          assignee: assignee.trim(),
          dueAt,
          requestNote: requestNote.trim(),
          requesterId: requesterId.trim(),
        },
      });
      return;
    }
    if (command === "record_material_return") {
      const nextMaterialStatus = Object.fromEntries(
        requestedMaterials.map((key) => [
          key,
          key === returnMaterialKey ? "received" : materialStatus[key],
        ]),
      ) as Partial<MaterialStatus>;
      const receipt: ReturnReceipt = {
        sourceRef: returnSourceRef.trim(),
        receiptId: returnReceiptId.trim(),
        actorId: returnActorId.trim(),
      };
      const nextReturnReceipts = Object.fromEntries(
        requestedMaterials.flatMap((key) => {
          if (key === returnMaterialKey) return [[key, receipt]];
          const existing = restoredTask.returnReceipts?.[key];
          return existing ? [[key, existing]] : [];
        }),
      );
      props.onCommand(command, `${materials.find((item) => item.key === returnMaterialKey)?.label ?? returnMaterialKey}回传：${receipt.receiptId}`, {
        actorId: receipt.actorId,
        idempotencyKey: `credit-material:${props.selected.objectId}:${props.selected.version}:return:${returnMaterialKey}:${receipt.receiptId}`,
        evidenceIds: [`returned-material:${returnMaterialKey}`, `return-receipt:${receipt.receiptId}`],
        data: {
          materialKey: returnMaterialKey,
          sourceRef: receipt.sourceRef,
          receiptId: receipt.receiptId,
          returnActorId: receipt.actorId,
          materialStatus: nextMaterialStatus,
          returnReceipts: nextReturnReceipts,
        },
      });
      return;
    }
    if (command === "start_human_review") {
      props.onCommand(command, reviewNote.trim(), {
        actorId: secondReviewerId.trim(),
        idempotencyKey: `credit-material:${props.selected.objectId}:${props.selected.version}:review`,
        evidenceIds: requestedMaterials.map((item) => `returned-material:${item}`),
        data: {
          materialStatus,
          secondReviewerId: secondReviewerId.trim(),
          reviewNote: reviewNote.trim(),
          separationConfirmed: true,
        },
      });
      return;
    }
    if (command === "hold_application") {
      props.onCommand(command, decisionReason.trim(), {
        idempotencyKey: `credit-material:${props.selected.objectId}:${props.selected.version}:hold`,
        evidenceIds: [`application:${applicationId}`],
        data: { decisionReason: decisionReason.trim() },
      });
    }
  }

  return (
    <main className={styles.shell} aria-label="申请材料人工复核工作台">
      <header className={styles.topbar}>
        <div>
          <h1>申请材料补正与双岗复核</h1>
          <p>只处理真实材料缺口，不在本页产生信用结论</p>
        </div>
        <div className={styles.topActions}>
          <span className={styles.roleBadge}><UserRoundCheck aria-hidden="true" size={18} />{roleLabel(props.actorRole)}</span>
          <button type="button" onClick={props.onReset} disabled={props.busy} aria-label="恢复当前申请案卷" title="恢复当前申请案卷"><RefreshCw aria-hidden="true" size={18} /></button>
        </div>
      </header>

      <section className={styles.caseRibbon} aria-label="当前申请摘要">
        <div><span>申请编号</span><strong>{applicationId}</strong></div>
        <div><span>申请金额</span><strong>{moneyFromFen(row.requested_amount_fen)}</strong></div>
        <div><span>申请地区</span><strong>{text(row.city_name, "城市未记录")}</strong></div>
        <div><span>当前状态</span><strong data-status>{props.selected.state}</strong></div>
        <div><span>来源渠道</span><strong>{text(row.channel, "渠道未记录")}</strong></div>
      </section>

      <section className={styles.workspace}>
        <aside className={styles.queue} aria-label="申请案卷队列">
          <header>
            <div><strong>申请案卷队列</strong><small>已加载 {props.objects.length.toLocaleString("zh-CN")} / 数据 {props.datasetRowCount.toLocaleString("zh-CN")}</small></div>
            <label className={styles.searchField}><Search aria-hidden="true" size={16} /><input type="search" aria-label="搜索申请编号或城市" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="编号或城市" /></label>
          </header>
          <div className={styles.queueFilters}>
            {([
              ["all", "全部"],
              ["incomplete", "材料不齐"],
              ["supplement", "待补件"],
              ["advanced", "复核 / 暂缓"],
            ] as const).map(([key, label]) => <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>)}
          </div>
          <div className={styles.queueList}>
            {visibleObjects.map((item) => {
              const incomplete = !isComplete(item.payload);
              const id = text(item.payload.application_id, item.objectId);
              return <button
                key={item.objectId}
                type="button"
                className={styles.queueCard}
                aria-label={`${id} · ${text(item.payload.city_name)} · ${item.state}`}
                aria-pressed={item.objectId === props.selected.objectId}
                onClick={() => props.onSelect(item.objectId)}
              >
                <span><strong>{id}</strong><em data-incomplete={incomplete}>{incomplete ? "材料不齐" : "材料齐备"}</em></span>
                <span><MapPin aria-hidden="true" size={14} />{text(item.payload.city_name, "城市未记录")}<b>{moneyFromFen(item.payload.requested_amount_fen)}</b></span>
                <small>{time(item.payload.application_at)} · {item.state}</small>
              </button>;
            })}
            {!visibleObjects.length ? <p className={styles.emptyQueue}>没有匹配的申请案卷</p> : null}
          </div>
          <footer className={styles.pagination}>
            <button type="button" aria-label="上一页申请" disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))}><ChevronLeft aria-hidden="true" size={17} /></button>
            <span>{Math.min(page + 1, pageCount)} / {pageCount}</span>
            <button type="button" aria-label="下一页申请" disabled={page + 1 >= pageCount} onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}><ChevronRight aria-hidden="true" size={17} /></button>
          </footer>
        </aside>

        <section className={styles.dossier} aria-label="申请材料案卷">
          <section className={styles.materialBoard} aria-label="材料清单与核对">
            <header>
              <div><h2>案卷材料</h2><p>四个槽位只呈现字段级状态；缺失项才可进入补件任务</p></div>
              <span><FolderOpen aria-hidden="true" size={17} />版本 v{props.selected.version}</span>
            </header>
            <div className={styles.materialSlots} role="region" aria-label="匿名材料槽">
              {materials.map((item, index) => {
                const Icon = item.icon;
                const sourceMissingItem = sourceMissing.includes(item.key);
                return <button
                  key={item.key}
                  type="button"
                  className={styles.materialSlot}
                  data-active={activeMaterial === item.key || undefined}
                  data-missing={!item.ok || undefined}
                  aria-label={`查看${item.label}`}
                  aria-pressed={activeMaterial === item.key}
                  onClick={() => setActiveMaterial(item.key)}
                >
                  <span className={styles.slotNumber}>{index + 1}</span>
                  <Icon aria-hidden="true" size={29} />
                  <strong>{item.label}</strong>
                  <b>{item.status}</b>
                  <small>{sourceMissingItem ? "源记录缺失" : "源记录已确认"}</small>
                </button>;
              })}
            </div>
            <section className={styles.materialDetail} aria-label="所选材料详情" aria-live="polite">
              <selectedMaterial.icon aria-hidden="true" size={24} />
              <div><strong>{selectedMaterial.label} · {selectedMaterial.status}</strong><p>{selectedMaterial.detail}</p></div>
              <span>字段依据 <code>{selectedMaterial.field}</code></span>
            </section>
          </section>

          <section className={styles.facts} aria-label="申请事实摘要">
            <div><span>客户类型</span><strong>{row.customer_segment === "new_customer" ? "新客户" : row.customer_segment === "returning_customer" ? "存量客户" : "未记录"}</strong></div>
            <div><span>申报收入档</span><strong>{text(row.declared_income_band, "未记录")}</strong></div>
            <div><span>提交时间</span><strong>{time(row.application_at)}</strong></div>
            <div><span>数据性质</span><strong>确定性合成</strong></div>
          </section>

          <section className={styles.auditLane} aria-label="申请流转记录">
            <header><strong>人员职责交接</strong><small>只显示当前申请的持久化事件</small></header>
            <div>
              <article data-current={currentEvents.length === 0 || undefined}><i>1</i><span><b>材料初核</b><small>{applicationId} · {props.selected.state}</small></span></article>
              {currentEvents.map((event, index) => <article key={event.eventId} data-current={index === currentEvents.length - 1 || undefined}><i>{index + 2}</i><span><b>{commandLabel(event.command)}</b><small>{event.actor.id} · v{event.version}</small></span></article>)}
            </div>
          </section>
        </section>

        <aside className={styles.taskPanel} aria-label="当前补件任务">
          <header><div><strong>{requestPersisted ? "当前补件任务" : "创建补件任务"}</strong><small>{applicationId}</small></div><span>{requestPersisted ? `${assignee} · ${dueAt}` : `${requestedMaterials.length} 项待请求`}</span></header>
          <div className={styles.actionBody}>
            <section className={styles.statusCard} data-ready={reviewReady}>
              {reviewReady ? <BadgeCheck aria-hidden="true" size={22} /> : <CircleAlert aria-hidden="true" size={22} />}
              <div><strong>{reviewStatusTitle}</strong><p>{reviewStatusDetail}</p></div>
            </section>

            <section className={styles.caseTask} aria-label="补件案卷">
              {!requestPersisted ? <>
                <div className={styles.checkList}>{materials.map((item) => {
                  const eligible = sourceMissing.includes(item.key);
                  return <label key={item.key} data-disabled={!eligible || undefined}><input type="checkbox" checked={eligible && requestedMaterials.includes(item.key)} disabled={!eligible} onChange={() => toggleRequestedMaterial(item.key)} /><span><b>{item.label}</b><small>{eligible ? item.status : "源记录已确认，不可请求"}</small></span></label>;
                })}</div>
                <div className={styles.fieldGrid}>
                  <label>初审身份<input aria-label="初审人员身份" value={requesterId} onChange={(event) => setRequesterId(event.target.value)} /></label>
                  <label>补件负责人<input aria-label="补件负责人" value={assignee} onChange={(event) => setAssignee(event.target.value)} /></label>
                  <label className={styles.full}>回传期限<input aria-label="补件回传期限" type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></label>
                  <label className={styles.full}>补件说明<textarea aria-label="补件说明" value={requestNote} maxLength={180} onChange={(event) => setRequestNote(event.target.value)} placeholder="写明缺少什么，以及为什么需要" /></label>
                </div>
              </> : <div className={styles.returnList}>{requestedMaterials.map((key) => {
                const item = materials.find((candidate) => candidate.key === key)!;
                const received = materialStatus[key] === "received";
                const selectedForReturn = hasReturnCommand && returnMaterialKey === key;
                const receipt = restoredTask.returnReceipts?.[key];
                return <button
                  key={key}
                  type="button"
                  aria-label={hasReturnCommand ? `${item.label}${received ? "已回传" : "选择回传"}` : `${item.label}${received ? "取消已回传" : "标记已回传"}`}
                  aria-pressed={hasReturnCommand ? selectedForReturn : received}
                  data-received={received}
                  data-selected={selectedForReturn || undefined}
                  disabled={hasReturnCommand && received}
                  onClick={() => hasReturnCommand ? setReturnMaterialKey(key) : toggleMaterialReceived(key)}
                ><span>{received ? <BadgeCheck aria-hidden="true" size={17} /> : <FileClock aria-hidden="true" size={17} />}<b>{item.label}</b></span><small>{received ? receipt?.receiptId ?? "已回传" : selectedForReturn ? "当前登记项" : "选择登记"}</small></button>;
              })}</div>}
            </section>

            {requestPersisted && hasReturnCommand ? <section className={styles.returnReceipt} aria-label="单项回传回执">
              <header><strong>单项回传回执</strong><small>不保存影像或个人身份字段</small></header>
              <label>回传材料<select aria-label="回传材料" value={returnMaterialKey} onChange={(event) => setReturnMaterialKey(event.target.value as MaterialKey)}>{requestedMaterials.map((key) => {
                const item = materials.find((candidate) => candidate.key === key)!;
                return <option key={key} value={key} disabled={materialStatus[key] === "received"}>{item.label}{materialStatus[key] === "received" ? " · 已回传" : ""}</option>;
              })}</select></label>
              <label>匿名材料来源<input aria-label="匿名材料来源" value={returnSourceRef} onChange={(event) => setReturnSourceRef(event.target.value)} placeholder="例如：bank-statement-channel" /></label>
              <label>材料回执编号<input aria-label="材料回执编号" value={returnReceiptId} onChange={(event) => setReturnReceiptId(event.target.value)} placeholder="例如：RET-2026-0001" /></label>
              <label>回传操作身份<input aria-label="回传操作身份" value={returnActorId} onChange={(event) => setReturnActorId(event.target.value)} /></label>
            </section> : null}

            {requestPersisted ? <section className={styles.secondReview} aria-label="第二身份复核">
              <header><strong>第二身份复核</strong><span data-valid={secondIdentityReady}>{secondIdentityReady ? "身份已分离" : "待确认"}</span></header>
              <label>第二复核身份<input aria-label="第二复核人员身份" value={secondReviewerId} onChange={(event) => setSecondReviewerId(event.target.value)} /></label>
              <label className={styles.confirm}><input type="checkbox" checked={separationConfirmed} onChange={(event) => setSeparationConfirmed(event.target.checked)} />确认初审与第二复核不是同一身份</label>
              {secondReviewerId.trim() === requesterId.trim() ? <p role="alert">第二复核身份不能与初审身份相同。</p> : null}
              <label>复核说明<textarea aria-label="第二身份复核说明" value={reviewNote} maxLength={200} onChange={(event) => setReviewNote(event.target.value)} placeholder="记录材料来源、仍有疑点和复核范围" /></label>
            </section> : null}

            {props.commands.some((command) => command.id === "hold_application") ? <label className={styles.holdReason}>暂缓理由<textarea aria-label="暂缓申请理由" value={decisionReason} maxLength={180} onChange={(event) => setDecisionReason(event.target.value)} placeholder="说明暂缓范围和仍缺少的材料" /></label> : null}

            <label className={styles.roleField}>操作角色<select aria-label="当前操作角色" value={props.actorRole} onChange={(event) => props.onActorRoleChange(event.target.value)}>{props.roles.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}</select></label>
            <div className={styles.commandGrid}>{props.commands.length ? props.commands.map((command) => {
              const disabled = props.busy
                || (command.id === "request_material" && !requestReady)
                || (command.id === "record_material_return" && !returnReady)
                || (command.id === "start_human_review" && !reviewReady)
                || (command.id === "hold_application" && decisionReason.trim().length < 6);
              const icon = command.id === "request_material"
                ? <Send aria-hidden="true" size={16} />
                : command.id === "record_material_return"
                  ? <FileCheck2 aria-hidden="true" size={16} />
                  : <UserRoundCheck aria-hidden="true" size={16} />;
              return <button key={command.id} type="button" onClick={() => runCommand(command.id)} disabled={disabled} data-danger={command.id === "hold_application"}>{icon}{props.busy ? "正在记录…" : command.label}</button>;
            }) : <p>当前角色没有可执行动作。</p>}</div>
            {props.receipt ? <p role="status" className={styles.success}><BadgeCheck aria-hidden="true" size={15} />已持久化：{props.receipt.event.fromState} → {props.receipt.event.toState}</p> : null}
            {props.error ? <p role="alert" className={styles.error}>{props.error} <button type="button" onClick={() => props.onSelect(props.selected.objectId)}>刷新当前申请</button></p> : null}
            <section className={styles.boundary}><ShieldCheck aria-hidden="true" size={17} /><span><strong>材料完整不等于授信结论</strong><small>本页只记录材料状态与岗位交接。</small></span></section>
          </div>
        </aside>
      </section>
    </main>
  );
}
