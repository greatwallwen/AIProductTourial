// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SpatialEvidenceStage } from "../src/components/spatial/SpatialEvidenceStage";
import type { SceneModel } from "../src/components/spatial/types";

const model: SceneModel = {
  caseId: "B019",
  title: "循环 H-0217 部件状态",
  disclosure: "示意结构",
  nodes: [
    {
      id: "cooler",
      label: "冷却器",
      kind: "component",
      status: "critical",
      position: [-2, 0, 0],
    },
    {
      id: "pump",
      label: "泵",
      kind: "component",
      status: "normal",
      position: [2, 0, 0],
    },
  ],
  legend: [
    { status: "critical", label: "优先核查" },
    { status: "normal", label: "记录正常" },
  ],
  textAlternative: "四个模块按检查语境排列，不代表现场管路结构。",
};

afterEach(cleanup);

describe("SpatialEvidenceStage", () => {
  it("keeps a complete static path when WebGL is unavailable", () => {
    render(<SpatialEvidenceStage model={model} forceFallback />);

    expect(
      screen.getByRole("region", { name: "循环 H-0217 部件状态" }),
    ).toBeVisible();
    expect(screen.getByText("示意结构")).toBeVisible();
    expect(screen.getByText(model.textAlternative)).toBeVisible();
    expect(screen.getByRole("button", { name: "选择冷却器" })).toBeEnabled();
  });

  it("reports local scene selection without changing business state", () => {
    const onSelectNode = vi.fn();
    render(
      <SpatialEvidenceStage
        model={model}
        forceFallback
        selectedNodeId="cooler"
        onSelectNode={onSelectNode}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "选择泵" }));

    expect(onSelectNode).toHaveBeenCalledWith("pump");
  });
});
