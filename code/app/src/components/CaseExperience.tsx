"use client";

import {
  Activity,
  ArrowLeft,
  Database,
  FileJson2,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import {
  AppShell,
  CaseNav,
  CommandBar,
  ReceiptPanel,
  StatusTag,
} from "@course-ai-product/design-system";
import type {
  AssistReceipt,
  CaseEvent,
  CaseProjection,
  CommandResult,
} from "@course-ai-product/case-runtime";
import type { CaseDefinition, CaseMetric } from "@cases/contracts";
import { resolveFeaturedObject } from "../../../cases/featured-object";
import { useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { CaseOverview } from "./CaseOverview";
import { CaseTourLauncher } from "./tours/CaseTourLauncher";
import { getCaseTourDefinition } from "./tours/case-tour-registry";
import { CommerceWorkspace } from "./families/CommerceWorkspace";
import { ApprovalWorkspace } from "./families/ApprovalWorkspace";
import { InvestigationWorkspace } from "./families/InvestigationWorkspace";
import { IndustrialWorkspace } from "./families/IndustrialWorkspace";
import {
  formatBusinessRole,
  formatBusinessValue,
} from "./families/SharedPanels";
import { OperationalInvestigationConsole } from "./workbenches/OperationalInvestigationConsole";
import {
  AirQualityReleaseWorkbench,
  AutoServiceTriageWorkbench,
  AquacultureResponseWorkbench,
  ColdChainInvestigationWorkbench,
  CreditMaterialWorkbench,
  CutterHealthWorkbench,
  BoilerEventWorkbench,
  FlotationReviewWorkbench,
  HospitalTransferWorkbench,
  HydraulicConditionWorkbench,
  MemberTrialWorkbench,
  MetroCompressorWorkbench,
  ModelAdmissionWorkbench,
  RetailArchitectureWorkbench,
  ReturnEvidenceWorkbench,
  ReviewResearchWorkbench,
  PvLossWorkbench,
  TelecomRecoveryWorkbench,
  WaferRetestWorkbench,
  WindUnderperformanceWorkbench,
  type CaseWorkbenchProps,
  type WorkbenchCommandOptions,
} from "./workbenches/case-specific";

const familyComponents = {
  commerce: CommerceWorkspace,
  approval: ApprovalWorkspace,
  investigation: InvestigationWorkspace,
  industrial: IndustrialWorkspace,
};

const caseSpecificWorkbenches: Record<string, ComponentType<CaseWorkbenchProps>> = {
  "01": ReturnEvidenceWorkbench,
  "02": MemberTrialWorkbench,
  "03": ReviewResearchWorkbench,
  "04": CreditMaterialWorkbench,
  "05": HospitalTransferWorkbench,
  "06": AirQualityReleaseWorkbench,
  "07": RetailArchitectureWorkbench,
  "08": AquacultureResponseWorkbench,
  "09": MetroCompressorWorkbench,
  "10": TelecomRecoveryWorkbench,
  "11": ModelAdmissionWorkbench,
  "12": ColdChainInvestigationWorkbench,
  "13": AutoServiceTriageWorkbench,
  "14": FlotationReviewWorkbench,
  "15": WaferRetestWorkbench,
  "16": WindUnderperformanceWorkbench,
  "17": CutterHealthWorkbench,
  "18": BoilerEventWorkbench,
  "19": HydraulicConditionWorkbench,
  "20": PvLossWorkbench,
};

function ProductWorkbenchFrame({
  definition,
  selected,
  events,
  datasetRowCount,
  datasetHash: _datasetHash,
  tourControl,
  children,
}: {
  definition: CaseDefinition;
  selected: CaseProjection;
  events: CaseEvent[];
  datasetRowCount: number;
  datasetHash: string;
  tourControl?: ReactNode;
  children: ReactNode;
}) {
  const [drawer, setDrawer] = useState<"evidence" | "activity" | null>(null);
  const teachingId = `B${definition.id}`;
  const objectEvents = events.filter((event) => event.objectId === selected.objectId);
  const evidenceFields = definition.displayFields.slice(0, 6);
  return (
    <div className="product-workbench-frame">
      <nav className="product-workbench-nav" aria-label="案例产品导航" data-tour={`case-${definition.id}-context`}>
        <a className="product-workbench-nav__home" href="/">全部案例</a>
        <span aria-hidden="true">/</span>
        <b>{teachingId} · {definition.shortTitle}</b>
        <span className="product-workbench-nav__state" data-tour={`case-${definition.id}-result`}>{selected.state}</span>
        <div className="product-workbench-nav__actions">
          {tourControl}
          <button type="button" onClick={() => setDrawer("evidence")} aria-expanded={drawer === "evidence"}>
            <Database aria-hidden="true" size={15} />
            查看当前数据
          </button>
          <button type="button" onClick={() => setDrawer("activity")} aria-expanded={drawer === "activity"}>
            <Activity aria-hidden="true" size={15} />
            查看操作记录
          </button>
        </div>
      </nav>
      <div className="product-workbench-frame__body" data-tour={`case-${definition.id}-workspace`}>{children}</div>
      {drawer ? (
        <aside className="workbench-context-drawer" role="dialog" aria-modal="false" aria-label={drawer === "evidence" ? "当前数据" : "操作记录"}>
          <header>
            <div>
              <span>{teachingId} · {selected.objectId}</span>
              <h2>{drawer === "evidence" ? "当前数据" : "操作记录"}</h2>
            </div>
            <button type="button" aria-label="关闭抽屉" onClick={() => setDrawer(null)}><X aria-hidden="true" size={18} /></button>
          </header>
          {drawer === "evidence" ? (
            <div className="workbench-context-drawer__content">
              <dl className="workbench-evidence-facts">
                {evidenceFields.map((field) => (
                  <div key={field.key}>
                    <dt>{field.label}</dt>
                    <dd>{formatBusinessValue(field.key, selected.payload[field.key])}</dd>
                  </div>
                ))}
              </dl>
              <section className="workbench-evidence-source">
                <Database aria-hidden="true" size={17} />
                <div><span>案例数据</span><strong>{definition.datasetTarget} · {datasetRowCount.toLocaleString("zh-CN")} 条</strong></div>
              </section>
              <details>
                <summary>查看本地记录</summary>
                <p>已载入 {datasetRowCount.toLocaleString("zh-CN")} 条本地案例数据；以下是当前对象的原始字段。</p>
                <pre>{JSON.stringify(selected.payload, null, 2)}</pre>
              </details>
            </div>
          ) : (
            <ol className="workbench-activity-list">
              {objectEvents.length > 0 ? objectEvents.map((event) => (
                <li key={event.eventId}>
                  <time>{event.occurredAt.replace("T", " ").slice(0, 19)}</time>
                  <strong>{definition.commandLabels[event.command] ?? event.command}</strong>
                  <span>{event.fromState} → {event.toState}</span>
                  <small>{formatBusinessRole(event.actor.role)} · 版本 {event.version}</small>
                </li>
              )) : <li className="workbench-activity-list__empty">尚无操作。完成一次业务动作后，回执会出现在这里。</li>}
            </ol>
          )}
        </aside>
      ) : null}
    </div>
  );
}

const errorLabels: Record<string, string> = {
  version_conflict: "对象已被其他操作更新，请刷新后重试。",
  role_forbidden: "当前角色无权执行这项动作。",
  transition_forbidden: "当前状态不允许执行这项动作。",
  command_unknown: "服务端未登记这项动作。",
  candidate_required: "请先选择候选原单，或明确记录没有可匹配原单。",
  candidate_invalid: "所选候选原单不在当前数据切片中，或时间与交易方向不符合原单条件。",
  return_object_required: "当前取消单缺少可追溯的发票编号。",
  return_evidence_invalid: "补证清单必须使用已登记材料，并保留原单查询和付款记录。",
  return_evidence_mismatch: "提交的证据编号没有绑定当前取消单、候选原单或回传材料。",
  evidence_request_required: "请至少选择一项需要补齐或核对的证据。",
  evidence_incomplete: "补证材料尚未全部回传，不能提交独立复核。",
  assignee_required: "请指定任务负责人。",
  due_at_required: "请填写任务期限。",
  review_note_required: "请填写复核意见。",
  decision_reason_required: "请填写暂缓或决策理由。",
  event_required: "请先选择需要调和的冲突事件。",
  authoritative_state_required: "请明确本次会签采用的权威状态。",
  reconciliation_reason_required: "请填写状态调和依据。",
  sender_actor_required: "请登记发出方确认人。",
  receiver_actor_required: "请登记接收方会签人。",
  actor_separation_required: "发出方确认人与接收方会签人不能是同一人。",
  cosign_note_required: "请填写接收方会签意见。",
  late_event_required: "请提供触发重开的迟到事件。",
  late_event_already_handled: "这条晚到事件已经处理过，不能重复触发复核。",
  hospital_object_required: "当前转运记录缺少可追溯的转运单号。",
  hospital_event_invalid: "所选事件不属于当前转运单，或不是可升级的冲突事件。",
  hospital_evidence_mismatch: "会签证据与当前事件、床位申请或流程令牌不一致。",
  hospital_state_invalid: "请选择工作台登记的权威运营状态。",
  segment_required: "请先选择需要检查的工艺段。",
  investigation_reason_required: "请填写排查理由。",
  segment_mismatch: "主管确认的检查段与当班提交不一致，请退回核对。",
  boiler_object_required: "当前偏差窗口缺少监测分钟或温度记录。",
  boiler_event_required: "当前排查单缺少可追溯的温度事件号。",
  boiler_event_mismatch: "排查单绑定的事件或分钟窗口与当前事件不一致。",
  boiler_window_required: "请使用当前事件的完整分钟窗口。",
  boiler_window_invalid: "当前事件需要 25 个连续分钟点，请刷新数据后重试。",
  boiler_requested_source_required: "请至少选择一项需要现场补取的过程资料。",
  boiler_task_required: "请先保存与当前偏差窗口绑定的当班排查任务。",
  boiler_object_mismatch: "排查任务与当前监测窗口、版本或温度记录不一致。",
  boiler_evidence_mismatch: "排查证据必须包含当前分钟温度和采样完整性，并与任务清单一致。",
  boiler_condition_invalid: "当前温度偏离程度不满足这项处置的业务条件。",
  boiler_confirmation_invalid: "主管确认没有关联到已保存的排查任务，或确认说明不完整。",
  business_idempotency_key_required: "恢复任务缺少本地恢复关联键。",
  local_recovery_key_required: "恢复任务缺少本地恢复关联键。",
  telecom_lookup_target_required: "请选择外部效果核对目标。",
  telecom_lookup_result_invalid: "核对结果必须是已生效或未生效；仍未知时请保留待核对。",
  telecom_lookup_summary_required: "请填写可核验的结果摘要。",
  telecom_lookup_evidence_required: "明确结果必须填写证据编号。",
  telecom_lookup_evidence_mismatch: "提交的证据与当前核对结果不一致。",
  idempotency_key_mismatch: "页面展示的幂等键与实际请求不一致。",
  idempotency_conflict: "同一业务请求键对应了不同内容，请刷新后重新提交。",
  trial_plan_required: "请填写试投方案名称。",
  trial_hypothesis_required: "请写清这次试投要验证的假设。",
  trial_cohort_required: "目标人群规则不完整。",
  trial_cohort_invalid: "目标人群使用了未开放的行为字段。",
  trial_seed_required: "请填写可复现的分组种子。",
  trial_assignment_required: "处理组和对照组都必须有人。",
  trial_assignment_overlap: "同一会员不能同时进入处理组和对照组。",
  trial_assignment_invalid: "试投名单数量与样本设置不一致。",
  trial_assignment_ratio_invalid: "处理组比例与实际名单不一致。",
  trial_measurement_required: "请补齐主指标、护栏指标和观察周期。",
  trial_budget_required: "请补齐试投预算。",
  trial_budget_invalid: "预算不足以覆盖当前处理组。",
  trial_stop_rule_required: "请设置停损人数和预算。",
  trial_stop_rule_invalid: "停损线超出了当前名单或总预算。",
  persisted_task_required: "请先保存当前业务任务，再执行审批动作。",
  review_task_required: "需求验证单缺少任务编号。",
  review_aspect_required: "请选择要研究的顾客体验主题。",
  review_aspect_invalid: "这项评论主题不在当前数据标注范围内。",
  review_evidence_required: "支持证据和反例都至少需要一条。",
  review_evidence_invalid: "评论证据编号格式不正确。",
  review_evidence_overlap: "同一条评论不能既是支持证据又是反例。",
  review_question_required: "请把研究问题写成可验证的问题。",
  review_method_required: "请填写研究方法。",
  review_sample_required: "请填写有效的样本量。",
  review_sample_invalid: "样本量超出了本案例允许的研究范围。",
  due_at_invalid: "任务日期格式不正确。",
  review_window_required: "请填写观察窗口。",
  review_success_criteria_required: "请写清什么结果算验证通过。",
  review_task_mismatch: "主管处理的不是当前已保存的验证单。",
  credit_material_required: "请至少选择一项当前确实缺失的申请材料。",
  credit_material_invalid: "补件清单包含已齐备或未登记的材料。",
  credit_application_required: "当前申请缺少可追溯的申请编号。",
  credit_request_note_required: "请写清需要补交的材料和核对要求。",
  credit_material_incomplete: "补件清单尚未全部回传，不能进入第二身份复核。",
  credit_evidence_mismatch: "回传材料与当前申请的补件清单不一致。",
  credit_return_source_required: "请填写不含个人信息的材料来源说明。",
  credit_return_receipt_required: "请填写材料回传记录编号。",
  air_release_object_required: "当前站点小时记录缺少站点、时次或来源行号。",
  air_release_package_required: "请先形成字段完整的数据摘录。",
  air_release_package_mismatch: "数据摘录与当前站点小时记录不一致。",
  air_release_completeness_mismatch: "污染物完整度与当前记录的真实缺测情况不一致。",
  air_release_incomplete: "六项污染物仍有缺测，不能锁定为完整摘录。",
  air_release_evidence_mismatch: "摘录记录没有关联到当前站点、时次或源行。",
  air_release_missing_required: "请列出当前记录的真实缺测污染物。",
  architecture_facts_required: "请至少选择两项可追溯事实。",
  architecture_facts_invalid: "架构评审事实不在当前公开数据和运营记录范围内。",
  architecture_hypothesis_required: "请写下一条可以继续验证的架构假设。",
  architecture_constraints_required: "请至少选择两项现实约束。",
  architecture_constraints_invalid: "架构约束不在当前评审范围内。",
  architecture_risks_required: "请至少选择两项需要控制的交付风险。",
  architecture_risks_invalid: "风险项不在当前评审范围内。",
  architecture_object_required: "当前架构评审缺少订单对象。",
  architecture_adr_required: "请先保存当前对象的架构决策记录。",
  architecture_adr_invalid: "架构决策记录与已核对的对象、阶段或决策不一致。",
  architecture_evidence_mismatch: "提交的证据编号没有覆盖所选事实。",
  architecture_rationale_required: "请写清选择这一架构路径的理由。",
  architecture_signature_required: "请由第二身份签署架构决定。",
  architecture_signature_invalid: "签署声明与当前架构决定不一致。",
  architecture_contract_required: "事件试点需要完整填写最小事件契约。",
  architecture_contract_invalid: "事件契约的生产者、消费者或版本格式无效。",
  handoff_object_mismatch: "交接记录与当前服务进线不一致。",
  safety_check_incomplete: "请先完成四项接车安全核对。",
  technician_required: "请选择接收的技师组。",
  response_window_required: "请选择响应时间。",
  handoff_note_required: "请填写完整的技师交接说明。",
  details_request_required: "请选择需要客户补充的车辆状态信息。",
  actor_mismatch: "操作人身份与任务记录不一致，请刷新后重试。",
  process_review_required: "当前工艺核查单不完整。",
  process_window_required: "请选择有效的工艺时间窗。",
  process_window_invalid: "工艺时间窗与实际数据切片不一致。",
  process_object_mismatch: "核查单的结束时段不是当前工艺对象。",
  process_hypothesis_required: "请选择优先核查假设。",
  process_hypothesis_invalid: "优先核查假设不在已登记范围内。",
  process_evidence_required: "请补齐趋势、槽体风量和品质证据。",
  process_evidence_invalid: "核查证据与当前工艺窗口不匹配。",
  process_task_mismatch: "主管处理的不是当前已保存的工艺核查单。",
  field_event_mismatch: "现场任务与当前水质事件不一致。",
  field_evidence_issue_mismatch: "现场任务记录的证据问题与原事件不一致。",
  field_evidence_required: "请补齐现场读数与照片要求。",
  field_operator_required: "请登记现场回传人员。",
  field_capture_required: "请登记现场采集时间。",
  field_photo_required: "请提供可追溯的现场照片资产号。",
  field_reading_required: "请补齐四项现场读数。",
  field_reading_invalid: "现场读数超出可接受的物理范围，请复核录入。",
  field_issue_unresolved: "证据冲突尚未解决，不能确认补齐。",
  retrieval_question_required: "请把排查目标写成清楚的问题。",
  retrieval_query_mismatch: "检索式与当前测点或问题不一致。",
  retrieval_window_invalid: "当前采样点不在已登记的检索窗口内。",
  retrieval_results_required: "当前检索没有可核验的本地资料。",
  retrieval_results_invalid: "检索结果排序或来源信息不完整。",
  retrieval_evidence_mismatch: "请求中的资料版本与检索结果不一致。",
  retrieval_task_mismatch: "现场检查申请不是基于当前已保存的检索任务。",
  retrieval_citation_required: "支持资料和边界资料都至少选择一条。",
  retrieval_citation_overlap: "同一资料不能同时作为支持与约束引用。",
  retrieval_citation_invalid: "所选引用的用途与资料类型不一致。",
  inspection_checklist_required: "请完成现场检查的三项安全核对。",
  inspection_action_invalid: "当前案例只允许创建现场目视检查申请。",
  model_candidate_mismatch: "会签记录与当前模型候选不一致。",
  model_policy_mismatch: "会签政策版本与当前候选不一致。",
  model_evaluation_mismatch: "补测任务与当前评测项不一致。",
  model_gate_set_required: "风险、公平和安全三类准入检查必须完整。",
  model_gate_set_invalid: "准入检查项存在重复或无效内容。",
  model_retest_required: "请补齐地区切片补测任务。",
  model_retest_mismatch: "补测数据版本或评测项与已保存任务不一致。",
  model_retest_sample_invalid: "补测样本量不能小于原评测样本量。",
  model_retest_invalid: "补测计划与当前阶段不一致。",
  model_retest_not_passed: "补测结果尚未达到当前门槛。",
  model_review_required: "三类准入检查需要由独立评审人签署。",
  model_gate_not_passed: "仍有准入检查未通过，不能确认补测完成。",
  cold_chain_investigation_mismatch: "调查单与当前冷链路线不一致。",
  cold_chain_events_invalid: "调查事件集合没有覆盖当前权威事件。",
  cold_chain_window_invalid: "调查窗口超出当前路线记录范围。",
  cold_chain_peak_mismatch: "调查单记录的峰值与当前路线不一致。",
  cold_chain_excursion_mismatch: "超温事件不属于当前路线事件集合。",
  cold_chain_decision_invalid: "质量决定与当前命令不一致。",
  cold_chain_evidence_required: "证据缺口尚未补齐。",
  cold_chain_evidence_unverified: "补录证据尚未由质量角色核验。",
  cold_chain_evidence_mismatch: "补录证据没有关联到当前路线事件。",
  cold_chain_freeze_scope_invalid: "冻结范围超出了当前调查路线。",
  wafer_retest_required: "当前操作缺少可复核的生产观测与复测协议。",
  wafer_object_mismatch: "复测记录与当前生产观测的编号、版本或质量标签不一致。",
  wafer_sensor_required: "请至少选择一个匿名信号通道。",
  wafer_sensor_invalid: "复测任务包含未开放或重复的信号通道。",
  wafer_sensor_mismatch: "信号原值、缺失状态或全局缺失量与本地数据不一致。",
  wafer_evidence_mismatch: "复测证据没有关联当前观测、通道或复测任务。",
  wafer_retest_task_required: "请先形成具名复测任务。",
  wafer_retest_task_invalid: "复测任务的编号、核对项或发起身份无效。",
  wafer_retest_task_mismatch: "主管处理的不是当前已保存的复测任务。",
  wafer_checklist_required: "请完成原始记录、缺失通道和人工复核三项核对。",
  wafer_supervisor_review_invalid: "主管意见与当前复测任务或隔离决定不一致。",
  wind_investigation_required: "当前操作缺少完整的风机七日核查记录。",
  wind_object_mismatch: "核查记录与当前风机或任务版本不一致。",
  wind_window_required: "请提供当前风机的七个运行日窗口。",
  wind_window_mismatch: "七日范围、下偏天数或数据覆盖量与本地记录不一致。",
  wind_request_required: "请先建立现场核查请求。",
  wind_request_invalid: "现场核查请求的对象、范围、角色或状态无效。",
  wind_request_mismatch: "主管处理的不是当前已保存的现场核查请求。",
  wind_checklist_required: "请至少选择一项现场核查内容。",
  wind_checklist_invalid: "现场核查内容不在本案例开放范围内。",
  wind_evidence_required: "同群基线、限电、告警和维修回执必须分别记录。",
  wind_evidence_invalid: "现场回执状态或引用与本次核查不一致。",
  wind_evidence_mismatch: "核查证据没有关联当前风机七日窗口。",
  wind_inspector_required: "请登记现场检查人员。",
  wind_inspection_required: "请补齐现场班次、回执和检查发现。",
  wind_inspection_invalid: "现场检查尚未形成完整回传。",
  wind_confirmation_invalid: "主管确认与本次现场核查记录不一致。",
  cutter_review_required: "当前操作缺少完整的切刀会话复核记录。",
  cutter_object_mismatch: "复核记录与当前设备会话或任务版本不一致。",
  cutter_source_mismatch: "波形文件、样本数或会话摘要数量与本地数据不一致。",
  cutter_waveform_required: "当前会话没有足够的真实同步波形样本。",
  cutter_channel_required: "请提供三路同步通道。",
  cutter_channel_invalid: "同步通道集合与当前波形文件不一致。",
  cutter_evidence_mismatch: "会话摘要、波形样本或游标证据不匹配。",
  cutter_plan_required: "请先建立具名排检计划。",
  cutter_plan_invalid: "排检计划的会话、信号、负责人或状态无效。",
  cutter_plan_mismatch: "主管处理的不是当前已保存的排检计划。",
  cutter_cursor_required: "请在三路波形上选择同一个样本游标。",
  cutter_cursor_invalid: "所选波形游标不在真实样本中。",
  cutter_cursor_mismatch: "游标处的三路数值与波形文件不一致。",
  cutter_window_required: "请设置有效的排检样本窗口。",
  cutter_window_invalid: "排检窗口超出波形范围，或没有覆盖当前游标。",
  cutter_direction_required: "请写明排检方向。",
  cutter_confirmation_invalid: "主管确认没有引用当前已保存的排检计划。",
  cutter_continuation_invalid: "继续采样的数量、理由或状态无效。",
  hydraulic_object_mismatch: "维护任务与当前测量循环不一致。",
  hydraulic_task_required: "请先形成具名维护复核任务。",
  hydraulic_task_mismatch: "主管确认的不是当前已保存的维护任务。",
  hydraulic_order_required: "请给四个液压部件排出完整检查顺序。",
  hydraulic_order_invalid: "检查顺序包含重复或未登记部件。",
  hydraulic_order_mismatch: "检查项的状态、等级或状态码与当前循环不一致。",
  hydraulic_order_unconfirmed: "请人工确认部件检查顺序。",
  hydraulic_review_required: "请核对当前循环受影响的部件。",
  hydraulic_review_invalid: "部件核对清单包含未登记项目。",
  hydraulic_review_incomplete: "临界或关注部件尚未全部核对。",
  hydraulic_basis_required: "请至少选择两项检查依据。",
  hydraulic_basis_invalid: "检查依据不在当前数据范围内。",
  hydraulic_evidence_mismatch: "维护任务证据没有关联当前循环、部件或依据。",
  hydraulic_confirmation_invalid: "主管意见与当前部件检查顺序不一致。",
  pv_object_mismatch: "站端核查任务与当前电站日期不一致。",
  pv_task_required: "请先形成具名站端核查任务。",
  pv_task_mismatch: "主管确认的不是当前已保存的站端核查任务。",
  pv_direction_required: "请选择一个暂定的站端核查方向。",
  pv_direction_invalid: "核查方向或状态不在当前案例范围内。",
  pv_direction_mismatch: "核查方向使用的站日指标与本地记录不一致。",
  pv_sources_required: "请明确记录一项已装载来源和三项装载失败来源。",
  pv_sources_invalid: "证据来源的状态、失败码或来源编号不一致。",
  pv_retrieval_required: "请建立三类站端证据的补取请求。",
  pv_retrieval_invalid: "补取请求没有覆盖调度、告警和检修记录。",
  pv_evidence_mismatch: "证据编号没有覆盖当前站日和三项装载失败来源。",
  pv_confirmation_invalid: "主管意见没有引用当前已保存的核查方向。",
  pv_control_block_invalid: "自动控制阻断范围、理由或证据缺口不完整。",
};

function formatActorRole(role: string): string {
  return role === "supervisor" ? "业务主管" : formatBusinessRole(role);
}

export function CaseExperience({
  definition,
  activeView,
  initialObjects,
  initialEvents,
  initialReceipt,
  datasetRowCount,
  datasetHash,
  metrics,
  sceneRows = [],
  supportingArtifacts = {},
}: {
  definition: CaseDefinition;
  activeView: string;
  initialObjects: CaseProjection[];
  initialEvents: CaseEvent[];
  initialReceipt?: CommandResult;
  datasetRowCount: number;
  datasetHash: string;
  metrics: CaseMetric[];
  sceneRows?: Record<string, unknown>[];
  supportingArtifacts?: Record<string, Record<string, unknown>[]>;
}) {
  const teachingId = `B${definition.id}`;
  const [objects, setObjects] = useState(initialObjects);
  const [selectedId, setSelectedId] = useState(
    resolveFeaturedObject(initialObjects, definition.featuredObjectId)?.objectId ?? "",
  );
  const [events, setEvents] = useState(initialEvents);
  const [receipt, setReceipt] = useState<CommandResult | undefined>(
    initialReceipt,
  );
  const [assistReceipt, setAssistReceipt] = useState<AssistReceipt>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const selectionRequest = useRef(0);
  const selected = objects.find((item) => item.objectId === selectedId) ?? objects[0];
  const defaultProjection =
    resolveFeaturedObject(objects, definition.featuredObjectId) ?? objects[0];
  const FamilyWorkspace = familyComponents[definition.family];
  const roles = useMemo(
    () =>
      Array.from(
        new Set(
          Object.values(definition.workflow.commands).flatMap(
            (command) => command.roles,
          ),
        ),
      ),
    [definition.workflow.commands],
  );
  const [actorRole, setActorRole] = useState(
    roles.includes(definition.primaryRole)
      ? definition.primaryRole
      : (roles[0] ?? definition.primaryRole),
  );
  const tourDefinition = getCaseTourDefinition(definition.id);

  const commands = useMemo(() => {
    if (!selected) {
      return [];
    }
    return Object.entries(definition.workflow.commands)
      .filter(
        ([, item]) =>
          item.from.includes(selected.state) && item.roles.includes(actorRole),
      )
      .map(([id]) => ({
        id,
        label: definition.commandLabels[id] ?? id,
        tone: id === "resolve" ? ("primary" as const) : id === "reject" ? ("danger" as const) : ("secondary" as const),
      }));
  }, [actorRole, definition, selected]);

  async function selectObject(objectId: string) {
    const requestId = selectionRequest.current + 1;
    selectionRequest.current = requestId;
    setReceipt(undefined);
    setError(undefined);
    try {
      const response = await fetch(
        `/api/cases/${definition.id}/objects/${encodeURIComponent(objectId)}`,
      );
      const body = (await response.json()) as {
        error?: string;
        projection?: CaseProjection;
        events?: CaseEvent[];
        receipt?: CommandResult | null;
      };
      if (requestId !== selectionRequest.current) return;
      if (!response.ok || !body.projection) {
        throw new Error(body.error ?? "object_not_found");
      }
      setObjects((current) => {
        const exists = current.some((item) => item.objectId === body.projection?.objectId);
        return exists
          ? current.map((item) =>
              item.objectId === body.projection?.objectId ? body.projection! : item,
            )
          : [...current, body.projection!];
      });
      setSelectedId(body.projection.objectId);
      setEvents(body.events ?? []);
      setReceipt(body.receipt ?? undefined);
    } catch (caught) {
      if (requestId !== selectionRequest.current) return;
      const message = caught instanceof Error ? caught.message : "object_not_found";
      setError(
        errorLabels[message] ?? "未找到这条业务对象，当前选择没有改变。",
      );
    }
  }

  async function execute(
    command: string,
    reason?: string,
    options: WorkbenchCommandOptions = {},
  ) {
    if (!selected) {
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const response = await fetch(
        `/api/cases/${definition.id}/objects/${encodeURIComponent(selected.objectId)}/commands`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            command,
            actorRole,
            actorId: options.actorId,
            expectedVersion: selected.version,
            idempotencyKey: options.idempotencyKey ?? crypto.randomUUID(),
            reason,
            evidenceIds: options.evidenceIds ?? [
              "dataset-row",
              `dataset-sha256:${datasetHash}`,
            ],
            data: options.data,
          }),
        },
      );
      const body = (await response.json()) as CommandResult & { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "command_failed");
      }
      setReceipt(body);
      setObjects((current) =>
        current.map((item) =>
          item.objectId === body.projection.objectId ? body.projection : item,
        ),
      );
      setEvents((current) => [...current, body.event]);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "command_failed";
      setError(errorLabels[message] ?? "动作未执行，请检查服务状态后重试。");
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (!window.confirm("恢复该案例的初始状态？当前操作记录将被清空。")) {
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const response = await fetch(`/api/cases/${definition.id}/reset`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmation: `RESET-${definition.id}` }),
      });
      const body = (await response.json()) as {
        objects?: CaseProjection[];
        error?: string;
      };
      if (!response.ok || !body.objects) {
        throw new Error(body.error ?? "reset_failed");
      }
      setObjects(body.objects);
      setSelectedId(
        resolveFeaturedObject(body.objects, definition.featuredObjectId)?.objectId ?? "",
      );
      setEvents([]);
      setReceipt(undefined);
    } catch {
      setError("案例状态未能恢复，请稍后重试或检查本地服务是否可用。");
    } finally {
      setBusy(false);
    }
  }

  async function resetTourObject(objectId: string): Promise<boolean> {
    setBusy(true);
    setError(undefined);
    try {
      const response = await fetch(
        `/api/cases/${definition.id}/objects/${encodeURIComponent(objectId)}/reset`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            confirmation: `RESET-${definition.id}-${objectId}`,
          }),
        },
      );
      const body = (await response.json()) as {
        projection?: CaseProjection;
        events?: CaseEvent[];
        commandReceipt?: CommandResult | null;
        error?: string;
      };
      if (!response.ok || !body.projection) {
        throw new Error(body.error ?? "reset_failed");
      }
      setObjects((current) => {
        const exists = current.some((item) => item.objectId === body.projection?.objectId);
        return exists
          ? current.map((item) => item.objectId === body.projection?.objectId ? body.projection! : item)
          : [body.projection!, ...current];
      });
      setSelectedId(body.projection.objectId);
      setEvents(body.events ?? []);
      setReceipt(body.commandReceipt ?? undefined);
      setActorRole(
        roles.includes(definition.primaryRole)
          ? definition.primaryRole
          : (roles[0] ?? definition.primaryRole),
      );
      return true;
    } catch {
      setError("演示对象未能恢复，请稍后重试或检查本地服务。");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function requestAssist(mode: "offline" | "live") {
    setBusy(true);
    setError(undefined);
    try {
      const response = await fetch(`/api/cases/${definition.id}/assist`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          objectId: selected.objectId,
          mode,
          question: "请整理当前对象的已知证据、缺口与下一步候选动作。",
        }),
      });
      const body = (await response.json()) as AssistReceipt & { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "assist_failed");
      }
      setAssistReceipt(body);
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : "assist_failed";
      setError(
        code === "missing_api_key"
          ? "未检测到 DASHSCOPE_API_KEY；离线回放仍可继续。"
          : "模型辅助请求失败，业务状态没有改变。",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!selected) {
    return (
      <AppShell
        family={definition.family}
        eyebrow={`${teachingId} · ${definition.industry}`}
        title={definition.shortTitle}
        description="数据集没有可展示记录，请核对 case.csv。"
      >
        <a href="/">返回案例驾驶舱</a>
      </AppShell>
    );
  }

  const SpecificWorkbench = caseSpecificWorkbenches[definition.id];
  if (SpecificWorkbench && activeView === "work") {
    const tourControl = tourDefinition ? (
      <CaseTourLauncher
        definition={tourDefinition}
        runtime={{
          state: selected.state,
          actorRole,
          completedCommands: events
            .filter((event) => event.objectId === selected.objectId)
            .map((event) => event.command),
        }}
        busy={busy}
        onPrepare={() => resetTourObject(tourDefinition.featuredObjectId)}
      />
    ) : undefined;
    return (
      <ProductWorkbenchFrame definition={definition} selected={selected} events={events} datasetRowCount={datasetRowCount} datasetHash={datasetHash} tourControl={tourControl}>
        <SpecificWorkbench
          definition={definition}
          objects={objects}
          selected={selected}
          events={events}
          metrics={metrics}
          datasetRowCount={datasetRowCount}
          sceneRows={sceneRows}
          supportingArtifacts={supportingArtifacts}
          actorRole={actorRole}
          roles={roles}
          commands={commands}
          busy={busy}
          error={error}
          receipt={receipt}
          onActorRoleChange={setActorRole}
          onCommand={execute}
          onReset={reset}
          onSelect={selectObject}
        />
      </ProductWorkbenchFrame>
    );
  }

  if (
    activeView === "work" &&
    definition.views.some(
      (view) => view.id === "work" && view.label === "处置工作台",
    )
  ) {
    const tourControl = tourDefinition ? (
      <CaseTourLauncher
        definition={tourDefinition}
        runtime={{
          state: selected.state,
          actorRole,
          completedCommands: events
            .filter((event) => event.objectId === selected.objectId)
            .map((event) => event.command),
        }}
        busy={busy}
        onPrepare={() => resetTourObject(tourDefinition.featuredObjectId)}
      />
    ) : undefined;
    return (
      <ProductWorkbenchFrame definition={definition} selected={selected} events={events} datasetRowCount={datasetRowCount} datasetHash={datasetHash} tourControl={tourControl}>
        <OperationalInvestigationConsole
          definition={definition}
          objects={objects}
          selected={selected}
          datasetRowCount={datasetRowCount}
          actorRole={actorRole}
          roles={roles}
          commands={commands}
          busy={busy}
          error={error}
          receipt={receipt}
          onActorRoleChange={setActorRole}
          onCommand={execute}
          onReset={reset}
          onSelect={selectObject}
        />
      </ProductWorkbenchFrame>
    );
  }

  return (
    <AppShell
      family={definition.family}
      eyebrow={`${teachingId} · ${definition.industry}`}
      title={definition.shortTitle}
      description={definition.scenario}
      actions={
        <>
          <a className="back-link" href="/">
            <ArrowLeft aria-hidden="true" size={16} />
            全部案例
          </a>
          <StatusTag
            label={definition.aiEnabled ? "可接入模型" : "确定性运行"}
            tone={definition.aiEnabled ? "success" : "neutral"}
          />
        </>
      }
    >
      <CaseNav active={activeView} caseId={teachingId} items={definition.views} />

      {activeView === "overview" ? (
        <CaseOverview
          definition={definition}
          defaultProjection={defaultProjection}
          metrics={metrics}
          workHref={`/cases/${teachingId}/work`}
        />
      ) : null}

      {activeView === "work" ? (
        <>
          <p className="workbench-scope-note">
            队列最多展示 24 个代表对象；顶部指标来自 {datasetRowCount.toLocaleString("zh-CN")} 条全量记录。
          </p>
        <FamilyWorkspace
          definition={definition}
          objects={objects}
          selected={selected}
          onSelect={selectObject}
          metrics={metrics}
        />
        </>
      ) : null}

      {activeView === "evidence" ? (
        <div className="evidence-workspace">
          <section className="evidence-card">
            <div className="section-heading">
              <Database aria-hidden="true" size={18} />
              <h2>数据来源</h2>
            </div>
            <dl>
              <div><dt>数据集</dt><dd>{definition.datasetTarget}</dd></div>
              <div><dt>全量记录</dt><dd>{datasetRowCount.toLocaleString("zh-CN")} 行</dd></div>
              <div><dt>操作队列</dt><dd>最多 24 个代表对象</dd></div>
            </dl>
          </section>
          <section className="evidence-card">
            <div className="section-heading">
              <FileJson2 aria-hidden="true" size={18} />
              <h2>当前对象</h2>
            </div>
            <dl className="detail-grid">
              <div><dt>{definition.objectLabel}</dt><dd>{selected.objectId}</dd></div>
              <div><dt>当前状态</dt><dd>{selected.state}</dd></div>
              {definition.displayFields
                .filter((field) => field.key !== "state")
                .map((field) => (
                  <div key={field.key}>
                    <dt>{field.label}</dt>
                    <dd>{formatBusinessValue(field.key, selected.payload[field.key])}</dd>
                  </div>
                ))}
            </dl>
            <details>
              <summary>技术明细</summary>
              <dl>
                <div><dt>本地目录</dt><dd className="mono">{definition.datasetFolder}</dd></div>
                <div><dt>SHA-256</dt><dd className="mono">{datasetHash}</dd></div>
              </dl>
              <pre>{JSON.stringify(selected.payload, null, 2)}</pre>
            </details>
          </section>
          {definition.aiEnabled ? (
            <section className="evidence-card">
              <div className="section-heading">
                <Sparkles aria-hidden="true" size={18} />
                <h2>模型辅助边界</h2>
              </div>
              <p>模型只能整理证据和提出候选判断；权限、金额、状态变化和高风险动作由确定性服务端执行。</p>
              <div className="assist-actions">
                <button type="button" disabled={busy} onClick={() => requestAssist("offline")}>
                  离线回放
                </button>
                <button type="button" disabled={busy} onClick={() => requestAssist("live")}>
                  实时模型
                </button>
              </div>
              {assistReceipt ? (
                <div className="assist-result">
                  <StatusTag
                    label={assistReceipt.verifiedLive ? "实时回执" : "离线回放"}
                    tone={assistReceipt.verifiedLive ? "success" : "neutral"}
                  />
                  <p className="mono">
                    {assistReceipt.model} · {assistReceipt.outputHash.slice(0, 16)}
                  </p>
                  <pre>{assistReceipt.content}</pre>
                </div>
              ) : null}
              {error ? <p className="error-copy">{error}</p> : null}
            </section>
          ) : null}
        </div>
      ) : null}

      {activeView === "audit" ? (
        <div className="audit-workspace">
          <section className="timeline-panel">
            <div className="panel-heading">
              <div><p>事件日志</p><h2>{selected.objectId}</h2></div>
              <div>
                <span>{events.length} 条</span>
                <button type="button" disabled={busy} onClick={reset}>
                  <RotateCcw aria-hidden="true" size={16} />
                  恢复案例 {teachingId}
                </button>
              </div>
            </div>
            {events.length === 0 ? (
              <p className="empty-state">尚无业务动作。前往处置工作台执行一次命令后，这里会出现审计事件。</p>
            ) : (
              <ol className="event-timeline">
                {events.map((event) => (
                  <li key={event.eventId}>
                    <strong>{definition.commandLabels[event.command] ?? event.command}</strong>
                    <span>{event.fromState} → {event.toState}</span>
                    <small>{event.actor.id} · v{event.version} · {event.occurredAt}</small>
                  </li>
                ))}
              </ol>
            )}
          </section>
          <ReceiptPanel
            receiptId={receipt?.receiptId}
            state={selected.state}
            version={selected.version}
            error={error}
          />
        </div>
      ) : null}

      {activeView === "recovery" ? (
        <div className="recovery-workspace">
          <section>
            <RotateCcw aria-hidden="true" size={26} />
            <h2>恢复初始状态</h2>
            <p>清除当前操作记录，并从已校验的数据重新建立工作队列。原始数据不会被修改。</p>
            <button type="button" disabled={busy} onClick={reset}>
              <RotateCcw aria-hidden="true" size={17} />
              恢复案例 {teachingId}
            </button>
          </section>
          <ReceiptPanel state={selected.state} version={selected.version} error={error} />
        </div>
      ) : null}

      {activeView === "work" ? (
        <section className="action-dock">
          <div>
            <p>当前对象</p>
            <strong>{selected.objectId}</strong>
          </div>
          <label className="role-selector">
            <span>当前操作角色</span>
            <select
              aria-label="当前操作角色"
              value={actorRole}
              onChange={(event) => setActorRole(event.target.value)}
            >
              {roles.map((role) => (
                <option key={role} value={role}>
                  {formatActorRole(role)}
                </option>
              ))}
            </select>
          </label>
          <CommandBar busy={busy} commands={commands} onCommand={execute} />
          <button type="button" disabled={busy} onClick={reset}>
            <RotateCcw aria-hidden="true" size={16} />
            恢复案例 {teachingId}
          </button>
          <ReceiptPanel
            receiptId={receipt?.receiptId}
            state={selected.state}
            version={selected.version}
            error={error}
          />
        </section>
      ) : null}
    </AppShell>
  );
}
