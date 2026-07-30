"use client";

import { CirclePlay, LoaderCircle, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { DriveStep, Driver } from "driver.js";
import {
  isTourGateSatisfied,
  type CaseTourDefinition,
  type CaseTourRuntime,
} from "./case-tour-registry";

type DriverModule = typeof import("driver.js");

function afterLayout(): Promise<void> {
  return new Promise((resolve) => {
    const schedule = typeof requestAnimationFrame === "function"
      ? requestAnimationFrame
      : (callback: FrameRequestCallback) => setTimeout(callback, 0);
    schedule(() => schedule(() => resolve()));
  });
}

function toDriverSteps(definition: CaseTourDefinition): DriveStep[] {
  return definition.steps.map((step, index) => ({
    element: step.element,
    waitForElement: 1600,
    skipMissingElement: false,
    disableActiveInteraction: false,
    data: { tourStepId: step.id, gate: step.gate },
    popover: {
      title: step.title,
      description: step.description,
      side: step.side,
      align: step.align,
      showButtons: step.gate ? ["previous", "close"] : ["previous", "next", "close"],
      nextBtnText: index === definition.steps.length - 1 ? "完成" : "下一步",
      prevBtnText: "上一步",
      doneBtnText: "完成",
      progressText: `${index + 1} / ${definition.steps.length}`,
      popoverClass: step.gate ? "case-task-tour case-task-tour--waiting" : "case-task-tour",
    },
  }));
}

export function CaseTourLauncher({
  definition,
  runtime,
  busy,
  onPrepare,
  loadDriver = () => import("driver.js"),
}: {
  definition: CaseTourDefinition;
  runtime: CaseTourRuntime;
  busy: boolean;
  onPrepare: () => Promise<boolean>;
  loadDriver?: () => Promise<DriverModule>;
}) {
  const driverRef = useRef<Driver | undefined>(undefined);
  const runtimeRef = useRef(runtime);
  const mountedRef = useRef(true);
  const [preparing, setPreparing] = useState(false);
  const [running, setRunning] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [message, setMessage] = useState<string>();

  runtimeRef.current = runtime;

  useEffect(() => {
    const instance = driverRef.current;
    if (!instance?.isActive()) return;
    const activeIndex = instance.getActiveIndex();
    if (activeIndex === undefined) return;
    const activeStep = definition.steps[activeIndex];
    if (!activeStep?.gate || !isTourGateSatisfied(activeStep.gate, runtime)) return;
    const timer = window.setTimeout(() => instance.moveNext(), 320);
    return () => window.clearTimeout(timer);
  }, [definition.steps, runtime]);

  useEffect(() => () => {
    mountedRef.current = false;
    const instance = driverRef.current;
    driverRef.current = undefined;
    instance?.destroy();
  }, []);

  async function startTour() {
    if (preparing || busy) return;
    driverRef.current?.destroy();
    setPreparing(true);
    setMessage(undefined);
    try {
      const prepared = await onPrepare();
      if (!prepared) {
        setMessage("演示对象未能恢复，请检查本地服务。");
        return;
      }
      const module = await loadDriver();
      await afterLayout();
      setHasRun(true);
      const instance = module.driver({
        steps: toDriverSteps(definition),
        animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        smoothScroll: true,
        allowClose: true,
        allowScroll: true,
        overlayClickBehavior: "close",
        overlayColor: "#07131f",
        overlayOpacity: 0.58,
        stagePadding: 8,
        stageRadius: 12,
        popoverOffset: 12,
        showProgress: true,
        progressText: "{{current}} / {{total}}",
        nextBtnText: "下一步",
        prevBtnText: "上一步",
        doneBtnText: "完成",
        allowKeyboardControl: true,
        disableActiveInteraction: false,
        onPopoverRender: (popover) => {
          popover.closeButton.setAttribute("aria-label", "退出演示");
          popover.previousButton.setAttribute("aria-label", "返回上一步");
          popover.nextButton.setAttribute("aria-label", "进入下一步");
          popover.progress.setAttribute("aria-live", "polite");
        },
        onHighlighted: () => setRunning(true),
        onDestroyed: () => {
          driverRef.current = undefined;
          if (mountedRef.current) setRunning(false);
        },
        onNextClick: (_element, _step, { driver }) => {
          const activeIndex = driver.getActiveIndex();
          const activeStep = activeIndex === undefined ? undefined : definition.steps[activeIndex];
          if (activeStep?.gate && !isTourGateSatisfied(activeStep.gate, runtimeRef.current)) {
            setMessage("先完成高亮区域中的业务动作。");
            return;
          }
          setMessage(undefined);
          driver.moveNext();
        },
        onCloseClick: (_element, _step, { driver }) => driver.destroy(),
        onDoneClick: (_element, _step, { driver }) => driver.destroy(),
      });
      driverRef.current = instance;
      setRunning(true);
      instance.drive();
    } catch {
      setMessage("导览没有启动，请刷新页面后重试。");
      setRunning(false);
    } finally {
      setPreparing(false);
    }
  }

  return (
    <div className="case-tour-launcher">
      <button
        type="button"
        className="case-tour-launcher__button"
        aria-label={`${running ? "演示进行中" : hasRun ? "重新演示" : "开始演示"}：${definition.title}`}
        aria-busy={preparing}
        disabled={busy || preparing || running}
        onClick={startTour}
      >
        {preparing ? <LoaderCircle aria-hidden="true" size={15} /> : hasRun ? <RotateCcw aria-hidden="true" size={15} /> : <CirclePlay aria-hidden="true" size={15} />}
        {preparing ? "正在准备" : running ? "演示进行中" : hasRun ? "重新演示" : "开始演示"}
      </button>
      {message ? <span role="status" className="case-tour-launcher__message">{message}</span> : null}
    </div>
  );
}
