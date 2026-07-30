"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { useEffect } from "react";
import type { SceneModel } from "./types";
import { HydraulicScene } from "./scenes/HydraulicScene";
import { SolarFieldScene } from "./scenes/SolarFieldScene";
import { WaferScene } from "./scenes/WaferScene";
import { WindComparisonScene } from "./scenes/WindComparisonScene";

function InvalidateOnMount({ revision }: { revision: string }) {
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    invalidate();
  }, [invalidate, revision]);

  return null;
}

export default function SceneCanvas({
  model,
  selectedNodeId,
  onSelectNode,
  cameraDistance,
}: {
  model: SceneModel;
  selectedNodeId?: string;
  onSelectNode: (id: string) => void;
  cameraDistance: number;
}) {
  const Scene =
    model.caseId === "B015"
      ? WaferScene
      : model.caseId === "B016"
        ? WindComparisonScene
        : model.caseId === "B019"
          ? HydraulicScene
          : SolarFieldScene;

  return (
    <Canvas
      key={`${model.caseId}-${cameraDistance}`}
      dpr={[1, 1.5]}
      frameloop="demand"
      camera={{ position: [0, 5.4, cameraDistance], fov: 37 }}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      }}
      shadows
    >
      <ambientLight intensity={1.4} />
      <hemisphereLight color="#ffffff" groundColor="#c9d6e2" intensity={1.05} />
      <directionalLight
        position={[6, 10, 7]}
        intensity={2.2}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-7, 4, -4]} intensity={0.8} color="#8ec5ff" />
      <gridHelper args={[18, 18, "#c4d6e7", "#dce7f0"]} position={[0, -0.18, 0]} />
      <InvalidateOnMount revision={`${model.caseId}-${cameraDistance}`} />
      <Scene
        model={model}
        selectedNodeId={selectedNodeId}
        onSelectNode={onSelectNode}
      />
      <OrbitControls
        makeDefault
        autoRotate={false}
        enableDamping={false}
        enablePan={false}
        minDistance={6}
        maxDistance={16}
        minPolarAngle={0.55}
        maxPolarAngle={1.35}
      />
    </Canvas>
  );
}
