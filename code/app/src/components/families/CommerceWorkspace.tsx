import { DataTable } from "@course-ai-product/design-system";
import type { CaseDefinition, CaseMetric } from "@cases/contracts";
import type { CaseProjection } from "@course-ai-product/case-runtime";
import { caseTableRows, MetricStrip, ObjectDetail } from "./SharedPanels";

export function CommerceWorkspace({
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
      <div className="family-grid commerce-grid">
        <section>
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
