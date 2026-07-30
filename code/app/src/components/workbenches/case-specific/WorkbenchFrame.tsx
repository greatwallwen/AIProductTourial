"use client";

import {
  ArrowLeft,
  CheckCircle2,
  Database,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import type { ReactNode } from "react";
import { formatBusinessRole } from "../../families/SharedPanels";
import type { CaseWorkbenchProps } from "./types";

function roleLabel(role: string): string {
  return role === "supervisor" ? "业务主管" : formatBusinessRole(role);
}

export function WorkbenchFrame({
  props,
  kicker,
  title,
  subtitle,
  tone,
  hideGenericActions = false,
  children,
}: {
  props: CaseWorkbenchProps;
  kicker: string;
  title: string;
  subtitle: string;
  tone: "retail" | "trial" | "review" | "credit" | "hospital" | "air" | "architecture" | "aquaculture" | "metro" | "telecom" | "model-gate" | "cold-chain" | "auto-service" | "flotation" | "wafer" | "wind" | "cutter" | "boiler" | "hydraulic" | "solar";
  hideGenericActions?: boolean;
  children: ReactNode;
}) {
  return (
    <main className={`case-studio case-studio--${tone}`}>
      <header className="case-studio__header">
        <a className="case-studio__back" href="/" aria-label="返回全部案例">
          <ArrowLeft aria-hidden="true" size={18} />
        </a>
        <div className="case-studio__identity">
          <span>{kicker}</span>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <div className="case-studio__status">
          <span><Database aria-hidden="true" size={15} />{props.datasetRowCount.toLocaleString("zh-CN")} 条本地记录</span>
          <span><ShieldCheck aria-hidden="true" size={15} />人工决策</span>
        </div>
      </header>

      <section className="case-studio__body">{children}</section>

      <footer className="case-studio__footer">
        <div className="case-studio__object">
          <span>当前对象</span>
          <strong>{props.selected.objectId}</strong>
          <em>{props.selected.state} · v{props.selected.version}</em>
        </div>
        <label className="case-studio__role">
          <span>操作角色</span>
          <select
            aria-label="当前操作角色"
            value={props.actorRole}
            onChange={(event) => props.onActorRoleChange(event.target.value)}
          >
            {props.roles.map((role) => (
              <option key={role} value={role}>{roleLabel(role)}</option>
            ))}
          </select>
        </label>
        {!hideGenericActions ? <div className="case-studio__actions" aria-label="可执行动作">
          {props.commands.length ? props.commands.map((command) => (
            <button
              key={command.id}
              type="button"
              data-tone={command.tone ?? "secondary"}
              disabled={props.busy}
              onClick={() => props.onCommand(command.id)}
            >
              <CheckCircle2 aria-hidden="true" size={17} />
              {props.busy ? "正在记录…" : command.label}
            </button>
          )) : <span className="case-studio__waiting">当前角色没有可执行动作</span>}
        </div> : <span className="case-studio__waiting">请在研究任务中填写并提交</span>}
        <button
          className="case-studio__reset"
          type="button"
          aria-label={`恢复案例 ${props.definition.id}`}
          title="恢复初始状态"
          disabled={props.busy}
          onClick={props.onReset}
        >
          <RotateCcw aria-hidden="true" size={17} />
        </button>
      </footer>
      {props.error ? <p className="case-studio__error" role="alert">{props.error}</p> : null}
    </main>
  );
}

export function MetricCards({
  items,
}: {
  items: Array<{ label: string; value: ReactNode; note?: string; tone?: string }>;
}) {
  return (
    <section className="case-studio__metrics" aria-label="关键指标">
      {items.map((item) => (
        <article key={item.label} data-tone={item.tone}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          {item.note ? <small>{item.note}</small> : null}
        </article>
      ))}
    </section>
  );
}

export function RecordList({
  title,
  objects,
  selectedId,
  describe,
  onSelect,
}: {
  title: string;
  objects: CaseWorkbenchProps["objects"];
  selectedId: string;
  describe: (item: CaseWorkbenchProps["selected"]) => { title: string; meta: string; badge?: string };
  onSelect: (objectId: string) => void;
}) {
  return (
    <aside className="case-studio__queue">
      <header><span>{title}</span><b>{objects.length}</b></header>
      <div>
        {objects.map((item) => {
          const row = describe(item);
          return (
            <button
              type="button"
              key={item.objectId}
              aria-pressed={item.objectId === selectedId}
              onClick={() => onSelect(item.objectId)}
            >
              <span><strong>{row.title}</strong><small>{row.meta}</small></span>
              {row.badge ? <em>{row.badge}</em> : null}
            </button>
          );
        })}
      </div>
    </aside>
  );
}

export function ReceiptNote({ props }: { props: CaseWorkbenchProps }) {
  if (!props.receipt) return null;
  return (
    <div className="case-studio__receipt" role="status">
      已记录：{props.receipt.event.fromState} → {props.receipt.event.toState}
    </div>
  );
}
