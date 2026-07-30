import { CheckCircle2, CircleDot, ShieldCheck } from "lucide-react";
import { DataTable } from "@course-ai-product/design-system";
import type { CaseDefinition, CaseMetric } from "@cases/contracts";
import type { CaseProjection } from "@course-ai-product/case-runtime";
import { caseTableRows, MetricStrip, ObjectDetail } from "./SharedPanels";

export function ApprovalWorkspace({
  definition,
  objects,
  selected,
  onSelect,
  metrics,
}: {
  definition: CaseDefinition;
  objects: CaseProjection[];
  selected: CaseProjection;
  onSelect: (id: string) => void;
  metrics: CaseMetric[];
}) {
  return (
    <>
      <MetricStrip metrics={metrics} />
      <div className="approval-layout">
      <aside className="approval-rail">
        <ShieldCheck aria-hidden="true" size={23} />
        <h2>处理步骤</h2>
        <ol>
          {definition.workspace.processSteps.map((step, index) => (
            <li
              key={step.label}
              data-current={step.states.includes(selected.state)}
            >
              {index === definition.workspace.processSteps.length - 1 ? (
                <CheckCircle2 aria-hidden="true" size={16} />
              ) : (
                <CircleDot aria-hidden="true" size={16} />
              )}
              {step.label}
            </li>
          ))}
        </ol>
      </aside>
      <section className="approval-queue">
        <div className="panel-heading">
          <div>
              <p>{definition.workspace.queueEyebrow}</p>
              <h2>{definition.workspace.queueTitle}</h2>
          </div>
          <span>{objects.length} 项</span>
        </div>
        <DataTable
          columns={definition.displayFields}
          rows={caseTableRows(definition, objects)}
          selectedId={selected.objectId}
          onSelect={onSelect}
        />
      </section>
      <ObjectDetail definition={definition} projection={selected} />
      </div>
    </>
  );
}
