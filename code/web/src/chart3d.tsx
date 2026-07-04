import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
// three.js 真三维散点（独立 chunk，供 React.lazy 动态加载，首屏不载 three）
function Cloud({ points }: { points: Array<{ x: number; y: number; z: number; c: number }> }) {
  const ref = useRef<any>(null);
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.y += dt * 0.16; });
  const { positions, colors } = useMemo(() => {
    const xs = points.map((p) => p.x), ys = points.map((p) => p.y), zs = points.map((p) => p.z);
    const nrm = (v: number, a: number[]) => { const mn = Math.min(...a), mx = Math.max(...a); return ((v - mn) / ((mx - mn) || 1)) * 2 - 1; };
    const pal = [[0.2, 0.83, 0.6], [0.98, 0.75, 0.14], [0.4, 0.7, 1], [0.66, 0.33, 0.97], [0.94, 0.44, 0.44]];
    const pos = new Float32Array(points.length * 3), col = new Float32Array(points.length * 3);
    points.forEach((p, i) => { pos[i * 3] = nrm(p.x, xs); pos[i * 3 + 1] = nrm(p.y, ys); pos[i * 3 + 2] = nrm(p.z, zs); const c = pal[p.c % pal.length]; col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2]; });
    return { positions: pos, colors: col };
  }, [points]);
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.07} vertexColors sizeAttenuation transparent opacity={0.9} />
    </points>
  );
}
export default function Chart3D({ points }: { points: any[] }) {
  return (
    <Canvas camera={{ position: [2.6, 1.9, 2.6], fov: 50 }} gl={{ antialias: true }}>
      <ambientLight intensity={0.9} />
      <Cloud points={points} />
    </Canvas>
  );
}
