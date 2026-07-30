export type SceneStatus = "normal" | "attention" | "critical" | "unknown";

export type SceneNode = {
  id: string;
  label: string;
  kind: string;
  value?: number;
  status: SceneStatus;
  position: [number, number, number];
};

export type SceneModel = {
  caseId: "B015" | "B016" | "B019" | "B020";
  title: string;
  disclosure: "比较视图" | "示意结构";
  nodes: SceneNode[];
  legend: Array<{ status: SceneStatus; label: string }>;
  textAlternative: string;
};
