import { ArrowRight, CircleAlert, Layers3 } from "lucide-react";
import { StatusTag } from "@course-ai-product/design-system";
import type { CaseProjection } from "@course-ai-product/case-runtime";
import type {
  CaseDecision,
  CaseDefinition,
  CaseMetric,
} from "@cases/contracts";
import {
  formatBusinessValue,
  MetricStrip,
} from "./families/SharedPanels";

export function CaseOverview({
  definition,
  defaultProjection,
  metrics,
  workHref,
}: {
  definition: CaseDefinition;
  defaultProjection: CaseProjection;
  metrics: CaseMetric[];
  workHref: string;
}) {
  const decision = defaultProjection.payload.decision as
    | CaseDecision
    | undefined;
  const visibleFields = definition.displayFields.filter(
    (field) => field.key !== "state",
  );

  return (
    <div className="case-overview">
      <section className="overview-problem">
        <p className="eyebrow">当前问题</p>
        <h2>{definition.title}</h2>
        <p>{definition.scenario}</p>
      </section>

      <MetricStrip metrics={metrics} />
      <p className="overview-scope-note">
        以上指标按本地全量数据计算；工作台最多载入 24 个代表对象，便于快速核对。
      </p>

      <section className="overview-default-object">
        <div className="section-heading">
          <Layers3 aria-hidden="true" size={18} />
          <div>
            <p>故事对象</p>
            <h2>{defaultProjection.objectId}</h2>
          </div>
          <StatusTag
            label={defaultProjection.state}
            tone={defaultProjection.state.includes("已") ? "success" : "warning"}
          />
        </div>
        <dl className="detail-grid">
          {visibleFields.map((field) => (
            <div key={field.key}>
              <dt>{field.label}</dt>
              <dd>
                {formatBusinessValue(
                  field.key,
                  defaultProjection.payload[field.key],
                )}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="overview-risk">
        <div className="section-heading">
          <CircleAlert aria-hidden="true" size={18} />
          <h2>当前判断</h2>
        </div>
        {decision ? (
          <>
            <strong>{decision.label}</strong>
            <p>{decision.reason}</p>
            <dl>
              <div>
                <dt>建议动作</dt>
                <dd>
                  {definition.commandLabels[decision.recommendedCommand] ??
                    decision.recommendedCommand}
                </dd>
              </div>
            </dl>
          </>
        ) : (
          <p>等待数据判断。</p>
        )}
      </section>

      <a className="overview-work-cta" href={workHref}>
        进入处置工作台
        <ArrowRight aria-hidden="true" size={17} />
      </a>
    </div>
  );
}
