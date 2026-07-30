"use client";

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CloudSun,
  Database,
  FileCheck2,
  Filter,
  LockKeyhole,
  RefreshCw,
  Search,
  ShieldCheck,
  Thermometer,
  Wind,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import styles from "./AirQualityReleaseWorkbench.module.css";
import type { CaseWorkbenchProps } from "./types";

const pollutants = ["PM2.5", "PM10", "SO2", "NO2", "CO", "O3"] as const;
type Pollutant = typeof pollutants[number];
type Completeness = Record<Pollutant, "present" | "missing">;
type ReleasePackage = {
  packageId: string;
  version: string;
  station: string;
  observedAt: string;
  sourceRowId: string;
  pollutants: Record<Pollutant, string>;
};
type AirReleaseTask = {
  releasePackage?: ReleasePackage;
  completeness?: Partial<Completeness>;
  reviewNote?: string;
  approvalNote?: string;
  returnReason?: string;
  missingPollutants?: Pollutant[];
  reviewerId?: string;
};

const stationLabels: Record<string, string> = {
  Aotizhongxin: "奥体中心",
  Changping: "昌平",
  Dingling: "定陵",
  Dongsi: "东四",
  Guanyuan: "官园",
  Gucheng: "古城",
  Huairou: "怀柔",
  Nongzhanguan: "农展馆",
  Shunyi: "顺义",
  Tiantan: "天坛",
  Wanliu: "万柳",
  Wanshouxigong: "万寿西宫",
};

const pollutantUnits: Record<Pollutant, string> = {
  "PM2.5": "μg/m³",
  PM10: "μg/m³",
  SO2: "μg/m³",
  NO2: "μg/m³",
  CO: "mg/m³",
  O3: "μg/m³",
};

function text(value: unknown): string {
  return String(value ?? "—");
}

function rawText(value: unknown): string {
  return value === undefined || value === null ? "" : String(value);
}

function isMissing(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

function stationName(value: unknown): string {
  return stationLabels[text(value)] ?? text(value);
}

function observedLabel(value: unknown): string {
  return text(value).slice(0, 16);
}

function displayPollutant(key: Pollutant, value: unknown): string {
  if (isMissing(value)) return "—";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return text(value);
  if (key === "CO") return (parsed / 1000).toFixed(1);
  return parsed.toFixed(parsed % 1 ? 1 : 0);
}

function roleLabel(role: string): string {
  if (role === "supervisor") return "数据复核人";
  if (role === "auditor") return "数据审核员";
  return role;
}

function stateLabel(state: string): string {
  if (state === "待审核" || state === "待质检") return "待质检";
  if (state === "待发布" || state === "待复核") return "待复核";
  if (state === "已发布" || state === "已纳入摘录") return "摘录已确认";
  if (state === "已拒发" || state === "本批次不纳入") return "本批次不纳入";
  return state;
}

function completenessOf(row: Record<string, unknown>): Completeness {
  return Object.fromEntries(
    pollutants.map((key) => [key, isMissing(row[key]) ? "missing" : "present"]),
  ) as Completeness;
}

function restoreTask(props: CaseWorkbenchProps): AirReleaseTask {
  const eventData = props.events
    .filter((event) => event.objectId === props.selected.objectId)
    .reduce<AirReleaseTask>(
    (current, event) => ({ ...current, ...(event.data ?? {}) }),
    {},
    );
  return { ...eventData, ...(props.selected.task ?? {}) } as AirReleaseTask;
}

function releasePackageOf(row: Record<string, unknown>, revision: number): ReleasePackage {
  const station = text(row.station);
  const observedAt = text(row.observed_at);
  const version = Math.max(1, revision + 1);
  return {
    packageId: `AQ-${observedAt.slice(0, 10).replaceAll("-", "")}-${station}-${text(row.No)}-v${version}`,
    version: `${version}.0`,
    station,
    observedAt,
    sourceRowId: text(row.No),
    pollutants: Object.fromEntries(
      pollutants.map((key) => [key, rawText(row[key])]),
    ) as Record<Pollutant, string>,
  };
}

function queueStatus(row: Record<string, unknown>): string {
  const missing = pollutants.filter((key) => isMissing(row[key])).length;
  if (missing === pollutants.length) return "六项缺测";
  if (missing > 0) return `缺测 ${missing} 项`;
  return "六项有值";
}

export function AirQualityReleaseWorkbench(props: CaseWorkbenchProps) {
  const row = props.selected.payload;
  const restoredTask = useMemo(
    () => restoreTask(props),
    [props.events, props.selected.task],
  );
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "complete" | "missing">("all");
  const [reviewNote, setReviewNote] = useState(restoredTask.reviewNote ?? "");
  const [approvalNote, setApprovalNote] = useState(restoredTask.approvalNote ?? "");
  const [returnReason, setReturnReason] = useState(restoredTask.returnReason ?? "");

  useEffect(() => {
    setReviewNote(restoredTask.reviewNote ?? "");
    setApprovalNote(restoredTask.approvalNote ?? "");
    setReturnReason(restoredTask.returnReason ?? "");
  }, [props.selected.objectId, props.selected.version, restoredTask]);

  const currentCompleteness = useMemo(() => completenessOf(row), [row]);
  const currentPackage = useMemo(
    () => releasePackageOf(row, props.selected.version),
    [props.selected.version, row],
  );
  const reviewPackage = restoredTask.releasePackage ?? currentPackage;
  const packagePersisted = Boolean(restoredTask.releasePackage?.packageId);
  const packageBoundToSelection = reviewPackage.station === currentPackage.station
    && reviewPackage.observedAt === currentPackage.observedAt
    && reviewPackage.sourceRowId === currentPackage.sourceRowId
    && pollutants.every((key) => reviewPackage.pollutants?.[key] === currentPackage.pollutants[key]);
  const reviewCompleteness = packagePersisted && packageBoundToSelection
    ? { ...currentCompleteness, ...(restoredTask.completeness ?? {}) } as Completeness
    : currentCompleteness;
  const missingPollutants = pollutants.filter((key) => reviewCompleteness[key] === "missing");
  const availableCount = pollutants.length - missingPollutants.length;
  const hasCommand = (id: string) => props.commands.some((command) => command.id === id);
  const freezeReady = availableCount === pollutants.length && reviewNote.trim().length >= 6;
  const confirmReady = packagePersisted
    && packageBoundToSelection
    && availableCount === pollutants.length
    && approvalNote.trim().length >= 6;
  const excludeReady = missingPollutants.length > 0 && returnReason.trim().length >= 6;

  const filteredObjects = props.objects.filter((item) => {
    const payload = item.payload;
    const label = `${stationName(payload.station)} ${observedLabel(payload.observed_at)}`;
    const missing = pollutants.some((key) => isMissing(payload[key]));
    const queryMatches = !query.trim() || label.includes(query.trim());
    const filterMatches = filter === "all" || (filter === "missing" ? missing : !missing);
    return queryMatches && filterMatches;
  });

  const sameHourRows = [
    row,
    ...props.sceneRows.filter(
      (item) => text(item.observed_at) === text(row.observed_at)
        && !(text(item.station) === text(row.station) && text(item.No) === text(row.No)),
    ),
  ].slice(0, 3);
  const currentIndex = Math.max(0, props.objects.findIndex((item) => item.objectId === props.selected.objectId));
  const previousObject = props.objects[currentIndex - 1];
  const nextObject = props.objects[currentIndex + 1];

  function runCommand(command: "freeze_release_scope" | "publish" | "reject_release") {
    if (command === "freeze_release_scope") {
      if (!freezeReady) return;
      props.onCommand(command, reviewNote.trim(), {
        actorId: "case06-air-auditor",
        idempotencyKey: `air-release:${props.selected.objectId}:${props.selected.version}:freeze`,
        evidenceIds: [
          `station-hour:${currentPackage.station}:${currentPackage.observedAt}`,
          `source-row:${currentPackage.sourceRowId}`,
        ],
        data: {
          releasePackage: currentPackage,
          completeness: currentCompleteness,
          reviewNote: reviewNote.trim(),
          reviewerId: "case06-air-auditor",
        },
      });
      return;
    }
    if (command === "publish") {
      if (!confirmReady) return;
      props.onCommand(command, approvalNote.trim(), {
        actorId: "case06-release-supervisor",
        idempotencyKey: `air-release:${props.selected.objectId}:${props.selected.version}:publish`,
        evidenceIds: [`release-package:${reviewPackage.packageId}`],
        data: {
          releasePackage: reviewPackage,
          approvalNote: approvalNote.trim(),
          approverId: "case06-release-supervisor",
        },
      });
      return;
    }
    if (!excludeReady) return;
    props.onCommand(command, returnReason.trim(), {
      actorId: "case06-release-supervisor",
      idempotencyKey: `air-release:${props.selected.objectId}:${props.selected.version}:reject`,
      evidenceIds: [`station-hour:${currentPackage.station}:${currentPackage.observedAt}`],
      data: {
        returnReason: returnReason.trim(),
        missingPollutants,
        approverId: "case06-release-supervisor",
      },
    });
  }

  const action = missingPollutants.length > 0
    ? hasCommand("reject_release") ? "reject_release" : undefined
    : packagePersisted
      ? packageBoundToSelection && hasCommand("publish") ? "publish" : undefined
      : hasCommand("freeze_release_scope") ? "freeze_release_scope" : undefined;
  const isExcluded = props.selected.state === "已拒发" || props.selected.state === "本批次不纳入";
  const isIncluded = props.selected.state === "已发布" || props.selected.state === "已纳入摘录";
  const resultTitle = isExcluded
    ? "本批次不纳入"
    : isIncluded
      ? "摘录已确认"
      : missingPollutants.length > 0
        ? "本批次不纳入"
        : packagePersisted
          ? "摘录已锁定"
          : "可锁定摘录";
  const inactiveActionLabel = isExcluded
    ? "已记录本批次不纳入"
    : isIncluded
      ? "本批次摘录已确认"
      : missingPollutants.length > 0
        ? "切换数据复核人处理"
        : packagePersisted
          ? "等待锁定摘录复核"
          : "切换数据审核员处理";

  return (
    <main className={styles.root} aria-label="历史空气质量数据摘录质检">
      <header className={styles.header}>
        <div className={styles.brand}><Database aria-hidden="true" /><span>空气质量数据质检平台</span></div>
        <h1>历史空气质量数据摘录质检</h1>
        <div className={styles.datasetFact}><strong>{props.datasetRowCount.toLocaleString("zh-CN")}</strong><span>行系统抽样切片 · 历史数据</span></div>
        <div className={styles.actor}><ShieldCheck aria-hidden="true" /><span>{roleLabel(props.actorRole)}</span><button type="button" aria-label="恢复当前质检记录" title="恢复当前质检记录" onClick={props.onReset} disabled={props.busy}><RefreshCw aria-hidden="true" /></button></div>
      </header>

      <section className={styles.workspace}>
        <aside className={styles.queue} aria-label="待检查记录队列">
          <header><div><h2>待检查记录队列</h2><span>当前装载 {props.objects.length.toLocaleString("zh-CN")} 条</span></div></header>
          <div className={styles.queueTools}>
            <label><Filter aria-hidden="true" /><span className={styles.srOnly}>记录状态</span><select aria-label="记录状态" value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}><option value="all">全部状态</option><option value="missing">存在缺测</option><option value="complete">六项有值</option></select></label>
            <label><Search aria-hidden="true" /><input aria-label="搜索站点或时间" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="站点或时间" /></label>
          </div>
          <div className={styles.queueList}>
            {filteredObjects.map((item) => {
              const status = queueStatus(item.payload);
              const complete = status === "六项有值";
              return <button key={item.objectId} type="button" aria-pressed={item.objectId === props.selected.objectId} aria-label={`${stationName(item.payload.station)}站 ${observedLabel(item.payload.observed_at)} ${status}`} onClick={() => props.onSelect(item.objectId)}><span><strong>{stationName(item.payload.station)}站</strong><small>{observedLabel(item.payload.observed_at)}</small></span><b data-complete={complete}>{status}</b></button>;
            })}
            {!filteredObjects.length ? <p className={styles.empty}>当前筛选没有记录。</p> : null}
          </div>
          <footer><span>课程切片共 {props.datasetRowCount.toLocaleString("zh-CN")} 行</span><small>每 20 行取 1 行</small></footer>
        </aside>

        <section className={styles.inspection}>
          <header className={styles.recordHeader}>
            <div><span>当前检查记录</span><h2>{stationName(row.station)}站</h2></div>
            <dl><div><dt>时间</dt><dd>{observedLabel(row.observed_at)}</dd></div><div><dt>源行</dt><dd>{text(row.No)}</dd></div><div><dt>状态</dt><dd>{stateLabel(props.selected.state)}</dd></div></dl>
          </header>

          <section className={styles.gates} aria-label="六指标质量闸门">
            <header><div><h2>六指标质量闸门</h2><p>系统按源字段逐项核对，不填 0，不用其他记录补值。</p></div><strong data-complete={availableCount === pollutants.length}>{availableCount} / 6 项可用</strong></header>
            <div className={styles.gateList} key={props.selected.objectId}>
              {pollutants.map((key, index) => {
                const missing = currentCompleteness[key] === "missing";
                return <article key={key} data-missing={missing}>
                  <span className={styles.gateIndex}>{index + 1}</span>
                  <div className={styles.gateName}><strong>{key}</strong><small>{pollutantUnits[key]}</small></div>
                  <div className={styles.gateTrack}><i /></div>
                  <strong className={styles.gateValue}>{displayPollutant(key, row[key])}</strong>
                  <span className={styles.gateState}>{missing ? <X aria-hidden="true" /> : <Check aria-hidden="true" />}{missing ? "缺测" : "有值"}</span>
                </article>;
              })}
            </div>
          </section>

          <section className={styles.context}>
            <div className={styles.weather} aria-label="原记录气象字段">
              <header><h3>同一条原记录中的气象字段</h3><span>仅证明该行仍存在</span></header>
              <div><article><Thermometer aria-hidden="true" /><span>气温</span><strong>{text(row.TEMP)} ℃</strong></article><article><CloudSun aria-hidden="true" /><span>气压</span><strong>{text(row.PRES)} hPa</strong></article><article><Wind aria-hidden="true" /><span>风向 / 风速</span><strong>{text(row.wd)} · {text(row.WSPM)} m/s</strong></article></div>
            </div>
            <div className={styles.sliceTable} aria-label="当前切片同一时点记录">
              <header><div><h3>当前切片同一时点保留 {sameHourRows.length} 条记录</h3><p>仅作字段完整性对照，不替代当前站点原值。</p></div><span>最多 3 站</span></header>
              <div className={styles.tableWrap}><table><thead><tr><th>站点</th>{pollutants.map((key) => <th key={key}>{key}</th>)}<th>结果</th></tr></thead><tbody>{sameHourRows.map((item) => {
                const missing = pollutants.filter((key) => isMissing(item[key])).length;
                return <tr key={`${text(item.station)}-${text(item.No)}`} data-active={text(item.station) === text(row.station)}><th>{stationName(item.station)}</th>{pollutants.map((key) => <td key={key} data-missing={isMissing(item[key])}>{displayPollutant(key, item[key])}</td>)}<td>{missing ? `缺 ${missing} 项` : "六项有值"}</td></tr>;
              })}</tbody></table></div>
              <p className={styles.unsampled}>其他站点未进入当前切片，不等于缺测</p>
            </div>
          </section>

          <footer className={styles.recordNav}><button type="button" disabled={!previousObject} onClick={() => previousObject && props.onSelect(previousObject.objectId)}><ArrowLeft aria-hidden="true" />上一条</button><span>{currentIndex + 1} / {props.objects.length}</span><button type="button" disabled={!nextObject} onClick={() => nextObject && props.onSelect(nextObject.objectId)}>下一条<ArrowRight aria-hidden="true" /></button></footer>
        </section>

        <aside className={styles.decision} aria-label="摘录质检决定">
          <section className={styles.result} data-missing={missingPollutants.length > 0}>
            <header>{missingPollutants.length > 0 ? <AlertTriangle aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}<div><span>本条检查结果</span><h2>{resultTitle}</h2></div></header>
            <p>{missingPollutants.length > 0 ? `${missingPollutants.join("、")} 为真实空值；原值保持不变。` : "六项污染物均有值，可锁定站点、时次、源行和原始数值。"}</p>
          </section>

          {!packageBoundToSelection && packagePersisted ? <p className={styles.error} role="alert" aria-label="摘录绑定异常">当前记录 {stationName(currentPackage.station)} / {currentPackage.observedAt} 与锁定摘录 {stationName(reviewPackage.station)} / {reviewPackage.observedAt} 不一致，不能确认。</p> : null}

          <section className={styles.review}>
            <header><h2>审核信息</h2><span>{stateLabel(props.selected.state)}</span></header>
            <label><span>当前角色</span><select aria-label="当前操作角色" value={props.actorRole} onChange={(event) => props.onActorRoleChange(event.target.value)}>{props.roles.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}</select></label>
            {missingPollutants.length > 0 ? <label><span>本批次不纳入原因</span><textarea aria-label="本批次不纳入原因" value={returnReason} onChange={(event) => setReturnReason(event.target.value)} placeholder="写明缺项，本批次不纳入并保留原始空值" /></label> : packagePersisted ? <label><span>复核意见</span><textarea aria-label="复核意见" value={approvalNote} onChange={(event) => setApprovalNote(event.target.value)} placeholder="核对锁定记录与六项原始值" /></label> : <label><span>摘录检查说明</span><textarea aria-label="摘录检查说明" value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} placeholder="核对站点、时次、源行和六项污染物" /></label>}
          </section>

          <section className={styles.preview} aria-label="数据摘录预览">
            <header><h2>数据摘录预览</h2><span>{packagePersisted ? "摘录已锁定" : "当前记录"}</span></header>
            <dl><div><dt>摘录编号</dt><dd>{reviewPackage.packageId}</dd></div><div><dt>站点 / 时次</dt><dd>{stationName(reviewPackage.station)} · {observedLabel(reviewPackage.observedAt)}</dd></div><div><dt>源行</dt><dd>{reviewPackage.sourceRowId}</dd></div></dl>
            <div className={styles.previewGrid}>{pollutants.map((key) => <span key={key} data-missing={isMissing(reviewPackage.pollutants[key])}><small>{key}</small><strong>{displayPollutant(key, reviewPackage.pollutants[key])}</strong></span>)}</div>
          </section>

          <section className={styles.scopeNote}><FileCheck2 aria-hidden="true" /><p><strong>本案例只检查历史数据摘录。</strong>不生成 AQI、健康建议、缺测原因或污染成因。</p></section>
          {props.receipt ? <p className={styles.receipt} role="status">记录已保存：{stateLabel(props.receipt.event.fromState)} → {stateLabel(props.receipt.event.toState)}</p> : null}
          {props.error ? <p className={styles.error} role="alert">{props.error}<button type="button" onClick={() => props.onSelect(props.selected.objectId)}>刷新当前记录</button></p> : null}

          <footer className={styles.actionDock}>
            {action === "reject_release" ? <button type="button" data-tone="danger" disabled={props.busy || !excludeReady} onClick={() => runCommand("reject_release")}><X aria-hidden="true" />{props.busy ? "正在保存…" : "确认本批次不纳入"}</button> : null}
            {action === "freeze_release_scope" ? <button type="button" disabled={props.busy || !freezeReady} onClick={() => runCommand("freeze_release_scope")}><LockKeyhole aria-hidden="true" />{props.busy ? "正在保存…" : "锁定数据摘录"}</button> : null}
            {action === "publish" ? <button type="button" disabled={props.busy || !confirmReady} onClick={() => runCommand("publish")}><Check aria-hidden="true" />{props.busy ? "正在保存…" : "确认本批次摘录"}</button> : null}
            {!action ? <button type="button" disabled>{inactiveActionLabel}</button> : null}
          </footer>
        </aside>
      </section>
    </main>
  );
}
