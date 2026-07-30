"use client";

import {
  AlertTriangle,
  CarFront,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  MessageSquareText,
  Phone,
  RefreshCw,
  Save,
  ShieldCheck,
  UserRound,
  Wrench,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import styles from "./AutoServiceTriageWorkbench.module.css";
import type { CaseWorkbenchProps } from "./types";

type QuestionKey = "drivable" | "warning" | "condition" | "recurrence";
type RecordedAnswer = { value: string; label: string; source: "customer_answer" };
type AnswerMap = Partial<Record<QuestionKey, RecordedAnswer>>;
type HandoffTask = {
  intakeId?: string;
  answers: AnswerMap;
  safetyNoticeAcknowledged: boolean;
  technician: string;
  handoffWindow: string;
  note: string;
  requestedQuestionIds?: QuestionKey[];
  createdBy?: string;
};

const questions: Array<{
  id: QuestionKey;
  title: string;
  prompt: string;
  options: Array<{ value: string; label: string }>;
}> = [
  {
    id: "drivable",
    title: "车辆移动状态",
    prompt: "车辆现在能否安全移动？",
    options: [
      { value: "can_move", label: "可以" },
      { value: "cannot_move", label: "不能" },
      { value: "uncertain", label: "不确定" },
      { value: "unasked", label: "未询问" },
    ],
  },
  {
    id: "warning",
    title: "仪表警示",
    prompt: "仪表是否出现警示？",
    options: [
      { value: "present", label: "有" },
      { value: "none", label: "无" },
      { value: "uncertain", label: "不确定" },
      { value: "unasked", label: "未询问" },
    ],
  },
  {
    id: "condition",
    title: "发生条件",
    prompt: "异响在什么情况下出现？",
    options: [
      { value: "low_speed_braking", label: "低速制动" },
      { value: "high_speed_braking", label: "高速制动" },
      { value: "multiple_conditions", label: "多种条件" },
      { value: "unasked", label: "未询问" },
    ],
  },
  {
    id: "recurrence",
    title: "出现频次",
    prompt: "这是首次出现还是反复出现？",
    options: [
      { value: "first", label: "首次出现" },
      { value: "repeated", label: "反复出现" },
      { value: "uncertain", label: "不确定" },
      { value: "unasked", label: "未询问" },
    ],
  },
];

const categoryLabels: Record<string, string> = {
  brake: "制动",
  cooling: "冷却",
  steering: "转向",
  electrical: "电气",
  maintenance: "保养",
  tire: "轮胎",
};

function text(value: unknown): string { return String(value ?? "—"); }
function truthy(value: unknown): boolean { return text(value).toLowerCase() === "true"; }
function roleLabel(role: string): string {
  return role === "supervisor" ? "技师主管" : role === "dispatcher" ? "服务顾问" : role;
}
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
function parseAnswers(value: unknown): AnswerMap {
  const source = record(value);
  const result: AnswerMap = {};
  for (const question of questions) {
    const answer = record(source[question.id]);
    if (typeof answer.value === "string" && typeof answer.label === "string") {
      result[question.id] = {
        value: answer.value,
        label: answer.label,
        source: "customer_answer",
      };
    }
  }
  return result;
}
function parseHandoffData(value: unknown): HandoffTask | undefined {
  const source = record(value);
  const handoff = record(source.handoff ?? source);
  const answers = parseAnswers(handoff.answers);
  if (!Object.keys(answers).length && typeof handoff.technician !== "string") return undefined;
  return {
    answers,
    safetyNoticeAcknowledged: handoff.safetyNoticeAcknowledged === true,
    technician: typeof handoff.technician === "string" ? handoff.technician : "待分配",
    handoffWindow: typeof handoff.handoffWindow === "string" ? handoff.handoffWindow : "30 分钟内",
    note: typeof handoff.note === "string" ? handoff.note : "",
    intakeId: typeof handoff.intakeId === "string" ? handoff.intakeId : undefined,
    requestedQuestionIds: Array.isArray(handoff.requestedQuestionIds)
      ? handoff.requestedQuestionIds.filter((item): item is QuestionKey => questions.some((question) => question.id === item))
      : undefined,
    createdBy: typeof handoff.createdBy === "string" ? handoff.createdBy : undefined,
  };
}

export function AutoServiceTriageWorkbench(props: CaseWorkbenchProps) {
  const row = props.selected.payload;
  const category = text(row.symptom_category);
  const persisted = useMemo(() => {
    const fromProjection = parseHandoffData(props.selected.task);
    if (fromProjection) return fromProjection;
    const latest = [...props.events].reverse().find((event) => event.objectId === props.selected.objectId);
    return parseHandoffData(latest?.data);
  }, [props.events, props.selected.objectId, props.selected.task]);

  const [regionFilter, setRegionFilter] = useState("all");
  const [activeArea, setActiveArea] = useState(category);
  const [answers, setAnswers] = useState<AnswerMap>(persisted?.answers ?? {});
  const [currentQuestion, setCurrentQuestion] = useState<QuestionKey>(() => questions.find((item) => !persisted?.answers[item.id])?.id ?? "drivable");
  const [safetyNoticeAcknowledged, setSafetyNoticeAcknowledged] = useState(persisted?.safetyNoticeAcknowledged ?? false);
  const [technician, setTechnician] = useState(persisted?.technician ?? "待分配");
  const [handoffWindow, setHandoffWindow] = useState(persisted?.handoffWindow ?? "30 分钟内");
  const [note, setNote] = useState(persisted?.note ?? "");
  const [supervisorNote, setSupervisorNote] = useState("");

  useEffect(() => {
    const restoredAnswers = persisted?.answers ?? {};
    setRegionFilter("all");
    setActiveArea(category);
    setAnswers(restoredAnswers);
    setCurrentQuestion(questions.find((item) => !restoredAnswers[item.id])?.id ?? "drivable");
    setSafetyNoticeAcknowledged(persisted?.safetyNoticeAcknowledged ?? false);
    setTechnician(persisted?.technician ?? "待分配");
    setHandoffWindow(persisted?.handoffWindow ?? "30 分钟内");
    setNote(persisted?.note ?? "");
    setSupervisorNote("");
  }, [category, persisted, props.selected.objectId]);

  const regions = useMemo(() => [...new Set(props.objects.map((item) => text(item.payload.region)))], [props.objects]);
  const queue = useMemo(() => props.objects
    .filter((item) => regionFilter === "all" || text(item.payload.region) === regionFilter)
    .slice(0, 6), [props.objects, regionFilter]);
  const answered = questions.filter((question) => answers[question.id] && answers[question.id]?.value !== "unasked");
  const missing = questions.filter((question) => !answers[question.id] || answers[question.id]?.value === "unasked");
  const current = questions.find((question) => question.id === currentQuestion) ?? questions[0];
  const highRisk = answers.drivable?.value === "cannot_move" || answers.drivable?.value === "uncertain";
  const canHandoff = safetyNoticeAcknowledged
    && technician !== "待分配"
    && note.trim().length >= 6
    && (highRisk || missing.length === 0);
  const canAccept = Boolean(persisted) && supervisorNote.trim().length >= 6;

  function answerQuestion(questionId: QuestionKey, value: string, label: string) {
    const nextAnswers: AnswerMap = {
      ...answers,
      [questionId]: { value, label, source: "customer_answer" },
    };
    setAnswers(nextAnswers);
    const next = questions.find((question) => question.id !== questionId && (!nextAnswers[question.id] || nextAnswers[question.id]?.value === "unasked"));
    setCurrentQuestion(next?.id ?? questionId);
  }

  function reset() {
    setRegionFilter("all");
    setActiveArea(category);
    setAnswers({});
    setCurrentQuestion("drivable");
    setSafetyNoticeAcknowledged(false);
    setTechnician("待分配");
    setHandoffWindow("30 分钟内");
    setNote("");
    setSupervisorNote("");
    props.onReset();
  }

  function runCommand(command: string) {
    const actorId = props.actorRole === "supervisor" ? "case13-technician-supervisor" : "case13-service-dispatcher";
    const requestedQuestionIds = missing.map((question) => question.id);
    const handoff: HandoffTask = {
      intakeId: text(row.intake_id),
      answers,
      safetyNoticeAcknowledged,
      technician,
      handoffWindow,
      note: note.trim(),
      requestedQuestionIds,
      createdBy: persisted?.createdBy ?? actorId,
    };
    const evidenceIds = [
      `intake:${text(row.intake_id)}`,
      `customer-answers:${text(row.intake_id)}`,
      `safety-handoff:${text(row.intake_id)}`,
    ];
    if (command === "request_details") {
      props.onCommand(command, `等待客户补充 ${requestedQuestionIds.length} 项回答`, {
        actorId,
        data: {
          detailsRequest: {
            intakeId: text(row.intake_id),
            requestedQuestionIds,
            assignee: "服务顾问",
            responseWindow: handoffWindow,
          },
          handoff,
        },
        evidenceIds,
      });
      return;
    }
    if (command === "dispatch_rescue") {
      props.onCommand(command, supervisorNote.trim(), {
        actorId,
        data: {
          handoff: persisted,
          acceptance: {
            intakeId: text(row.intake_id),
            technicianSupervisorId: actorId,
            note: supervisorNote.trim(),
          },
        },
        evidenceIds,
      });
      return;
    }
    props.onCommand(command, note.trim(), { actorId, data: { handoff }, evidenceIds });
  }

  return (
    <main className={styles.root} aria-label="接车通话与安全分流单">
      <header className={styles.header}>
        <div className={styles.brand}><ShieldCheck size={22} /><h1>接车通话与安全分流</h1></div>
        <div className={styles.headerMeta}>
          <span><UserRound size={16} />{roleLabel(props.actorRole)}</span>
          <span><Clock3 size={16} />响应目标：{handoffWindow}</span>
          <label>当前角色<select aria-label="当前操作角色" value={props.actorRole} onChange={(event) => props.onActorRoleChange(event.target.value)}>{props.roles.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}</select></label>
          <button type="button" aria-label="恢复案例 B013" title="恢复演示数据" disabled={props.busy} onClick={reset}><RefreshCw size={17} /></button>
        </div>
      </header>

      <section className={styles.workspace}>
        <aside className={styles.queue} aria-label="来电列表">
          <header><div><h2>来电列表</h2><b>{props.objects.length}</b></div><select aria-label="地区筛选" value={regionFilter} onChange={(event) => setRegionFilter(event.target.value)}><option value="all">全部地区</option>{regions.map((region) => <option key={region}>{region}</option>)}</select></header>
          <div className={styles.queueList}>{queue.map((item) => {
            const safety = truthy(item.payload.safety_review_required);
            return <button type="button" key={item.objectId} aria-pressed={item.objectId === props.selected.objectId} onClick={() => props.onSelect(item.objectId)}>
              <span className={styles.queueLine}><Phone size={15} /><strong>{text(item.payload.intake_id)}</strong><em>{safety ? "待安全复核" : "常规核对"}</em></span>
              <span>{text(item.payload.region)} · {text(item.payload.vehicle_class)}</span>
              <small>问题：{text(item.payload.symptom_text)}</small>
            </button>;
          })}</div>
          <footer>显示 {queue.length} 条代表进线 · 数据集 {props.datasetRowCount} 条</footer>
        </aside>

        <section className={styles.call} aria-label="当前接车通话">
          <header className={styles.callHeader}><div><span>当前接车通话</span><h2>{text(row.intake_id)}</h2></div><b>{props.selected.state}</b></header>
          <blockquote><MessageSquareText size={22} /><div><span>客户原话</span><strong>“{text(row.symptom_text)}”</strong></div></blockquote>

          <section className={styles.question} key={current.id} aria-label="当前问题">
            <header><span>当前问题 {questions.findIndex((item) => item.id === current.id) + 1} / {questions.length}</span><small>来源：客户回答</small></header>
            <h2>{current.prompt}</h2>
            <div className={styles.answerGrid}>{current.options.map((option) => <button
              type="button"
              key={option.value}
              aria-label={`回答：${option.label}`}
              aria-pressed={answers[current.id]?.value === option.value}
              onClick={() => answerQuestion(current.id, option.value, option.label)}
            ><span>{option.label === "可以" || option.label === "无" || option.label === "低速制动" || option.label === "首次出现" ? <Check size={20} /> : <CircleHelp size={20} />}</span><strong>{option.label}</strong></button>)}</div>
          </section>

          <section className={styles.followups} aria-label="后续问题">
            <header><h3>后续问题</h3><span>回答会同步进入右侧接车单</span></header>
            {questions.filter((question) => question.id !== current.id).map((question) => <button type="button" key={question.id} onClick={() => setCurrentQuestion(question.id)}>
              <div><strong>{question.title}</strong><small>{question.prompt}</small></div>
              <span data-recorded={Boolean(answers[question.id] && answers[question.id]?.value !== "unasked")}>{answers[question.id]?.label ?? "未询问"}</span><ChevronDown size={16} />
            </button>)}
          </section>

          <section className={styles.vehicle} aria-label="问题发生位置">
            <div className={styles.vehicleImage}><img suppressHydrationWarning src="/case-assets/case-B013/scene.png" alt="匿名车辆部位定位示意图" /></div>
            <div className={styles.areaButtons}>{Object.keys(categoryLabels).map((key) => <button type="button" key={key} aria-label={`${categoryLabels[key]}区域`} aria-pressed={activeArea === key} data-current={activeArea === key} onClick={() => setActiveArea(key)}>{categoryLabels[key]}区域</button>)}</div>
            <p><CarFront size={16} />部位只帮助组织追问，不生成故障或维修结论。</p>
          </section>
        </section>

        <aside className={styles.dossier} aria-label="接车事实单">
          <section className={styles.recorded}>
            <header><div><Check size={17} /><h2>已记录</h2></div><span>已记录 {answered.length + 2} 项</span></header>
            <dl>
              <div><dt>问题描述</dt><dd>{text(row.symptom_text)}</dd><small>客户原话</small></div>
              <div><dt>车辆信息</dt><dd>{text(row.region)} · {text(row.vehicle_class)}</dd><small>源数据</small></div>
              {answered.map((question) => <div key={question.id}><dt>{question.title}</dt><dd>{answers[question.id]?.label}</dd><small>客户回答</small></div>)}
            </dl>
          </section>

          <section className={styles.missing}>
            <header><div><AlertTriangle size={17} /><h2>仍缺少</h2></div><span>仍缺少 {missing.length} 项</span></header>
            <ul>{missing.length ? missing.map((question) => <li key={question.id}><button type="button" onClick={() => setCurrentQuestion(question.id)}><span>{question.title}</span><small>未记录</small><ChevronRight size={15} /></button></li>) : <li className={styles.complete}><Check size={16} />本轮问题已记录完整</li>}</ul>
          </section>

          <section className={styles.safety} data-risk={highRisk}>
            <ShieldCheck size={20} /><div><strong>{highRisk ? "已触发优先转交" : "安全提醒"}</strong><p>{highRisk ? "客户表示不能安全移动或无法确认，可先转技师，其他问题随后补齐。" : "客户描述不等于故障诊断；页面不生成维修或换件建议。"}</p></div>
          </section>

          <section className={styles.handoff}>
            <div className={styles.selectRow}><label>交接技师组<select aria-label="交接技师组" value={technician} disabled={props.actorRole === "supervisor"} onChange={(event) => setTechnician(event.target.value)}><option>待分配</option><option>安全检视组</option><option>综合检视组</option><option>机电检视组</option></select></label><label>响应目标<select aria-label="交接响应时间" value={handoffWindow} disabled={props.actorRole === "supervisor"} onChange={(event) => setHandoffWindow(event.target.value)}><option>30 分钟内</option><option>60 分钟内</option><option>当班内</option></select></label></div>
            {props.actorRole === "supervisor" ? <label>技师接收说明<textarea aria-label="技师接收说明" value={supervisorNote} onChange={(event) => setSupervisorNote(event.target.value)} placeholder="记录接收范围和下一步核对" /></label> : <><label className={styles.safetyCheck}><input type="checkbox" checked={safetyNoticeAcknowledged} onChange={(event) => setSafetyNoticeAcknowledged(event.target.checked)} /><i>{safetyNoticeAcknowledged ? <Check size={13} /> : null}</i><span>已向客户说明症状加重时停止行驶并联系人工服务</span></label><label>交接说明<textarea aria-label="交接说明" value={note} onChange={(event) => setNote(event.target.value)} placeholder="记录客户回答和需要技师复核的内容" /></label></>}
          </section>
          {props.receipt ? <p className={styles.receipt} role="status">已保存：{props.receipt.event.fromState} → {props.receipt.event.toState}</p> : null}
          {props.error ? <p className={styles.error} role="alert">{props.error}<button type="button" onClick={() => props.onSelect(props.selected.objectId)}>刷新当前进线</button></p> : null}
        </aside>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerSummary}><ShieldCheck size={24} /><span>安全分流流程<strong>接车问答与技师交接</strong></span><i /><Clock3 size={23} /><span>响应目标<strong>{handoffWindow}</strong></span></div>
        <div className={styles.actions}>{props.commands.length ? props.commands.map((command) => {
          const disabled = props.busy
            || (command.id === "submit_triage" && !canHandoff)
            || (command.id === "request_details" && missing.length === 0)
            || (command.id === "dispatch_rescue" && !canAccept);
          return <button type="button" key={command.id} data-tone={command.id === "submit_triage" || command.id === "dispatch_rescue" ? "primary" : "secondary"} disabled={disabled} onClick={() => runCommand(command.id)}>{command.id === "submit_triage" ? <ShieldCheck size={18} /> : command.id === "dispatch_rescue" ? <Wrench size={18} /> : <Save size={18} />}{props.busy ? "正在保存…" : command.label}</button>;
        }) : <span>当前状态没有可执行动作</span>}</div>
      </footer>
    </main>
  );
}
