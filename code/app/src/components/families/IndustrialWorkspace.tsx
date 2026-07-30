"use client";

import { Activity, CircleGauge, Wrench } from "lucide-react";
import { DataTable, StatusTag } from "@course-ai-product/design-system";
import type {
  CaseDecision,
  CaseDefinition,
  CaseMetric,
} from "@cases/contracts";
import type { CaseProjection } from "@course-ai-product/case-runtime";
import { useEffect, useMemo, useState } from "react";
import { buildSceneModel } from "../spatial/scene-models";
import { SpatialEvidenceStage } from "../spatial/SpatialEvidenceStage";
import {
  caseTableRows,
  DecisionRail,
  MetricStrip,
  ObjectDetail,
} from "./SharedPanels";

export function IndustrialWorkspace({
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
  const sceneModel = useMemo(
    () => buildSceneModel(definition.id, selected),
    [definition.id, selected],
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string>();

  useEffect(() => {
    setSelectedNodeId(
      sceneModel?.nodes.find((node) => node.id === selected.objectId)?.id ??
        sceneModel?.nodes[0]?.id,
    );
  }, [sceneModel, selected.objectId]);

  if (sceneModel) {
    return (
      <>
        <MetricStrip metrics={metrics} />
        <div className="spatial-workbench">
          <SpatialEvidenceStage
            model={sceneModel}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
          />
          <DecisionRail definition={definition} projection={selected} />
        </div>
        <section className="asset-list spatial-object-queue">
          <div className="panel-heading">
            <div>
              <p>{definition.workspace.queueEyebrow}</p>
              <h2>{definition.workspace.queueTitle}</h2>
            </div>
            <span>{objects.length} 个对象</span>
          </div>
          <DataTable
            columns={definition.displayFields}
            rows={caseTableRows(definition, objects)}
            selectedId={selected.objectId}
            onSelect={onSelect}
          />
        </section>
      </>
    );
  }

  return (
    <>
      <MetricStrip metrics={metrics} />
      <section className="industrial-summary">
        <div>
          <Activity aria-hidden="true" size={20} />
          <span>当前队列</span>
          <strong>{objects.length} 个窗口</strong>
        </div>
        <div>
          <CircleGauge aria-hidden="true" size={20} />
          <span>当前判断</span>
          <StatusTag
            label={decision?.label ?? selected.state}
            tone={decision?.level === "normal" ? "success" : "warning"}
          />
        </div>
        <div>
          <Wrench aria-hidden="true" size={20} />
          <span>建议动作</span>
          <strong>
            {decision
              ? definition.commandLabels[decision.recommendedCommand]
              : "人工确认后下发"}
          </strong>
        </div>
      </section>
      <div className="industrial-grid">
        <section className="asset-list">
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
