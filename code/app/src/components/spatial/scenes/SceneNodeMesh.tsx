"use client";

import type { ThreeEvent } from "@react-three/fiber";
import type { SceneNode } from "../types";

export const STATUS_COLORS = {
  normal: "#159a74",
  attention: "#e49b20",
  critical: "#df5c52",
  unknown: "#91a0b4",
} as const;

export function SceneNodeMesh({
  node,
  selected,
  onSelect,
  scale = 1,
}: {
  node: SceneNode;
  selected: boolean;
  onSelect: (id: string) => void;
  scale?: number;
}) {
  function select(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation();
    onSelect(node.id);
  }

  return (
    <mesh
      position={node.position}
      scale={selected ? scale * 1.18 : scale}
      onClick={select}
      castShadow
      receiveShadow
    >
      <sphereGeometry args={[0.34, 24, 24]} />
      <meshStandardMaterial
        color={STATUS_COLORS[node.status]}
        emissive={selected ? STATUS_COLORS[node.status] : "#000000"}
        emissiveIntensity={selected ? 0.24 : 0}
        metalness={0.18}
        roughness={0.36}
      />
    </mesh>
  );
}
