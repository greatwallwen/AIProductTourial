// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import manifest from "../../../course-manifest.json";
import { CASES } from "../../cases/registry";
import { CaseCatalog } from "../src/components/CaseCatalog";
import { buildCatalogCases, type CourseManifest } from "../src/lib/catalog-adapter";

const catalogCases = buildCatalogCases(CASES, manifest as CourseManifest);

afterEach(cleanup);

describe("CaseCatalog", () => {
  it("opens with one selected business scene and a user-controlled 24-case filmstrip", () => {
    render(<CaseCatalog cases={catalogCases} />);

    const stage = screen.getByLabelText("案例舞台");
    expect(within(stage).getByRole("heading", { name: "跨境售后异常调查" })).toBeVisible();
    expect(within(stage).getByRole("link", { name: "一张 8.17 万元取消单，缺的是哪张原单？" })).toHaveAttribute(
      "href",
      "/cases/B001",
    );
    expect(within(stage).getByText("发票：B001-C496116-M")).toBeVisible();
    expect(within(stage).getByRole("link", { name: "进入案例：跨境售后异常调查" })).toHaveAttribute(
      "href",
      "/cases/B001",
    );

    const filmstrip = screen.getByLabelText("选择案例");
    expect(within(filmstrip).getAllByRole("button", { name: /^选择案例 B\d{3}/ })).toHaveLength(24);

    fireEvent.click(within(filmstrip).getByRole("button", { name: /选择案例 B002/ }));
    const updatedStage = screen.getByLabelText("案例舞台");
    expect(within(updatedStage).getByRole("heading", { name: catalogCases[1]!.shortTitle })).toBeVisible();
    expect(within(updatedStage).getByRole("link", { name: `进入案例：${catalogCases[1]!.shortTitle}` })).toHaveAttribute(
      "href",
      "/cases/B002",
    );
  });

  it("supports deliberate keyboard and wheel selection without an automatic carousel", () => {
    render(<CaseCatalog cases={catalogCases} />);

    const filmstrip = screen.getByLabelText("选择案例");
    fireEvent.keyDown(filmstrip, { key: "ArrowRight" });
    expect(screen.getByRole("heading", { name: catalogCases[1]!.shortTitle })).toBeVisible();

    fireEvent.wheel(filmstrip, { deltaY: 120 });
    expect(screen.getByRole("heading", { name: catalogCases[2]!.shortTitle })).toBeVisible();

    expect(document.querySelector("[data-autoplay='true']")).not.toBeInTheDocument();
  });

  it("keeps each case journey specific instead of repeating a shared generic loop", () => {
    render(<CaseCatalog cases={catalogCases} />);

    const journey = screen.getByLabelText("当前案例流程");
    expect(within(journey).getAllByRole("listitem").length).toBeGreaterThan(2);
    expect(within(journey).getByText(catalogCases[0]!.journeySteps[0]!)).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /选择案例 B003/ }));
    expect(within(screen.getByLabelText("当前案例流程")).getByText(catalogCases[2]!.journeySteps[0]!)).toBeVisible();
    expect(catalogCases[2]!.journeySteps).not.toEqual(catalogCases[0]!.journeySteps);
  });
});
