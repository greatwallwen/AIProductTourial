"use client";

import {
  AlertTriangle,
  Check,
  CheckCircle2,
  CircleHelp,
  Database,
  FileQuestion,
  FileSearch,
  KeyRound,
  LockKeyhole,
  Network,
  RefreshCw,
  Search,
  ShieldCheck,
  Unplug,
  UserCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import styles from "./TelecomRecoveryWorkbench.module.css";
import type { CaseWorkbenchProps } from "./types";

type DirectoryGroup = "response_lost" | "effect_unknown" | "not_committed" | "evidence_missing";
type LookupResult = "effective" | "not_effective" | "unknown";
type RecoveryRecord = {
  lookupTarget: string;
  recoveryWindow: string;
  note: string;
  lookupResult: LookupResult;
  resultSummary: string;
  evidenceId: string;
};

const directoryGroups: Array<{ id: DirectoryGroup; label: string }> = [
  { id: "response_lost", label: "响应缺失" },
  { id: "effect_unknown", label: "效果未知" },
  { id: "not_committed", label: "尚未提交" },
  { id: "evidence_missing", label: "证据待补" },
];

const resultLabels: Record<LookupResult, string> = {
  effective: "已生效",
  not_effective: "未生效",
  unknown: "仍未知",
};

function text(value: unknown): string { return String(value ?? "—"); }
function optionalText(value: unknown): string { return typeof value === "string" ? value : ""; }
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function truthy(value: unknown): boolean { return String(value).toLowerCase() === "true"; }
function shortMinute(value: unknown): string {
  const source = text(value).replace("T", " ");
  return source.length >= 16 ? source.slice(0, 16) : source;
}
function roleLabel(role: string): string {
  return role === "supervisor" ? "业务主管" : role === "coordinator" ? "恢复专员" : role;
}
function scenarioFaultLabel(value: unknown): string {
  if (value === "committed_response_lost") return "已提交后响应丢失";
  if (value === "effect_status_unknown") return "效果状态未知";
  if (value === "not_committed") return "尚未提交";
  return text(value);
}
function defaultTarget(category: unknown): string {
  const value = text(category);
  if (value.includes("资费")) return "计费中心";
  if (value.includes("网络")) return "网络工单中心";
  if (value.includes("业务")) return "业务受理中心";
  return "服务工单中心";
}
function stableSuffix(source: string): string {
  let hash = 17;
  for (let index = 0; index < source.length; index += 1) hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  return hash.toString(16).padStart(8, "0").slice(-8);
}
function normalizeResult(value: unknown): LookupResult {
  if (value === "effective" || value === "已生效") return "effective";
  if (value === "not_effective" || value === "未生效") return "not_effective";
  return "unknown";
}
function parseRecord(reason: unknown): RecoveryRecord | undefined {
  const source = text(reason);
  const marker = ["recovery-plan:", "recovery-check:", "recovery-pending:", "recovery-close:"]
    .find((item) => source.startsWith(item));
  if (!marker) return undefined;
  try {
    const parsed = JSON.parse(source.slice(marker.length)) as Partial<RecoveryRecord>;
    return {
      lookupTarget: text(parsed.lookupTarget),
      recoveryWindow: text(parsed.recoveryWindow || "24 小时"),
      note: text(parsed.note === undefined ? "" : parsed.note),
      lookupResult: normalizeResult(parsed.lookupResult),
      resultSummary: text(parsed.resultSummary === undefined ? "" : parsed.resultSummary),
      evidenceId: text(parsed.evidenceId === undefined ? "" : parsed.evidenceId),
    };
  } catch {
    return undefined;
  }
}
function belongsToGroup(item: CaseWorkbenchProps["objects"][number], group: DirectoryGroup): boolean {
  const scenario = text(item.payload.external_lookup_scenario);
  if (group === "response_lost") return scenario === "committed_response_lost";
  if (group === "effect_unknown") return scenario === "effect_status_unknown";
  if (group === "not_committed") return scenario === "not_committed";
  return !truthy(item.payload.evidence_complete);
}

export function TelecomRecoveryWorkbench(props: CaseWorkbenchProps) {
  const row = props.selected.payload;
  const taskId = text(row.task_id);
  const scenario = text(row.external_lookup_scenario);
  const [directoryGroup, setDirectoryGroup] = useState<DirectoryGroup>("response_lost");
  const [query, setQuery] = useState("");

  const selectedEvents = useMemo(
    () => props.events.filter((event) => event.objectId === props.selected.objectId),
    [props.events, props.selected.objectId],
  );
  const records = useMemo(
    () => selectedEvents.map((event) => ({ event, record: parseRecord(event.reason) })).filter((entry) => entry.record),
    [selectedEvents],
  );
  const eventRecord = records.at(-1)?.record;
  const eventKnownResult = [...records].reverse().find(({ record: entry }) => entry?.lookupResult !== "unknown")?.record;
  const taskData = useMemo(() => record(props.selected.task), [props.selected.task]);
  const taskPlan = useMemo(() => record(taskData.recoveryPlan), [taskData]);
  const taskLookup = useMemo(() => record(taskData.lookupResult), [taskData]);
  const persistedCreatedBy = optionalText(taskData.createdBy);
  const taskKnownResult = useMemo<RecoveryRecord | undefined>(() => {
    const status = normalizeResult(taskLookup.status);
    const summary = optionalText(taskLookup.summary);
    const taskEvidenceId = optionalText(taskLookup.evidenceId);
    if (status === "unknown" || !summary || !taskEvidenceId) return undefined;
    return {
      lookupTarget: optionalText(taskPlan.lookupTarget) || eventRecord?.lookupTarget || defaultTarget(row.category),
      recoveryWindow: eventRecord?.recoveryWindow || "24 小时",
      note: optionalText(taskPlan.note) || eventRecord?.note || "只查询外部效果，不重放原业务请求",
      lookupResult: status,
      resultSummary: summary,
      evidenceId: taskEvidenceId,
    };
  }, [eventRecord, row.category, taskLookup, taskPlan]);
  const persistedRecord = useMemo<RecoveryRecord | undefined>(() => {
    if (!Object.keys(taskData).length) return eventRecord;
    return {
      lookupTarget: optionalText(taskPlan.lookupTarget) || eventRecord?.lookupTarget || defaultTarget(row.category),
      recoveryWindow: eventRecord?.recoveryWindow || "24 小时",
      note: optionalText(taskPlan.note) || eventRecord?.note || "只查询外部效果，不重放原业务请求",
      lookupResult: taskKnownResult?.lookupResult || eventRecord?.lookupResult || "unknown",
      resultSummary: taskKnownResult?.resultSummary || eventRecord?.resultSummary || "",
      evidenceId: taskKnownResult?.evidenceId || eventRecord?.evidenceId || "",
    };
  }, [eventRecord, row.category, taskData, taskKnownResult, taskPlan]);
  const recordedKnownResult = taskKnownResult || eventKnownResult;

  const [lookupTarget, setLookupTarget] = useState(persistedRecord?.lookupTarget || defaultTarget(row.category));
  const [note, setNote] = useState(persistedRecord?.note || "只查询外部效果，不重放原业务请求");
  const [lookupResult, setLookupResult] = useState<LookupResult>(persistedRecord?.lookupResult || "unknown");
  const [resultSummary, setResultSummary] = useState(persistedRecord?.resultSummary || "");
  const [evidenceId, setEvidenceId] = useState(persistedRecord?.evidenceId || "");

  useEffect(() => {
    setLookupTarget(persistedRecord?.lookupTarget || defaultTarget(row.category));
    setNote(persistedRecord?.note || "只查询外部效果，不重放原业务请求");
    setLookupResult(persistedRecord?.lookupResult || "unknown");
    setResultSummary(persistedRecord?.resultSummary || "");
    setEvidenceId(persistedRecord?.evidenceId || "");
  }, [persistedRecord, props.selected.objectId, row.category]);

  const groupCounts = useMemo(() => Object.fromEntries(directoryGroups.map(({ id }) => [
    id,
    props.objects.filter((item) => belongsToGroup(item, id)).length,
  ])) as Record<DirectoryGroup, number>, [props.objects]);

  const visibleObjects = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return props.objects.filter((item) => belongsToGroup(item, directoryGroup)).filter((item) => {
      if (!needle) return true;
      return [item.payload.task_id, item.payload.category, item.payload.province, item.payload.city]
        .some((value) => text(value).toLowerCase().includes(needle));
    });
  }, [directoryGroup, props.objects, query]);

  const localRecoveryKey = `IK-${taskId.replace(/^CN-TEL-/, "")}-${stableSuffix(taskId)}`;
  const evidenceComplete = truthy(row.evidence_complete);
  const allegationVerified = truthy(row.allegation_verified);
  const hasSendClue = scenario !== "not_committed";
  const startCommand = props.commands.find((command) => command.id === "start_lookup");
  const resultCommand = props.commands.find((command) => command.id === "retry_idempotent");
  const pendingCommand = props.commands.find((command) => command.id === "keep_pending");
  const closeCommand = props.commands.find((command) => command.id === "close_task");
  const actorId = props.actorRole === "supervisor" ? "case10-recovery-supervisor" : "case10-recovery-coordinator";
  const roleSeparated = props.actorRole === "supervisor"
    && Boolean(persistedCreatedBy)
    && persistedCreatedBy !== actorId;
  const hasKnownDraft = lookupResult !== "unknown";
  const canRecordResult = Boolean(resultCommand)
    && hasKnownDraft
    && resultSummary.trim().length >= 4
    && evidenceId.trim().length >= 4;
  const canKeepPending = Boolean(pendingCommand)
    && lookupResult === "unknown"
    && resultSummary.trim().length >= 4;
  const canClose = Boolean(closeCommand)
    && roleSeparated
    && Boolean(taskKnownResult?.resultSummary)
    && Boolean(taskKnownResult?.evidenceId);
  const latestEvent = selectedEvents.at(-1);

  function commandRecord(command: string): RecoveryRecord {
    const draft: RecoveryRecord = {
      lookupTarget,
      recoveryWindow: persistedRecord?.recoveryWindow || "24 小时",
      note: note.trim(),
      lookupResult,
      resultSummary: resultSummary.trim(),
      evidenceId: evidenceId.trim(),
    };
    if (command === "start_lookup") return { ...draft, lookupResult: "unknown", resultSummary: "", evidenceId: "" };
    if (command === "keep_pending") return { ...draft, lookupResult: "unknown", evidenceId: "" };
    if (command === "close_task" && taskKnownResult) return taskKnownResult;
    return draft;
  }

  function runCommand(command: string) {
    const record = commandRecord(command);
    const prefix = command === "start_lookup"
      ? "recovery-plan:"
      : command === "retry_idempotent"
        ? "recovery-check:"
        : command === "keep_pending"
          ? "recovery-pending:"
          : "recovery-close:";
    const evidenceIds = [`task:${taskId}`, ...(record.evidenceId ? [record.evidenceId] : [])];
    const data = command === "start_lookup"
      ? {
        localRecoveryKey,
        recoveryPlan: { lookupTarget: record.lookupTarget, note: record.note },
        createdBy: actorId,
      }
      : command === "retry_idempotent"
        ? {
          localRecoveryKey,
          lookupResult: {
            status: record.lookupResult,
            summary: record.resultSummary,
            evidenceId: record.evidenceId,
            checkedBy: actorId,
          },
        }
        : command === "keep_pending"
          ? { localRecoveryKey, pendingReason: record.resultSummary }
          : {
            localRecoveryKey,
            decisionBy: actorId,
            closeNote: record.resultSummary,
          };
    props.onCommand(command, `${prefix}${JSON.stringify(record)}`, {
      actorId,
      data,
      evidenceIds,
      idempotencyKey: `${localRecoveryKey}:${command}`,
    });
  }

  const matrixResult = recordedKnownResult
    ? `已记录：${resultLabels[recordedKnownResult.lookupResult]}`
    : "外部效果未知";

  return (
    <main className={styles.root} aria-label="通信请求恢复核查工作台">
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <h1>通信请求恢复核查</h1>
          <span>本地观察：响应未取得</span>
          <strong><AlertTriangle size={16} />外部效果未知 · 禁止重放</strong>
        </div>
        <dl className={styles.identity}>
          <div><dt>任务编号</dt><dd>{taskId}</dd></div>
          <div><dt>业务类型</dt><dd>{text(row.category)} / {text(row.subcategory)}</dd></div>
          <div><dt>区域</dt><dd>{text(row.province)} / {text(row.city)}</dd></div>
          <div><dt>课程故障标签</dt><dd>{scenarioFaultLabel(scenario)}</dd></div>
        </dl>
        <div className={styles.headerActions}>
          <label>当前操作角色<select aria-label="当前操作角色" value={props.actorRole} onChange={(event) => props.onActorRoleChange(event.target.value)}>{props.roles.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}</select></label>
          <button type="button" aria-label="恢复案例 B010" title="恢复案例" disabled={props.busy} onClick={props.onReset}><RefreshCw size={18} /></button>
        </div>
      </header>

      <section className={styles.workspace}>
        <aside className={styles.directory} aria-label="匿名恢复核查单目录">
          <header><div><strong>核查单目录</strong><span>匿名课程任务</span></div><b>{props.datasetRowCount.toLocaleString("zh-CN")}</b></header>
          <label className={styles.search}><Search size={16} /><input aria-label="搜索核查单" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="任务号、类别或地区" /></label>
          <nav className={styles.groupTabs} aria-label="核查单分组">
            {directoryGroups.map((group) => <button key={group.id} type="button" aria-pressed={directoryGroup === group.id} onClick={() => setDirectoryGroup(group.id)}><span>{group.label}</span><b>{groupCounts[group.id]}</b></button>)}
          </nav>
          <div className={styles.taskList}>
            {visibleObjects.map((item) => <button key={item.objectId} type="button" aria-pressed={item.objectId === props.selected.objectId} onClick={() => props.onSelect(item.objectId)}>
              <span><strong>{text(item.payload.task_id)}</strong><em>{text(item.payload.priority)}</em></span>
              <b>{text(item.payload.category)} · {text(item.payload.subcategory)}</b>
              <small>{text(item.payload.province)} / {text(item.payload.city)} · {truthy(item.payload.evidence_complete) ? "证据字段完整" : "证据待补"}</small>
            </button>)}
            {!visibleObjects.length ? <p>该分组没有匹配任务。</p> : null}
          </div>
          <footer><ShieldCheck size={15} /><span>不含姓名、手机号或账号</span></footer>
        </aside>

        <section className={styles.forensics}>
          <section className={styles.waterfall} role="region" aria-label="调用链路取证">
            <header><div><span>当前核查对象</span><strong>{taskId}</strong></div><p>本地记录与课程故障标签不能替代外部回执</p></header>
            <div className={styles.laneHead}><span>本地系统</span><span>网络边界</span><span>外部效果</span></div>
            <div className={styles.trace}>
              <article className={styles.localNode}><Database size={27} /><span><strong>本地已登记</strong><small>{shortMinute(row.received_at)}</small></span><CheckCircle2 size={19} /></article>
              <div className={styles.outbound}><span>{hasSendClue ? "请求发送线索" : "没有发送线索"}</span><small>仅来自课程故障标签</small></div>
              <div className={styles.breakNode}><Unplug size={26} /><strong>响应未取得</strong><span>没有可验证回执</span></div>
              <div className={styles.scanTrack} aria-hidden="true"><i key={props.selected.objectId} className={styles.scanPulse} /></div>
              <article className={styles.externalNode}><FileQuestion size={30} /><strong>外部效果未知</strong><span>当前页面不连接真实运营商系统</span></article>
            </div>
          </section>

          <section className={styles.matrix} role="region" aria-label="证据对比矩阵">
            <header><div><strong>证据对比矩阵</strong><span>观察、材料和结论分别记录</span></div><aside><KeyRound size={17} /><span><small>本地恢复关联键</small><strong>{localRecoveryKey}</strong></span></aside></header>
            <table>
              <thead><tr><th>证据槽</th><th>当前观察</th><th>可验证材料</th><th>当前结论</th></tr></thead>
              <tbody>
                <tr><th>本地登记</th><td>任务字段已读取</td><td>本地任务记录</td><td data-state="ready">本地已登记</td></tr>
                <tr><th>请求发送线索</th><td>{hasSendClue ? "课程标签存在" : "未显示发送"}</td><td>无真实请求日志</td><td data-state="clue">仅作演示线索</td></tr>
                <tr><th>响应回执</th><td>响应未取得</td><td>没有可验证回执</td><td data-state="missing">缺失</td></tr>
                <tr><th>外部效果</th><td>{matrixResult}</td><td>{recordedKnownResult?.evidenceId || "证据待补"}</td><td data-state={recordedKnownResult ? "ready" : "unknown"}>{matrixResult}</td></tr>
              </tbody>
            </table>
          </section>

          <section className={styles.receiptStrip} aria-label="当前任务回执">
            <div><Database size={16} /><span><small>当前任务回执</small><strong>{latestEvent ? `${latestEvent.fromState} → ${latestEvent.toState}` : "本地已登记"}</strong></span></div>
            <span>{latestEvent ? shortMinute(latestEvent.occurredAt) : shortMinute(row.received_at)}</span>
            <b>{allegationVerified ? "已有核实记录" : "投诉未核实"}</b>
          </section>
        </section>

        <aside className={styles.resultPanel} aria-label="核对结果与完成条件">
          <header><div><span>当前状态</span><strong>{props.selected.state}</strong></div><em data-unknown={lookupResult === "unknown"}>{resultLabels[lookupResult]}</em></header>

          <section className={styles.gates}>
            <h2>完成前必须满足</h2>
            <ol>
              <li data-ready="true"><Check size={16} /><span><strong>原任务关联</strong><small>本地恢复关联键已生成</small></span><b>已具备</b></li>
              <li data-ready={Boolean(recordedKnownResult)}>{recordedKnownResult ? <Check size={16} /> : <CircleHelp size={16} />}<span><strong>查询结果</strong><small>{recordedKnownResult ? resultLabels[recordedKnownResult.lookupResult] : "仍未知"}</small></span><b>{recordedKnownResult ? "已记录" : "待记录"}</b></li>
              <li data-ready={Boolean(recordedKnownResult?.evidenceId)}>{recordedKnownResult?.evidenceId ? <Check size={16} /> : <FileQuestion size={16} />}<span><strong>证据编号</strong><small>{recordedKnownResult?.evidenceId || "待补"}</small></span><b>{recordedKnownResult?.evidenceId ? "已关联" : "待补"}</b></li>
              <li data-ready={roleSeparated}>{roleSeparated ? <UserCheck size={16} /> : <LockKeyhole size={16} />}<span><strong>角色分离</strong><small>{roleSeparated ? "创建人与确认人不同" : roleLabel(props.actorRole)}</small></span><b>{roleSeparated ? "业务主管" : "待主管"}</b></li>
            </ol>
          </section>

          <section className={styles.form}>
            <h2>外部效果核对</h2>
            <fieldset><legend>核对结果</legend><div className={styles.resultOptions}>{(["effective", "not_effective", "unknown"] as LookupResult[]).map((result) => <label key={result} data-selected={lookupResult === result}><input type="radio" name="lookup-result" value={result} checked={lookupResult === result} onChange={() => setLookupResult(result)} /><span>{resultLabels[result]}</span></label>)}</div></fieldset>
            <label>查询目标<select aria-label="查询目标" value={lookupTarget} onChange={(event) => setLookupTarget(event.target.value)}><option>计费中心</option><option>业务受理中心</option><option>网络工单中心</option><option>服务工单中心</option></select></label>
            <label>查询说明<textarea aria-label="查询说明" value={note} onChange={(event) => setNote(event.target.value)} /></label>
            <label>查询结果摘要<textarea aria-label="查询结果摘要" value={resultSummary} onChange={(event) => setResultSummary(event.target.value)} placeholder={lookupResult === "unknown" ? "说明仍未知的原因" : "至少 4 个字符，只写可验证事实"} /></label>
            <label>证据编号<input aria-label="证据编号" value={evidenceId} onChange={(event) => setEvidenceId(event.target.value)} disabled={lookupResult === "unknown"} placeholder={lookupResult === "unknown" ? "仍未知时不填写" : "填写本次核对材料编号"} /></label>
          </section>

          <section className={styles.actions} aria-label="核查动作">
            <button type="button" data-tone="primary" disabled={props.busy || !startCommand || note.trim().length < 4} onClick={() => runCommand("start_lookup")}><FileSearch size={17} /><span>发起外部效果查询</span></button>
            <button type="button" data-tone="primary" disabled={props.busy || !canRecordResult} onClick={() => runCommand("retry_idempotent")}><CheckCircle2 size={17} /><span>记录外部核对结果</span></button>
            <button type="button" disabled={props.busy || !canKeepPending} onClick={() => runCommand("keep_pending")}><CircleHelp size={17} /><span>保留待核对</span></button>
            <button type="button" data-tone="close" disabled={props.busy || !canClose} onClick={() => runCommand("close_task")}><LockKeyhole size={17} /><span>关闭课程恢复核查</span></button>
          </section>

          {props.receipt ? <p className={styles.status} role="status"><CheckCircle2 size={16} />本地状态已写入：{props.receipt.event.fromState} → {props.receipt.event.toState}</p> : null}
          {props.error ? <p className={styles.error} role="alert"><AlertTriangle size={16} /><span>动作未写入，请刷新后核对当前状态。</span><button type="button" onClick={() => props.onSelect(props.selected.objectId)}>刷新当前核查单</button></p> : null}
        </aside>
      </section>

      <footer className={styles.footer}>
        <span><ShieldCheck size={15} />匿名合成运营任务 · {evidenceComplete ? "字段完整" : "证据待补"}</span>
        <strong>本地动作不等于外部处理结果；投诉主张保持未核实。</strong>
        <span>v{props.selected.version}</span>
      </footer>
    </main>
  );
}
