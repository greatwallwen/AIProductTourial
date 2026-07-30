import { Database, FileText, Gauge, UserRoundCheck } from "lucide-react";
import { StatusTag } from "@course-ai-product/design-system";
import type { CaseDecision, CaseDefinition, CaseMetric } from "@cases/contracts";
import type { CaseProjection } from "@course-ai-product/case-runtime";

const valueLabels: Record<string, Record<string, string>> = {
  event_type: {
    transport_requested: "转运申请",
    transport_assigned: "转运分派",
    bed_request_confirmed: "床位确认",
    handoff_received: "接收交接",
    coordination_snapshot: "协调快照",
    correction_appended: "追加更正",
  },
  conflict_type: {
    none: "无",
    missing: "事件缺失",
    mutually_exclusive: "状态互斥",
    late_reopen: "迟到重开",
    late_event: "迟到事件",
    out_of_order: "事件乱序",
    duplicate: "重复事件",
  },
  external_lookup_scenario: {
    not_committed: "尚未提交",
    effect_status_unknown: "副作用未知",
    committed_response_lost: "已提交 / 响应丢失",
  },
  result: {
    pass: "通过",
    evidence_required: "需要补证",
  },
  quality_label: {
    pass: "通过",
    fail: "未通过",
  },
  review_priority: {
    "routine-gate": "常规复核",
    "quality-gate-review": "质量门复核",
  },
  symptom_category: {
    brake: "制动",
    cooling: "冷却",
    steering: "转向",
    electrical: "电气",
    maintenance: "保养",
    tire: "轮胎",
  },
  risk_level: {
    normal: "正常",
    medium: "关注",
    high: "高风险",
  },
  sensor_status: {
    online: "在线",
    offline: "离线",
  },
  evidence_status: {
    complete: "完整",
    value_conflict: "数值冲突",
    source_missing: "来源缺失",
    missing_slice: "缺少切片",
  },
  income_evidence_status: {
    complete: "完整",
    missing: "缺失",
  },
  identity_verification_status: {
    verified: "已核验",
    pending: "待核验",
  },
  consent_status: {
    confirmed: "已确认",
    not_confirmed: "未确认",
  },
  application_consistency: {
    consistent: "一致",
    needs_evidence: "需要补证",
  },
  overall_severity_label: {
    正常: "正常",
    临界: "临界",
    退化: "退化",
  },
};

const roleLabels: Record<string, string> = {
  analyst: "业务分析",
  operator: "业务运营",
  reviewer: "人工复核",
  coordinator: "流程协调",
  auditor: "质量审核",
  architect: "系统架构",
  dispatcher: "服务调度",
  engineer: "现场工程",
  release_manager: "发布管理",
  quality_reviewer: "质量复核",
  process_engineer: "工艺工程",
  quality_engineer: "质量工程",
  reliability_engineer: "可靠性工程",
  maintenance_planner: "维护计划",
  performance_engineer: "性能工程",
};

const booleanFields = new Set([
  "known_failure_window",
  "safety_review_required",
  "automatic_repair_allowed",
  "automatic_scrap_allowed",
  "evidence_complete",
]);
const percentFields = new Set([
  "underperformance_share",
  "mean_efficiency_ratio",
  "curtailment_suspected_share",
]);
const currencyFields = new Set(["line_amount_cny", "LIMIT_BAL"]);

export function formatBusinessValue(field: string, raw: unknown): string {
  const value = String(raw ?? "").trim();
  const mapped = valueLabels[field]?.[value];
  if (mapped) return mapped;
  if (booleanFields.has(field)) {
    if (value.toLocaleLowerCase("zh-CN") === "true") return "是";
    if (value.toLocaleLowerCase("zh-CN") === "false") return "否";
  }
  const numeric = Number(value);
  if (percentFields.has(field) && Number.isFinite(numeric)) {
    return new Intl.NumberFormat("zh-CN", {
      style: "percent",
      maximumFractionDigits: 1,
    }).format(numeric);
  }
  if (currencyFields.has(field) && Number.isFinite(numeric)) {
    return new Intl.NumberFormat("zh-CN", {
      style: "currency",
      currency: "CNY",
      maximumFractionDigits: 2,
    }).format(numeric);
  }
  return value || "—";
}

export function formatBusinessRole(role: string): string {
  return roleLabels[role] ?? role;
}

export function caseTableRows(
  definition: CaseDefinition,
  objects: CaseProjection[],
): Array<Record<string, unknown> & { objectId: string }> {
  return objects.map((item) => ({
    ...Object.fromEntries(
      definition.displayFields.map((field) => [
        field.key,
        field.key === "state"
          ? item.state
          : formatBusinessValue(field.key, item.payload[field.key]),
      ]),
    ),
    objectId: item.objectId,
  }));
}

export function MetricStrip({ metrics }: { metrics: CaseMetric[] }) {
  return (
    <section className="metric-strip" aria-label="业务指标">
      {metrics.map((metric) => (
        <article key={metric.id}>
          <p>{metric.label}</p>
          <strong>{metric.value}</strong>
          <span>{metric.note}</span>
        </article>
      ))}
    </section>
  );
}

export function ObjectDetail({
  definition,
  projection,
}: {
  definition: CaseDefinition;
  projection: CaseProjection;
}) {
  const visible = definition.displayFields.filter((field) => field.key !== "state");
  const decision = projection.payload.decision as CaseDecision | undefined;
  return (
    <section className="detail-panel">
      <div className="detail-title">
        <div>
          <p>{definition.objectLabel}</p>
          <h2>{projection.objectId}</h2>
        </div>
        <StatusTag
          label={projection.state}
          tone={projection.state.includes("已") ? "success" : "warning"}
        />
      </div>
      <div className="detail-grid">
        {visible.map((field) => (
          <div key={field.key}>
            <span>{field.label}</span>
            <strong>
              {formatBusinessValue(field.key, projection.payload[field.key])}
            </strong>
          </div>
        ))}
      </div>
      {decision ? (
        <section className="decision-card" data-level={decision.level}>
          <span>{definition.workspace.decisionTitle}</span>
          <strong>{decision.label}</strong>
          <p>{decision.reason}</p>
          <dl>
            <div>
              <dt>依据字段</dt>
              <dd>
                {decision.sourceFields
                  .map(
                    (sourceField) =>
                      definition.displayFields.find(
                        (field) => field.key === sourceField,
                      )?.label ?? sourceField,
                  )
                  .join(" · ")}
              </dd>
            </div>
            <div>
              <dt>建议动作</dt>
              <dd>
                {definition.commandLabels[decision.recommendedCommand] ??
                  decision.recommendedCommand}
              </dd>
            </div>
          </dl>
        </section>
      ) : null}
      <div className="evidence-line">
        <Database aria-hidden="true" size={17} />
        <span>原始数据行</span>
        <FileText aria-hidden="true" size={17} />
        <span>字段口径</span>
        <Gauge aria-hidden="true" size={17} />
        <span>状态机 v{projection.version}</span>
        <UserRoundCheck aria-hidden="true" size={17} />
        <span>{formatBusinessRole(definition.primaryRole)}</span>
      </div>
    </section>
  );
}

export function DecisionRail({
  definition,
  projection,
}: {
  definition: CaseDefinition;
  projection: CaseProjection;
}) {
  return (
    <aside className="decision-rail" aria-label="当前对象与处置建议">
      <section className="decision-track" aria-label="处置路径">
        <div className="decision-track-heading">
          <p>处置路径</p>
          <strong>{projection.state}</strong>
        </div>
        <ol>
          {definition.workspace.processSteps.map((step, index) => {
            const current = step.states.includes(projection.state);
            return (
              <li key={step.label} aria-current={current ? "step" : undefined}>
                <span>{index + 1}</span>
                <strong>{step.label}</strong>
              </li>
            );
          })}
        </ol>
      </section>
      <ObjectDetail definition={definition} projection={projection} />
    </aside>
  );
}
