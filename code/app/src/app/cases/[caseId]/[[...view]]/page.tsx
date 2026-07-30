import { notFound } from "next/navigation";
import { getCaseDefinition } from "@cases/registry";
import {
  ensureCaseSeeded,
  eventsFor,
  receiptFor,
} from "@cases/runtime.server";
import { resolveFeaturedObject } from "@cases/featured-object";
import { CaseExperience } from "@/components/CaseExperience";

export default async function CasePage({
  params,
}: {
  params: Promise<{ caseId: string; view?: string[] }>;
}) {
  const { caseId, view } = await params;
  const definition = getCaseDefinition(caseId);
  if (!definition) {
    notFound();
  }
  const requestedView = view?.[0] ?? "overview";
  const activeView = requestedView === "workbench" ? "work" : requestedView;
  if (!definition.views.some((item) => item.id === activeView)) {
    notFound();
  }
  const dataset = ensureCaseSeeded(definition);
  const selected =
    resolveFeaturedObject(dataset.objects, definition.featuredObjectId) ??
    dataset.objects[0];
  return (
    <CaseExperience
      definition={definition}
      activeView={activeView}
      initialObjects={dataset.objects}
      initialEvents={eventsFor(definition, selected?.objectId)}
      initialReceipt={receiptFor(definition, selected?.objectId)}
      datasetRowCount={dataset.rowCount}
      datasetHash={dataset.datasetHash}
      metrics={dataset.metrics}
      sceneRows={dataset.sceneRows}
      supportingArtifacts={dataset.supportingArtifacts}
    />
  );
}
