// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CourseCapabilityMap } from "../src/components/CourseCapabilityMap";
import { CAPABILITY_STORAGE_KEY } from "../src/lib/course-capabilities";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("CourseCapabilityMap", () => {
  it("shows the seven-layer course spine before the case catalog", () => {
    render(<CourseCapabilityMap onOpenCases={() => undefined} />);

    const map = screen.getByLabelText("课程能力地图");
    expect(within(map).getByRole("heading", { name: "从一句好 Prompt，到一套能交付的智能系统" })).toBeVisible();
    expect(within(map).getAllByRole("button", { name: /^\d\. / })).toHaveLength(7);
    expect(within(map).getByRole("button", { name: "1. 逻辑与证据，未点亮" })).toBeVisible();
    expect(within(map).getByText("事实 / 推断 / 决定")).toBeVisible();
  });

  it("lets the instructor select and persist independently lit layers", () => {
    render(<CourseCapabilityMap onOpenCases={() => undefined} />);

    fireEvent.click(screen.getByRole("button", { name: "3. Agent + Skills，未点亮" }));
    expect(screen.getByRole("heading", { name: "Agent + Skills" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "点亮当前层" }));

    expect(screen.getByText("1 / 7")).toBeVisible();
    expect(screen.getByRole("button", { name: "3. Agent + Skills，已点亮" })).toBeVisible();
    expect(JSON.parse(window.localStorage.getItem(CAPABILITY_STORAGE_KEY) ?? "[]")).toEqual(["agent-skills"]);

    fireEvent.click(screen.getByRole("button", { name: "重置点亮" }));
    expect(screen.getByText("0 / 7")).toBeVisible();
  });

  it("opens the business-case cockpit only on an explicit action", () => {
    let opened = false;
    render(<CourseCapabilityMap onOpenCases={() => { opened = true; }} />);

    fireEvent.click(screen.getByRole("button", { name: "7. 综合业务案例，未点亮" }));
    fireEvent.click(screen.getByRole("button", { name: /进入 24 个综合案例/ }));
    expect(opened).toBe(true);
  });
});
