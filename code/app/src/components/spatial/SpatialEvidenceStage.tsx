"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { SceneModel } from "./types";
import { SceneControls } from "./SceneControls";
import { SceneErrorBoundary } from "./SceneErrorBoundary";
import { StaticSceneFallback } from "./StaticSceneFallback";

const DynamicSceneCanvas = dynamic(() => import("./SceneCanvas"), {
  ssr: false,
  loading: () => <div className="scene-loading">正在建立三维视图…</div>,
});

export function SpatialEvidenceStage({
  model,
  selectedNodeId,
  onSelectNode = () => undefined,
  forceFallback = false,
}: {
  model: SceneModel;
  selectedNodeId?: string;
  onSelectNode?: (id: string) => void;
  forceFallback?: boolean;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [webglAvailable, setWebglAvailable] = useState(false);
  const [sceneFailed, setSceneFailed] = useState(false);
  const [cameraDistance, setCameraDistance] = useState(8.7);

  useEffect(() => {
    if (forceFallback) return;
    const canvas = document.createElement("canvas");
    const supported = Boolean(
      canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: true }) ||
        canvas.getContext("webgl", { failIfMajorPerformanceCaveat: true }),
    );
    setWebglAvailable(supported);
    if (!supported || !viewportRef.current) return;
    if (!("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(Boolean(entry?.isIntersecting)),
      { rootMargin: "120px" },
    );
    observer.observe(viewportRef.current);
    return () => observer.disconnect();
  }, [forceFallback]);

  const showCanvas = visible && webglAvailable && !sceneFailed && !forceFallback;

  return (
    <section className="spatial-stage" role="region" aria-label={model.title}>
      <header className="spatial-stage-header">
        <div>
          <p>空间证据</p>
          <h2>{model.title}</h2>
        </div>
        <span className="scene-disclosure">{model.disclosure}</span>
      </header>
      <div className="scene-viewport" ref={viewportRef}>
        {showCanvas ? (
          <SceneErrorBoundary onError={() => setSceneFailed(true)}>
            <DynamicSceneCanvas
              model={model}
              selectedNodeId={selectedNodeId}
              onSelectNode={onSelectNode}
              cameraDistance={cameraDistance}
            />
          </SceneErrorBoundary>
        ) : (
          <div className="scene-static-backdrop" aria-hidden="true" />
        )}
        <SceneControls
          onZoomIn={() => setCameraDistance((value) => Math.max(7, value - 1))}
          onZoomOut={() => setCameraDistance((value) => Math.min(14, value + 1))}
          onReset={() => setCameraDistance(8.7)}
        />
      </div>
      <StaticSceneFallback
        model={model}
        selectedNodeId={selectedNodeId}
        onSelectNode={onSelectNode}
      />
      <div className="scene-legend" aria-label="状态图例">
        {model.legend.map((item) => (
          <span key={`${item.status}-${item.label}`} data-status={item.status}>
            <i aria-hidden="true" />
            {item.label}
          </span>
        ))}
      </div>
    </section>
  );
}
