/*
 * Generated with img2threejs at commit 9614f1ac830bb3977b186ebf98af0f75796742ed.
 * Upstream: https://github.com/img2threejs/img2threejs (Apache-2.0).
 * Modified for Course_AIProduct: unbranded hydraulic inspection hierarchy,
 * browser performance budget, Chinese semantic node names and accessibility hooks.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type ProceduralModelOptions = {
  wireframe?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
  textureSize?: number;
  textureAnisotropy?: number;
  qualityPriority?: 'reference-fidelity' | 'balanced';
};

export type ProceduralModelRuntime = {
  nodes: Record<string, THREE.Object3D>;
  meshes: Record<string, THREE.Mesh>;
  sockets: Record<string, THREE.Object3D>;
  colliders: Record<string, unknown>;
  destructionGroups: Record<string, THREE.Object3D[]>;
};

type SculptMaterialSpec = Record<string, any>;

function buildTubeGeometry(
  path: { points: [number, number, number][]; radius?: number; radialSegments?: number; closed?: boolean },
): THREE.TubeGeometry {
  const vectors = path.points.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const curve = new THREE.CatmullRomCurve3(vectors, path.closed ?? false);
  const tubularSegments = Math.max(8, path.points.length * 6);
  return new THREE.TubeGeometry(curve, tubularSegments, path.radius ?? 0.05, path.radialSegments ?? 8, path.closed ?? false);
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function readLayerNumber(value: unknown, keys: string[], fallback: number): number {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of keys) {
      if (typeof record[key] === 'number') return record[key] as number;
    }
  }
  return fallback;
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = /^#[0-9a-f]{3}$/i.test(hex)
    ? '#' + hex.slice(1).split('').map((part) => part + part).join('')
    : hex;
  const value = /^#[0-9a-f]{6}$/i.test(normalized) ? Number.parseInt(normalized.slice(1), 16) : 0x8a7a5f;
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function materialPalette(spec: SculptMaterialSpec): string[] {
  const palette = spec.colorVariation?.palette;
  if (Array.isArray(palette) && palette.length > 0) return palette.filter((value) => typeof value === 'string');
  const secondary = spec.albedo?.secondary;
  const colors = [spec.baseColor ?? spec.color ?? spec.albedo?.dominant, ...(Array.isArray(secondary) ? secondary : [])];
  return colors.filter((value): value is string => typeof value === 'string' && value.startsWith('#'));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smoothCurve(value: number): number {
  return value * value * (3 - 2 * value);
}

function periodicHash(x: number, y: number, seed: number, periodX: number, periodY: number): number {
  const wrappedX = ((x % periodX) + periodX) % periodX;
  const wrappedY = ((y % periodY) + periodY) % periodY;
  let value = Math.imul(wrappedX + seed * 17, 374761393) ^ Math.imul(wrappedY + seed * 31, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function periodicValueNoise(u: number, v: number, seed: number, periodX: number, periodY: number): number {
  const x = u * periodX;
  const y = v * periodY;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smoothCurve(x - x0);
  const ty = smoothCurve(y - y0);
  const a = periodicHash(x0, y0, seed, periodX, periodY);
  const b = periodicHash(x0 + 1, y0, seed, periodX, periodY);
  const c = periodicHash(x0, y0 + 1, seed, periodX, periodY);
  const d = periodicHash(x0 + 1, y0 + 1, seed, periodX, periodY);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, tx), THREE.MathUtils.lerp(c, d, tx), ty);
}

type SurfaceBand = {
  frequency: number;
  amplitude: number;
  stretchX: number;
  stretchY: number;
  ridge: boolean;
};

function surfaceBands(spec: SculptMaterialSpec): SurfaceBand[] {
  const source = Array.isArray(spec.surfaceFrequencyBands) ? spec.surfaceFrequencyBands : [];
  const parsed = source.flatMap((item: unknown) => {
    if (!item || typeof item !== 'object') return [];
    const band = item as Record<string, unknown>;
    const frequency = typeof band.frequency === 'number' ? band.frequency : 0;
    const amplitude = typeof band.amplitude === 'number' ? band.amplitude : 0;
    if (frequency <= 0 || amplitude <= 0) return [];
    const stretch = Array.isArray(band.stretch) ? band.stretch : [1, 1];
    const description = `${String(band.pattern ?? '')} ${String(band.role ?? '')}`.toLowerCase();
    return [{
      frequency,
      amplitude,
      stretchX: typeof stretch[0] === 'number' ? Math.max(0.1, stretch[0]) : 1,
      stretchY: typeof stretch[1] === 'number' ? Math.max(0.1, stretch[1]) : 1,
      ridge: /(ridge|groove|grain|fiber|striated|crack)/.test(description),
    }];
  });
  return parsed.length > 0 ? parsed : [
    { frequency: 2, amplitude: 0.42, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 12, amplitude: 0.22, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 56, amplitude: 0.08, stretchX: 1, stretchY: 1, ridge: false },
  ];
}

function sampleSurface(u: number, v: number, bands: SurfaceBand[], seed: number): number {
  let value = 0;
  let weight = 0;
  for (let index = 0; index < bands.length; index += 1) {
    const band = bands[index];
    const periodX = Math.max(1, Math.round(band.frequency * band.stretchX));
    const periodY = Math.max(1, Math.round(band.frequency * band.stretchY));
    let sample = periodicValueNoise(u, v, seed + index * 1013, periodX, periodY);
    if (band.ridge) sample = 1 - Math.abs(sample * 2 - 1);
    value += sample * band.amplitude;
    weight += band.amplitude;
  }
  return weight > 0 ? clamp01(value / weight) : 0.5;
}

function mixPalette(colors: [number, number, number][], value: number): [number, number, number] {
  if (colors.length === 1) return colors[0];
  const scaled = clamp01(value) * (colors.length - 1);
  const index = Math.min(colors.length - 2, Math.floor(scaled));
  const mix = scaled - index;
  const a = colors[index];
  const b = colors[index + 1];
  return [
    Math.round(THREE.MathUtils.lerp(a[0], b[0], mix)),
    Math.round(THREE.MathUtils.lerp(a[1], b[1], mix)),
    Math.round(THREE.MathUtils.lerp(a[2], b[2], mix)),
  ];
}

type ColorGradientStop = { offset: number; color: string };
type ColorGradientSpec = {
  type: 'linear' | 'radial';
  axis: [number, number];
  stops: ColorGradientStop[];
};

function parseRgba(value: string): [number, number, number] {
  const match = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(value);
  if (!match) return [138, 122, 95];
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

// Analytical per-pixel gradient sample. The extraction schema's colorGradient carries
// exact rgba(...) stop colors (see extract_part_color_recipe.py), so this samples the
// same trend directly in JS math rather than round-tripping through a Canvas 2D
// createLinearGradient/createRadialGradient object — same visual result, and it composes
// directly with the existing noise/height-correlated colorVariation blend below.
function sampleColorGradient(gradient: ColorGradientSpec, u: number, v: number): [number, number, number] {
  const stops = gradient.stops.length >= 2 ? gradient.stops : [{ offset: 0, color: 'rgba(138,122,95,1)' }, { offset: 1, color: 'rgba(138,122,95,1)' }];
  let t: number;
  if (gradient.type === 'radial') {
    const [cx, cy] = gradient.axis;
    const dx = u - cx;
    const dy = v - cy;
    const maxRadius = Math.max(0.001, Math.hypot(Math.max(cx, 1 - cx), Math.max(cy, 1 - cy)));
    t = clamp01(Math.hypot(dx, dy) / maxRadius);
  } else {
    const [ax, ay] = gradient.axis;
    const projection = (u - 0.5) * ax + (v - 0.5) * ay;
    const maxProjection = 0.5 * (Math.abs(ax) + Math.abs(ay)) || 0.5;
    t = clamp01(projection / maxProjection + 0.5);
  }
  const scaled = t * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.max(0, Math.floor(scaled)));
  const mix = scaled - index;
  const a = parseRgba(stops[index].color);
  const b = parseRgba(stops[index + 1].color);
  return [
    THREE.MathUtils.lerp(a[0], b[0], mix),
    THREE.MathUtils.lerp(a[1], b[1], mix),
    THREE.MathUtils.lerp(a[2], b[2], mix),
  ];
}

function writePixel(data: Uint8ClampedArray, offset: number, red: number, green: number, blue: number): void {
  data[offset] = Math.max(0, Math.min(255, Math.round(red)));
  data[offset + 1] = Math.max(0, Math.min(255, Math.round(green)));
  data[offset + 2] = Math.max(0, Math.min(255, Math.round(blue)));
  data[offset + 3] = 255;
}

function makeCanvas(size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function createMapTexture(
  canvas: HTMLCanvasElement,
  colorSpace: THREE.ColorSpace,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  const projection = spec.textureProjection && typeof spec.textureProjection === 'object' ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [2, 2];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === 'number' ? repeat[0] : 2,
    typeof repeat[1] === 'number' ? repeat[1] : 2,
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}

type ProceduralTextureSet = {
  albedo: THREE.Texture;
  roughness: THREE.Texture;
  height: THREE.Texture;
  normal: THREE.Texture;
  ao: THREE.Texture;
  source: 'reference-pixel-extraction' | 'procedural';
};

function referenceMapUrl(spec: SculptMaterialSpec, channel: string): string | null {
  const reference = spec.referencePbr;
  if (!reference || typeof reference !== 'object') return null;
  if (reference.usable === false) return null;
  const confidence = typeof reference.confidence === 'number'
    ? reference.confidence
    : (typeof reference.estimatedFidelity === 'number' ? reference.estimatedFidelity : 0);
  const threshold = typeof reference.targetThreshold === 'number' ? reference.targetThreshold : 0.7;
  if (confidence < threshold) return null;
  const maps = reference.maps;
  if (!maps || typeof maps !== 'object') return null;
  const map = (maps as Record<string, unknown>)[channel];
  if (!map || typeof map !== 'object') return null;
  const record = map as Record<string, unknown>;
  const url = typeof record.url === 'string' && record.url.trim() ? record.url : record.path;
  return typeof url === 'string' && url.trim() ? url : null;
}

function createLoadedMapTexture(
  url: string,
  colorSpace: THREE.ColorSpace,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): THREE.Texture {
  const texture = new THREE.TextureLoader().load(url);
  const projection = spec.textureProjection && typeof spec.textureProjection === 'object' ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [1, 1];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === 'number' ? repeat[0] : 1,
    typeof repeat[1] === 'number' ? repeat[1] : 1,
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}

function makeReferenceTextureSet(spec: SculptMaterialSpec, options: ProceduralModelOptions): ProceduralTextureSet | null {
  const albedo = referenceMapUrl(spec, 'albedo');
  const roughness = referenceMapUrl(spec, 'roughness');
  const height = referenceMapUrl(spec, 'height');
  const normal = referenceMapUrl(spec, 'normal');
  const ao = referenceMapUrl(spec, 'ao');
  if (!albedo || !roughness || !height || !normal || !ao) return null;
  return {
    albedo: createLoadedMapTexture(albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createLoadedMapTexture(roughness, THREE.NoColorSpace, spec, options),
    height: createLoadedMapTexture(height, THREE.NoColorSpace, spec, options),
    normal: createLoadedMapTexture(normal, THREE.NoColorSpace, spec, options),
    ao: createLoadedMapTexture(ao, THREE.NoColorSpace, spec, options),
    source: 'reference-pixel-extraction',
  };
}

function makeProceduralTextureSet(
  id: string,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): ProceduralTextureSet | null {
  if (typeof document === 'undefined') return null;
  const qualityFirst = (options.qualityPriority ?? 'reference-fidelity') === 'reference-fidelity';
  const requested = options.textureSize ?? spec.textureResolution;
  const requestedSize = typeof requested === 'number' && Number.isFinite(requested)
    ? requested
    : (qualityFirst ? 1024 : 512);
  const size = Math.max(256, Math.min(2048, 2 ** Math.round(Math.log2(requestedSize))));
  const canvases = {
    albedo: makeCanvas(size),
    roughness: makeCanvas(size),
    height: makeCanvas(size),
    normal: makeCanvas(size),
    ao: makeCanvas(size),
  };
  const contexts = {
    albedo: canvases.albedo.getContext('2d'),
    roughness: canvases.roughness.getContext('2d'),
    height: canvases.height.getContext('2d'),
    normal: canvases.normal.getContext('2d'),
    ao: canvases.ao.getContext('2d'),
  };
  if (!contexts.albedo || !contexts.roughness || !contexts.height || !contexts.normal || !contexts.ao) return null;
  const images = {
    albedo: contexts.albedo.createImageData(size, size),
    roughness: contexts.roughness.createImageData(size, size),
    height: contexts.height.createImageData(size, size),
    normal: contexts.normal.createImageData(size, size),
    ao: contexts.ao.createImageData(size, size),
  };
  const seed = hashString(id);
  const bands = surfaceBands(spec);
  const heightField = new Float32Array(size * size);
  const roughnessField = new Float32Array(size * size);
  const palette = materialPalette(spec);
  const fallback = typeof spec.baseColor === 'string' ? spec.baseColor : '#8A7A5F';
  const colors = (palette.length >= 2 ? palette : [fallback, '#6E614B', '#A08F70']).map(hexToRgb);
  const baseRoughness = clamp01(readLayerNumber(spec.roughness, ['base'], 0.76));
  const roughnessVariation = clamp01(readLayerNumber(spec.roughness, ['variation'], 0.18));
  const colorAmplitude = clamp01(readLayerNumber(spec.colorVariation, ['amplitude', 'variation'], 0.18));
  const heightCorrelation = clamp01(readLayerNumber(spec.colorVariation, ['heightCorrelation'], 0.3));
  const colorGradient: ColorGradientSpec | undefined = spec.colorGradient;
  for (let y = 0; y < size; y += 1) {
    const v = y / size;
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const index = y * size + x;
      const height = sampleSurface(u, v, bands, seed + 101);
      const roughNoise = sampleSurface(u, v, bands, seed + 7001);
      const colorNoise = sampleSurface(u, v, bands, seed + 15013);
      heightField[index] = height;
      roughnessField[index] = clamp01(baseRoughness + (roughNoise - 0.5) * roughnessVariation * 2);
      let color: [number, number, number];
      if (colorGradient) {
        // Evidence-derived spatial gradient (Plan 1.3 Workstream C) takes priority
        // over the noise-based palette blend below — it is a measured trend, not a guess.
        color = sampleColorGradient(colorGradient, u, v);
      } else {
        const paletteValue = clamp01(
          0.5 + (colorNoise - 0.5) * colorAmplitude * 2 + (height - 0.5) * heightCorrelation
        );
        color = mixPalette(colors, paletteValue);
      }
      writePixel(images.albedo.data, index * 4, color[0], color[1], color[2]);
    }
  }
  const normalStrength = Math.max(0.05, readLayerNumber(spec.normal, ['strength', 'amplitude'], 0.35));
  const aoStrength = clamp01(readLayerNumber(spec.ambientOcclusion, ['cavityStrength', 'strength'], 0.35));
  for (let y = 0; y < size; y += 1) {
    const up = ((y - 1 + size) % size) * size;
    const down = ((y + 1) % size) * size;
    for (let x = 0; x < size; x += 1) {
      const left = (x - 1 + size) % size;
      const right = (x + 1) % size;
      const index = y * size + x;
      const center = heightField[index];
      const dx = (heightField[y * size + right] - heightField[y * size + left]) * normalStrength * 6;
      const dy = (heightField[down + x] - heightField[up + x]) * normalStrength * 6;
      const inverseLength = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const normalX = -dx * inverseLength;
      const normalY = -dy * inverseLength;
      const normalZ = inverseLength;
      const neighborAverage = (
        heightField[y * size + left] + heightField[y * size + right]
        + heightField[up + x] + heightField[down + x]
      ) * 0.25;
      const cavity = Math.max(0, neighborAverage - center);
      const ao = clamp01(1 - aoStrength * (cavity * 12 + (1 - center) * 0.16));
      const offset = index * 4;
      const heightByte = center * 255;
      const roughnessByte = roughnessField[index] * 255;
      writePixel(images.height.data, offset, heightByte, heightByte, heightByte);
      writePixel(images.roughness.data, offset, roughnessByte, roughnessByte, roughnessByte);
      writePixel(
        images.normal.data, offset,
        (normalX * 0.5 + 0.5) * 255,
        (normalY * 0.5 + 0.5) * 255,
        (normalZ * 0.5 + 0.5) * 255,
      );
      writePixel(images.ao.data, offset, ao * 255, ao * 255, ao * 255);
    }
  }
  contexts.albedo.putImageData(images.albedo, 0, 0);
  contexts.roughness.putImageData(images.roughness, 0, 0);
  contexts.height.putImageData(images.height, 0, 0);
  contexts.normal.putImageData(images.normal, 0, 0);
  contexts.ao.putImageData(images.ao, 0, 0);
  return {
    albedo: createMapTexture(canvases.albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createMapTexture(canvases.roughness, THREE.NoColorSpace, spec, options),
    height: createMapTexture(canvases.height, THREE.NoColorSpace, spec, options),
    normal: createMapTexture(canvases.normal, THREE.NoColorSpace, spec, options),
    ao: createMapTexture(canvases.ao, THREE.NoColorSpace, spec, options),
    source: 'procedural',
  };
}

function createSculptMaterial(id: string, spec: SculptMaterialSpec, options: ProceduralModelOptions): THREE.MeshPhysicalMaterial {
  const textures = makeReferenceTextureSet(spec, options) ?? makeProceduralTextureSet(id, spec, options);
  const material = new THREE.MeshPhysicalMaterial({
    color: textures ? 0xffffff : new THREE.Color(typeof spec.baseColor === 'string' ? spec.baseColor : '#8A7A5F'),
    roughness: textures ? 1 : clamp01(readLayerNumber(spec.roughness, ['base'], 0.76)),
    metalness: clamp01(readLayerNumber(spec.metalness, ['base'], 0.0)),
    clearcoat: clamp01(readLayerNumber(spec.clearcoat, ['base', 'amount'], 0)),
    clearcoatRoughness: clamp01(readLayerNumber(spec.clearcoatRoughness, ['base'], 0.25)),
    transmission: clamp01(readLayerNumber(spec.transmission, ['base', 'amount'], 0)),
    ior: Math.max(1, readLayerNumber(spec.ior, ['base', 'value'], 1.5)),
    thickness: Math.max(0, readLayerNumber(spec.thickness, ['base', 'amount'], 0)),
    attenuationDistance: Math.max(0.001, readLayerNumber(spec.attenuationDistance, ['base', 'value'], Infinity)),
    attenuationColor: new THREE.Color(typeof spec.attenuationColor === 'string' ? spec.attenuationColor : '#ffffff'),
    sheen: clamp01(readLayerNumber(spec.sheen, ['base', 'amount'], 0)),
    sheenColor: new THREE.Color(typeof spec.sheenColor === 'string' ? spec.sheenColor : '#ffffff'),
    sheenRoughness: clamp01(readLayerNumber(spec.sheenRoughness, ['base'], 1.0)),
    iridescence: clamp01(readLayerNumber(spec.iridescence, ['base', 'amount'], 0)),
    iridescenceIOR: Math.max(1, readLayerNumber(spec.iridescenceIOR, ['base', 'value'], 1.3)),
    anisotropy: clamp01(readLayerNumber(spec.anisotropy, ['base', 'amount'], 0)),
    anisotropyRotation: readLayerNumber(spec.anisotropy, ['rotation'], 0),
    specularIntensity: clamp01(readLayerNumber(spec.specularIntensity, ['base'], 1.0)),
    specularColor: new THREE.Color(typeof spec.specularColor === 'string' ? spec.specularColor : '#ffffff'),
    emissive: new THREE.Color(typeof spec.emissive === 'string' ? spec.emissive : '#000000'),
    emissiveIntensity: Math.max(0, readLayerNumber(spec.emissiveIntensity, ['base'], 1.0)),
    opacity: clamp01(readLayerNumber(spec.opacity, ['base'], 1)),
    transparent: readLayerNumber(spec.transmission, ['base', 'amount'], 0) > 0 || readLayerNumber(spec.opacity, ['base'], 1) < 1,
    alphaTest: Math.max(0, readLayerNumber(spec.alpha, ['cutoff', 'alphaTest'], 0)),
    wireframe: options.wireframe ?? false,
    side: spec.doubleSided === true ? THREE.DoubleSide : THREE.FrontSide,
  });
  if (textures) {
    material.map = textures.albedo;
    material.roughnessMap = textures.roughness;
    material.normalMap = textures.normal;
    material.normalScale.setScalar(Math.max(0.05, readLayerNumber(spec.normal, ['strength', 'amplitude'], 0.35)));
    material.aoMap = textures.ao;
    material.aoMap.channel = 0;
    material.aoMapIntensity = readLayerNumber(spec.ambientOcclusion, ['cavityStrength', 'strength'], 0.35);
    const bumpScale = Math.max(0, readLayerNumber(spec.bump, ['amplitude', 'strength'], 0));
    if (bumpScale > 0) {
      material.bumpMap = textures.height;
      material.bumpScale = bumpScale;
    }
    const displacementScale = Math.max(0, readLayerNumber(spec.displacement, ['amplitude', 'strength'], 0));
    if (displacementScale > 0) {
      material.displacementMap = textures.height;
      material.displacementScale = displacementScale;
      material.displacementBias = -displacementScale * 0.5;
    }
  }
  material.envMapIntensity = readLayerNumber(spec, ['envMapIntensity'], 0.8);
  material.userData.sculptMaterial = spec;
  material.userData.proceduralMapsIndependent = true;
  material.userData.pbrTextureSource = textures?.source ?? 'flat-fallback';
  material.userData.referencePbr = spec.referencePbr ?? null;
  material.needsUpdate = true;
  return material;
}

type AttachmentEndpoint = {
  start: THREE.Vector3;
  midpoint: THREE.Vector3;
  quaternion: THREE.Quaternion;
  length: number;
  baseRadius: number;
  endRadius: number;
};

function readVector3(value: unknown, fallback: [number, number, number]): THREE.Vector3 {
  if (Array.isArray(value) && value.length === 3 && value.every((item) => typeof item === 'number')) {
    return new THREE.Vector3(value[0], value[1], value[2]);
  }
  return new THREE.Vector3(fallback[0], fallback[1], fallback[2]);
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function makeAttachmentEndpoint(attachment: unknown): AttachmentEndpoint | null {
  if (!attachment || typeof attachment !== 'object') return null;
  const record = attachment as Record<string, unknown>;
  const start = readVector3(record.localStart, [0, 0, 0]);
  const end = readVector3(record.localEnd, [0, 1, 0]);
  const delta = end.clone().sub(start);
  const length = delta.length();
  if (length <= 0.0001) return null;
  const direction = delta.clone().normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  const baseRadius = Math.max(0.005, readNumber(record.baseRadius, 0.06));
  const endRadius = Math.max(0.003, readNumber(record.endRadius, baseRadius * 0.55));
  return {
    start,
    midpoint: delta.multiplyScalar(0.5),
    quaternion,
    length,
    baseRadius,
    endRadius,
  };
}

// Generated from ObjectSculptSpec target: Hydraulic Power Unit
// Sculpt build pass: blockout
// This factory is intentionally pass-gated. Finish browser screenshot review before unlocking deeper passes.
export function createHydraulicPowerUnitModel(options: ProceduralModelOptions = {}): THREE.Group {
  const root = new THREE.Group();
  root.name = "Hydraulic Power Unit";
  root.userData.reconstructionEvidence = {"itemFamily": "industrial-hydraulic-power-unit", "subtype": "unbranded-browser-inspection-locator", "componentAdapter": null, "route": "img2threejs-object-sculpt-spec-to-threejs-factory", "exactnessTier": "approximate-diagnostic-locator", "referenceCamera": {"solved": false, "fovDegrees": 40, "aspect": 1, "orientation": {"yaw": 0, "pitch": 0, "roll": 0}, "positionHint": [0, 0, 3], "note": "For likeness work, solve the reference camera (forge/stage1_intake/solve_camera_pose.py) so the review render aligns with the photo and the reference can be projected. Confirm by overlay review."}, "approximationNotes": ["Single-view ImageGen reference cannot determine hidden hose routing or exact dimensions.", "The model supports visual part selection only and must not be used for maintenance measurements or safety control."]};

  const materialMap: Record<string, THREE.Material> = {};
  materialMap["container"] = createSculptMaterial(
    "container",
    {"id": "container", "name": "Invisible semantic root", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#0b1724", "color": "#0b1724", "albedo": {"dominant": "#0b1724", "secondary": [], "samplingNotes": "Color is matched to the unbranded ImageGen reference; it is not a manufacturer finish code."}, "colorVariation": {"palette": ["#0b1724"], "pattern": "uniform", "amplitude": 0.015, "heightCorrelation": 0}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [2, 2], "anisotropy": 8, "texelDensityIntent": "Preserve stable world/object-scale detail; do not stretch micro detail with component scale."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2, "amplitude": 0.42, "role": "broad color and height breakup"}, {"id": "meso", "frequency": 12, "amplitude": 0.22, "role": "ridges, pores, grain, dents, or equivalent visible relief"}, {"id": "micro", "frequency": 56, "amplitude": 0.08, "role": "highlight breakup visible under grazing light"}], "roughness": {"base": 1, "variation": 0.04, "map": "independent-procedural-field", "localResponse": "subtle workshop wear"}, "metalness": {"base": 0, "variation": 0.03}, "normal": {"pattern": "fine-coated-metal", "strength": 0.08, "scale": 48, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0, "scale": 1}, "displacement": {"pattern": "none", "amplitude": 0, "scale": 1, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.36, "contactShadowBias": 0.3, "notes": "contact and joint readability"}, "wear": {"edgeWear": 0, "scratches": [], "chips": []}, "dirt": {"amount": 0, "cavityBias": 0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "opacity": {"base": 0}},
    options
  );
  materialMap["painted-blue"] = createSculptMaterial(
    "painted-blue",
    {"id": "painted-blue", "name": "Blue powder-coated steel", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#0876d1", "color": "#0876d1", "albedo": {"dominant": "#0876d1", "secondary": [], "samplingNotes": "Color is matched to the unbranded ImageGen reference; it is not a manufacturer finish code."}, "colorVariation": {"palette": ["#0876d1"], "pattern": "uniform", "amplitude": 0.015, "heightCorrelation": 0}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [2, 2], "anisotropy": 8, "texelDensityIntent": "Preserve stable world/object-scale detail; do not stretch micro detail with component scale."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2, "amplitude": 0.42, "role": "broad color and height breakup"}, {"id": "meso", "frequency": 12, "amplitude": 0.22, "role": "ridges, pores, grain, dents, or equivalent visible relief"}, {"id": "micro", "frequency": 56, "amplitude": 0.08, "role": "highlight breakup visible under grazing light"}], "roughness": {"base": 0.34, "variation": 0.04, "map": "independent-procedural-field", "localResponse": "subtle workshop wear"}, "metalness": {"base": 0.58, "variation": 0.03}, "normal": {"pattern": "fine-coated-metal", "strength": 0.08, "scale": 48, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0, "scale": 1}, "displacement": {"pattern": "none", "amplitude": 0, "scale": 1, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.36, "contactShadowBias": 0.3, "notes": "contact and joint readability"}, "wear": {"edgeWear": 0, "scratches": [], "chips": []}, "dirt": {"amount": 0, "cavityBias": 0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "opacity": {"base": 1}, "clearcoat": {"base": 0.18}},
    options
  );
  materialMap["steel"] = createSculptMaterial(
    "steel",
    {"id": "steel", "name": "Brushed service metal", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#a9b8c5", "color": "#a9b8c5", "albedo": {"dominant": "#a9b8c5", "secondary": [], "samplingNotes": "Color is matched to the unbranded ImageGen reference; it is not a manufacturer finish code."}, "colorVariation": {"palette": ["#a9b8c5"], "pattern": "uniform", "amplitude": 0.015, "heightCorrelation": 0}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [2, 2], "anisotropy": 8, "texelDensityIntent": "Preserve stable world/object-scale detail; do not stretch micro detail with component scale."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2, "amplitude": 0.42, "role": "broad color and height breakup"}, {"id": "meso", "frequency": 12, "amplitude": 0.22, "role": "ridges, pores, grain, dents, or equivalent visible relief"}, {"id": "micro", "frequency": 56, "amplitude": 0.08, "role": "highlight breakup visible under grazing light"}], "roughness": {"base": 0.28, "variation": 0.04, "map": "independent-procedural-field", "localResponse": "subtle workshop wear"}, "metalness": {"base": 0.9, "variation": 0.03}, "normal": {"pattern": "fine-coated-metal", "strength": 0.08, "scale": 48, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0, "scale": 1}, "displacement": {"pattern": "none", "amplitude": 0, "scale": 1, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.36, "contactShadowBias": 0.3, "notes": "contact and joint readability"}, "wear": {"edgeWear": 0, "scratches": [], "chips": []}, "dirt": {"amount": 0, "cavityBias": 0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "opacity": {"base": 1}},
    options
  );
  materialMap["dark-metal"] = createSculptMaterial(
    "dark-metal",
    {"id": "dark-metal", "name": "Dark motor and frame metal", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#152635", "color": "#152635", "albedo": {"dominant": "#152635", "secondary": [], "samplingNotes": "Color is matched to the unbranded ImageGen reference; it is not a manufacturer finish code."}, "colorVariation": {"palette": ["#152635"], "pattern": "uniform", "amplitude": 0.015, "heightCorrelation": 0}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [2, 2], "anisotropy": 8, "texelDensityIntent": "Preserve stable world/object-scale detail; do not stretch micro detail with component scale."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2, "amplitude": 0.42, "role": "broad color and height breakup"}, {"id": "meso", "frequency": 12, "amplitude": 0.22, "role": "ridges, pores, grain, dents, or equivalent visible relief"}, {"id": "micro", "frequency": 56, "amplitude": 0.08, "role": "highlight breakup visible under grazing light"}], "roughness": {"base": 0.42, "variation": 0.04, "map": "independent-procedural-field", "localResponse": "subtle workshop wear"}, "metalness": {"base": 0.72, "variation": 0.03}, "normal": {"pattern": "fine-coated-metal", "strength": 0.08, "scale": 48, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0, "scale": 1}, "displacement": {"pattern": "none", "amplitude": 0, "scale": 1, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.36, "contactShadowBias": 0.3, "notes": "contact and joint readability"}, "wear": {"edgeWear": 0, "scratches": [], "chips": []}, "dirt": {"amount": 0, "cavityBias": 0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "opacity": {"base": 1}},
    options
  );
  materialMap["rubber"] = createSculptMaterial(
    "rubber",
    {"id": "rubber", "name": "Rubber hose", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#111820", "color": "#111820", "albedo": {"dominant": "#111820", "secondary": [], "samplingNotes": "Color is matched to the unbranded ImageGen reference; it is not a manufacturer finish code."}, "colorVariation": {"palette": ["#111820"], "pattern": "uniform", "amplitude": 0.015, "heightCorrelation": 0}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [2, 2], "anisotropy": 8, "texelDensityIntent": "Preserve stable world/object-scale detail; do not stretch micro detail with component scale."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2, "amplitude": 0.42, "role": "broad color and height breakup"}, {"id": "meso", "frequency": 12, "amplitude": 0.22, "role": "ridges, pores, grain, dents, or equivalent visible relief"}, {"id": "micro", "frequency": 56, "amplitude": 0.08, "role": "highlight breakup visible under grazing light"}], "roughness": {"base": 0.78, "variation": 0.04, "map": "independent-procedural-field", "localResponse": "subtle workshop wear"}, "metalness": {"base": 0.02, "variation": 0.03}, "normal": {"pattern": "fine-coated-metal", "strength": 0.08, "scale": 48, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0, "scale": 1}, "displacement": {"pattern": "none", "amplitude": 0, "scale": 1, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.36, "contactShadowBias": 0.3, "notes": "contact and joint readability"}, "wear": {"edgeWear": 0, "scratches": [], "chips": []}, "dirt": {"amount": 0, "cavityBias": 0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "opacity": {"base": 1}},
    options
  );
  materialMap["warning"] = createSculptMaterial(
    "warning",
    {"id": "warning", "name": "Inspection accent", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#f2b536", "color": "#f2b536", "albedo": {"dominant": "#f2b536", "secondary": [], "samplingNotes": "Color is matched to the unbranded ImageGen reference; it is not a manufacturer finish code."}, "colorVariation": {"palette": ["#f2b536"], "pattern": "uniform", "amplitude": 0.015, "heightCorrelation": 0}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [2, 2], "anisotropy": 8, "texelDensityIntent": "Preserve stable world/object-scale detail; do not stretch micro detail with component scale."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2, "amplitude": 0.42, "role": "broad color and height breakup"}, {"id": "meso", "frequency": 12, "amplitude": 0.22, "role": "ridges, pores, grain, dents, or equivalent visible relief"}, {"id": "micro", "frequency": 56, "amplitude": 0.08, "role": "highlight breakup visible under grazing light"}], "roughness": {"base": 0.36, "variation": 0.04, "map": "independent-procedural-field", "localResponse": "subtle workshop wear"}, "metalness": {"base": 0.38, "variation": 0.03}, "normal": {"pattern": "fine-coated-metal", "strength": 0.08, "scale": 48, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0, "scale": 1}, "displacement": {"pattern": "none", "amplitude": 0, "scale": 1, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.36, "contactShadowBias": 0.3, "notes": "contact and joint readability"}, "wear": {"edgeWear": 0, "scratches": [], "chips": []}, "dirt": {"amount": 0, "cavityBias": 0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "opacity": {"base": 1}, "emissive": "#6c4200", "emissiveIntensity": {"base": 0.12}},
    options
  );

  const nodes: Record<string, THREE.Object3D> = { root };
  const meshes: Record<string, THREE.Mesh> = {};
  const sockets: Record<string, THREE.Object3D> = {};
  const colliders: Record<string, unknown> = {};
  const destructionGroups: Record<string, THREE.Object3D[]> = {};

  const attachment_root_0 = null;
  const endpoint_root_0 = makeAttachmentEndpoint(attachment_root_0);
  const node_root_0 = new THREE.Group();
  node_root_0.name = "Hydraulic Power Unit Root__pivot";
  if (endpoint_root_0) {
    node_root_0.position.copy(endpoint_root_0.start);
    node_root_0.rotation.set(0, 0, 0);
    node_root_0.scale.set(1, 1, 1);
  } else {
    node_root_0.position.set(0.0, 0.0, 0.0);
    node_root_0.rotation.set(0.0, 0.0, 0.0);
    node_root_0.scale.set(1.0, 1.0, 1.0);
  }
  node_root_0.userData.sculptComponent = {"id": "root", "name": "Hydraulic Power Unit Root", "level": "macro", "role": "root", "importance": 1, "confidence": 0.82, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Procedural browser locator built from observable hard-surface primitives; hidden structure remains approximate.", "geometryDescriptor": {"topologyIntent": "browser diagnostic locator with stable selectable hierarchy", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.025, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.76}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "inspection pick proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "container"}}, "material": "container", "materialLayers": ["container"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout"};
  node_root_0.userData.actionProfile = {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "inspection pick proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "container"}};
  (nodes["root"] ?? root).add(node_root_0);
  nodes["root"] = node_root_0;
  const mesh_root_0Geometry = endpoint_root_0
    ? new THREE.CylinderGeometry(endpoint_root_0.endRadius, endpoint_root_0.baseRadius, endpoint_root_0.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_root_0 = new THREE.Mesh(
    mesh_root_0Geometry,
    materialMap["container"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_root_0.name = "Hydraulic Power Unit Root";
  if (endpoint_root_0) {
    mesh_root_0.position.copy(endpoint_root_0.midpoint);
    mesh_root_0.quaternion.copy(endpoint_root_0.quaternion);
  }
  mesh_root_0.castShadow = options.castShadow ?? true;
  mesh_root_0.receiveShadow = options.receiveShadow ?? true;
  mesh_root_0.userData.sculptComponent = {"id": "root", "name": "Hydraulic Power Unit Root", "level": "macro", "role": "root", "importance": 1, "confidence": 0.82, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Procedural browser locator built from observable hard-surface primitives; hidden structure remains approximate.", "geometryDescriptor": {"topologyIntent": "browser diagnostic locator with stable selectable hierarchy", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.025, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.76}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "inspection pick proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "container"}}, "material": "container", "materialLayers": ["container"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout"};
  node_root_0.add(mesh_root_0);
  meshes["root"] = mesh_root_0;
  colliders["root"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "inspection pick proxy"};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_root_0);

  const attachment_skid_base_1 = null;
  const endpoint_skid_base_1 = makeAttachmentEndpoint(attachment_skid_base_1);
  const node_skid_base_1 = new THREE.Group();
  node_skid_base_1.name = "\u6ed1\u64ac\u5e95\u5ea7__pivot";
  if (endpoint_skid_base_1) {
    node_skid_base_1.position.copy(endpoint_skid_base_1.start);
    node_skid_base_1.rotation.set(0, 0, 0);
    node_skid_base_1.scale.set(1, 1, 1);
  } else {
    node_skid_base_1.position.set(0.0, -1.42, 0.0);
    node_skid_base_1.rotation.set(0.0, 0.0, 0.0);
    node_skid_base_1.scale.set(6.1, 0.22, 3.15);
  }
  node_skid_base_1.userData.sculptComponent = {"id": "skid-base", "name": "滑撬底座", "level": "macro", "role": "support", "importance": 0.8, "confidence": 0.82, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Procedural browser locator built from observable hard-surface primitives; hidden structure remains approximate.", "geometryDescriptor": {"topologyIntent": "browser diagnostic locator with stable selectable hierarchy", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.025, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 6.1, "height": 0.22, "depth": 3.15, "units": "relative", "confidence": 0.76}, "transform": {"position": [0, -1.42, 0], "rotation": [0, 0, 0], "scale": [6.1, 0.22, 3.15]}, "actionProfile": {"animationRole": "support", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [6.1, 0.22, 3.15], "isTrigger": false, "notes": "inspection pick proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "skid-base", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "painted-blue"}}, "material": "painted-blue", "materialLayers": ["painted-blue"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout"};
  node_skid_base_1.userData.actionProfile = {"animationRole": "support", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [6.1, 0.22, 3.15], "isTrigger": false, "notes": "inspection pick proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "skid-base", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "painted-blue"}};
  (nodes["root"] ?? root).add(node_skid_base_1);
  nodes["skid-base"] = node_skid_base_1;
  const mesh_skid_base_1Geometry = endpoint_skid_base_1
    ? new THREE.CylinderGeometry(endpoint_skid_base_1.endRadius, endpoint_skid_base_1.baseRadius, endpoint_skid_base_1.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_skid_base_1 = new THREE.Mesh(
    mesh_skid_base_1Geometry,
    materialMap["painted-blue"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_skid_base_1.name = "\u6ed1\u64ac\u5e95\u5ea7";
  if (endpoint_skid_base_1) {
    mesh_skid_base_1.position.copy(endpoint_skid_base_1.midpoint);
    mesh_skid_base_1.quaternion.copy(endpoint_skid_base_1.quaternion);
  }
  mesh_skid_base_1.castShadow = options.castShadow ?? true;
  mesh_skid_base_1.receiveShadow = options.receiveShadow ?? true;
  mesh_skid_base_1.userData.sculptComponent = {"id": "skid-base", "name": "滑撬底座", "level": "macro", "role": "support", "importance": 0.8, "confidence": 0.82, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Procedural browser locator built from observable hard-surface primitives; hidden structure remains approximate.", "geometryDescriptor": {"topologyIntent": "browser diagnostic locator with stable selectable hierarchy", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.025, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 6.1, "height": 0.22, "depth": 3.15, "units": "relative", "confidence": 0.76}, "transform": {"position": [0, -1.42, 0], "rotation": [0, 0, 0], "scale": [6.1, 0.22, 3.15]}, "actionProfile": {"animationRole": "support", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [6.1, 0.22, 3.15], "isTrigger": false, "notes": "inspection pick proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "skid-base", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "painted-blue"}}, "material": "painted-blue", "materialLayers": ["painted-blue"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout"};
  node_skid_base_1.add(mesh_skid_base_1);
  meshes["skid-base"] = mesh_skid_base_1;
  colliders["skid-base"] = {"type": "box", "offset": [0, 0, 0], "scale": [6.1, 0.22, 3.15], "isTrigger": false, "notes": "inspection pick proxy"};
  destructionGroups["skid-base"] ??= [];
  destructionGroups["skid-base"].push(node_skid_base_1);

  const attachment_oil_tank_2 = null;
  const endpoint_oil_tank_2 = makeAttachmentEndpoint(attachment_oil_tank_2);
  const node_oil_tank_2 = new THREE.Group();
  node_oil_tank_2.name = "\u6cb9\u7bb1__pivot";
  if (endpoint_oil_tank_2) {
    node_oil_tank_2.position.copy(endpoint_oil_tank_2.start);
    node_oil_tank_2.rotation.set(0, 0, 0);
    node_oil_tank_2.scale.set(1, 1, 1);
  } else {
    node_oil_tank_2.position.set(0.65, -0.72, 0.1);
    node_oil_tank_2.rotation.set(0.0, 0.0, 0.0);
    node_oil_tank_2.scale.set(3.25, 1.18, 1.95);
  }
  node_oil_tank_2.userData.sculptComponent = {"id": "oil-tank", "name": "油箱", "level": "macro", "role": "tank", "importance": 0.8, "confidence": 0.82, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Procedural browser locator built from observable hard-surface primitives; hidden structure remains approximate.", "geometryDescriptor": {"topologyIntent": "browser diagnostic locator with stable selectable hierarchy", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.025, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 3.25, "height": 1.18, "depth": 1.95, "units": "relative", "confidence": 0.76}, "transform": {"position": [0.65, -0.72, 0.1], "rotation": [0, 0, 0], "scale": [3.25, 1.18, 1.95]}, "actionProfile": {"animationRole": "tank", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [3.25, 1.18, 1.95], "isTrigger": false, "notes": "inspection pick proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "oil-tank", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "painted-blue"}}, "material": "painted-blue", "materialLayers": ["painted-blue"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout"};
  node_oil_tank_2.userData.actionProfile = {"animationRole": "tank", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [3.25, 1.18, 1.95], "isTrigger": false, "notes": "inspection pick proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "oil-tank", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "painted-blue"}};
  (nodes["root"] ?? root).add(node_oil_tank_2);
  nodes["oil-tank"] = node_oil_tank_2;
  const mesh_oil_tank_2Geometry = endpoint_oil_tank_2
    ? new THREE.CylinderGeometry(endpoint_oil_tank_2.endRadius, endpoint_oil_tank_2.baseRadius, endpoint_oil_tank_2.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_oil_tank_2 = new THREE.Mesh(
    mesh_oil_tank_2Geometry,
    materialMap["painted-blue"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_oil_tank_2.name = "\u6cb9\u7bb1";
  if (endpoint_oil_tank_2) {
    mesh_oil_tank_2.position.copy(endpoint_oil_tank_2.midpoint);
    mesh_oil_tank_2.quaternion.copy(endpoint_oil_tank_2.quaternion);
  }
  mesh_oil_tank_2.castShadow = options.castShadow ?? true;
  mesh_oil_tank_2.receiveShadow = options.receiveShadow ?? true;
  mesh_oil_tank_2.userData.sculptComponent = {"id": "oil-tank", "name": "油箱", "level": "macro", "role": "tank", "importance": 0.8, "confidence": 0.82, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Procedural browser locator built from observable hard-surface primitives; hidden structure remains approximate.", "geometryDescriptor": {"topologyIntent": "browser diagnostic locator with stable selectable hierarchy", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.025, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 3.25, "height": 1.18, "depth": 1.95, "units": "relative", "confidence": 0.76}, "transform": {"position": [0.65, -0.72, 0.1], "rotation": [0, 0, 0], "scale": [3.25, 1.18, 1.95]}, "actionProfile": {"animationRole": "tank", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [3.25, 1.18, 1.95], "isTrigger": false, "notes": "inspection pick proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "oil-tank", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "painted-blue"}}, "material": "painted-blue", "materialLayers": ["painted-blue"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout"};
  node_oil_tank_2.add(mesh_oil_tank_2);
  meshes["oil-tank"] = mesh_oil_tank_2;
  colliders["oil-tank"] = {"type": "box", "offset": [0, 0, 0], "scale": [3.25, 1.18, 1.95], "isTrigger": false, "notes": "inspection pick proxy"};
  destructionGroups["oil-tank"] ??= [];
  destructionGroups["oil-tank"].push(node_oil_tank_2);

  const attachment_motor_3 = null;
  const endpoint_motor_3 = makeAttachmentEndpoint(attachment_motor_3);
  const node_motor_3 = new THREE.Group();
  node_motor_3.name = "\u9a71\u52a8\u7535\u673a__pivot";
  if (endpoint_motor_3) {
    node_motor_3.position.copy(endpoint_motor_3.start);
    node_motor_3.rotation.set(0, 0, 0);
    node_motor_3.scale.set(1, 1, 1);
  } else {
    node_motor_3.position.set(-2.1, -0.66, 0.2);
    node_motor_3.rotation.set(0.0, 0.0, 1.5707963267948966);
    node_motor_3.scale.set(1.02, 1.7, 1.02);
  }
  node_motor_3.userData.sculptComponent = {"id": "motor", "name": "驱动电机", "level": "macro", "role": "motor", "importance": 0.8, "confidence": 0.82, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Procedural browser locator built from observable hard-surface primitives; hidden structure remains approximate.", "geometryDescriptor": {"topologyIntent": "browser diagnostic locator with stable selectable hierarchy", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.025, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 1.02, "height": 1.7, "depth": 1.02, "units": "relative", "confidence": 0.76}, "transform": {"position": [-2.1, -0.66, 0.2], "rotation": [0, 0, 1.5707963267948966], "scale": [1.02, 1.7, 1.02]}, "actionProfile": {"animationRole": "motor", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1.02, 1.7, 1.02], "isTrigger": false, "notes": "inspection pick proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "motor", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "dark-metal"}}, "material": "dark-metal", "materialLayers": ["dark-metal"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "cooling-fins", "kind": "ridge", "description": "motor cooling fin rhythm", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout"};
  node_motor_3.userData.actionProfile = {"animationRole": "motor", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1.02, 1.7, 1.02], "isTrigger": false, "notes": "inspection pick proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "motor", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "dark-metal"}};
  (nodes["root"] ?? root).add(node_motor_3);
  nodes["motor"] = node_motor_3;
  const mesh_motor_3Geometry = endpoint_motor_3
    ? new THREE.CylinderGeometry(endpoint_motor_3.endRadius, endpoint_motor_3.baseRadius, endpoint_motor_3.length, 32, 12)
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 48, 16);
  const mesh_motor_3 = new THREE.Mesh(
    mesh_motor_3Geometry,
    materialMap["dark-metal"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_motor_3.name = "\u9a71\u52a8\u7535\u673a";
  if (endpoint_motor_3) {
    mesh_motor_3.position.copy(endpoint_motor_3.midpoint);
    mesh_motor_3.quaternion.copy(endpoint_motor_3.quaternion);
  }
  mesh_motor_3.castShadow = options.castShadow ?? true;
  mesh_motor_3.receiveShadow = options.receiveShadow ?? true;
  mesh_motor_3.userData.sculptComponent = {"id": "motor", "name": "驱动电机", "level": "macro", "role": "motor", "importance": 0.8, "confidence": 0.82, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Procedural browser locator built from observable hard-surface primitives; hidden structure remains approximate.", "geometryDescriptor": {"topologyIntent": "browser diagnostic locator with stable selectable hierarchy", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.025, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 1.02, "height": 1.7, "depth": 1.02, "units": "relative", "confidence": 0.76}, "transform": {"position": [-2.1, -0.66, 0.2], "rotation": [0, 0, 1.5707963267948966], "scale": [1.02, 1.7, 1.02]}, "actionProfile": {"animationRole": "motor", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1.02, 1.7, 1.02], "isTrigger": false, "notes": "inspection pick proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "motor", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "dark-metal"}}, "material": "dark-metal", "materialLayers": ["dark-metal"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "cooling-fins", "kind": "ridge", "description": "motor cooling fin rhythm", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout"};
  node_motor_3.add(mesh_motor_3);
  meshes["motor"] = mesh_motor_3;
  colliders["motor"] = {"type": "box", "offset": [0, 0, 0], "scale": [1.02, 1.7, 1.02], "isTrigger": false, "notes": "inspection pick proxy"};
  destructionGroups["motor"] ??= [];
  destructionGroups["motor"].push(node_motor_3);

  const attachment_motor_end_4 = null;
  const endpoint_motor_end_4 = makeAttachmentEndpoint(attachment_motor_end_4);
  const node_motor_end_4 = new THREE.Group();
  node_motor_end_4.name = "\u7535\u673a\u7aef\u76d6__pivot";
  if (endpoint_motor_end_4) {
    node_motor_end_4.position.copy(endpoint_motor_end_4.start);
    node_motor_end_4.rotation.set(0, 0, 0);
    node_motor_end_4.scale.set(1, 1, 1);
  } else {
    node_motor_end_4.position.set(-2.96, -0.66, 0.2);
    node_motor_end_4.rotation.set(0.0, 0.0, 1.5707963267948966);
    node_motor_end_4.scale.set(0.72, 0.18, 0.72);
  }
  node_motor_end_4.userData.sculptComponent = {"id": "motor-end", "name": "电机端盖", "level": "macro", "role": "motor-cap", "importance": 0.8, "confidence": 0.82, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Procedural browser locator built from observable hard-surface primitives; hidden structure remains approximate.", "geometryDescriptor": {"topologyIntent": "browser diagnostic locator with stable selectable hierarchy", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.025, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.72, "height": 0.18, "depth": 0.72, "units": "relative", "confidence": 0.76}, "transform": {"position": [-2.96, -0.66, 0.2], "rotation": [0, 0, 1.5707963267948966], "scale": [0.72, 0.18, 0.72]}, "actionProfile": {"animationRole": "motor-cap", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.72, 0.18, 0.72], "isTrigger": false, "notes": "inspection pick proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "motor-end", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "steel"}}, "material": "steel", "materialLayers": ["steel"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout"};
  node_motor_end_4.userData.actionProfile = {"animationRole": "motor-cap", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.72, 0.18, 0.72], "isTrigger": false, "notes": "inspection pick proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "motor-end", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "steel"}};
  (nodes["root"] ?? root).add(node_motor_end_4);
  nodes["motor-end"] = node_motor_end_4;
  const mesh_motor_end_4Geometry = endpoint_motor_end_4
    ? new THREE.CylinderGeometry(endpoint_motor_end_4.endRadius, endpoint_motor_end_4.baseRadius, endpoint_motor_end_4.length, 32, 12)
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 48, 16);
  const mesh_motor_end_4 = new THREE.Mesh(
    mesh_motor_end_4Geometry,
    materialMap["steel"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_motor_end_4.name = "\u7535\u673a\u7aef\u76d6";
  if (endpoint_motor_end_4) {
    mesh_motor_end_4.position.copy(endpoint_motor_end_4.midpoint);
    mesh_motor_end_4.quaternion.copy(endpoint_motor_end_4.quaternion);
  }
  mesh_motor_end_4.castShadow = options.castShadow ?? true;
  mesh_motor_end_4.receiveShadow = options.receiveShadow ?? true;
  mesh_motor_end_4.userData.sculptComponent = {"id": "motor-end", "name": "电机端盖", "level": "macro", "role": "motor-cap", "importance": 0.8, "confidence": 0.82, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Procedural browser locator built from observable hard-surface primitives; hidden structure remains approximate.", "geometryDescriptor": {"topologyIntent": "browser diagnostic locator with stable selectable hierarchy", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.025, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.72, "height": 0.18, "depth": 0.72, "units": "relative", "confidence": 0.76}, "transform": {"position": [-2.96, -0.66, 0.2], "rotation": [0, 0, 1.5707963267948966], "scale": [0.72, 0.18, 0.72]}, "actionProfile": {"animationRole": "motor-cap", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.72, 0.18, 0.72], "isTrigger": false, "notes": "inspection pick proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "motor-end", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "steel"}}, "material": "steel", "materialLayers": ["steel"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout"};
  node_motor_end_4.add(mesh_motor_end_4);
  meshes["motor-end"] = mesh_motor_end_4;
  colliders["motor-end"] = {"type": "box", "offset": [0, 0, 0], "scale": [0.72, 0.18, 0.72], "isTrigger": false, "notes": "inspection pick proxy"};
  destructionGroups["motor-end"] ??= [];
  destructionGroups["motor-end"].push(node_motor_end_4);

  const attachment_pump_5 = null;
  const endpoint_pump_5 = makeAttachmentEndpoint(attachment_pump_5);
  const node_pump_5 = new THREE.Group();
  node_pump_5.name = "\u4e3b\u6cf5__pivot";
  if (endpoint_pump_5) {
    node_pump_5.position.copy(endpoint_pump_5.start);
    node_pump_5.rotation.set(0, 0, 0);
    node_pump_5.scale.set(1, 1, 1);
  } else {
    node_pump_5.position.set(-1.05, -0.66, 0.2);
    node_pump_5.rotation.set(0.0, 0.0, 1.5707963267948966);
    node_pump_5.scale.set(0.78, 0.72, 0.78);
  }
  node_pump_5.userData.sculptComponent = {"id": "pump", "name": "主泵", "level": "macro", "role": "inspection-target", "importance": 1, "confidence": 0.82, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Procedural browser locator built from observable hard-surface primitives; hidden structure remains approximate.", "geometryDescriptor": {"topologyIntent": "browser diagnostic locator with stable selectable hierarchy", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.025, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.78, "height": 0.72, "depth": 0.78, "units": "relative", "confidence": 0.76}, "transform": {"position": [-1.05, -0.66, 0.2], "rotation": [0, 0, 1.5707963267948966], "scale": [0.78, 0.72, 0.78]}, "actionProfile": {"animationRole": "inspection-target", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.78, 0.72, 0.78], "isTrigger": false, "notes": "inspection pick proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "pump", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "painted-blue"}}, "material": "painted-blue", "materialLayers": ["painted-blue"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "flange-bolts", "kind": "fastener", "description": "radial pump flange bolt pattern", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout"};
  node_pump_5.userData.actionProfile = {"animationRole": "inspection-target", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.78, 0.72, 0.78], "isTrigger": false, "notes": "inspection pick proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "pump", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "painted-blue"}};
  (nodes["root"] ?? root).add(node_pump_5);
  nodes["pump"] = node_pump_5;
  const mesh_pump_5Geometry = endpoint_pump_5
    ? new THREE.CylinderGeometry(endpoint_pump_5.endRadius, endpoint_pump_5.baseRadius, endpoint_pump_5.length, 32, 12)
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 48, 16);
  const mesh_pump_5 = new THREE.Mesh(
    mesh_pump_5Geometry,
    materialMap["painted-blue"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_pump_5.name = "\u4e3b\u6cf5";
  if (endpoint_pump_5) {
    mesh_pump_5.position.copy(endpoint_pump_5.midpoint);
    mesh_pump_5.quaternion.copy(endpoint_pump_5.quaternion);
  }
  mesh_pump_5.castShadow = options.castShadow ?? true;
  mesh_pump_5.receiveShadow = options.receiveShadow ?? true;
  mesh_pump_5.userData.sculptComponent = {"id": "pump", "name": "主泵", "level": "macro", "role": "inspection-target", "importance": 1, "confidence": 0.82, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Procedural browser locator built from observable hard-surface primitives; hidden structure remains approximate.", "geometryDescriptor": {"topologyIntent": "browser diagnostic locator with stable selectable hierarchy", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.025, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.78, "height": 0.72, "depth": 0.78, "units": "relative", "confidence": 0.76}, "transform": {"position": [-1.05, -0.66, 0.2], "rotation": [0, 0, 1.5707963267948966], "scale": [0.78, 0.72, 0.78]}, "actionProfile": {"animationRole": "inspection-target", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.78, 0.72, 0.78], "isTrigger": false, "notes": "inspection pick proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "pump", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "painted-blue"}}, "material": "painted-blue", "materialLayers": ["painted-blue"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "flange-bolts", "kind": "fastener", "description": "radial pump flange bolt pattern", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout"};
  node_pump_5.add(mesh_pump_5);
  meshes["pump"] = mesh_pump_5;
  colliders["pump"] = {"type": "box", "offset": [0, 0, 0], "scale": [0.78, 0.72, 0.78], "isTrigger": false, "notes": "inspection pick proxy"};
  destructionGroups["pump"] ??= [];
  destructionGroups["pump"].push(node_pump_5);

  const attachment_pump_flange_6 = null;
  const endpoint_pump_flange_6 = makeAttachmentEndpoint(attachment_pump_flange_6);
  const node_pump_flange_6 = new THREE.Group();
  node_pump_flange_6.name = "\u6cf5\u6cd5\u5170__pivot";
  if (endpoint_pump_flange_6) {
    node_pump_flange_6.position.copy(endpoint_pump_flange_6.start);
    node_pump_flange_6.rotation.set(0, 0, 0);
    node_pump_flange_6.scale.set(1, 1, 1);
  } else {
    node_pump_flange_6.position.set(-0.66, -0.66, 0.2);
    node_pump_flange_6.rotation.set(0.0, 1.5707963267948966, 0.0);
    node_pump_flange_6.scale.set(0.72, 0.72, 0.72);
  }
  node_pump_flange_6.userData.sculptComponent = {"id": "pump-flange", "name": "泵法兰", "level": "macro", "role": "pump-flange", "importance": 0.8, "confidence": 0.82, "primitive": "torus", "topologyClass": "assembled-solid", "topologyRationale": "Procedural browser locator built from observable hard-surface primitives; hidden structure remains approximate.", "geometryDescriptor": {"topologyIntent": "browser diagnostic locator with stable selectable hierarchy", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.025, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry", "torusTubeRatio": 0.24}, "parent": "root", "attachment": null, "dimensions": {"width": 0.72, "height": 0.72, "depth": 0.72, "units": "relative", "confidence": 0.76}, "transform": {"position": [-0.66, -0.66, 0.2], "rotation": [0, 1.5707963267948966, 0], "scale": [0.72, 0.72, 0.72]}, "actionProfile": {"animationRole": "pump-flange", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.72, 0.72, 0.72], "isTrigger": false, "notes": "inspection pick proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "pump-flange", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "steel"}}, "material": "steel", "materialLayers": ["steel"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout"};
  node_pump_flange_6.userData.actionProfile = {"animationRole": "pump-flange", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.72, 0.72, 0.72], "isTrigger": false, "notes": "inspection pick proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "pump-flange", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "steel"}};
  (nodes["root"] ?? root).add(node_pump_flange_6);
  nodes["pump-flange"] = node_pump_flange_6;
  const mesh_pump_flange_6Geometry = endpoint_pump_flange_6
    ? new THREE.CylinderGeometry(endpoint_pump_flange_6.endRadius, endpoint_pump_flange_6.baseRadius, endpoint_pump_flange_6.length, 32, 12)
    : new THREE.TorusGeometry(0.45, 0.108, 24, 96);
  const mesh_pump_flange_6 = new THREE.Mesh(
    mesh_pump_flange_6Geometry,
    materialMap["steel"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_pump_flange_6.name = "\u6cf5\u6cd5\u5170";
  if (endpoint_pump_flange_6) {
    mesh_pump_flange_6.position.copy(endpoint_pump_flange_6.midpoint);
    mesh_pump_flange_6.quaternion.copy(endpoint_pump_flange_6.quaternion);
  }
  mesh_pump_flange_6.castShadow = options.castShadow ?? true;
  mesh_pump_flange_6.receiveShadow = options.receiveShadow ?? true;
  mesh_pump_flange_6.userData.sculptComponent = {"id": "pump-flange", "name": "泵法兰", "level": "macro", "role": "pump-flange", "importance": 0.8, "confidence": 0.82, "primitive": "torus", "topologyClass": "assembled-solid", "topologyRationale": "Procedural browser locator built from observable hard-surface primitives; hidden structure remains approximate.", "geometryDescriptor": {"topologyIntent": "browser diagnostic locator with stable selectable hierarchy", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.025, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry", "torusTubeRatio": 0.24}, "parent": "root", "attachment": null, "dimensions": {"width": 0.72, "height": 0.72, "depth": 0.72, "units": "relative", "confidence": 0.76}, "transform": {"position": [-0.66, -0.66, 0.2], "rotation": [0, 1.5707963267948966, 0], "scale": [0.72, 0.72, 0.72]}, "actionProfile": {"animationRole": "pump-flange", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.72, 0.72, 0.72], "isTrigger": false, "notes": "inspection pick proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "pump-flange", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "steel"}}, "material": "steel", "materialLayers": ["steel"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout"};
  node_pump_flange_6.add(mesh_pump_flange_6);
  meshes["pump-flange"] = mesh_pump_flange_6;
  colliders["pump-flange"] = {"type": "box", "offset": [0, 0, 0], "scale": [0.72, 0.72, 0.72], "isTrigger": false, "notes": "inspection pick proxy"};
  destructionGroups["pump-flange"] ??= [];
  destructionGroups["pump-flange"].push(node_pump_flange_6);

  const attachment_valve_7 = null;
  const endpoint_valve_7 = makeAttachmentEndpoint(attachment_valve_7);
  const node_valve_7 = new THREE.Group();
  node_valve_7.name = "\u6bd4\u4f8b\u9600\u7ec4__pivot";
  if (endpoint_valve_7) {
    node_valve_7.position.copy(endpoint_valve_7.start);
    node_valve_7.rotation.set(0, 0, 0);
    node_valve_7.scale.set(1, 1, 1);
  } else {
    node_valve_7.position.set(0.3, 0.3, 0.06);
    node_valve_7.rotation.set(0.0, 0.0, 0.0);
    node_valve_7.scale.set(1.85, 0.48, 0.86);
  }
  node_valve_7.userData.sculptComponent = {"id": "valve", "name": "比例阀组", "level": "macro", "role": "inspection-target", "importance": 1, "confidence": 0.82, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Procedural browser locator built from observable hard-surface primitives; hidden structure remains approximate.", "geometryDescriptor": {"topologyIntent": "browser diagnostic locator with stable selectable hierarchy", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.025, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 1.85, "height": 0.48, "depth": 0.86, "units": "relative", "confidence": 0.76}, "transform": {"position": [0.3, 0.3, 0.06], "rotation": [0, 0, 0], "scale": [1.85, 0.48, 0.86]}, "actionProfile": {"animationRole": "inspection-target", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1.85, 0.48, 0.86], "isTrigger": false, "notes": "inspection pick proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "valve", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "painted-blue"}}, "material": "painted-blue", "materialLayers": ["painted-blue"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "cartridge-bank", "kind": "fastener", "description": "visible valve cartridge bank", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout"};
  node_valve_7.userData.actionProfile = {"animationRole": "inspection-target", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1.85, 0.48, 0.86], "isTrigger": false, "notes": "inspection pick proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "valve", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "painted-blue"}};
  (nodes["root"] ?? root).add(node_valve_7);
  nodes["valve"] = node_valve_7;
  const mesh_valve_7Geometry = endpoint_valve_7
    ? new THREE.CylinderGeometry(endpoint_valve_7.endRadius, endpoint_valve_7.baseRadius, endpoint_valve_7.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_valve_7 = new THREE.Mesh(
    mesh_valve_7Geometry,
    materialMap["painted-blue"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_valve_7.name = "\u6bd4\u4f8b\u9600\u7ec4";
  if (endpoint_valve_7) {
    mesh_valve_7.position.copy(endpoint_valve_7.midpoint);
    mesh_valve_7.quaternion.copy(endpoint_valve_7.quaternion);
  }
  mesh_valve_7.castShadow = options.castShadow ?? true;
  mesh_valve_7.receiveShadow = options.receiveShadow ?? true;
  mesh_valve_7.userData.sculptComponent = {"id": "valve", "name": "比例阀组", "level": "macro", "role": "inspection-target", "importance": 1, "confidence": 0.82, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Procedural browser locator built from observable hard-surface primitives; hidden structure remains approximate.", "geometryDescriptor": {"topologyIntent": "browser diagnostic locator with stable selectable hierarchy", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.025, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 1.85, "height": 0.48, "depth": 0.86, "units": "relative", "confidence": 0.76}, "transform": {"position": [0.3, 0.3, 0.06], "rotation": [0, 0, 0], "scale": [1.85, 0.48, 0.86]}, "actionProfile": {"animationRole": "inspection-target", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1.85, 0.48, 0.86], "isTrigger": false, "notes": "inspection pick proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "valve", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "painted-blue"}}, "material": "painted-blue", "materialLayers": ["painted-blue"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "cartridge-bank", "kind": "fastener", "description": "visible valve cartridge bank", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout"};
  node_valve_7.add(mesh_valve_7);
  meshes["valve"] = mesh_valve_7;
  colliders["valve"] = {"type": "box", "offset": [0, 0, 0], "scale": [1.85, 0.48, 0.86], "isTrigger": false, "notes": "inspection pick proxy"};
  destructionGroups["valve"] ??= [];
  destructionGroups["valve"].push(node_valve_7);

  const attachment_valve_cartridge_left_8 = null;
  const endpoint_valve_cartridge_left_8 = makeAttachmentEndpoint(attachment_valve_cartridge_left_8);
  const node_valve_cartridge_left_8 = new THREE.Group();
  node_valve_cartridge_left_8.name = "\u5de6\u9600\u82af__pivot";
  if (endpoint_valve_cartridge_left_8) {
    node_valve_cartridge_left_8.position.copy(endpoint_valve_cartridge_left_8.start);
    node_valve_cartridge_left_8.rotation.set(0, 0, 0);
    node_valve_cartridge_left_8.scale.set(1, 1, 1);
  } else {
    node_valve_cartridge_left_8.position.set(-0.15, 0.68, 0.05);
    node_valve_cartridge_left_8.rotation.set(0.0, 0.0, 0.0);
    node_valve_cartridge_left_8.scale.set(0.19, 0.38, 0.19);
  }
  node_valve_cartridge_left_8.userData.sculptComponent = {"id": "valve-cartridge-left", "name": "左阀芯", "level": "macro", "role": "valve-cartridge", "importance": 0.8, "confidence": 0.82, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Procedural browser locator built from observable hard-surface primitives; hidden structure remains approximate.", "geometryDescriptor": {"topologyIntent": "browser diagnostic locator with stable selectable hierarchy", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.025, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.19, "height": 0.38, "depth": 0.19, "units": "relative", "confidence": 0.76}, "transform": {"position": [-0.15, 0.68, 0.05], "rotation": [0, 0, 0], "scale": [0.19, 0.38, 0.19]}, "actionProfile": {"animationRole": "valve-cartridge", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.19, 0.38, 0.19], "isTrigger": false, "notes": "inspection pick proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "valve-cartridge-left", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "dark-metal"}}, "material": "dark-metal", "materialLayers": ["dark-metal"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout"};
  node_valve_cartridge_left_8.userData.actionProfile = {"animationRole": "valve-cartridge", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.19, 0.38, 0.19], "isTrigger": false, "notes": "inspection pick proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "valve-cartridge-left", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "dark-metal"}};
  (nodes["root"] ?? root).add(node_valve_cartridge_left_8);
  nodes["valve-cartridge-left"] = node_valve_cartridge_left_8;
  const mesh_valve_cartridge_left_8Geometry = endpoint_valve_cartridge_left_8
    ? new THREE.CylinderGeometry(endpoint_valve_cartridge_left_8.endRadius, endpoint_valve_cartridge_left_8.baseRadius, endpoint_valve_cartridge_left_8.length, 32, 12)
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 48, 16);
  const mesh_valve_cartridge_left_8 = new THREE.Mesh(
    mesh_valve_cartridge_left_8Geometry,
    materialMap["dark-metal"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_valve_cartridge_left_8.name = "\u5de6\u9600\u82af";
  if (endpoint_valve_cartridge_left_8) {
    mesh_valve_cartridge_left_8.position.copy(endpoint_valve_cartridge_left_8.midpoint);
    mesh_valve_cartridge_left_8.quaternion.copy(endpoint_valve_cartridge_left_8.quaternion);
  }
  mesh_valve_cartridge_left_8.castShadow = options.castShadow ?? true;
  mesh_valve_cartridge_left_8.receiveShadow = options.receiveShadow ?? true;
  mesh_valve_cartridge_left_8.userData.sculptComponent = {"id": "valve-cartridge-left", "name": "左阀芯", "level": "macro", "role": "valve-cartridge", "importance": 0.8, "confidence": 0.82, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Procedural browser locator built from observable hard-surface primitives; hidden structure remains approximate.", "geometryDescriptor": {"topologyIntent": "browser diagnostic locator with stable selectable hierarchy", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.025, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.19, "height": 0.38, "depth": 0.19, "units": "relative", "confidence": 0.76}, "transform": {"position": [-0.15, 0.68, 0.05], "rotation": [0, 0, 0], "scale": [0.19, 0.38, 0.19]}, "actionProfile": {"animationRole": "valve-cartridge", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.19, 0.38, 0.19], "isTrigger": false, "notes": "inspection pick proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "valve-cartridge-left", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "dark-metal"}}, "material": "dark-metal", "materialLayers": ["dark-metal"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout"};
  node_valve_cartridge_left_8.add(mesh_valve_cartridge_left_8);
  meshes["valve-cartridge-left"] = mesh_valve_cartridge_left_8;
  colliders["valve-cartridge-left"] = {"type": "box", "offset": [0, 0, 0], "scale": [0.19, 0.38, 0.19], "isTrigger": false, "notes": "inspection pick proxy"};
  destructionGroups["valve-cartridge-left"] ??= [];
  destructionGroups["valve-cartridge-left"].push(node_valve_cartridge_left_8);

  const attachment_valve_cartridge_right_9 = null;
  const endpoint_valve_cartridge_right_9 = makeAttachmentEndpoint(attachment_valve_cartridge_right_9);
  const node_valve_cartridge_right_9 = new THREE.Group();
  node_valve_cartridge_right_9.name = "\u53f3\u9600\u82af__pivot";
  if (endpoint_valve_cartridge_right_9) {
    node_valve_cartridge_right_9.position.copy(endpoint_valve_cartridge_right_9.start);
    node_valve_cartridge_right_9.rotation.set(0, 0, 0);
    node_valve_cartridge_right_9.scale.set(1, 1, 1);
  } else {
    node_valve_cartridge_right_9.position.set(0.48, 0.68, 0.05);
    node_valve_cartridge_right_9.rotation.set(0.0, 0.0, 0.0);
    node_valve_cartridge_right_9.scale.set(0.19, 0.38, 0.19);
  }
  node_valve_cartridge_right_9.userData.sculptComponent = {"id": "valve-cartridge-right", "name": "右阀芯", "level": "macro", "role": "valve-cartridge", "importance": 0.8, "confidence": 0.82, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Procedural browser locator built from observable hard-surface primitives; hidden structure remains approximate.", "geometryDescriptor": {"topologyIntent": "browser diagnostic locator with stable selectable hierarchy", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.025, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.19, "height": 0.38, "depth": 0.19, "units": "relative", "confidence": 0.76}, "transform": {"position": [0.48, 0.68, 0.05], "rotation": [0, 0, 0], "scale": [0.19, 0.38, 0.19]}, "actionProfile": {"animationRole": "valve-cartridge", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.19, 0.38, 0.19], "isTrigger": false, "notes": "inspection pick proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "valve-cartridge-right", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "dark-metal"}}, "material": "dark-metal", "materialLayers": ["dark-metal"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout"};
  node_valve_cartridge_right_9.userData.actionProfile = {"animationRole": "valve-cartridge", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.19, 0.38, 0.19], "isTrigger": false, "notes": "inspection pick proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "valve-cartridge-right", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "dark-metal"}};
  (nodes["root"] ?? root).add(node_valve_cartridge_right_9);
  nodes["valve-cartridge-right"] = node_valve_cartridge_right_9;
  const mesh_valve_cartridge_right_9Geometry = endpoint_valve_cartridge_right_9
    ? new THREE.CylinderGeometry(endpoint_valve_cartridge_right_9.endRadius, endpoint_valve_cartridge_right_9.baseRadius, endpoint_valve_cartridge_right_9.length, 32, 12)
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 48, 16);
  const mesh_valve_cartridge_right_9 = new THREE.Mesh(
    mesh_valve_cartridge_right_9Geometry,
    materialMap["dark-metal"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_valve_cartridge_right_9.name = "\u53f3\u9600\u82af";
  if (endpoint_valve_cartridge_right_9) {
    mesh_valve_cartridge_right_9.position.copy(endpoint_valve_cartridge_right_9.midpoint);
    mesh_valve_cartridge_right_9.quaternion.copy(endpoint_valve_cartridge_right_9.quaternion);
  }
  mesh_valve_cartridge_right_9.castShadow = options.castShadow ?? true;
  mesh_valve_cartridge_right_9.receiveShadow = options.receiveShadow ?? true;
  mesh_valve_cartridge_right_9.userData.sculptComponent = {"id": "valve-cartridge-right", "name": "右阀芯", "level": "macro", "role": "valve-cartridge", "importance": 0.8, "confidence": 0.82, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Procedural browser locator built from observable hard-surface primitives; hidden structure remains approximate.", "geometryDescriptor": {"topologyIntent": "browser diagnostic locator with stable selectable hierarchy", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.025, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.19, "height": 0.38, "depth": 0.19, "units": "relative", "confidence": 0.76}, "transform": {"position": [0.48, 0.68, 0.05], "rotation": [0, 0, 0], "scale": [0.19, 0.38, 0.19]}, "actionProfile": {"animationRole": "valve-cartridge", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.19, 0.38, 0.19], "isTrigger": false, "notes": "inspection pick proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "valve-cartridge-right", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "dark-metal"}}, "material": "dark-metal", "materialLayers": ["dark-metal"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout"};
  node_valve_cartridge_right_9.add(mesh_valve_cartridge_right_9);
  meshes["valve-cartridge-right"] = mesh_valve_cartridge_right_9;
  colliders["valve-cartridge-right"] = {"type": "box", "offset": [0, 0, 0], "scale": [0.19, 0.38, 0.19], "isTrigger": false, "notes": "inspection pick proxy"};
  destructionGroups["valve-cartridge-right"] ??= [];
  destructionGroups["valve-cartridge-right"].push(node_valve_cartridge_right_9);

  const attachment_gauge_left_10 = null;
  const endpoint_gauge_left_10 = makeAttachmentEndpoint(attachment_gauge_left_10);
  const node_gauge_left_10 = new THREE.Group();
  node_gauge_left_10.name = "\u5de6\u538b\u529b\u8868__pivot";
  if (endpoint_gauge_left_10) {
    node_gauge_left_10.position.copy(endpoint_gauge_left_10.start);
    node_gauge_left_10.rotation.set(0, 0, 0);
    node_gauge_left_10.scale.set(1, 1, 1);
  } else {
    node_gauge_left_10.position.set(-0.2, 0.25, 0.72);
    node_gauge_left_10.rotation.set(1.5707963267948966, 0.0, 0.0);
    node_gauge_left_10.scale.set(0.32, 0.12, 0.32);
  }
  node_gauge_left_10.userData.sculptComponent = {"id": "gauge-left", "name": "左压力表", "level": "macro", "role": "instrument", "importance": 0.8, "confidence": 0.82, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Procedural browser locator built from observable hard-surface primitives; hidden structure remains approximate.", "geometryDescriptor": {"topologyIntent": "browser diagnostic locator with stable selectable hierarchy", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.025, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.32, "height": 0.12, "depth": 0.32, "units": "relative", "confidence": 0.76}, "transform": {"position": [-0.2, 0.25, 0.72], "rotation": [1.5707963267948966, 0, 0], "scale": [0.32, 0.12, 0.32]}, "actionProfile": {"animationRole": "instrument", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.32, 0.12, 0.32], "isTrigger": false, "notes": "inspection pick proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "gauge-left", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "steel"}}, "material": "steel", "materialLayers": ["steel"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "gauge-needle-left", "kind": "linework", "description": "pressure gauge needle", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout"};
  node_gauge_left_10.userData.actionProfile = {"animationRole": "instrument", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.32, 0.12, 0.32], "isTrigger": false, "notes": "inspection pick proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "gauge-left", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "steel"}};
  (nodes["root"] ?? root).add(node_gauge_left_10);
  nodes["gauge-left"] = node_gauge_left_10;
  const mesh_gauge_left_10Geometry = endpoint_gauge_left_10
    ? new THREE.CylinderGeometry(endpoint_gauge_left_10.endRadius, endpoint_gauge_left_10.baseRadius, endpoint_gauge_left_10.length, 32, 12)
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 48, 16);
  const mesh_gauge_left_10 = new THREE.Mesh(
    mesh_gauge_left_10Geometry,
    materialMap["steel"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_gauge_left_10.name = "\u5de6\u538b\u529b\u8868";
  if (endpoint_gauge_left_10) {
    mesh_gauge_left_10.position.copy(endpoint_gauge_left_10.midpoint);
    mesh_gauge_left_10.quaternion.copy(endpoint_gauge_left_10.quaternion);
  }
  mesh_gauge_left_10.castShadow = options.castShadow ?? true;
  mesh_gauge_left_10.receiveShadow = options.receiveShadow ?? true;
  mesh_gauge_left_10.userData.sculptComponent = {"id": "gauge-left", "name": "左压力表", "level": "macro", "role": "instrument", "importance": 0.8, "confidence": 0.82, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Procedural browser locator built from observable hard-surface primitives; hidden structure remains approximate.", "geometryDescriptor": {"topologyIntent": "browser diagnostic locator with stable selectable hierarchy", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.025, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.32, "height": 0.12, "depth": 0.32, "units": "relative", "confidence": 0.76}, "transform": {"position": [-0.2, 0.25, 0.72], "rotation": [1.5707963267948966, 0, 0], "scale": [0.32, 0.12, 0.32]}, "actionProfile": {"animationRole": "instrument", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.32, 0.12, 0.32], "isTrigger": false, "notes": "inspection pick proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "gauge-left", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "steel"}}, "material": "steel", "materialLayers": ["steel"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "gauge-needle-left", "kind": "linework", "description": "pressure gauge needle", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout"};
  node_gauge_left_10.add(mesh_gauge_left_10);
  meshes["gauge-left"] = mesh_gauge_left_10;
  colliders["gauge-left"] = {"type": "box", "offset": [0, 0, 0], "scale": [0.32, 0.12, 0.32], "isTrigger": false, "notes": "inspection pick proxy"};
  destructionGroups["gauge-left"] ??= [];
  destructionGroups["gauge-left"].push(node_gauge_left_10);

  const attachment_gauge_right_11 = null;
  const endpoint_gauge_right_11 = makeAttachmentEndpoint(attachment_gauge_right_11);
  const node_gauge_right_11 = new THREE.Group();
  node_gauge_right_11.name = "\u53f3\u538b\u529b\u8868__pivot";
  if (endpoint_gauge_right_11) {
    node_gauge_right_11.position.copy(endpoint_gauge_right_11.start);
    node_gauge_right_11.rotation.set(0, 0, 0);
    node_gauge_right_11.scale.set(1, 1, 1);
  } else {
    node_gauge_right_11.position.set(0.54, 0.25, 0.72);
    node_gauge_right_11.rotation.set(1.5707963267948966, 0.0, 0.0);
    node_gauge_right_11.scale.set(0.32, 0.12, 0.32);
  }
  node_gauge_right_11.userData.sculptComponent = {"id": "gauge-right", "name": "右压力表", "level": "macro", "role": "instrument", "importance": 0.8, "confidence": 0.82, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Procedural browser locator built from observable hard-surface primitives; hidden structure remains approximate.", "geometryDescriptor": {"topologyIntent": "browser diagnostic locator with stable selectable hierarchy", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.025, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.32, "height": 0.12, "depth": 0.32, "units": "relative", "confidence": 0.76}, "transform": {"position": [0.54, 0.25, 0.72], "rotation": [1.5707963267948966, 0, 0], "scale": [0.32, 0.12, 0.32]}, "actionProfile": {"animationRole": "instrument", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.32, 0.12, 0.32], "isTrigger": false, "notes": "inspection pick proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "gauge-right", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "steel"}}, "material": "steel", "materialLayers": ["steel"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout"};
  node_gauge_right_11.userData.actionProfile = {"animationRole": "instrument", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.32, 0.12, 0.32], "isTrigger": false, "notes": "inspection pick proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "gauge-right", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "steel"}};
  (nodes["root"] ?? root).add(node_gauge_right_11);
  nodes["gauge-right"] = node_gauge_right_11;
  const mesh_gauge_right_11Geometry = endpoint_gauge_right_11
    ? new THREE.CylinderGeometry(endpoint_gauge_right_11.endRadius, endpoint_gauge_right_11.baseRadius, endpoint_gauge_right_11.length, 32, 12)
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 48, 16);
  const mesh_gauge_right_11 = new THREE.Mesh(
    mesh_gauge_right_11Geometry,
    materialMap["steel"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_gauge_right_11.name = "\u53f3\u538b\u529b\u8868";
  if (endpoint_gauge_right_11) {
    mesh_gauge_right_11.position.copy(endpoint_gauge_right_11.midpoint);
    mesh_gauge_right_11.quaternion.copy(endpoint_gauge_right_11.quaternion);
  }
  mesh_gauge_right_11.castShadow = options.castShadow ?? true;
  mesh_gauge_right_11.receiveShadow = options.receiveShadow ?? true;
  mesh_gauge_right_11.userData.sculptComponent = {"id": "gauge-right", "name": "右压力表", "level": "macro", "role": "instrument", "importance": 0.8, "confidence": 0.82, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Procedural browser locator built from observable hard-surface primitives; hidden structure remains approximate.", "geometryDescriptor": {"topologyIntent": "browser diagnostic locator with stable selectable hierarchy", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.025, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.32, "height": 0.12, "depth": 0.32, "units": "relative", "confidence": 0.76}, "transform": {"position": [0.54, 0.25, 0.72], "rotation": [1.5707963267948966, 0, 0], "scale": [0.32, 0.12, 0.32]}, "actionProfile": {"animationRole": "instrument", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.32, 0.12, 0.32], "isTrigger": false, "notes": "inspection pick proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "gauge-right", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "steel"}}, "material": "steel", "materialLayers": ["steel"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout"};
  node_gauge_right_11.add(mesh_gauge_right_11);
  meshes["gauge-right"] = mesh_gauge_right_11;
  colliders["gauge-right"] = {"type": "box", "offset": [0, 0, 0], "scale": [0.32, 0.12, 0.32], "isTrigger": false, "notes": "inspection pick proxy"};
  destructionGroups["gauge-right"] ??= [];
  destructionGroups["gauge-right"].push(node_gauge_right_11);

  const attachment_cooler_12 = null;
  const endpoint_cooler_12 = makeAttachmentEndpoint(attachment_cooler_12);
  const node_cooler_12 = new THREE.Group();
  node_cooler_12.name = "\u6cb9\u51b7\u5374\u5668__pivot";
  if (endpoint_cooler_12) {
    node_cooler_12.position.copy(endpoint_cooler_12.start);
    node_cooler_12.rotation.set(0, 0, 0);
    node_cooler_12.scale.set(1, 1, 1);
  } else {
    node_cooler_12.position.set(2.35, 0.0, -0.05);
    node_cooler_12.rotation.set(0.0, 0.0, 0.0);
    node_cooler_12.scale.set(0.34, 2.25, 1.85);
  }
  node_cooler_12.userData.sculptComponent = {"id": "cooler", "name": "油冷却器", "level": "macro", "role": "inspection-target", "importance": 1, "confidence": 0.82, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Procedural browser locator built from observable hard-surface primitives; hidden structure remains approximate.", "geometryDescriptor": {"topologyIntent": "browser diagnostic locator with stable selectable hierarchy", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.025, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.34, "height": 2.25, "depth": 1.85, "units": "relative", "confidence": 0.76}, "transform": {"position": [2.35, 0, -0.05], "rotation": [0, 0, 0], "scale": [0.34, 2.25, 1.85]}, "actionProfile": {"animationRole": "inspection-target", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.34, 2.25, 1.85], "isTrigger": false, "notes": "inspection pick proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "cooler", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "dark-metal"}}, "material": "dark-metal", "materialLayers": ["dark-metal"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "radiator-grid", "kind": "linework", "description": "cooler radiator grid", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout"};
  node_cooler_12.userData.actionProfile = {"animationRole": "inspection-target", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.34, 2.25, 1.85], "isTrigger": false, "notes": "inspection pick proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "cooler", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "dark-metal"}};
  (nodes["root"] ?? root).add(node_cooler_12);
  nodes["cooler"] = node_cooler_12;
  const mesh_cooler_12Geometry = endpoint_cooler_12
    ? new THREE.CylinderGeometry(endpoint_cooler_12.endRadius, endpoint_cooler_12.baseRadius, endpoint_cooler_12.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_cooler_12 = new THREE.Mesh(
    mesh_cooler_12Geometry,
    materialMap["dark-metal"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_cooler_12.name = "\u6cb9\u51b7\u5374\u5668";
  if (endpoint_cooler_12) {
    mesh_cooler_12.position.copy(endpoint_cooler_12.midpoint);
    mesh_cooler_12.quaternion.copy(endpoint_cooler_12.quaternion);
  }
  mesh_cooler_12.castShadow = options.castShadow ?? true;
  mesh_cooler_12.receiveShadow = options.receiveShadow ?? true;
  mesh_cooler_12.userData.sculptComponent = {"id": "cooler", "name": "油冷却器", "level": "macro", "role": "inspection-target", "importance": 1, "confidence": 0.82, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Procedural browser locator built from observable hard-surface primitives; hidden structure remains approximate.", "geometryDescriptor": {"topologyIntent": "browser diagnostic locator with stable selectable hierarchy", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.025, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.34, "height": 2.25, "depth": 1.85, "units": "relative", "confidence": 0.76}, "transform": {"position": [2.35, 0, -0.05], "rotation": [0, 0, 0], "scale": [0.34, 2.25, 1.85]}, "actionProfile": {"animationRole": "inspection-target", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.34, 2.25, 1.85], "isTrigger": false, "notes": "inspection pick proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "cooler", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "dark-metal"}}, "material": "dark-metal", "materialLayers": ["dark-metal"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "radiator-grid", "kind": "linework", "description": "cooler radiator grid", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout"};
  node_cooler_12.add(mesh_cooler_12);
  meshes["cooler"] = mesh_cooler_12;
  colliders["cooler"] = {"type": "box", "offset": [0, 0, 0], "scale": [0.34, 2.25, 1.85], "isTrigger": false, "notes": "inspection pick proxy"};
  destructionGroups["cooler"] ??= [];
  destructionGroups["cooler"].push(node_cooler_12);

  const attachment_cooler_fan_13 = null;
  const endpoint_cooler_fan_13 = makeAttachmentEndpoint(attachment_cooler_fan_13);
  const node_cooler_fan_13 = new THREE.Group();
  node_cooler_fan_13.name = "\u51b7\u5374\u5668\u98ce\u6247\u62a4\u5708__pivot";
  if (endpoint_cooler_fan_13) {
    node_cooler_fan_13.position.copy(endpoint_cooler_fan_13.start);
    node_cooler_fan_13.rotation.set(0, 0, 0);
    node_cooler_fan_13.scale.set(1, 1, 1);
  } else {
    node_cooler_fan_13.position.set(2.14, 0.0, 0.0);
    node_cooler_fan_13.rotation.set(0.0, 1.5707963267948966, 0.0);
    node_cooler_fan_13.scale.set(1.38, 1.38, 1.38);
  }
  node_cooler_fan_13.userData.sculptComponent = {"id": "cooler-fan", "name": "冷却器风扇护圈", "level": "macro", "role": "fan-cage", "importance": 0.8, "confidence": 0.82, "primitive": "torus", "topologyClass": "assembled-solid", "topologyRationale": "Procedural browser locator built from observable hard-surface primitives; hidden structure remains approximate.", "geometryDescriptor": {"topologyIntent": "browser diagnostic locator with stable selectable hierarchy", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.025, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry", "torusTubeRatio": 0.12}, "parent": "root", "attachment": null, "dimensions": {"width": 1.38, "height": 1.38, "depth": 1.38, "units": "relative", "confidence": 0.76}, "transform": {"position": [2.14, 0, 0], "rotation": [0, 1.5707963267948966, 0], "scale": [1.38, 1.38, 1.38]}, "actionProfile": {"animationRole": "fan-cage", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1.38, 1.38, 1.38], "isTrigger": false, "notes": "inspection pick proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "cooler-fan", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "steel"}}, "material": "steel", "materialLayers": ["steel"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "fan-cage", "kind": "ridge", "description": "concentric fan guard", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout"};
  node_cooler_fan_13.userData.actionProfile = {"animationRole": "fan-cage", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1.38, 1.38, 1.38], "isTrigger": false, "notes": "inspection pick proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "cooler-fan", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "steel"}};
  (nodes["root"] ?? root).add(node_cooler_fan_13);
  nodes["cooler-fan"] = node_cooler_fan_13;
  const mesh_cooler_fan_13Geometry = endpoint_cooler_fan_13
    ? new THREE.CylinderGeometry(endpoint_cooler_fan_13.endRadius, endpoint_cooler_fan_13.baseRadius, endpoint_cooler_fan_13.length, 32, 12)
    : new THREE.TorusGeometry(0.45, 0.054, 24, 96);
  const mesh_cooler_fan_13 = new THREE.Mesh(
    mesh_cooler_fan_13Geometry,
    materialMap["steel"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_cooler_fan_13.name = "\u51b7\u5374\u5668\u98ce\u6247\u62a4\u5708";
  if (endpoint_cooler_fan_13) {
    mesh_cooler_fan_13.position.copy(endpoint_cooler_fan_13.midpoint);
    mesh_cooler_fan_13.quaternion.copy(endpoint_cooler_fan_13.quaternion);
  }
  mesh_cooler_fan_13.castShadow = options.castShadow ?? true;
  mesh_cooler_fan_13.receiveShadow = options.receiveShadow ?? true;
  mesh_cooler_fan_13.userData.sculptComponent = {"id": "cooler-fan", "name": "冷却器风扇护圈", "level": "macro", "role": "fan-cage", "importance": 0.8, "confidence": 0.82, "primitive": "torus", "topologyClass": "assembled-solid", "topologyRationale": "Procedural browser locator built from observable hard-surface primitives; hidden structure remains approximate.", "geometryDescriptor": {"topologyIntent": "browser diagnostic locator with stable selectable hierarchy", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.025, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry", "torusTubeRatio": 0.12}, "parent": "root", "attachment": null, "dimensions": {"width": 1.38, "height": 1.38, "depth": 1.38, "units": "relative", "confidence": 0.76}, "transform": {"position": [2.14, 0, 0], "rotation": [0, 1.5707963267948966, 0], "scale": [1.38, 1.38, 1.38]}, "actionProfile": {"animationRole": "fan-cage", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1.38, 1.38, 1.38], "isTrigger": false, "notes": "inspection pick proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "cooler-fan", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "steel"}}, "material": "steel", "materialLayers": ["steel"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "fan-cage", "kind": "ridge", "description": "concentric fan guard", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout"};
  node_cooler_fan_13.add(mesh_cooler_fan_13);
  meshes["cooler-fan"] = mesh_cooler_fan_13;
  colliders["cooler-fan"] = {"type": "box", "offset": [0, 0, 0], "scale": [1.38, 1.38, 1.38], "isTrigger": false, "notes": "inspection pick proxy"};
  destructionGroups["cooler-fan"] ??= [];
  destructionGroups["cooler-fan"].push(node_cooler_fan_13);

  const attachment_accumulator_14 = null;
  const endpoint_accumulator_14 = makeAttachmentEndpoint(attachment_accumulator_14);
  const node_accumulator_14 = new THREE.Group();
  node_accumulator_14.name = "\u84c4\u80fd\u5668__pivot";
  if (endpoint_accumulator_14) {
    node_accumulator_14.position.copy(endpoint_accumulator_14.start);
    node_accumulator_14.rotation.set(0, 0, 0);
    node_accumulator_14.scale.set(1, 1, 1);
  } else {
    node_accumulator_14.position.set(1.15, -0.22, 1.02);
    node_accumulator_14.rotation.set(0.0, 0.0, 0.0);
    node_accumulator_14.scale.set(0.88, 1.08, 0.88);
  }
  node_accumulator_14.userData.sculptComponent = {"id": "accumulator", "name": "蓄能器", "level": "macro", "role": "inspection-target", "importance": 1, "confidence": 0.82, "primitive": "sphere", "topologyClass": "assembled-solid", "topologyRationale": "Procedural browser locator built from observable hard-surface primitives; hidden structure remains approximate.", "geometryDescriptor": {"topologyIntent": "browser diagnostic locator with stable selectable hierarchy", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.025, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.88, "height": 1.08, "depth": 0.88, "units": "relative", "confidence": 0.76}, "transform": {"position": [1.15, -0.22, 1.02], "rotation": [0, 0, 0], "scale": [0.88, 1.08, 0.88]}, "actionProfile": {"animationRole": "inspection-target", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.88, 1.08, 0.88], "isTrigger": false, "notes": "inspection pick proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "accumulator", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "dark-metal"}}, "material": "dark-metal", "materialLayers": ["dark-metal"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "clamp-band", "kind": "ridge", "description": "metal accumulator clamp band", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout"};
  node_accumulator_14.userData.actionProfile = {"animationRole": "inspection-target", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.88, 1.08, 0.88], "isTrigger": false, "notes": "inspection pick proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "accumulator", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "dark-metal"}};
  (nodes["root"] ?? root).add(node_accumulator_14);
  nodes["accumulator"] = node_accumulator_14;
  const mesh_accumulator_14Geometry = endpoint_accumulator_14
    ? new THREE.CylinderGeometry(endpoint_accumulator_14.endRadius, endpoint_accumulator_14.baseRadius, endpoint_accumulator_14.length, 32, 12)
    : new THREE.SphereGeometry(0.5, 64, 40);
  const mesh_accumulator_14 = new THREE.Mesh(
    mesh_accumulator_14Geometry,
    materialMap["dark-metal"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_accumulator_14.name = "\u84c4\u80fd\u5668";
  if (endpoint_accumulator_14) {
    mesh_accumulator_14.position.copy(endpoint_accumulator_14.midpoint);
    mesh_accumulator_14.quaternion.copy(endpoint_accumulator_14.quaternion);
  }
  mesh_accumulator_14.castShadow = options.castShadow ?? true;
  mesh_accumulator_14.receiveShadow = options.receiveShadow ?? true;
  mesh_accumulator_14.userData.sculptComponent = {"id": "accumulator", "name": "蓄能器", "level": "macro", "role": "inspection-target", "importance": 1, "confidence": 0.82, "primitive": "sphere", "topologyClass": "assembled-solid", "topologyRationale": "Procedural browser locator built from observable hard-surface primitives; hidden structure remains approximate.", "geometryDescriptor": {"topologyIntent": "browser diagnostic locator with stable selectable hierarchy", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.025, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.88, "height": 1.08, "depth": 0.88, "units": "relative", "confidence": 0.76}, "transform": {"position": [1.15, -0.22, 1.02], "rotation": [0, 0, 0], "scale": [0.88, 1.08, 0.88]}, "actionProfile": {"animationRole": "inspection-target", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.88, 1.08, 0.88], "isTrigger": false, "notes": "inspection pick proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "accumulator", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "dark-metal"}}, "material": "dark-metal", "materialLayers": ["dark-metal"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "clamp-band", "kind": "ridge", "description": "metal accumulator clamp band", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout"};
  node_accumulator_14.add(mesh_accumulator_14);
  meshes["accumulator"] = mesh_accumulator_14;
  colliders["accumulator"] = {"type": "box", "offset": [0, 0, 0], "scale": [0.88, 1.08, 0.88], "isTrigger": false, "notes": "inspection pick proxy"};
  destructionGroups["accumulator"] ??= [];
  destructionGroups["accumulator"].push(node_accumulator_14);

  const attachment_accumulator_band_15 = null;
  const endpoint_accumulator_band_15 = makeAttachmentEndpoint(attachment_accumulator_band_15);
  const node_accumulator_band_15 = new THREE.Group();
  node_accumulator_band_15.name = "\u84c4\u80fd\u5668\u62b1\u7b8d__pivot";
  if (endpoint_accumulator_band_15) {
    node_accumulator_band_15.position.copy(endpoint_accumulator_band_15.start);
    node_accumulator_band_15.rotation.set(0, 0, 0);
    node_accumulator_band_15.scale.set(1, 1, 1);
  } else {
    node_accumulator_band_15.position.set(1.15, -0.22, 1.02);
    node_accumulator_band_15.rotation.set(1.5707963267948966, 0.0, 0.0);
    node_accumulator_band_15.scale.set(0.87, 0.87, 0.87);
  }
  node_accumulator_band_15.userData.sculptComponent = {"id": "accumulator-band", "name": "蓄能器抱箍", "level": "macro", "role": "clamp", "importance": 0.8, "confidence": 0.82, "primitive": "torus", "topologyClass": "assembled-solid", "topologyRationale": "Procedural browser locator built from observable hard-surface primitives; hidden structure remains approximate.", "geometryDescriptor": {"topologyIntent": "browser diagnostic locator with stable selectable hierarchy", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.025, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry", "torusTubeRatio": 0.1}, "parent": "root", "attachment": null, "dimensions": {"width": 0.87, "height": 0.87, "depth": 0.87, "units": "relative", "confidence": 0.76}, "transform": {"position": [1.15, -0.22, 1.02], "rotation": [1.5707963267948966, 0, 0], "scale": [0.87, 0.87, 0.87]}, "actionProfile": {"animationRole": "clamp", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.87, 0.87, 0.87], "isTrigger": false, "notes": "inspection pick proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "accumulator-band", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "steel"}}, "material": "steel", "materialLayers": ["steel"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout"};
  node_accumulator_band_15.userData.actionProfile = {"animationRole": "clamp", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.87, 0.87, 0.87], "isTrigger": false, "notes": "inspection pick proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "accumulator-band", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "steel"}};
  (nodes["root"] ?? root).add(node_accumulator_band_15);
  nodes["accumulator-band"] = node_accumulator_band_15;
  const mesh_accumulator_band_15Geometry = endpoint_accumulator_band_15
    ? new THREE.CylinderGeometry(endpoint_accumulator_band_15.endRadius, endpoint_accumulator_band_15.baseRadius, endpoint_accumulator_band_15.length, 32, 12)
    : new THREE.TorusGeometry(0.45, 0.045, 24, 96);
  const mesh_accumulator_band_15 = new THREE.Mesh(
    mesh_accumulator_band_15Geometry,
    materialMap["steel"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_accumulator_band_15.name = "\u84c4\u80fd\u5668\u62b1\u7b8d";
  if (endpoint_accumulator_band_15) {
    mesh_accumulator_band_15.position.copy(endpoint_accumulator_band_15.midpoint);
    mesh_accumulator_band_15.quaternion.copy(endpoint_accumulator_band_15.quaternion);
  }
  mesh_accumulator_band_15.castShadow = options.castShadow ?? true;
  mesh_accumulator_band_15.receiveShadow = options.receiveShadow ?? true;
  mesh_accumulator_band_15.userData.sculptComponent = {"id": "accumulator-band", "name": "蓄能器抱箍", "level": "macro", "role": "clamp", "importance": 0.8, "confidence": 0.82, "primitive": "torus", "topologyClass": "assembled-solid", "topologyRationale": "Procedural browser locator built from observable hard-surface primitives; hidden structure remains approximate.", "geometryDescriptor": {"topologyIntent": "browser diagnostic locator with stable selectable hierarchy", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.025, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry", "torusTubeRatio": 0.1}, "parent": "root", "attachment": null, "dimensions": {"width": 0.87, "height": 0.87, "depth": 0.87, "units": "relative", "confidence": 0.76}, "transform": {"position": [1.15, -0.22, 1.02], "rotation": [1.5707963267948966, 0, 0], "scale": [0.87, 0.87, 0.87]}, "actionProfile": {"animationRole": "clamp", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.87, 0.87, 0.87], "isTrigger": false, "notes": "inspection pick proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "accumulator-band", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "steel"}}, "material": "steel", "materialLayers": ["steel"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout"};
  node_accumulator_band_15.add(mesh_accumulator_band_15);
  meshes["accumulator-band"] = mesh_accumulator_band_15;
  colliders["accumulator-band"] = {"type": "box", "offset": [0, 0, 0], "scale": [0.87, 0.87, 0.87], "isTrigger": false, "notes": "inspection pick proxy"};
  destructionGroups["accumulator-band"] ??= [];
  destructionGroups["accumulator-band"].push(node_accumulator_band_15);

  const attachment_pressure_hose_16 = null;
  const endpoint_pressure_hose_16 = makeAttachmentEndpoint(attachment_pressure_hose_16);
  const node_pressure_hose_16 = new THREE.Group();
  node_pressure_hose_16.name = "\u9ad8\u538b\u8f6f\u7ba1__pivot";
  if (endpoint_pressure_hose_16) {
    node_pressure_hose_16.position.copy(endpoint_pressure_hose_16.start);
    node_pressure_hose_16.rotation.set(0, 0, 0);
    node_pressure_hose_16.scale.set(1, 1, 1);
  } else {
    node_pressure_hose_16.position.set(0.0, 0.0, 0.0);
    node_pressure_hose_16.rotation.set(0.0, 0.0, 0.0);
    node_pressure_hose_16.scale.set(1.0, 1.0, 1.0);
  }
  node_pressure_hose_16.userData.sculptComponent = {"id": "pressure-hose", "name": "高压软管", "level": "macro", "role": "hose", "importance": 0.8, "confidence": 0.82, "primitive": "tube", "topologyClass": "tube-network", "topologyRationale": "Procedural browser locator built from observable hard-surface primitives; hidden structure remains approximate.", "geometryDescriptor": {"topologyIntent": "browser diagnostic locator with stable selectable hierarchy", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.025, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry", "tubePath": {"points": [[-0.82, -0.35, 0.46], [-0.25, 0.16, 0.62], [0.2, 0.65, 0.42], [0.7, 0.46, 0.25]], "radius": 0.09, "closed": false}}, "parent": "root", "attachment": null, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.76}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "hose", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "inspection pick proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "pressure-hose", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "rubber"}}, "material": "rubber", "materialLayers": ["rubber"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "hose-couplings", "kind": "seam", "description": "metal hose couplings", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout"};
  node_pressure_hose_16.userData.actionProfile = {"animationRole": "hose", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "inspection pick proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "pressure-hose", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "rubber"}};
  (nodes["root"] ?? root).add(node_pressure_hose_16);
  nodes["pressure-hose"] = node_pressure_hose_16;
  const mesh_pressure_hose_16Geometry = endpoint_pressure_hose_16
    ? new THREE.CylinderGeometry(endpoint_pressure_hose_16.endRadius, endpoint_pressure_hose_16.baseRadius, endpoint_pressure_hose_16.length, 32, 12)
    : buildTubeGeometry({"points": [[-0.82, -0.35, 0.46], [-0.25, 0.16, 0.62], [0.2, 0.65, 0.42], [0.7, 0.46, 0.25]], "radius": 0.09, "closed": false});
  const mesh_pressure_hose_16 = new THREE.Mesh(
    mesh_pressure_hose_16Geometry,
    materialMap["rubber"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_pressure_hose_16.name = "\u9ad8\u538b\u8f6f\u7ba1";
  if (endpoint_pressure_hose_16) {
    mesh_pressure_hose_16.position.copy(endpoint_pressure_hose_16.midpoint);
    mesh_pressure_hose_16.quaternion.copy(endpoint_pressure_hose_16.quaternion);
  }
  mesh_pressure_hose_16.castShadow = options.castShadow ?? true;
  mesh_pressure_hose_16.receiveShadow = options.receiveShadow ?? true;
  mesh_pressure_hose_16.userData.sculptComponent = {"id": "pressure-hose", "name": "高压软管", "level": "macro", "role": "hose", "importance": 0.8, "confidence": 0.82, "primitive": "tube", "topologyClass": "tube-network", "topologyRationale": "Procedural browser locator built from observable hard-surface primitives; hidden structure remains approximate.", "geometryDescriptor": {"topologyIntent": "browser diagnostic locator with stable selectable hierarchy", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.025, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry", "tubePath": {"points": [[-0.82, -0.35, 0.46], [-0.25, 0.16, 0.62], [0.2, 0.65, 0.42], [0.7, 0.46, 0.25]], "radius": 0.09, "closed": false}}, "parent": "root", "attachment": null, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.76}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "hose", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "inspection pick proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "pressure-hose", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "rubber"}}, "material": "rubber", "materialLayers": ["rubber"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "hose-couplings", "kind": "seam", "description": "metal hose couplings", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout"};
  node_pressure_hose_16.add(mesh_pressure_hose_16);
  meshes["pressure-hose"] = mesh_pressure_hose_16;
  colliders["pressure-hose"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "inspection pick proxy"};
  destructionGroups["pressure-hose"] ??= [];
  destructionGroups["pressure-hose"].push(node_pressure_hose_16);

  const attachment_cooler_hose_17 = null;
  const endpoint_cooler_hose_17 = makeAttachmentEndpoint(attachment_cooler_hose_17);
  const node_cooler_hose_17 = new THREE.Group();
  node_cooler_hose_17.name = "\u51b7\u5374\u56de\u8def\u8f6f\u7ba1__pivot";
  if (endpoint_cooler_hose_17) {
    node_cooler_hose_17.position.copy(endpoint_cooler_hose_17.start);
    node_cooler_hose_17.rotation.set(0, 0, 0);
    node_cooler_hose_17.scale.set(1, 1, 1);
  } else {
    node_cooler_hose_17.position.set(0.0, 0.0, 0.0);
    node_cooler_hose_17.rotation.set(0.0, 0.0, 0.0);
    node_cooler_hose_17.scale.set(1.0, 1.0, 1.0);
  }
  node_cooler_hose_17.userData.sculptComponent = {"id": "cooler-hose", "name": "冷却回路软管", "level": "macro", "role": "hose", "importance": 0.8, "confidence": 0.82, "primitive": "tube", "topologyClass": "tube-network", "topologyRationale": "Procedural browser locator built from observable hard-surface primitives; hidden structure remains approximate.", "geometryDescriptor": {"topologyIntent": "browser diagnostic locator with stable selectable hierarchy", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.025, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry", "tubePath": {"points": [[1.15, -0.2, 0.55], [1.55, 0.32, 0.76], [1.94, 0.55, 0.68], [2.14, 0.42, 0.42]], "radius": 0.075, "closed": false}}, "parent": "root", "attachment": null, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.76}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "hose", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "inspection pick proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "cooler-hose", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "rubber"}}, "material": "rubber", "materialLayers": ["rubber"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout"};
  node_cooler_hose_17.userData.actionProfile = {"animationRole": "hose", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "inspection pick proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "cooler-hose", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "rubber"}};
  (nodes["root"] ?? root).add(node_cooler_hose_17);
  nodes["cooler-hose"] = node_cooler_hose_17;
  const mesh_cooler_hose_17Geometry = endpoint_cooler_hose_17
    ? new THREE.CylinderGeometry(endpoint_cooler_hose_17.endRadius, endpoint_cooler_hose_17.baseRadius, endpoint_cooler_hose_17.length, 32, 12)
    : buildTubeGeometry({"points": [[1.15, -0.2, 0.55], [1.55, 0.32, 0.76], [1.94, 0.55, 0.68], [2.14, 0.42, 0.42]], "radius": 0.075, "closed": false});
  const mesh_cooler_hose_17 = new THREE.Mesh(
    mesh_cooler_hose_17Geometry,
    materialMap["rubber"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_cooler_hose_17.name = "\u51b7\u5374\u56de\u8def\u8f6f\u7ba1";
  if (endpoint_cooler_hose_17) {
    mesh_cooler_hose_17.position.copy(endpoint_cooler_hose_17.midpoint);
    mesh_cooler_hose_17.quaternion.copy(endpoint_cooler_hose_17.quaternion);
  }
  mesh_cooler_hose_17.castShadow = options.castShadow ?? true;
  mesh_cooler_hose_17.receiveShadow = options.receiveShadow ?? true;
  mesh_cooler_hose_17.userData.sculptComponent = {"id": "cooler-hose", "name": "冷却回路软管", "level": "macro", "role": "hose", "importance": 0.8, "confidence": 0.82, "primitive": "tube", "topologyClass": "tube-network", "topologyRationale": "Procedural browser locator built from observable hard-surface primitives; hidden structure remains approximate.", "geometryDescriptor": {"topologyIntent": "browser diagnostic locator with stable selectable hierarchy", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.025, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry", "tubePath": {"points": [[1.15, -0.2, 0.55], [1.55, 0.32, 0.76], [1.94, 0.55, 0.68], [2.14, 0.42, 0.42]], "radius": 0.075, "closed": false}}, "parent": "root", "attachment": null, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.76}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "hose", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "inspection pick proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "cooler-hose", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "rubber"}}, "material": "rubber", "materialLayers": ["rubber"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout"};
  node_cooler_hose_17.add(mesh_cooler_hose_17);
  meshes["cooler-hose"] = mesh_cooler_hose_17;
  colliders["cooler-hose"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "inspection pick proxy"};
  destructionGroups["cooler-hose"] ??= [];
  destructionGroups["cooler-hose"].push(node_cooler_hose_17);

  const attachment_level_gauge_18 = null;
  const endpoint_level_gauge_18 = makeAttachmentEndpoint(attachment_level_gauge_18);
  const node_level_gauge_18 = new THREE.Group();
  node_level_gauge_18.name = "\u6cb9\u4f4d\u8ba1__pivot";
  if (endpoint_level_gauge_18) {
    node_level_gauge_18.position.copy(endpoint_level_gauge_18.start);
    node_level_gauge_18.rotation.set(0, 0, 0);
    node_level_gauge_18.scale.set(1, 1, 1);
  } else {
    node_level_gauge_18.position.set(1.94, -0.7, 0.72);
    node_level_gauge_18.rotation.set(0.0, 0.0, 0.0);
    node_level_gauge_18.scale.set(0.11, 0.65, 0.1);
  }
  node_level_gauge_18.userData.sculptComponent = {"id": "level-gauge", "name": "油位计", "level": "macro", "role": "instrument", "importance": 0.8, "confidence": 0.82, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Procedural browser locator built from observable hard-surface primitives; hidden structure remains approximate.", "geometryDescriptor": {"topologyIntent": "browser diagnostic locator with stable selectable hierarchy", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.025, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.11, "height": 0.65, "depth": 0.1, "units": "relative", "confidence": 0.76}, "transform": {"position": [1.94, -0.7, 0.72], "rotation": [0, 0, 0], "scale": [0.11, 0.65, 0.1]}, "actionProfile": {"animationRole": "instrument", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.11, 0.65, 0.1], "isTrigger": false, "notes": "inspection pick proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "level-gauge", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "warning"}}, "material": "warning", "materialLayers": ["warning"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "level-window", "kind": "linework", "description": "oil level window", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout"};
  node_level_gauge_18.userData.actionProfile = {"animationRole": "instrument", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.11, 0.65, 0.1], "isTrigger": false, "notes": "inspection pick proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "level-gauge", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "warning"}};
  (nodes["root"] ?? root).add(node_level_gauge_18);
  nodes["level-gauge"] = node_level_gauge_18;
  const mesh_level_gauge_18Geometry = endpoint_level_gauge_18
    ? new THREE.CylinderGeometry(endpoint_level_gauge_18.endRadius, endpoint_level_gauge_18.baseRadius, endpoint_level_gauge_18.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_level_gauge_18 = new THREE.Mesh(
    mesh_level_gauge_18Geometry,
    materialMap["warning"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_level_gauge_18.name = "\u6cb9\u4f4d\u8ba1";
  if (endpoint_level_gauge_18) {
    mesh_level_gauge_18.position.copy(endpoint_level_gauge_18.midpoint);
    mesh_level_gauge_18.quaternion.copy(endpoint_level_gauge_18.quaternion);
  }
  mesh_level_gauge_18.castShadow = options.castShadow ?? true;
  mesh_level_gauge_18.receiveShadow = options.receiveShadow ?? true;
  mesh_level_gauge_18.userData.sculptComponent = {"id": "level-gauge", "name": "油位计", "level": "macro", "role": "instrument", "importance": 0.8, "confidence": 0.82, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Procedural browser locator built from observable hard-surface primitives; hidden structure remains approximate.", "geometryDescriptor": {"topologyIntent": "browser diagnostic locator with stable selectable hierarchy", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.025, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.11, "height": 0.65, "depth": 0.1, "units": "relative", "confidence": 0.76}, "transform": {"position": [1.94, -0.7, 0.72], "rotation": [0, 0, 0], "scale": [0.11, 0.65, 0.1]}, "actionProfile": {"animationRole": "instrument", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.11, 0.65, 0.1], "isTrigger": false, "notes": "inspection pick proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "level-gauge", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "warning"}}, "material": "warning", "materialLayers": ["warning"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "level-window", "kind": "linework", "description": "oil level window", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout"};
  node_level_gauge_18.add(mesh_level_gauge_18);
  meshes["level-gauge"] = mesh_level_gauge_18;
  colliders["level-gauge"] = {"type": "box", "offset": [0, 0, 0], "scale": [0.11, 0.65, 0.1], "isTrigger": false, "notes": "inspection pick proxy"};
  destructionGroups["level-gauge"] ??= [];
  destructionGroups["level-gauge"].push(node_level_gauge_18);

  // repetition system: pump-flange-bolts (InstancedMesh, radial, count=8, level=macro)
  {
    const parent = nodes["pump-flange"] ?? root;
    const geo = new THREE.CylinderGeometry(0.5, 0.5, 1, 48, 16);
    const mat = materialMap["steel"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 });
    const scl = [0.1, 0.16, 0.1];
    const axis = new THREE.Vector3(1.0, 0.0, 0.0).normalize();
    const radius = 0.72;
    const seed = Math.abs(axis.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
    const perp = new THREE.Vector3().crossVectors(axis, seed).normalize();
    // One InstancedMesh = one draw call for all repeated parts (teeth/fasteners/spokes),
    // replacing the former per-instance Mesh clone loop (real-time perf principle).
    const cluster = new THREE.InstancedMesh(geo, mat, 8);
    const _m = new THREE.Matrix4();
    const _p = new THREE.Vector3();
    const _q = new THREE.Quaternion();
    const _s = new THREE.Vector3(scl[0], scl[1], scl[2]);
    for (let i = 0; i < 8; i++) {
      const ang = ((22.5) + (i * 360) / 8) * Math.PI / 180;
      const dir = perp.clone().applyQuaternion(new THREE.Quaternion().setFromAxisAngle(axis, ang));
      _p.copy(radius > 0 ? dir.clone().multiplyScalar(radius * 0.5) : new THREE.Vector3());
      _q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
      _m.compose(_p, _q, _s);
      cluster.setMatrixAt(i, _m);
    }
    cluster.instanceMatrix.needsUpdate = true;
    cluster.castShadow = options.castShadow ?? true;
    cluster.receiveShadow = options.receiveShadow ?? true;
    cluster.name = "pump-flange-bolts";
    parent.add(cluster);
  }

  // repetition system: cooler-fan-spokes (InstancedMesh, radial, count=8, level=macro)
  {
    const parent = nodes["cooler-fan"] ?? root;
    const geo = new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
    const mat = materialMap["steel"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 });
    const scl = [1.2, 0.035, 0.04];
    const axis = new THREE.Vector3(1.0, 0.0, 0.0).normalize();
    const radius = 0.0;
    const seed = Math.abs(axis.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
    const perp = new THREE.Vector3().crossVectors(axis, seed).normalize();
    // One InstancedMesh = one draw call for all repeated parts (teeth/fasteners/spokes),
    // replacing the former per-instance Mesh clone loop (real-time perf principle).
    const cluster = new THREE.InstancedMesh(geo, mat, 8);
    const _m = new THREE.Matrix4();
    const _p = new THREE.Vector3();
    const _q = new THREE.Quaternion();
    const _s = new THREE.Vector3(scl[0], scl[1], scl[2]);
    for (let i = 0; i < 8; i++) {
      const ang = ((0.0) + (i * 360) / 8) * Math.PI / 180;
      const dir = perp.clone().applyQuaternion(new THREE.Quaternion().setFromAxisAngle(axis, ang));
      _p.copy(radius > 0 ? dir.clone().multiplyScalar(radius * 0.5) : new THREE.Vector3());
      _q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
      _m.compose(_p, _q, _s);
      cluster.setMatrixAt(i, _m);
    }
    cluster.instanceMatrix.needsUpdate = true;
    cluster.castShadow = options.castShadow ?? true;
    cluster.receiveShadow = options.receiveShadow ?? true;
    cluster.name = "cooler-fan-spokes";
    parent.add(cluster);
  }

  root.userData.sculptRuntime = { nodes, meshes, sockets, colliders, destructionGroups } satisfies ProceduralModelRuntime;
  root.userData.lookDevTargets = {"background": "#07121d", "neutralView": {"camera": [6.8, 4.7, 8.6], "target": [0, -0.35, 0]}, "inspectionTargets": ["pump", "valve", "cooler", "accumulator"]};
  root.userData.actionReadiness = {
    note: 'Use root.userData.sculptRuntime.nodes for transforms, sockets for attachments, colliders for physics proxies, and destructionGroups for breakable sets.',
  };
  return root;
}

export function createHydraulicPowerUnitLookDevLights(
  mode: 'neutral' | 'grazing' | 'reference' = 'neutral',
): THREE.Group {
  const lights = new THREE.Group();
  lights.name = "Hydraulic Power Unit look-dev lights";
  const hemi = new THREE.HemisphereLight(
    mode === 'reference' ? 0xfff0d6 : 0xf2f4ff,
    0x363b42,
    mode === 'grazing' ? 0.28 : mode === 'reference' ? 0.72 : 0.85,
  );
  lights.add(hemi);
  const key = new THREE.DirectionalLight(
    mode === 'reference' ? 0xffcf8a : 0xfff4e8,
    mode === 'grazing' ? 4.2 : mode === 'reference' ? 2.6 : 2.15,
  );
  if (mode === 'grazing') key.position.set(7.5, 1.1, 4.0);
  else if (mode === 'reference') key.position.set(-4.5, 7.5, 5.0);
  else key.position.set(-4.0, 6.0, 5.5);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  key.shadow.bias = -0.00025;
  key.shadow.normalBias = 0.018;
  key.shadow.radius = 7;
  key.shadow.blurSamples = 24;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 30;
  key.shadow.camera.left = -2.6;
  key.shadow.camera.right = 2.6;
  key.shadow.camera.top = 2.6;
  key.shadow.camera.bottom = -2.6;
  key.shadow.camera.updateProjectionMatrix();
  lights.add(key);
  const fill = new THREE.DirectionalLight(0xa8c4ff, mode === 'grazing' ? 0.12 : 0.42);
  fill.position.set(4.0, 3.0, 3.5);
  lights.add(fill);
  const rim = new THREE.DirectionalLight(0xfff1c4, mode === 'grazing' ? 0.28 : 0.85);
  rim.position.set(0.5, 4.5, -6.0);
  lights.add(rim);
  lights.userData.reviewMode = mode;
  lights.userData.lightingFromPhoto = [{"id": "key", "type": "directional", "direction": [-4, 7, 5], "color": "#e9f3ff", "intensity": 2.1, "evidenceRef": "full-object"}, {"id": "fill", "type": "hemisphere", "direction": [0, 1, 0], "color": "#8ec5ff", "intensity": 0.72, "evidenceRef": "full-object"}];
  lights.userData.lookDevTargets = {"background": "#07121d", "neutralView": {"camera": [6.8, 4.7, 8.6], "target": [0, -0.35, 0]}, "inspectionTargets": ["pump", "valve", "cooler", "accumulator"]};
  return lights;
}

// PBR materials (clearcoat/iridescence/transmission/anisotropy) need an environment
// map to visually behave as intended — call this once per renderer and assign the
// result to scene.environment before rendering. No external HDR asset required.
export function createHydraulicPowerUnitEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  return texture;
}

// Plan 1.3 §3.2 — auto-framing by bounding box. The Divine Eye can only compare a
// render to the reference if the object is FRAMED consistently (an object framed
// differently scores as wrong even when its shape is right). This positions the camera
// deterministically from the object's bounding box so it fills the frame at a stable
// margin, and sets near/far to the object scale. Call after adding the model to the
// scene, and again on resize (after updating camera.aspect).
export function frameHydraulicPowerUnitCamera(
  camera: THREE.PerspectiveCamera,
  object: THREE.Object3D,
  options: { margin?: number; azimuthDeg?: number; elevationDeg?: number } = {},
): void {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const margin = options.margin ?? 1.15;
  const maxDim = Math.max(size.x, size.y, size.z) * margin;
  const fov = (camera.fov * Math.PI) / 180;
  // distance so the largest object dimension fits vertically in the frame
  const distance = (maxDim / 2) / Math.tan(fov / 2);
  const az = ((options.azimuthDeg ?? 0) * Math.PI) / 180;
  const el = ((options.elevationDeg ?? 0) * Math.PI) / 180;
  const dir = new THREE.Vector3(
    Math.sin(az) * Math.cos(el),
    Math.sin(el),
    Math.cos(az) * Math.cos(el),
  );
  camera.position.copy(center).addScaledVector(dir, distance);
  camera.near = Math.max(0.01, distance - maxDim);
  camera.far = distance + maxDim * 2;
  camera.lookAt(center);
  camera.updateProjectionMatrix();
}

// Plan 1.3 §3.2c — PRESENTATION composer (DOF + bloom). CRITICAL (R-POSTFX): this is
// for the showcase/hero render ONLY. The Divine Eye's EVALUATION render MUST use a
// plain renderer with NO composer — bloom blows highlights and DOF blurs edges, which
// would corrupt the deterministic IoU/DCD/edge/blowout signals. Enable dof/bloom ONLY
// when the reference photo actually exhibits them (detect_reference_effects.py authorizes).
export function createHydraulicPowerUnitPresentationComposer(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  options: { dof?: boolean; bloom?: boolean; bloomStrength?: number; dofFocus?: number; dofAperture?: number } = {},
): EffectComposer {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  if (options.dof) {
    composer.addPass(new BokehPass(scene, camera, {
      focus: options.dofFocus ?? 10.0,
      aperture: options.dofAperture ?? 0.0002,
      maxblur: 0.01,
    }));
  }
  if (options.bloom) {
    const size = new THREE.Vector2();
    renderer.getSize(size);
    composer.addPass(new UnrealBloomPass(size, options.bloomStrength ?? 0.4, 0.4, 0.85));
  }
  return composer;
}

export function configureHydraulicPowerUnitRenderer(renderer: THREE.WebGLRenderer): void {
  // Load-bearing for view-dependent finishes (anodized / Doppler): without ACES + sRGB
  // the environment reflection reads flat/washed instead of a believable metal response.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
}

export function createHydraulicPowerUnitInspectControls(
  camera: THREE.Camera,
  domElement: HTMLElement,
): OrbitControls {
  // View-dependent finishes only read correctly once the user orbits — their color
  // comes from the environment reflection, not albedo, so free rotation matters here.
  const controls = new OrbitControls(camera, domElement);
  controls.enableDamping = true;
  controls.minDistance = 1.0;
  controls.maxDistance = 8.0;
  controls.autoRotate = false;
  return controls;
}
