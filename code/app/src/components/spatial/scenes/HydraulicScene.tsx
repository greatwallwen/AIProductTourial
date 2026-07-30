"use client";

import { Line } from "@react-three/drei";
import type { SceneModel, SceneNode } from "../types";
import { STATUS_COLORS } from "./SceneNodeMesh";

function HydraulicModule({
  node,
  selected,
  onSelect,
}: {
  node: SceneNode;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const color = STATUS_COLORS[node.status];
  return (
    <group
      position={node.position}
      scale={selected ? 1.12 : 1}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(node.id);
      }}
    >
      <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
        {node.id === "pump" || node.id === "accumulator" ? (
          <cylinderGeometry args={[0.58, 0.58, 1.05, 32]} />
        ) : (
          <boxGeometry args={[1.1, 0.9, 1]} />
        )}
        <meshStandardMaterial
          color={color}
          metalness={0.42}
          roughness={0.28}
          emissive={selected ? color : "#000000"}
          emissiveIntensity={selected ? 0.2 : 0}
        />
      </mesh>
      <mesh position={[0, -0.08, 0]} receiveShadow>
        <cylinderGeometry args={[0.72, 0.82, 0.16, 32]} />
        <meshStandardMaterial color="#c8d4df" metalness={0.54} roughness={0.35} />
      </mesh>
    </group>
  );
}

export function HydraulicScene({
  model,
  selectedNodeId,
  onSelectNode,
}: {
  model: SceneModel;
  selectedNodeId?: string;
  onSelectNode: (id: string) => void;
}) {
  const points = model.nodes.map((node) => [
    node.position[0],
    0.45,
    node.position[2],
  ] as [number, number, number]);
  return (
    <group>
      {points.slice(0, -1).map((point, index) => (
        <Line
          key={`${model.nodes[index]?.id}-${model.nodes[index + 1]?.id}`}
          points={[point, points[index + 1]!]}
          color="#78a8d4"
          lineWidth={2}
          transparent
          opacity={0.65}
        />
      ))}
      {model.nodes.map((node) => (
        <HydraulicModule
          key={node.id}
          node={node}
          selected={node.id === selectedNodeId}
          onSelect={onSelectNode}
        />
      ))}
    </group>
  );
}
