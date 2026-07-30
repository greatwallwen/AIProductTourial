"use client";

import type { SceneModel } from "../types";
import { SceneNodeMesh } from "./SceneNodeMesh";

export function WaferScene({
  model,
  selectedNodeId,
  onSelectNode,
}: {
  model: SceneModel;
  selectedNodeId?: string;
  onSelectNode: (id: string) => void;
}) {
  return (
    <group rotation={[-0.1, 0, 0]} scale={1.08}>
      <mesh receiveShadow position={[0, -0.22, 0]}>
        <cylinderGeometry args={[4.05, 4.05, 0.28, 96]} />
        <meshPhysicalMaterial
          color="#c5d5e5"
          metalness={0.52}
          roughness={0.16}
          clearcoat={1}
          clearcoatRoughness={0.08}
          iridescence={0.55}
          iridescenceIOR={1.35}
        />
      </mesh>
      <mesh position={[0, -0.08, 0]}>
        <torusGeometry args={[3.48, 0.025, 8, 96]} />
        <meshBasicMaterial color="#6d8eac" />
      </mesh>
      <mesh position={[0, -0.07, 0]}>
        <torusGeometry args={[2.25, 0.018, 8, 96]} />
        <meshBasicMaterial color="#a8bacb" />
      </mesh>
      {model.nodes.map((node) => (
        <SceneNodeMesh
          key={node.id}
          node={node}
          selected={node.id === selectedNodeId}
          onSelect={onSelectNode}
          scale={0.92}
        />
      ))}
    </group>
  );
}
