"use client";

import { Edges, Html, OrbitControls } from "@react-three/drei";
import { Canvas, type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { createHydraulicPowerUnitModel } from "./generated/createHydraulicPowerUnit";
import styles from "./HydraulicPowerUnitScene.module.css";

type ComponentKey = "pump" | "valve" | "cooler" | "accumulator";

const componentViews: Record<ComponentKey, {
  camera: [number, number, number];
  target: [number, number, number];
  halo: [number, number, number];
  size: [number, number, number];
  label: string;
}> = {
  pump: { camera: [5.3, 2.8, 7.7], target: [-1.15, -0.55, 0.2], halo: [-1.05, -0.66, 0.2], size: [1.15, 1.15, 1.15], label: "主泵" },
  valve: { camera: [5.4, 3.2, 7.5], target: [0.3, 0.25, 0.05], halo: [0.3, 0.38, 0.05], size: [2.15, 1.28, 1.2], label: "比例阀组" },
  cooler: { camera: [6.2, 3.1, 6.6], target: [2.25, 0, 0], halo: [2.25, 0, 0], size: [0.8, 2.7, 2.25], label: "油冷却器" },
  accumulator: { camera: [5.2, 2.5, 6.4], target: [1.15, -0.2, 1.0], halo: [1.15, -0.2, 1.0], size: [1.2, 1.45, 1.2], label: "蓄能器" },
};

const calloutPositions: Record<ComponentKey, [number, number, number]> = {
  pump: [-1.3, 0.15, 0.45],
  valve: [0.25, 1.05, 0.15],
  cooler: [2.32, 1.55, 0.15],
  accumulator: [1.15, 0.55, 1.05],
};

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return reduced;
}

function CameraFocus({ selectedComponent, reducedMotion }: { selectedComponent: ComponentKey; reducedMotion: boolean }) {
  const { camera, invalidate } = useThree();
  const start = useRef(new THREE.Vector3());
  const destination = useRef(new THREE.Vector3());
  const target = useRef(new THREE.Vector3());
  const startedAt = useRef(0);
  const active = useRef(false);

  useEffect(() => {
    const view = componentViews[selectedComponent];
    start.current.copy(camera.position);
    destination.current.set(...view.camera);
    target.current.set(...view.target);
    if (reducedMotion) {
      camera.position.copy(destination.current);
      camera.lookAt(target.current);
      active.current = false;
      invalidate();
      return;
    }
    startedAt.current = performance.now();
    active.current = true;
    invalidate();
  }, [camera, invalidate, reducedMotion, selectedComponent]);

  useFrame(() => {
    if (!active.current) return;
    const progress = Math.min(1, (performance.now() - startedAt.current) / 620);
    const eased = 1 - Math.pow(1 - progress, 3);
    camera.position.lerpVectors(start.current, destination.current, eased);
    camera.lookAt(target.current);
    if (progress < 1) invalidate();
    else active.current = false;
  });

  return null;
}

function SelectionPulse({ selectedComponent, reducedMotion }: { selectedComponent: ComponentKey; reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null);
  const { invalidate } = useThree();
  const startedAt = useRef(0);
  const active = useRef(false);
  const view = componentViews[selectedComponent];

  useEffect(() => {
    if (reducedMotion || !group.current) {
      active.current = false;
      group.current?.scale.setScalar(1);
      invalidate();
      return;
    }
    startedAt.current = performance.now();
    active.current = true;
    group.current.scale.setScalar(0.92);
    invalidate();
  }, [invalidate, reducedMotion, selectedComponent]);

  useFrame(() => {
    if (!active.current || !group.current) return;
    const progress = Math.min(1, (performance.now() - startedAt.current) / 720);
    const overshoot = Math.sin(progress * Math.PI) * 0.08;
    group.current.scale.setScalar(1 + overshoot);
    if (progress < 1) invalidate();
    else active.current = false;
  });

  return (
    <group ref={group} position={view.halo}>
      <mesh>
        <boxGeometry args={view.size} />
        <meshBasicMaterial color="#f4bd43" transparent opacity={0.035} depthWrite={false} />
        <Edges color="#f4bd43" linewidth={1.5} />
      </mesh>
      <pointLight color="#f4bd43" intensity={4.2} distance={2.4} decay={2} />
    </group>
  );
}

function componentFromObject(object: THREE.Object3D): ComponentKey | undefined {
  let current: THREE.Object3D | null = object;
  while (current) {
    const id = (current.userData.sculptComponent as { id?: string } | undefined)?.id ?? current.name;
    if (/pump/i.test(id)) return "pump";
    if (/valve|gauge/i.test(id)) return "valve";
    if (/cooler/i.test(id)) return "cooler";
    if (/accumulator/i.test(id)) return "accumulator";
    current = current.parent;
  }
  return undefined;
}

function HydraulicDetailKit() {
  const motorFins = Array.from({ length: 10 }, (_, index) => -2.72 + index * 0.13);
  const flangeBolts = Array.from({ length: 8 }, (_, index) => (index / 8) * Math.PI * 2);
  const fanSpokes = Array.from({ length: 8 }, (_, index) => (index / 8) * Math.PI);

  return (
    <group aria-hidden="true">
      {motorFins.map((x) => (
        <mesh key={`motor-fin-${x}`} position={[x, -0.66, 0.2]} rotation={[0, Math.PI / 2, 0]} castShadow>
          <torusGeometry args={[0.5, 0.025, 8, 32]} />
          <meshStandardMaterial color="#657783" roughness={0.34} metalness={0.88} />
        </mesh>
      ))}
      {flangeBolts.map((angle, index) => (
        <mesh key={`pump-bolt-${index}`} position={[-0.61, -0.66 + Math.sin(angle) * 0.31, 0.2 + Math.cos(angle) * 0.31]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.045, 0.045, 0.09, 12]} />
          <meshStandardMaterial color="#c8d2da" roughness={0.24} metalness={0.96} />
        </mesh>
      ))}
      <group position={[2.35, 0, 0.97]}>
        <mesh castShadow>
          <torusGeometry args={[0.72, 0.045, 12, 64]} />
          <meshStandardMaterial color="#72818c" roughness={0.34} metalness={0.84} />
        </mesh>
        {fanSpokes.map((angle, index) => (
          <mesh key={`fan-spoke-${index}`} rotation={[0, 0, angle]} castShadow>
            <boxGeometry args={[1.36, 0.035, 0.035]} />
            <meshStandardMaterial color="#72818c" roughness={0.34} metalness={0.84} />
          </mesh>
        ))}
        <mesh position={[0, 0, 0.03]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.18, 0.18, 0.13, 32]} />
          <meshStandardMaterial color="#34434e" roughness={0.3} metalness={0.82} />
        </mesh>
      </group>
      <mesh position={[1.15, -0.22, 1.02]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[0.43, 0.035, 10, 48]} />
        <meshStandardMaterial color="#c4cdd4" roughness={0.24} metalness={0.94} />
      </mesh>
      <mesh position={[-2.15, -1.21, 0.2]} castShadow>
        <boxGeometry args={[1.42, 0.22, 1.08]} />
        <meshStandardMaterial color="#1b3f5b" roughness={0.38} metalness={0.68} />
      </mesh>
    </group>
  );
}

function HydraulicAssembly({
  selectedComponent,
  inspectionOrder,
  reducedMotion,
  onSelectComponent,
}: {
  selectedComponent: ComponentKey;
  inspectionOrder: ComponentKey[];
  reducedMotion: boolean;
  onSelectComponent: (component: ComponentKey) => void;
}) {
  const assembly = useMemo(() => {
    const model = createHydraulicPowerUnitModel({ textureSize: 256 });
    const originalMaterials = new Set<THREE.Material>();
    const palette: Record<string, { color: string; roughness: number; metalness: number }> = {
      "skid-base": { color: "#0b63ad", roughness: 0.32, metalness: 0.62 },
      "oil-tank": { color: "#07589c", roughness: 0.34, metalness: 0.58 },
      motor: { color: "#33424f", roughness: 0.3, metalness: 0.84 },
      "motor-end": { color: "#9dacb9", roughness: 0.26, metalness: 0.92 },
      pump: { color: "#0873c9", roughness: 0.3, metalness: 0.7 },
      "pump-flange": { color: "#a7b5c1", roughness: 0.24, metalness: 0.94 },
      valve: { color: "#0866b2", roughness: 0.3, metalness: 0.7 },
      "valve-cartridge-left": { color: "#1a2631", roughness: 0.36, metalness: 0.78 },
      "valve-cartridge-right": { color: "#1a2631", roughness: 0.36, metalness: 0.78 },
      "gauge-left": { color: "#d5dde4", roughness: 0.2, metalness: 0.9 },
      "gauge-right": { color: "#d5dde4", roughness: 0.2, metalness: 0.9 },
      cooler: { color: "#273542", roughness: 0.34, metalness: 0.76 },
      "cooler-fan": { color: "#111820", roughness: 0.42, metalness: 0.72 },
      accumulator: { color: "#131b22", roughness: 0.48, metalness: 0.46 },
      "accumulator-band": { color: "#b5c0c8", roughness: 0.24, metalness: 0.94 },
      "pressure-hose": { color: "#0a0f14", roughness: 0.8, metalness: 0.02 },
      "cooler-hose": { color: "#0a0f14", roughness: 0.8, metalness: 0.02 },
      "level-gauge": { color: "#f1b633", roughness: 0.36, metalness: 0.42 },
    };

    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const id = (object.userData.sculptComponent as { id?: string } | undefined)?.id;
      if (id === "root") {
        object.visible = false;
        return;
      }
      const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material];
      sourceMaterials.forEach((item) => originalMaterials.add(item));
      const appearance = palette[id ?? ""] ?? { color: "#688198", roughness: 0.42, metalness: 0.58 };
      const nextMaterials = sourceMaterials.map((source) => {
        const material = source.clone() as THREE.MeshPhysicalMaterial;
        material.map = null;
        material.roughnessMap = null;
        material.normalMap = null;
        material.bumpMap = null;
        material.displacementMap = null;
        material.aoMap = null;
        material.color.set(appearance.color);
        material.roughness = appearance.roughness;
        material.metalness = appearance.metalness;
        material.envMapIntensity = 1.1;
        material.needsUpdate = true;
        return material;
      });
      object.material = Array.isArray(object.material) ? nextMaterials : nextMaterials[0]!;
    });
    for (const material of originalMaterials) {
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) value.dispose();
      }
      material.dispose();
    }
    return model;
  }, []);

  useEffect(() => () => {
    assembly.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        for (const value of Object.values(material)) {
          if (value instanceof THREE.Texture) value.dispose();
        }
        material.dispose();
      }
    });
  }, [assembly]);

  function selectFromScene(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation();
    const component = componentFromObject(event.object);
    if (component) onSelectComponent(component);
  }

  return (
    <group scale={0.88} position={[0, -0.08, 0]}>
      <primitive object={assembly} onPointerDown={selectFromScene} />
      <HydraulicDetailKit />
      <SelectionPulse selectedComponent={selectedComponent} reducedMotion={reducedMotion} />
      <Html position={calloutPositions[selectedComponent]} center distanceFactor={8.5} zIndexRange={[3, 0]}>
        <span className={styles.callout} data-selected="true" aria-hidden="true">
          <b>{inspectionOrder.indexOf(selectedComponent) + 1}</b>
          {componentViews[selectedComponent].label}
        </span>
      </Html>
    </group>
  );
}

function SceneContent({
  selectedComponent,
  inspectionOrder,
  onSelectComponent,
}: {
  selectedComponent: ComponentKey;
  inspectionOrder: ComponentKey[];
  onSelectComponent: (component: ComponentKey) => void;
}) {
  const reducedMotion = useReducedMotion();
  return (
    <>
      <color attach="background" args={["#06131f"]} />
      <fog attach="fog" args={["#06131f", 10, 18]} />
      <ambientLight intensity={0.7} />
      <hemisphereLight color="#d7efff" groundColor="#15283a" intensity={1.1} />
      <directionalLight position={[-4, 8, 6]} intensity={2.6} color="#eaf6ff" castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <directionalLight position={[7, 3, -4]} intensity={1.2} color="#4db8ff" />
      <spotLight position={[2, 6, 5]} angle={0.42} penumbra={0.7} intensity={1.4} color="#ffd486" />
      <mesh position={[0, -1.58, 0]} receiveShadow>
        <boxGeometry args={[8.4, 0.08, 5.4]} />
        <meshStandardMaterial color="#071724" metalness={0.18} roughness={0.78} />
      </mesh>
      <gridHelper args={[8, 16, "#255573", "#132f43"]} position={[0, -1.52, 0]} />
      <HydraulicAssembly
        selectedComponent={selectedComponent}
        inspectionOrder={inspectionOrder}
        reducedMotion={reducedMotion}
        onSelectComponent={onSelectComponent}
      />
      <CameraFocus selectedComponent={selectedComponent} reducedMotion={reducedMotion} />
      <OrbitControls autoRotate={false} enableDamping={false} enablePan={false} minDistance={5.8} maxDistance={12} minPolarAngle={0.55} maxPolarAngle={1.4} />
    </>
  );
}

export default function HydraulicPowerUnitScene({
  selectedComponent,
  inspectionOrder,
  onSelectComponent,
  onReady,
}: {
  selectedComponent: ComponentKey;
  inspectionOrder: ComponentKey[];
  onSelectComponent: (component: ComponentKey) => void;
  onReady: () => void;
}) {
  return (
    <div className={styles.root} data-testid="hydraulic-power-unit-scene">
      <Canvas
        className={styles.canvas}
        dpr={[1, 1.5]}
        frameloop="demand"
        camera={{ position: [6.4, 4.0, 8.6], fov: 38, near: 0.1, far: 80 }}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        shadows
        onCreated={() => onReady()}
      >
        <SceneContent selectedComponent={selectedComponent} inspectionOrder={inspectionOrder} onSelectComponent={onSelectComponent} />
      </Canvas>
      <p className={styles.disclosure}>单图近似定位模型 · 不提供尺寸、维修结论或安全控制</p>
    </div>
  );
}
