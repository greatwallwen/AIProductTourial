"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  Eye,
  EyeOff,
  Layers3,
  Minus,
  RotateCcw,
  Search,
  ShieldAlert,
  ZoomIn,
} from "lucide-react";
import type {
  CaseProjection,
  CommandResult,
} from "@course-ai-product/case-runtime";
import type { CaseDefinition } from "@cases/contracts";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  formatBusinessRole,
  formatBusinessValue,
} from "../families/SharedPanels";
import {
  getCaseConsoleConfig,
  type ConsoleSignal,
} from "./case-console-config";

type ConsoleCommand = {
  id: string;
  label: string;
  tone?: "primary" | "secondary" | "danger";
};

type OperationalInvestigationConsoleProps = {
  definition: CaseDefinition;
  objects: CaseProjection[];
  selected: CaseProjection;
  datasetRowCount: number;
  actorRole: string;
  roles: string[];
  commands: ConsoleCommand[];
  busy: boolean;
  error?: string;
  receipt?: CommandResult;
  onActorRoleChange: (role: string) => void;
  onCommand: (command: string) => void;
  onReset: () => void;
  onSelect: (objectId: string) => void;
};

function numeric(value: unknown): number | undefined {
  if (value === "" || value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatValue(signal: ConsoleSignal, raw: unknown): string {
  if (raw === "" || raw === null || raw === undefined) return "未记录";
  const value = numeric(raw);
  let rendered = formatBusinessValue(signal.key, raw);
  if (signal.format === "currency" && value !== undefined) {
    rendered = new Intl.NumberFormat("zh-CN", {
      style: "currency",
      currency: "CNY",
      minimumFractionDigits: 2,
    }).format(Math.abs(value));
  } else if (signal.format === "currencyFen" && value !== undefined) {
    rendered = new Intl.NumberFormat("zh-CN", {
      style: "currency",
      currency: "CNY",
      minimumFractionDigits: 2,
    }).format(Math.abs(value) / 100);
  } else if (signal.format === "integer" && value !== undefined) {
    rendered = Math.round(value).toLocaleString("zh-CN");
  } else if (signal.format === "decimal" && value !== undefined) {
    rendered = value.toLocaleString("zh-CN", { maximumFractionDigits: 3 });
  } else if (signal.format === "temperature" && value !== undefined) {
    rendered = `${value.toFixed(2)}℃`;
  } else if (signal.format === "percent" && value !== undefined) {
    const percentage = Math.abs(value) <= 1 ? value * 100 : value;
    rendered = `${percentage.toFixed(2)}%`;
  } else if (signal.format === "basisPoints" && value !== undefined) {
    rendered = `${(value / 100).toFixed(2)}%`;
  }
  return signal.unit && signal.format !== "temperature"
    ? `${rendered} ${signal.unit}`
    : rendered;
}

function SignalCanvas({
  objects,
  field,
  label,
  kind,
}: {
  objects: CaseProjection[];
  field?: string;
  label: string;
  kind: "time" | "records" | "process";
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const points = useMemo(
    () =>
      objects
        .map((item, index) => ({
          index,
          value: field ? numeric(item.payload[field]) : undefined,
        }))
        .filter((point): point is { index: number; value: number } =>
          point.value !== undefined,
        ),
    [field, objects],
  );

  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const draw = () => {
      const bounds = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(bounds.width));
      const height = Math.max(1, Math.round(bounds.height));
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);

      const left = 42;
      const right = 18;
      const top = 18;
      const bottom = 28;
      const plotWidth = width - left - right;
      const plotHeight = height - top - bottom;
      context.strokeStyle = "rgba(137, 174, 204, 0.18)";
      context.lineWidth = 1;
      for (let row = 0; row < 4; row += 1) {
        const y = top + (row / 3) * plotHeight;
        context.beginPath();
        context.moveTo(left, y);
        context.lineTo(width - right, y);
        context.stroke();
      }

      if (points.length < 2) {
        const blocks = Math.max(4, Math.min(objects.length || 4, 12));
        for (let index = 0; index < blocks; index += 1) {
          const blockWidth = Math.max(16, plotWidth / blocks - 8);
          const x = left + (index / blocks) * plotWidth;
          const heightScale = 0.35 + ((index * 17) % 7) / 10;
          const blockHeight = Math.min(plotHeight, plotHeight * heightScale);
          context.fillStyle =
            index === blocks - 1 ? "#ffbe2e" : "rgba(75, 170, 255, 0.48)";
          context.fillRect(x, top + plotHeight - blockHeight, blockWidth, blockHeight);
        }
      } else {
        const min = Math.min(...points.map((point) => point.value));
        const max = Math.max(...points.map((point) => point.value));
        const range = max - min || 1;
        const x = (index: number) =>
          left + (index / Math.max(points.length - 1, 1)) * plotWidth;
        const y = (value: number) =>
          top + ((max - value) / range) * plotHeight;
        const gradient = context.createLinearGradient(0, 0, width, 0);
        gradient.addColorStop(0, "#3e9dff");
        gradient.addColorStop(0.65, "#52e8aa");
        gradient.addColorStop(1, "#ffbe2e");
        context.beginPath();
        points.forEach((point, index) => {
          if (index === 0) context.moveTo(x(index), y(point.value));
          else context.lineTo(x(index), y(point.value));
        });
        context.strokeStyle = gradient;
        context.lineWidth = 3;
        context.shadowBlur = 10;
        context.shadowColor = "rgba(56, 164, 255, 0.48)";
        context.stroke();
        context.shadowBlur = 0;
      }

      context.fillStyle = "#7890a5";
      context.font = "11px Inter, 'Microsoft YaHei', sans-serif";
      context.textAlign = "left";
      context.fillText(
        kind === "time" ? "较早记录" : kind === "records" ? "前序样本" : "开始",
        left,
        height - 8,
      );
      context.textAlign = "right";
      context.fillText(
        kind === "time" ? "较新记录" : kind === "records" ? "当前样本" : "人工处理",
        width - right,
        height - 8,
      );
    };

    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    draw();
    return () => observer.disconnect();
  }, [kind, objects, points]);

  return <canvas ref={canvasRef} aria-label={label} />;
}

function LayerSwitch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      onClick={onChange}
    >
      <span>{label}</span>
      <i aria-hidden="true">
        {checked ? <Eye size={13} /> : <EyeOff size={13} />}
      </i>
    </button>
  );
}

export function OperationalInvestigationConsole({
  definition,
  objects,
  selected,
  datasetRowCount,
  actorRole,
  roles,
  commands,
  busy,
  error,
  receipt,
  onActorRoleChange,
  onCommand,
  onReset,
  onSelect,
}: OperationalInvestigationConsoleProps) {
  const config = getCaseConsoleConfig(definition.id);
  const teachingId = `B${definition.id}`;
  const [showSignals, setShowSignals] = useState(true);
  const [showGaps, setShowGaps] = useState(true);
  const [showExplanations, setShowExplanations] = useState(true);
  const [zoom, setZoom] = useState(1);
  const sceneTransform = useMemo(
    () => ({ transform: `scale(${zoom})` }),
    [zoom],
  );
  if (!config) return null;

  const primaryCommand =
    commands.find((command) =>
      String(selected.payload.decision &&
        typeof selected.payload.decision === "object" &&
        "recommendedCommand" in selected.payload.decision
        ? selected.payload.decision.recommendedCommand
        : "") === command.id,
    ) ?? commands[0];
  const timestamp = config.timeField
    ? String(selected.payload[config.timeField] ?? selected.updatedAt)
    : String(selected.updatedAt);
  const activeStep = receipt ? 4 : selected.version > 0 ? 3 : 2;

  return (
    <main className="ops-console">
      <header className="ops-topbar">
        <div className="ops-topbar-title">
          <a href="/" aria-label="返回案例库">
            <ArrowLeft aria-hidden="true" size={18} />
          </a>
          <strong>{config.subject}</strong>
          <span>案例 {teachingId}</span>
        </div>
        <div className="ops-topbar-status">
          <b>本地数据</b>
          <span>
            <Search aria-hidden="true" size={14} />
            {datasetRowCount.toLocaleString("zh-CN")} 条记录
          </span>
          <span className="ops-quality">
            <i aria-hidden="true" />
            当前状态：{selected.state}
          </span>
        </div>
        <nav aria-label="案例页面">
          <a href={`/cases/${teachingId}`}>问题</a>
          <a href={`/cases/${teachingId}/evidence`}>数据</a>
          <a href={`/cases/${teachingId}/audit`}>记录</a>
        </nav>
        <time>{timestamp}</time>
      </header>

      <div className="ops-main-grid">
        <section className="ops-left-column">
          <section className="ops-scene" role="region" aria-label={config.sceneAria}>
            <img
              src={config.sceneAsset}
              alt={config.sceneAlt}
              style={sceneTransform}
              suppressHydrationWarning
            />
            <div className="ops-scene-shade" aria-hidden="true" />

            <aside className="ops-layer-panel" aria-label="现场图层">
              <div>
                <Layers3 aria-hidden="true" size={16} />
                <strong>图层</strong>
              </div>
              <LayerSwitch
                label="业务数据"
                checked={showSignals}
                onChange={() => setShowSignals((value) => !value)}
              />
              <LayerSwitch
                label="待核对项"
                checked={showExplanations}
                onChange={() => setShowExplanations((value) => !value)}
              />
              <LayerSwitch
                label="数据缺口"
                checked={showGaps}
                onChange={() => setShowGaps((value) => !value)}
              />
            </aside>

            <div className="ops-zoom-controls" aria-label="现场视图控制">
              <button
                type="button"
                aria-label="放大现场"
                title="放大"
                onClick={() => setZoom((value) => Math.min(1.18, value + 0.06))}
              >
                <ZoomIn aria-hidden="true" size={18} />
              </button>
              <button
                type="button"
                aria-label="缩小现场"
                title="缩小"
                onClick={() => setZoom((value) => Math.max(1, value - 0.06))}
              >
                <Minus aria-hidden="true" size={18} />
              </button>
              <button
                type="button"
                aria-label="恢复现场视角"
                title="恢复视角"
                onClick={() => setZoom(1)}
              >
                <RotateCcw aria-hidden="true" size={17} />
              </button>
            </div>

            {showSignals ? (
              <div className="ops-scene-signals" aria-label="当前业务数据">
                {config.signals.map((signal, index) => (
                  <article key={signal.key} data-index={index}>
                    <span>{signal.label}</span>
                    <strong>{formatValue(signal, selected.payload[signal.key])}</strong>
                    <small>{index === 0 ? "当前选中记录" : selected.objectId}</small>
                  </article>
                ))}
              </div>
            ) : null}

            {showGaps ? (
              <aside className="ops-gap-panel" aria-label="数据缺口">
                <strong>当前还缺</strong>
                {config.gaps.map((gap) => (
                  <span key={gap}>{gap}</span>
                ))}
              </aside>
            ) : null}

            <div className="ops-scene-legend" aria-label="图层说明">
              <span data-tone="support">数据中已有</span>
              <span data-tone="review">需要核对</span>
              <span data-tone="missing">当前缺失</span>
            </div>
          </section>

          <section className="ops-sequence" aria-labelledby="ops-sequence-title">
            <header>
              <div>
                <p>{config.sequenceKind === "time" ? "记录时间线" : "记录序列"}</p>
                <h2 id="ops-sequence-title">{config.sequenceTitle}</h2>
              </div>
              <span>图中只使用当前数据集字段</span>
            </header>
            <div className="ops-sequence-body">
              <SignalCanvas
                objects={objects}
                field={config.plotField}
                label={config.sequenceTitle}
                kind={config.sequenceKind}
              />
              <div className="ops-object-strip" aria-label="代表记录">
                {objects.slice(0, 8).map((item) => (
                  <button
                    type="button"
                    key={item.objectId}
                    aria-pressed={item.objectId === selected.objectId}
                    onClick={() => onSelect(item.objectId)}
                    data-object-id={item.objectId}
                  >
                    {item.objectId}
                  </button>
                ))}
              </div>
            </div>
          </section>
        </section>

        <aside className="ops-analysis" aria-label="人工研判">
          <header>
            <p>当前要回答</p>
            <h1>{config.title}</h1>
            <span>{config.decisionQuestion}</span>
          </header>

          <ol className="ops-steps">
            {config.steps.map((step, index) => {
              const number = index + 1;
              const complete = number < activeStep;
              const active = number === activeStep;
              return (
                <li key={step} data-active={active} data-complete={complete}>
                  <i>{complete ? <Check size={15} /> : number}</i>
                  <div>
                    <strong>{step}</strong>
                    <span>
                      {index === 0
                        ? `选中 ${selected.objectId}`
                        : index === 1
                          ? `${config.signals.length} 个关键字段已展开`
                          : index === 2
                            ? "把已有记录与缺口分开"
                            : "由有权限的业务人员执行"}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>

          {showExplanations ? (
            <section className="ops-hypotheses">
              <h2>{config.hypothesesLabel}</h2>
              {config.hypotheses.map((item, index) => (
                <article key={item.title} data-tone={item.tone}>
                  <b>{index + 1}</b>
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.detail}</span>
                  </div>
                </article>
              ))}
            </section>
          ) : null}

          <section className="ops-control-panel">
            <label>
              当前操作角色
              <select
                aria-label="当前操作角色"
                value={actorRole}
                onChange={(event) => onActorRoleChange(event.target.value)}
              >
                {roles.map((role) => (
                  <option key={role} value={role}>
                    {role === "supervisor" ? "业务主管" : formatBusinessRole(role)}
                  </option>
                ))}
              </select>
            </label>
            {error ? (
              <p role="alert">
                <ShieldAlert aria-hidden="true" size={15} />
                {error}
              </p>
            ) : null}
            {receipt ? <p className="ops-receipt-note">操作已记录，状态为 {receipt.projection.state}</p> : null}
          </section>
        </aside>
      </div>

      <footer className="ops-footer">
        <button type="button" className="ops-secondary" onClick={onReset} disabled={busy}>
          <RotateCcw aria-hidden="true" size={16} />
          恢复初始状态
        </button>
        <span>
          <Clock3 aria-hidden="true" size={14} />
          动作不会自动修改真实业务系统
        </span>
        <button
          type="button"
          className="ops-primary"
          disabled={busy || !primaryCommand}
          onClick={() => primaryCommand && onCommand(primaryCommand.id)}
        >
          {busy ? "正在记录…" : (primaryCommand?.label ?? "等待人工处理")}
          <ArrowRight aria-hidden="true" size={18} />
        </button>
      </footer>
    </main>
  );
}
