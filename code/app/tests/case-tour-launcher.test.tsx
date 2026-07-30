// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CaseTourLauncher } from "../src/components/tours/CaseTourLauncher";
import { getCaseTourDefinition } from "../src/components/tours/case-tour-registry";

const driverHarness = vi.hoisted(() => {
  const instance = {
    isActive: vi.fn(() => false),
    getActiveIndex: vi.fn(() => 0),
    moveNext: vi.fn(),
    destroy: vi.fn(),
    drive: vi.fn(),
  };
  return {
    instance,
    factory: vi.fn(() => instance),
  };
});

vi.mock("driver.js", () => ({ driver: driverHarness.factory }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  driverHarness.factory.mockClear();
  Object.values(driverHarness.instance).forEach((value) => {
    if (typeof value === "function" && "mockClear" in value) value.mockClear();
  });
});

function installBrowserStubs() {
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
}

describe("CaseTourLauncher", () => {
  it("does nothing until the instructor starts the tour, then prepares state before loading Driver.js", async () => {
    installBrowserStubs();
    const onPrepare = vi.fn().mockResolvedValue(true);
    const definition = getCaseTourDefinition("B018")!;
    render(
      <CaseTourLauncher
        definition={definition}
        runtime={{ state: "待定位", actorRole: "process_engineer" }}
        busy={false}
        onPrepare={onPrepare}
      />,
    );

    expect(driverHarness.factory).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "开始演示：主汽低温事件核查" }));

    await waitFor(() => expect(onPrepare).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(driverHarness.factory).toHaveBeenCalledTimes(1));
    expect(driverHarness.instance.drive).toHaveBeenCalledTimes(1);
  });

  it("does not load the tour engine when the demonstration object cannot be restored", async () => {
    installBrowserStubs();
    const definition = getCaseTourDefinition("B018")!;
    render(
      <CaseTourLauncher
        definition={definition}
        runtime={{ state: "待定位", actorRole: "process_engineer" }}
        busy={false}
        onPrepare={vi.fn().mockResolvedValue(false)}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "开始演示：主汽低温事件核查" }));

    expect(await screen.findByRole("status")).toHaveTextContent("演示对象未能恢复");
    expect(driverHarness.factory).not.toHaveBeenCalled();
  });
});
