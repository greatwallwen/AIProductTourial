import type { CaseProjection } from "@course-ai-product/case-runtime";
import type { SceneModel, SceneNode, SceneStatus } from "./types";

const waferSensors = [
  "sensor_161",
  "sensor_159",
  "sensor_021",
  "sensor_024",
  "sensor_158",
  "sensor_160",
  "sensor_294",
  "sensor_162",
  "sensor_296",
  "sensor_295",
  "sensor_022",
  "sensor_090",
] as const;

const hydraulicComponents = [
  { id: "cooler", label: "冷却器" },
  { id: "valve", label: "阀" },
  { id: "pump", label: "泵" },
  { id: "accumulator", label: "蓄能器" },
] as const;

function numeric(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function rounded(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function severity(value: unknown): SceneStatus {
  if (value === "critical" || value === "fail" || value === "urgent") {
    return "critical";
  }
  if (value === "attention" || value === "warning" || value === "medium") {
    return "attention";
  }
  if (value === "normal" || value === "pass") {
    return "normal";
  }
  return "unknown";
}

function waferModel(projection: CaseProjection): SceneModel {
  const nodes = waferSensors.map((sensor, index): SceneNode => {
    const angle = (index / waferSensors.length) * Math.PI * 2 - Math.PI / 2;
    const value = numeric(projection.payload[sensor]);
    return {
      id: sensor,
      label: `匿名测点 ${sensor.slice(-3)}`,
      kind: "sensor",
      value,
      status: value === undefined ? "unknown" : "normal",
      position: [rounded(Math.cos(angle) * 3.2), 0.12, rounded(Math.sin(angle) * 3.2)],
    };
  });
  const missing = nodes.filter((node) => node.status === "unknown").length;
  return {
    caseId: "15",
    title: `${String(projection.payload.wafer_id ?? projection.objectId)} 匿名测点`,
    disclosure: "示意结构",
    nodes,
    legend: [
      { status: "normal", label: "有读数" },
      { status: "unknown", label: "数据缺失" },
    ],
    textAlternative: `12 个匿名测点中 ${missing} 个缺少读数；位置仅用于比较，不代表真实晶圆坐标。`,
  };
}

function windModel(projection: CaseProjection): SceneModel {
  const day = String(projection.payload.day ?? "1");
  const selectedTurbine = String(projection.payload.turbine_id ?? "7");
  const underperformance = numeric(projection.payload.underperformance_share);
  const nodes = Array.from({ length: 9 }, (_, index): SceneNode => {
    const turbine = String(index + 1);
    const selected = turbine === selectedTurbine;
    return {
      id: selected ? projection.objectId : `16-${turbine}-${day}`,
      label: `T${turbine.padStart(3, "0")}`,
      kind: "turbine",
      value: selected ? numeric(projection.payload.mean_active_power) : undefined,
      status: selected
        ? underperformance !== undefined && underperformance > 0
          ? "attention"
          : "normal"
        : "unknown",
      position: [(index % 3 - 1) * 2.7, 0, (Math.floor(index / 3) - 1) * 2.7],
    };
  });
  return {
    caseId: "16",
    title: `T${selectedTurbine.padStart(3, "0")} / Day ${day} 同群比较`,
    disclosure: "比较视图",
    nodes,
    legend: [
      { status: "attention", label: "当前核查对象" },
      { status: "unknown", label: "比较位置" },
    ],
    textAlternative: "九宫格用于整理同群比较，不代表真实风场坐标或尾流关系。",
  };
}

function hydraulicModel(projection: CaseProjection): SceneModel {
  const nodes = hydraulicComponents.map((component, index): SceneNode => {
    const status = severity(projection.payload[`${component.id}_severity`]);
    return {
      id: component.id,
      label: component.label,
      kind: "component",
      status,
      position: [(index - 1.5) * 2.25, 0, index % 2 === 0 ? -0.7 : 0.7],
    };
  });
  return {
    caseId: "19",
    title: `循环 H-${String(projection.payload.cycle_id ?? "").padStart(4, "0")} 部件状态`,
    disclosure: "示意结构",
    nodes,
    legend: [
      { status: "normal", label: "记录正常" },
      { status: "attention", label: "需要关注" },
      { status: "critical", label: "优先核查" },
      { status: "unknown", label: "状态未知" },
    ],
    textAlternative: "四个模块按检查语境排列，不代表现场管路结构。",
  };
}

function solarModel(projection: CaseProjection): SceneModel {
  const selectedStation = String(projection.payload.station_id ?? "8");
  const date = String(projection.payload.date ?? "");
  const suspectedShare = numeric(projection.payload.curtailment_suspected_share);
  const nodes = Array.from({ length: 8 }, (_, index): SceneNode => {
    const station = String(index + 1);
    const selected = station === selectedStation;
    return {
      id: selected ? projection.objectId : `20-${station}-${date}`,
      label: `PV-${station.padStart(2, "0")}`,
      kind: "station",
      value: selected ? numeric(projection.payload.mean_efficiency_ratio) : undefined,
      status: selected
        ? suspectedShare !== undefined && suspectedShare > 0
          ? "attention"
          : "normal"
        : "unknown",
      position: [(index % 4 - 1.5) * 2.2, 0, (Math.floor(index / 4) - 0.5) * 2.8],
    };
  });
  return {
    caseId: "20",
    title: `PV-${selectedStation.padStart(2, "0")} / ${date} 站日比较`,
    disclosure: "比较视图",
    nodes,
    legend: [
      { status: "attention", label: "当前复核对象" },
      { status: "unknown", label: "其他场站位置" },
    ],
    textAlternative: "八站阵列用于站日线索比较，不表示真实地理位置。",
  };
}

export function buildSceneModel(
  caseId: string,
  projection: CaseProjection,
): SceneModel | undefined {
  if (caseId === "15") return waferModel(projection);
  if (caseId === "16") return windModel(projection);
  if (caseId === "19") return hydraulicModel(projection);
  if (caseId === "20") return solarModel(projection);
  return undefined;
}
