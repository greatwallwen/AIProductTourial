"use client";

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Database,
  RefreshCcw,
  Search,
  ShieldCheck,
  UserCheck,
  Workflow,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import styles from "./HospitalTransferWorkbench.module.css";
import type { CaseWorkbenchProps } from "./types";

type JourneyItem = {
  objectId: string;
  payload: Record<string, unknown>;
};

type CoordinationDraft = {
  selectedEventId: string;
  authoritativeState: string;
  reconciliationReason: string;
  senderActorId: string;
  receiverActorId: string;
  cosignNote: string;
};

const eventLabels: Record<string, string> = {
  transport_requested: "转运申请",
  transport_assigned: "转运分派",
  bed_request_confirmed: "床位申请确认",
  handoff_received: "交接接收",
  coordination_snapshot: "协调快照",
  correction_appended: "追加更正",
};

const conflictLabels: Record<string, string> = {
  none: "无冲突",
  late_event: "晚到事件",
  late_reopen: "晚到重开",
  out_of_order: "乱序到达",
  duplicate: "重复事件",
  missing: "会签缺失",
  mutually_exclusive: "互斥状态",
};

const sourceLabels: Record<string, string> = {
  ED_BOARD: "急诊看板",
  TRANSPORT_DISPATCH: "转运调度",
  BED_CONTROL: "床位控制",
  WARD_BOARD: "病区看板",
  OPS_AUDIT: "运营审计",
};

const strategyOptions = [
  { value: "接收方已接收，保留迟到修正", label: "追加更正（保留历史）" },
  { value: "状态无法判定，升级协调", label: "升级协调（不自动覆盖）" },
] as const;

function value(input: unknown): string {
  return input == null || input === "" ? "—" : String(input);
}

function textList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return [...new Set(input.map((item) => value(item)).filter((item) => item !== "—"))];
}

function time(input: unknown): string {
  const source = value(input);
  const match = source.match(/T(\d{2}:\d{2})/) ?? source.match(/(\d{2}:\d{2})/);
  return match?.[1] ?? source;
}

function eventDelay(row: Record<string, unknown>): number {
  const occurred = Date.parse(value(row.event_time));
  const received = Date.parse(value(row.received_at));
  return Number.isFinite(occurred) && Number.isFinite(received)
    ? Math.max(0, Math.round((received - occurred) / 60_000))
    : 0;
}

function conflictType(row: Record<string, unknown>): string {
  return value(row.conflict_type) === "—" ? "none" : value(row.conflict_type);
}

function isConflict(row: Record<string, unknown>): boolean {
  return conflictType(row) !== "none";
}

function isLateConflict(row: Record<string, unknown>): boolean {
  const kind = conflictType(row);
  return kind === "late_event" || kind === "late_reopen";
}

function roleLabel(role: string): string {
  if (role === "coordinator") return "转出协调员";
  if (role === "supervisor") return "接收负责人";
  return role;
}

function restoreTask(
  selectedTask: Record<string, unknown> | undefined,
  events: CaseWorkbenchProps["events"],
  objectId: string,
): Record<string, unknown> {
  const restored: Record<string, unknown> = {};
  events
    .filter((event) => event.objectId === objectId && event.data)
    .sort((left, right) => left.version - right.version)
    .forEach((event) => Object.assign(restored, event.data));
  if (selectedTask) {
    const nested = selectedTask.coordination;
    Object.assign(restored, nested && typeof nested === "object" ? nested : selectedTask);
  }
  return restored;
}

function objectIdFor(row: Record<string, unknown>, objects: CaseWorkbenchProps["objects"]): string {
  const matched = objects.find((item) => value(item.payload.event_id) === value(row.event_id));
  return matched?.objectId ?? `05-${value(row.transport_id)}-${value(row.event_id)}`;
}

function draftFrom(journey: JourneyItem[], restored: Record<string, unknown>): CoordinationDraft {
  const conflict = [...journey]
    .filter((item) => isConflict(item.payload))
    .sort((left, right) => (
      Number(isLateConflict(right.payload)) - Number(isLateConflict(left.payload)) ||
      value(right.payload.received_at).localeCompare(value(left.payload.received_at))
    ))[0] ?? journey[journey.length - 1];
  return {
    selectedEventId: value(restored.selectedEventId ?? conflict?.payload.event_id).replace("—", ""),
    authoritativeState: value(restored.authoritativeState ?? "").replace("—", ""),
    reconciliationReason: value(restored.reconciliationReason ?? "").replace("—", ""),
    senderActorId: value(restored.senderActorId ?? "").replace("—", ""),
    receiverActorId: value(restored.receiverActorId ?? "").replace("—", ""),
    cosignNote: value(restored.cosignNote ?? "").replace("—", ""),
  };
}

function sortBy(field: "event_time" | "received_at") {
  return (left: JourneyItem, right: JourneyItem) => (
    value(left.payload[field]).localeCompare(value(right.payload[field])) ||
    Number(left.payload.event_version) - Number(right.payload.event_version)
  );
}

export function HospitalTransferWorkbench(props: CaseWorkbenchProps) {
  const [query, setQuery] = useState("");
  const sourceRows = props.sceneRows.length ? props.sceneRows : props.objects.map((item) => item.payload);
  const transportId = value(props.selected.payload.transport_id);
  const journey = useMemo<JourneyItem[]>(() => sourceRows
    .filter((row) => value(row.transport_id) === transportId)
    .map((payload) => ({ objectId: objectIdFor(payload, props.objects), payload })), [props.objects, sourceRows, transportId]);
  const restored = useMemo(
    () => restoreTask(props.selected.task, props.events, props.selected.objectId),
    [props.events, props.selected.objectId, props.selected.task],
  );
  const [draft, setDraft] = useState<CoordinationDraft>(() => draftFrom(journey, restored));

  useEffect(() => {
    setDraft(draftFrom(journey, restored));
  }, [journey, props.selected.objectId, props.selected.version, restored]);

  const occurredJourney = useMemo(() => [...journey].sort(sortBy("event_time")), [journey]);
  const receivedJourney = useMemo(() => [...journey].sort(sortBy("received_at")), [journey]);
  const conflictRows = journey.filter((item) => isConflict(item.payload));
  const selectedEvent = journey.find((item) => value(item.payload.event_id) === draft.selectedEventId)
    ?? [...conflictRows].reverse()[0]
    ?? journey[journey.length - 1]
    ?? { objectId: props.selected.objectId, payload: props.selected.payload };
  const selectedKind = conflictType(selectedEvent.payload);
  const selectedIsLate = isLateConflict(selectedEvent.payload);
  const selectedDelay = eventDelay(selectedEvent.payload);

  const transports = useMemo(() => {
    const grouped = new Map<string, Record<string, unknown>[]>();
    sourceRows.forEach((row) => {
      const id = value(row.transport_id);
      grouped.set(id, [...(grouped.get(id) ?? []), row]);
    });
    return [...grouped.entries()].map(([id, rows]) => {
      const conflict = [...rows]
        .filter(isConflict)
        .sort((left, right) => value(right.received_at).localeCompare(value(left.received_at)))[0];
      const focus = conflict ?? [...rows].sort((left, right) => value(right.received_at).localeCompare(value(left.received_at)))[0];
      return { id, rows, focus, objectId: objectIdFor(focus, props.objects) };
    }).filter((item) => item.id.toLowerCase().includes(query.trim().toLowerCase()))
      .sort((left, right) => Number(Boolean(right.focus && isConflict(right.focus))) - Number(Boolean(left.focus && isConflict(left.focus))) || left.id.localeCompare(right.id));
  }, [props.objects, query, sourceRows]);

  const handledLateEventIds = useMemo(() => [...new Set([
    ...textList(restored.handledLateEventIds),
    ...props.events
      .filter((event) => event.objectId === props.selected.objectId && event.command === "reopen_late_event")
      .flatMap((event) => [
        ...textList(event.data?.handledLateEventIds),
        value(event.data?.lateEventId),
      ])
      .filter((item) => item !== "—"),
  ])], [props.events, props.selected.objectId, restored.handledLateEventIds]);
  const handledLateEvent = handledLateEventIds.includes(value(selectedEvent.payload.event_id));
  const senderConfirmed = Boolean(value(restored.senderActorId).replace("—", "")) || props.selected.state !== "待会签";
  const actorsDiffer = Boolean(draft.receiverActorId.trim()) && draft.receiverActorId.trim() !== draft.senderActorId.trim();

  function updateDraft<Key extends keyof CoordinationDraft>(key: Key, next: CoordinationDraft[Key]) {
    setDraft((current) => ({ ...current, [key]: next }));
  }

  function selectEvent(item: JourneyItem) {
    setDraft((current) => ({
      ...current,
      selectedEventId: value(item.payload.event_id),
      authoritativeState: restored.authoritativeState ? current.authoritativeState : "",
      reconciliationReason: restored.reconciliationReason ? current.reconciliationReason : "",
    }));
  }

  function commandReady(commandId: string): boolean {
    if (commandId === "nurse_confirm") {
      return Boolean(
        isConflict(selectedEvent.payload) &&
        draft.authoritativeState &&
        draft.reconciliationReason.trim().length >= 8 &&
        draft.senderActorId.trim(),
      );
    }
    if (commandId === "cosign_transfer") {
      return Boolean(senderConfirmed && actorsDiffer && draft.cosignNote.trim().length >= 4);
    }
    if (commandId === "escalate_conflict") {
      return Boolean(isConflict(selectedEvent.payload) && draft.reconciliationReason.trim().length >= 8);
    }
    if (commandId === "reopen_late_event") {
      return selectedIsLate && !handledLateEvent && Boolean(draft.senderActorId.trim());
    }
    return true;
  }

  function runCommand(commandId: string) {
    if (!commandReady(commandId)) return;
    const selectedEventId = value(selectedEvent.payload.event_id);
    const evidenceIds = [
      selectedEventId,
      value(selectedEvent.payload.bed_request_id),
      value(selectedEvent.payload.flow_token),
    ].filter((item) => item && item !== "—");
    const common = {
      idempotencyKey: `case-B005:${transportId}:${commandId}:v${props.selected.version}:${selectedEventId}`,
      evidenceIds: [...new Set(evidenceIds)],
    };

    if (commandId === "nurse_confirm") {
      props.onCommand(commandId, draft.reconciliationReason.trim(), {
        ...common,
        actorId: draft.senderActorId.trim(),
        data: {
          selectedEventId,
          authoritativeState: draft.authoritativeState,
          reconciliationReason: draft.reconciliationReason.trim(),
          senderActorId: draft.senderActorId.trim(),
        },
      });
      return;
    }
    if (commandId === "cosign_transfer") {
      props.onCommand(commandId, draft.cosignNote.trim(), {
        ...common,
        actorId: draft.receiverActorId.trim(),
        data: { receiverActorId: draft.receiverActorId.trim(), cosignNote: draft.cosignNote.trim() },
      });
      return;
    }
    if (commandId === "reopen_late_event") {
      props.onCommand(commandId, "晚到事件首次到达，重新打开状态会签。", {
        ...common,
        actorId: draft.senderActorId.trim(),
        data: {
          lateEventId: selectedEventId,
          lateEventOccurredAt: value(selectedEvent.payload.event_time),
          lateEventReceivedAt: value(selectedEvent.payload.received_at),
          handledLateEventIds: [...new Set([...handledLateEventIds, selectedEventId])],
        },
      });
      return;
    }
    props.onCommand(commandId, draft.reconciliationReason.trim(), {
      ...common,
      actorId: draft.receiverActorId.trim() || draft.senderActorId.trim(),
      data: { selectedEventId, reconciliationReason: draft.reconciliationReason.trim() },
    });
  }

  const mappingPaths = journey.map((item) => {
    const fromIndex = occurredJourney.findIndex((event) => value(event.payload.event_id) === value(item.payload.event_id));
    const toIndex = receivedJourney.findIndex((event) => value(event.payload.event_id) === value(item.payload.event_id));
    const denominator = Math.max(1, journey.length - 1);
    const fromX = 60 + fromIndex * 880 / denominator;
    const toX = 60 + toIndex * 880 / denominator;
    return { item, fromX, toX };
  });

  function renderAxis(items: JourneyItem[], field: "event_time" | "received_at") {
    return (
      <div className={styles.axisTrack}>
        {items.map((item) => {
          const eventId = value(item.payload.event_id);
          const active = eventId === value(selectedEvent.payload.event_id);
          const kind = conflictType(item.payload);
          return (
            <button
              key={`${field}-${eventId}`}
              type="button"
              data-event-id={eventId}
              data-conflict={kind}
              aria-pressed={active}
              onClick={() => selectEvent(item)}
            >
              <span>{eventId}</span>
              <strong>{time(item.payload[field])}</strong>
              <small>{eventLabels[value(item.payload.event_type)] ?? "流程事件"}</small>
              {isLateConflict(item.payload) ? <em>晚到 {eventDelay(item.payload)} 分钟</em> : null}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <main className={styles.workbench} aria-label="转运晚到事件调和台">
      <header className={styles.topbar}>
        <div className={styles.brand}><Workflow aria-hidden="true" size={22} /><div><h1>转运晚到事件调和单</h1><span>运营事件调和</span></div></div>
        <div className={styles.topSummary}>
          <span><Database aria-hidden="true" size={15} />{props.datasetRowCount.toLocaleString("zh-CN")} 条本地合成事件</span>
          <span><ShieldCheck aria-hidden="true" size={15} />仅限运营协调</span>
          <button type="button" onClick={props.onReset} disabled={props.busy} aria-label="恢复当前调和单"><RefreshCcw aria-hidden="true" size={17} /></button>
        </div>
      </header>

      <div className={styles.workspace}>
        <aside className={styles.queuePanel} aria-label="待处理转运冲突">
          <header><div><strong>待处理转运冲突</strong><span>{transports.filter((item) => isConflict(item.focus)).length}</span></div><small>优先显示存在冲突的事件</small></header>
          <label className={styles.searchBox}><Search aria-hidden="true" size={15} /><input aria-label="按转运单号筛选" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="输入转运单号" /></label>
          <div className={styles.queueList}>
            {transports.slice(0, 12).map((item) => {
              const kind = conflictType(item.focus);
              const late = isLateConflict(item.focus);
              return (
                <button key={item.id} type="button" aria-pressed={item.id === transportId} onClick={() => props.onSelect(item.objectId)}>
                  <span><strong>{value(item.focus.event_id)}</strong><b data-conflict={kind}>{conflictLabels[kind] ?? "状态冲突"}</b></span>
                  <small>发生 {time(item.focus.event_time)}　接收 {time(item.focus.received_at)}</small>
                  <em>{late ? `晚到 ${eventDelay(item.focus)} 分钟` : `来源 ${sourceLabels[value(item.focus.source_system)] ?? value(item.focus.source_system)}`}</em>
                </button>
              );
            })}
          </div>
          <section className={styles.privacyNote} aria-label="数据边界">
            <ShieldCheck aria-hidden="true" size={16} />
            <p>不含患者身份、诊断、治疗或临床优先级；冲突比例是课程覆盖设计，不代表医院运营水平。</p>
          </section>
        </aside>

        <section className={styles.clockStage} aria-label="转运事件时间线">
          <header className={styles.stageHeader}>
            <div><span>{transportId}</span><strong>{value(journey[0]?.payload.from_department)} <ArrowRight aria-hidden="true" size={14} /> {value(journey[0]?.payload.to_department)}</strong></div>
            <div className={styles.legend}><span data-tone="normal">普通事件</span><span data-tone="conflict">冲突事件</span><span>连线表示同一事件</span></div>
          </header>

          <section className={styles.clockAxis} aria-label="业务发生时间轴">
            <header><div><Clock3 aria-hidden="true" size={17} /><strong>业务发生时间</strong></div><span>按 event_time 排序</span></header>
            {renderAxis(occurredJourney, "event_time")}
          </section>

          <div className={styles.mappingBand} aria-label="同一事件的双时点映射">
            <svg viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true">
              {mappingPaths.map(({ item, fromX, toX }) => (
                <path
                  key={value(item.payload.event_id)}
                  d={`M ${fromX} 0 C ${fromX} 36, ${toX} 64, ${toX} 100`}
                  data-active={value(item.payload.event_id) === value(selectedEvent.payload.event_id)}
                  data-conflict={conflictType(item.payload)}
                />
              ))}
            </svg>
            <span>事件从发生时钟映射到接收时钟</span>
            <i
              className={styles.replayMarker}
              aria-label={`回放位置：第 ${Math.max(1, occurredJourney.findIndex((item) => value(item.payload.event_id) === value(selectedEvent.payload.event_id)) + 1)} 个事件`}
            />
          </div>

          <section className={styles.clockAxis} aria-label="系统接收时间轴">
            <header><div><Database aria-hidden="true" size={17} /><strong>系统接收时间</strong></div><span>按 received_at 排序</span></header>
            {renderAxis(receivedJourney, "received_at")}
          </section>
        </section>

        <aside className={styles.actionPanel} aria-label="当前冲突调和">
          <header><div><span>当前事件</span><strong>{value(selectedEvent.payload.event_id)}</strong></div><b data-conflict={selectedKind}>{conflictLabels[selectedKind] ?? "状态冲突"}</b></header>
          <section className={styles.delayCard} aria-label="事件双时点">
            <div><span>业务发生</span><strong>{time(selectedEvent.payload.event_time)}</strong></div>
            <ArrowRight aria-hidden="true" size={18} />
            <div><span>系统接收</span><strong>{time(selectedEvent.payload.received_at)}</strong></div>
            {selectedIsLate ? <em>晚到 {selectedDelay} 分钟</em> : null}
          </section>
          <dl className={styles.eventFacts}>
            <div><dt>来源系统</dt><dd>{sourceLabels[value(selectedEvent.payload.source_system)] ?? value(selectedEvent.payload.source_system)}</dd></div>
            <div><dt>事件版本</dt><dd>v{value(selectedEvent.payload.event_version)}</dd></div>
            <div><dt>事件类型</dt><dd>{eventLabels[value(selectedEvent.payload.event_type)] ?? value(selectedEvent.payload.event_type)}</dd></div>
            <div><dt>会签状态</dt><dd>{value(selectedEvent.payload.co_sign_status) === "pending" ? "待会签" : value(selectedEvent.payload.co_sign_status)}</dd></div>
          </dl>

          <section className={styles.reconcileForm} aria-label="调和决定">
            <label><span>处理策略</span><select aria-label="处理策略" value={draft.authoritativeState} onChange={(event) => updateDraft("authoritativeState", event.target.value)}>
              <option value="">请选择，不预设结论</option>
              {strategyOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select></label>
            <label><span>调和理由</span><textarea aria-label="调和理由" rows={3} value={draft.reconciliationReason} onChange={(event) => updateDraft("reconciliationReason", event.target.value)} placeholder="说明采用哪条记录，以及为何不覆盖历史" /></label>
          </section>

          <section className={styles.signatures} aria-label="双岗会签">
            <header><UserCheck aria-hidden="true" size={17} /><strong>签署与会签</strong></header>
            <label><span>转出方签署人</span><input aria-label="转出方签署人" value={draft.senderActorId} onChange={(event) => updateDraft("senderActorId", event.target.value)} placeholder="输入岗位身份" /></label>
            <label><span>接收方签署人</span><input aria-label="接收方签署人" value={draft.receiverActorId} onChange={(event) => updateDraft("receiverActorId", event.target.value)} placeholder="必须与转出方不同" /></label>
            <label><span>接收会签说明</span><textarea aria-label="接收会签说明" rows={2} value={draft.cosignNote} onChange={(event) => updateDraft("cosignNote", event.target.value)} placeholder="说明已核对的运营记录" /></label>
            {draft.receiverActorId && !actorsDiffer ? <p role="alert">接收方签署人必须与转出方不同。</p> : null}
          </section>

          <label className={styles.roleSelect}><span>当前操作角色</span><select aria-label="当前操作角色" value={props.actorRole} onChange={(event) => props.onActorRoleChange(event.target.value)}>{props.roles.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}</select></label>
          <div className={styles.commandList} aria-label="可执行动作">
            {props.commands.map((command) => {
              const ready = commandReady(command.id);
              return <button key={command.id} type="button" disabled={props.busy || !ready} onClick={() => runCommand(command.id)} data-tone={command.tone ?? "secondary"}>{props.busy ? "正在记录…" : command.label}<CheckCircle2 aria-hidden="true" size={17} /></button>;
            })}
          </div>
          {handledLateEvent ? <p className={styles.handledNote}>该晚到事件已经触发过重开，不可重复处理。</p> : null}
          {props.receipt ? <p className={styles.receipt} role="status">已记录：{props.receipt.event.fromState} → {props.receipt.event.toState}</p> : null}
          {props.error ? <p className={styles.error} role="alert">{props.error}<button type="button" onClick={() => props.onSelect(props.selected.objectId)}>刷新当前调和单</button></p> : null}
        </aside>
      </div>
    </main>
  );
}
