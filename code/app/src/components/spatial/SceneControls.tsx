"use client";

import { RotateCcw, ZoomIn, ZoomOut } from "lucide-react";

export function SceneControls({
  onReset,
  onZoomIn,
  onZoomOut,
}: {
  onReset: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}) {
  return (
    <div className="scene-controls" aria-label="三维视角控制">
      <button type="button" onClick={onZoomIn} aria-label="放大三维视角" title="放大">
        <ZoomIn aria-hidden="true" size={17} />
      </button>
      <button type="button" onClick={onZoomOut} aria-label="缩小三维视角" title="缩小">
        <ZoomOut aria-hidden="true" size={17} />
      </button>
      <button type="button" onClick={onReset} aria-label="重置三维视角" title="重置视角">
        <RotateCcw aria-hidden="true" size={17} />
      </button>
    </div>
  );
}
