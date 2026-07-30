import { BookOpenCheck, SearchCheck, Waypoints } from "lucide-react";
import { DataTable } from "@course-ai-product/design-system";
import type {
  CaseDecision,
  CaseDefinition,
  CaseMetric,
} from "@cases/contracts";
import type { CaseProjection } from "@course-ai-product/case-runtime";
import { caseTableRows, MetricStrip, ObjectDetail } from "./SharedPanels";

export function InvestigationWorkspace({
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
  const decision = selected.payload.decision as CaseDecision | undefined;
  return (
    <>
      <MetricStrip metrics={metrics} />
      <section className="investigation-strip">
        <div>
          <SearchCheck aria-hidden="true" size={20} />
          <span>{definition.workspace.queueEyebrow}</span>
          <strong>{definition.workspace.sortHint}</strong>
        </div>
        <div>
          <Waypoints aria-hidden="true" size={20} />
          <span>当前判断</span>
          <strong>{decision?.label ?? "等待数据判断"}</strong>
        </div>
        <div>
          <BookOpenCheck aria-hidden="true" size={20} />
          <span>下一步</span>
          <strong>
            {decision
              ? definition.commandLabels[decision.recommendedCommand]
              : "人工核对"}
          </strong>
        </div>
      </section>
      <div className="family-grid investigation-grid">
        <section>
          <div className="panel-heading">
            <div>
              <p>{definition.workspace.queueEyebrow}</p>
              <h2>{definition.workspace.queueTitle}</h2>
            </div>
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
