"use client";

import type { SceneModel, SceneNode } from "../types";
import { STATUS_COLORS } from "./SceneNodeMesh";

function SolarStation({
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
      scale={selected ? 1.1 : 1}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(node.id);
      }}
    >
      {[0, 1].map((row) =>
        [0, 1, 2].map((column) => (
          <mesh
            key={`${row}-${column}`}
            position={[(column - 1) * 0.58, 0.33 + row * 0.03, (row - 0.5) * 0.65]}
            rotation={[-0.22, 0, 0]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[0.52, 0.05, 0.58]} />
            <meshPhysicalMaterial
              color={selected ? "#246fa8" : "#315a78"}
              metalness={0.38}
              roughness={0.2}
              clearcoat={0.5}
            />
          </mesh>
        )),
      )}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.95, selected ? 1.2 : 1.05, 32]} />
        <meshBasicMaterial color={color} transparent opacity={selected ? 0.48 : 0.15} />
      </mesh>
    </group>
  );
}

export function SolarFieldScene({
  model,
  selectedNodeId,
  onSelectNode,
}: {
  model: SceneModel;
  selectedNodeId?: string;
  onSelectNode: (id: string) => void;
}) {
  return (
    <group position={[0, -0.4, 0]}>
      {model.nodes.map((node) => (
        <SolarStation
          key={node.id}
          node={node}
          selected={node.id === selectedNodeId}
          onSelect={onSelectNode}
        />
      ))}
    </group>
  );
}
