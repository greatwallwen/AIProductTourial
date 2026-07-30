"use client";

import {
  Activity,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FileCheck2,
  RotateCcw,
  Search,
} from "lucide-react";
import type { ReactNode } from "react";

export type CaseFamily = "commerce" | "approval" | "investigation" | "industrial";

export type NavItem = {
  id: string;
  label: string;
};

export function AppShell({
  family,
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  family: CaseFamily;
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="product-shell" data-family={family}>
      <header className="product-header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="lede">{description}</p>
        </div>
        {actions ? <div className="header-actions">{actions}</div> : null}
      </header>
      {children}
    </main>
  );
}

export function CaseNav({
  active,
  caseId,
  items,
}: {
  active: string;
  caseId: string;
  items: NavItem[];
}) {
  return (
    <nav className="case-nav" aria-label="案例任务">
      {items.map((item) => {
        const href =
          item.id === "overview" ? `/cases/${caseId}` : `/cases/${caseId}/${item.id}`;
        return (
          <a key={item.id} href={href} aria-current={active === item.id ? "page" : undefined}>
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}

const statusIcons = {
  success: CheckCircle2,
  warning: CircleAlert,
  pending: Clock3,
  neutral: Activity,
};

export function StatusTag({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: keyof typeof statusIcons;
}) {
  const Icon = statusIcons[tone];
  return (
    <span className="status-tag" data-tone={tone}>
      <Icon aria-hidden="true" size={14} />
      {label}
    </span>
  );
}

export type CommandItem = {
  id: string;
  label: string;
  tone?: "primary" | "secondary" | "danger";
};

export function CommandBar({
  busy,
  commands,
  onCommand,
}: {
  busy: boolean;
  commands: CommandItem[];
  onCommand: (id: string) => void;
}) {
  return (
    <div className="command-bar" aria-label="可执行动作">
      {commands.map((command) => (
        <button
          type="button"
          key={command.id}
          className="command-button"
          data-tone={command.tone ?? "secondary"}
          disabled={busy}
          onClick={() => onCommand(command.id)}
        >
          {command.id.includes("reset") ? (
            <RotateCcw aria-hidden="true" size={16} />
          ) : (
            <ArrowRight aria-hidden="true" size={16} />
          )}
          {command.label}
        </button>
      ))}
    </div>
  );
}

export function DataTable({
  columns,
  rows,
  selectedId,
  onSelect,
}: {
  columns: { key: string; label: string }[];
  rows: Array<Record<string, unknown> & { objectId: string }>;
  selectedId?: string;
  onSelect?: (id: string) => void;
}) {
  return (
    <div className="table-wrap">
      <table suppressHydrationWarning>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.objectId}
              data-selected={row.objectId === selectedId}
              data-object-id={row.objectId}
              aria-selected={row.objectId === selectedId}
              tabIndex={0}
              onClick={() => onSelect?.(row.objectId)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect?.(row.objectId);
                }
              }}
            >
              {columns.map((column) => (
                <td key={column.key}>{String(row[column.key] ?? "—")}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ReceiptPanel({
  receiptId,
  state,
  version,
  error,
}: {
  receiptId?: string;
  state: string;
  version: number;
  error?: string;
}) {
  return (
    <section className="receipt-panel" aria-label="执行回执">
      <div className="section-heading">
        <FileCheck2 aria-hidden="true" size={18} />
        <h2>执行回执</h2>
      </div>
      {error ? <p className="error-copy">{error}</p> : null}
      <dl>
        <div>
          <dt>当前状态</dt>
          <dd>{state}</dd>
        </div>
        <div>
          <dt>对象版本</dt>
          <dd>v{version}</dd>
        </div>
        <div>
          <dt>回执编号</dt>
          <dd className="mono">{receiptId ? receiptId.slice(0, 16) : "尚未执行"}</dd>
        </div>
      </dl>
    </section>
  );
}

export function SearchField({
  value,
  onChange,
  label = "搜索案例",
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  return (
    <label className="search-field">
      <Search aria-hidden="true" size={18} />
      <span className="sr-only">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={label} />
    </label>
  );
}
