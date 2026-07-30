"use client";

import type { SceneModel, SceneNode } from "../types";
import { STATUS_COLORS } from "./SceneNodeMesh";

function Turbine({
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
      <mesh position={[0, 1, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.17, 2, 16]} />
        <meshStandardMaterial color="#dce6ee" metalness={0.45} roughness={0.36} />
      </mesh>
      <mesh position={[0, 2.02, 0]} castShadow>
        <boxGeometry args={[0.42, 0.22, 0.25]} />
        <meshStandardMaterial color={color} metalness={0.25} roughness={0.32} />
      </mesh>
      {[0, 120, 240].map((degrees) => (
        <mesh
          key={degrees}
          position={[0, 2.02, 0.04]}
          rotation={[0, 0, (degrees * Math.PI) / 180]}
          castShadow
        >
          <boxGeometry args={[0.09, 1.15, 0.055]} />
          <meshStandardMaterial color="#f6f9fb" metalness={0.15} roughness={0.4} />
        </mesh>
      ))}
      <mesh position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.34, selected ? 0.62 : 0.46, 32]} />
        <meshBasicMaterial color={color} transparent opacity={selected ? 0.48 : 0.16} />
      </mesh>
    </group>
  );
}

export function WindComparisonScene({
  model,
  selectedNodeId,
  onSelectNode,
}: {
  model: SceneModel;
  selectedNodeId?: string;
  onSelectNode: (id: string) => void;
}) {
  return (
    <group position={[0, -1.15, 0]}>
      {model.nodes.map((node) => (
        <Turbine
          key={node.id}
          node={node}
          selected={node.id === selectedNodeId}
          onSelect={onSelectNode}
        />
      ))}
    </group>
  );
}
