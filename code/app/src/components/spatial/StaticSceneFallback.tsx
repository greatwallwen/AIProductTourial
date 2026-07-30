"use client";

import type { SceneModel } from "./types";

const statusLabels = {
  normal: "正常",
  attention: "关注",
  critical: "优先核查",
  unknown: "未知",
} as const;

export function StaticSceneFallback({
  model,
  selectedNodeId,
  onSelectNode,
}: {
  model: SceneModel;
  selectedNodeId?: string;
  onSelectNode: (id: string) => void;
}) {
  return (
    <div className="spatial-fallback" data-testid="spatial-fallback">
      <ul className="spatial-fallback-grid" aria-label="场景对象">
        {model.nodes.map((node) => (
          <li key={node.id}>
            <button
              type="button"
              aria-label={`选择${node.label}`}
              aria-pressed={node.id === selectedNodeId}
              data-status={node.status}
              onClick={() => onSelectNode(node.id)}
            >
              <span className="scene-node-mark" aria-hidden="true" />
              <strong>{node.label}</strong>
              <small>{statusLabels[node.status]}</small>
            </button>
          </li>
        ))}
      </ul>
      <p className="scene-text-alternative">{model.textAlternative}</p>
    </div>
  );
}
