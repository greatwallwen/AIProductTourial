"use client";

import { Canvas, useLoader } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import { MapPin } from "lucide-react";
import * as THREE from "three";
import { Suspense, type CSSProperties } from "react";
import styles from "./PvLossWorkbench.module.css";

const MAP_TEXTURE = "/case-assets/case-20/china_topographic_map_no_text.jpg";
const MAP_W = 8;
const MAP_H = 6;

type Tone = "blue" | "sun" | "green";

interface StationCoord {
  x: number;
  y: number;
  tone: Tone;
}

const STATION_COORDS: StationCoord[] = [
  { x: 0.18, y: 0.32, tone: "sun" },
  { x: 0.33, y: 0.48, tone: "sun" },
  { x: 0.58, y: 0.30, tone: "blue" },
  { x: 0.74, y: 0.55, tone: "blue" },
  { x: 0.43, y: 0.58, tone: "green" },
  { x: 0.74, y: 0.80, tone: "green" },
  { x: 0.40, y: 0.72, tone: "sun" },
  { x: 0.72, y: 0.15, tone: "blue" },
];

const TONE_HEX: Record<Tone, string> = {
  blue: "#1e62b8",
  sun: "#df9c1d",
  green: "#16a083",
};

const TONE_BORDER: Record<Tone, string> = {
  blue: "#b8d1e9",
  sun: "#e8c36d",
  green: "#a8d8ca",
};

const TONE_TEXT: Record<Tone, string> = {
  blue: "#255d9f",
  sun: "#9b6a13",
  green: "#167761",
};

export interface TerrainStation {
  id: string;
  capacityMw: number | string;
}

interface ChinaTerrain3DProps {
  stations: TerrainStation[];
  selectedStationId: string;
  onSelectStation: (id: string) => void;
}

function toPlane(x: number, y: number): [number, number, number] {
  return [(x - 0.5) * MAP_W, 0, (0.5 - y) * MAP_H];
}

function labelStyle(tone: Tone, isSelected: boolean): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: "1px",
    padding: "3px 7px",
    borderRadius: "6px",
    border: `1px solid ${isSelected ? TONE_HEX[tone] : TONE_BORDER[tone]}`,
    background: isSelected ? `linear-gradient(135deg, ${TONE_HEX[tone]}f2, ${TONE_HEX[tone]}cc)` : "rgba(255,255,255,.92)",
    boxShadow: isSelected ? `0 6px 16px ${TONE_HEX[tone]}55` : "0 4px 11px rgba(28,67,106,.14)",
    color: isSelected ? "#fff" : TONE_TEXT[tone],
    fontSize: "9px",
    fontWeight: 700,
    lineHeight: 1.1,
    whiteSpace: "nowrap",
    cursor: "pointer",
    pointerEvents: "auto",
    userSelect: "none",
    transform: "perspective(180px) rotateX(6deg) scale(.70)",
    transition: "all .15s ease",
  };
}

function TerrainMesh() {
  const texture = useLoader(THREE.TextureLoader, MAP_TEXTURE);
  texture.colorSpace = THREE.SRGBColorSpace;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[MAP_W, MAP_H, 1, 1]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

function StationMarker({ station, coord, isSelected, onSelect }: {
  station: TerrainStation;
  coord: StationCoord;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  const [px, , pz] = toPlane(coord.x, coord.y);
  const color = TONE_HEX[coord.tone];
  const capStr = `${station.capacityMw} MW`;
  return (
    <group position={[px, 0, pz]}>
      <mesh position={[0, isSelected ? 0.22 : 0.18, 0]} castShadow>
        <boxGeometry args={[0.1, isSelected ? 0.44 : 0.36, 0.1]} />
        <meshStandardMaterial
          color={color}
          roughness={0.4}
          metalness={0.2}
          emissive={color}
          emissiveIntensity={isSelected ? 0.45 : 0.18}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[0.09, isSelected ? 0.18 : 0.14, 24]} />
        <meshBasicMaterial color={color} transparent opacity={isSelected ? 0.65 : 0.45} side={THREE.DoubleSide} />
      </mesh>
      <Html key={`${station.id}-${isSelected}`} position={[0, 0.55, 0]} center distanceFactor={12} zIndexRange={isSelected ? [100, 90] : [20, 0]}>
        <div
          style={labelStyle(coord.tone, isSelected)}
          onClick={(e) => { e.stopPropagation(); onSelect(station.id); }}
        >
          <span style={{ fontSize: "8px", opacity: 0.85 }}>电站 PV-{station.id.padStart(2, "0")}</span>
          <strong style={{ fontSize: "9px" }}>{capStr}</strong>
          <span style={{ fontSize: "7px", opacity: 0.7 }}>待核查</span>
        </div>
      </Html>
    </group>
  );
}

function SceneLight() {
  return (
    <>
      <ambientLight intensity={0.65} />
      <directionalLight
        position={[4, 8, 3]}
        intensity={1.1}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <hemisphereLight args={["#e9f4fb", "#f8fbf5", 0.3]} />
    </>
  );
}

export function ChinaTerrain3D({ stations, selectedStationId, onSelectStation }: ChinaTerrain3DProps) {
  return (
    <section className={styles.terrainOverview} aria-label="中国光伏区域三维地形总览">
      <div className={styles.terrainHeading}>
        <span><MapPin size={15} />区域核查总览</span>
        <small>区域标签用于核查导航，不表示匿名站点真实坐标</small>
      </div>
      <div className={styles.terrain3dCanvas}>
        <Canvas
          camera={{ position: [0, 6, 5], fov: 42 }}
          gl={{ antialias: true, alpha: true }}
          style={{ background: "transparent" }}
        >
          <SceneLight />
          <Suspense fallback={null}>
            <TerrainMesh />
            {stations.map((station, i) => {
              const coord = STATION_COORDS[i % STATION_COORDS.length];
              const isSelected = station.id === selectedStationId;
              return (
                <StationMarker
                  key={station.id}
                  station={station}
                  coord={coord}
                  isSelected={isSelected}
                  onSelect={onSelectStation}
                />
              );
            })}
          </Suspense>
          <OrbitControls
            enablePan={false}
            minDistance={6}
            maxDistance={16}
            minPolarAngle={Math.PI / 6}
            maxPolarAngle={Math.PI / 2.4}
            enableDamping
            dampingFactor={0.08}
          />
        </Canvas>
      </div>
      <div className={styles.terrainLegend}>
        <i /><span>三维地形浮雕底图</span><b>可拖拽旋转查看</b>
      </div>
    </section>
  );
}
