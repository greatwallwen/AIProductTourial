import "@testing-library/jest-dom/vitest";
import { act } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CaseNav, CommandBar, DataTable } from "../src";

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe("shared product controls", () => {
  it("renders accessible task navigation", () => {
    render(
      <CaseNav
        active="work"
        caseId="01"
        items={[
          { id: "overview", label: "总览" },
          { id: "work", label: "调查台" },
        ]}
      />,
    );
    expect(screen.getByRole("navigation", { name: "案例任务" })).toBeVisible();
    expect(screen.getByRole("link", { name: "调查台" })).toHaveAttribute("aria-current", "page");
  });

  it("submits named commands and honors busy state", () => {
    const handler = vi.fn();
    const { rerender } = render(
      <CommandBar
        busy={false}
        commands={[{ id: "review", label: "提交复核", tone: "primary" }]}
        onCommand={handler}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "提交复核" }));
    expect(handler).toHaveBeenCalledWith("review");
    rerender(
      <CommandBar
        busy
        commands={[{ id: "review", label: "提交复核", tone: "primary" }]}
        onCommand={handler}
      />,
    );
    expect(screen.getByRole("button", { name: "提交复核" })).toBeDisabled();
  });

  it("does not report a hydration mismatch when a table-capture extension adds metadata", async () => {
    const props = {
      columns: [{ key: "name", label: "名称" }],
      rows: [{ objectId: "row-1", name: "记录一" }],
      selectedId: "row-1",
    };
    const container = document.createElement("div");
    container.innerHTML = renderToString(<DataTable {...props} />);
    container
      .querySelector("table")
      ?.setAttribute("data-extentions-extra-tablecapture-id", "90336");
    document.body.appendChild(container);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let root: Root | undefined;

    await act(async () => {
      root = hydrateRoot(container, <DataTable {...props} />);
    });

    expect(consoleError.mock.calls.flat().join("\n")).not.toContain(
      "hydrated but some attributes",
    );
    await act(async () => root?.unmount());
  });
});
