import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(process.cwd(), "../..");

describe("案例 19 的空间检查合同", () => {
  it("img2threejs 规格保留四个业务检查节点和浏览器性能预算", () => {
    const spec = JSON.parse(readFileSync(
      resolve(projectRoot, "assets/cases/case-B019/spatial-contract.json"),
      "utf8",
    )) as {
      componentTree: Array<{ id: string; parent: string | null }>;
      performanceBudget: { targetTriangles: number; maxDrawCalls: number; fpsTarget: number };
      approximationNotes: string[];
    };
    const ids = spec.componentTree.map((item) => item.id);

    expect(ids).toEqual(expect.arrayContaining(["pump", "valve", "cooler", "accumulator"]));
    expect(spec.componentTree.filter((item) => item.id !== "root").every((item) => item.parent === "root")).toBe(true);
    expect(spec.performanceBudget).toMatchObject({ targetTriangles: 90000, maxDrawCalls: 42, fpsTarget: 45 });
    expect(spec.approximationNotes.join(" ")).toMatch(/Single-view|not be used/);
  });

  it("生成工厂保留来源归属并暴露稳定节点运行时", () => {
    const generated = readFileSync(
      resolve(process.cwd(), "src/components/spatial/generated/createHydraulicPowerUnit.ts"),
      "utf8",
    );

    expect(generated).toContain("img2threejs at commit 9614f1ac830bb3977b186ebf98af0f75796742ed");
    expect(generated).toContain("export function createHydraulicPowerUnitModel");
    expect(generated).toContain("root.userData.sculptRuntime = { nodes, meshes");
  });

  it("工作台按需加载三维场景，并把选择与排序状态传入场景", () => {
    const workbench = readFileSync(
      resolve(process.cwd(), "src/components/workbenches/case-specific/HydraulicConditionWorkbench.tsx"),
      "utf8",
    );

    expect(workbench).toMatch(/dynamic\(\s*\(\) => import\([^)]*HydraulicPowerUnitScene[^)]*\)[\s\S]*ssr:\s*false/);
    expect(workbench).toContain("selectedComponent={focused}");
    expect(workbench).toContain("inspectionOrder={inspectionOrder}");
    expect(workbench).toContain("onSelectComponent={inspectComponent}");
  });
});
