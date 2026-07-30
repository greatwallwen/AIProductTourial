"use client";

import {
  AlertTriangle,
  Building2,
  BusFront,
  Check,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  Film,
  MapPin,
  PackageCheck,
  RefreshCw,
  Route,
  School,
  Store,
  TicketCheck,
  Truck,
} from "lucide-react";
import type { CaseProjection } from "@course-ai-product/case-runtime";
import type { CSSProperties } from "react";
import type { CaseWorkbenchProps } from "./types";
import styles from "./ExpansionCaseWorkbenches.module.css";

const roleLabels: Record<string, string> = {
  route_planner: "路线策划",
  information_reviewer: "信息核验员",
  cinema_manager: "影院经理",
  replenishment_planner: "补货计划员",
  supervisor: "业务主管",
};

function value(row: Record<string, unknown>, key: string, fallback = "—") {
  const result = String(row[key] ?? "").trim();
  return result || fallback;
}

function number(row: Record<string, unknown>, key: string) {
  const result = Number(row[key]);
  return Number.isFinite(result) ? result : 0;
}

function money(amount: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 0,
  }).format(amount);
}

function RoleStateBar({ props, eyebrow, title, accent }: { props: CaseWorkbenchProps; eyebrow: string; title: string; accent: string }) {
  return <header className={styles.topbar} style={{ "--accent": accent } as CSSProperties}>
    <div><span>{eyebrow}</span><h1>{title}</h1><em>{props.selected.state}</em></div>
    <div className={styles.topActions}>
      <label>角色<select aria-label="当前操作角色" value={props.actorRole} onChange={(event) => props.onActorRoleChange(event.target.value)}>{props.roles.map((role) => <option key={role} value={role}>{roleLabels[role] ?? role}</option>)}</select></label>
      <button type="button" aria-label={`恢复案例 ${props.definition.id}`} onClick={props.onReset} disabled={props.busy}><RefreshCw size={16} /></button>
    </div>
  </header>;
}

function primary(props: CaseWorkbenchProps, operator: string, supervisor: string) {
  const wanted = props.actorRole === "supervisor" ? supervisor : operator;
  return props.commands.find((item) => item.id === wanted);
}

function ActionFooter({ props, operator, supervisor, label, reason, data }: { props: CaseWorkbenchProps; operator: string; supervisor: string; label: string; reason: string; data: Record<string, unknown> }) {
  const command = primary(props, operator, supervisor);
  return <footer className={styles.actionFooter}>
    <a href="/">全部案例</a>
    {props.error ? <span role="alert" className={styles.error}>{props.error}</span> : null}
    {props.receipt ? <span role="status" className={styles.receipt}><Check size={14} />{props.receipt.event.fromState} → {props.receipt.event.toState}</span> : null}
    {command ? <button type="button" disabled={props.busy} onClick={() => props.onCommand(command.id, reason, { data })}>{props.busy ? "正在保存…" : command.label || label}<ChevronRight size={18} /></button> : <strong>当前步骤已完成</strong>}
  </footer>;
}

function payloadOf(item: CaseProjection) {
  return item.payload as Record<string, unknown>;
}

export function WeekendRouteWorkbench(props: CaseWorkbenchProps) {
  const shanghai = props.objects.filter((item) => value(payloadOf(item), "city_name") === "上海").slice(0, 8);
  const preferredNames = ["上海迪士尼乐园", "东方绿舟", "东方明珠", "上海自然博物馆"];
  const preferredRoute = preferredNames
    .map((name) => props.objects.find((item) => value(payloadOf(item), "poi_name") === name))
    .filter((item): item is CaseProjection => Boolean(item));
  const routeItems = (preferredRoute.length === 4 ? preferredRoute : (shanghai.length >= 4 ? shanghai : props.objects)).slice(0, 4);
  const ticketBudget = routeItems.reduce((sum, item) => sum + number(payloadOf(item), "price_cny"), 0);
  return <main className={`${styles.product} ${styles.routeProduct}`} aria-label="上海周末路线编排台">
    <RoleStateBar props={props} eyebrow="B021 · 文旅服务" title="上海周末路线编排" accent="#13805f" />
    <section className={styles.routeSummary}>
      <span><Route size={17} />2 天 1 晚 · 上海周边</span><span><BusFront size={17} />4 个路线点</span><span><Clock3 size={17} />课程估算交通 4 小时 20 分</span>
      <b><CircleDollarSign size={18} />预算 ¥800 <i style={{ width: `${Math.min(100, ticketBudget / 8)}%` }} /><small>已用 {money(ticketBudget)} · 余 {money(Math.max(0, 800-ticketBudget))}</small></b>
    </section>
    <section className={styles.routeGrid}>
      <aside className={styles.poiRail}><header><strong>景点候选</strong><span>{props.datasetRowCount.toLocaleString("zh-CN")} 个历史 POI</span></header>{shanghai.slice(0, 7).map((item, index) => { const row=payloadOf(item); return <button key={item.objectId} type="button" data-active={props.selected.objectId === item.objectId} onClick={() => props.onSelect(item.objectId)}><i>{index + 1}</i><span><b>{value(row,"poi_name")}</b><small>{value(row,"district").split("·").at(-1)} · {number(row,"price_cny") ? money(number(row,"price_cny")) : "免费"}</small></span><em>{number(row,"sales_count").toLocaleString("zh-CN")}</em></button>; })}</aside>
      <section className={styles.routeMap} aria-label="路线地图">
        <div className={styles.mapGrid} />
        <svg viewBox="0 0 720 560" role="img" aria-label="四站路线连线"><path d="M145 385 C210 330 210 240 316 214 S455 135 536 189 S594 304 503 355" /><circle cx="145" cy="385" r="9"/><circle cx="316" cy="214" r="9"/><circle cx="536" cy="189" r="9"/><circle cx="503" cy="355" r="9"/></svg>
        {routeItems.map((item,index)=><article key={item.objectId} style={{left:["17%","40%","69%","64%"][index],top:["65%","35%","30%","62%"][index]}}><i>{index+1}</i><b>{value(payloadOf(item),"poi_name")}</b></article>)}
        <div className={styles.mapScale}>上海市区 <span>路线为课程编排示意</span></div>
      </section>
      <section className={styles.itinerary}><header><strong>两日行程</strong><span>门票估算 {money(ticketBudget)}</span></header><div className={styles.dayColumns}>{["周六","周日"].map((day,dayIndex)=><section key={day}><h3>{day}</h3>{routeItems.slice(dayIndex*2,dayIndex*2+2).map((item,index)=>{const row=payloadOf(item);return <article key={item.objectId}><i>{dayIndex*2+index+1}</i><div><b>{value(row,"poi_name")}</b><span>{index ? "14:00–17:30" : "09:00–12:00"}</span><small>{value(row,"address").slice(0,22)}</small></div></article>})}</section>)}</div><aside><strong>出发前核验</strong><span><Check size={13}/>营业时间</span><span><Check size={13}/>预约要求</span><span data-alert><AlertTriangle size={13}/>实时交通待核对</span></aside></section>
    </section>
    <ActionFooter props={props} operator="save_route_draft" supervisor="confirm_route" label="保存路线草案" reason="路线已按地理顺序、门票预算和两日时段完成编排，营业时间、预约和实时交通保留为出发前核验项。" data={{ routePoiIds: routeItems.map((item)=>value(payloadOf(item),"poi_id")), ticketBudgetCny: ticketBudget, liveChecks:["opening-hours","reservation","traffic"] }} />
  </main>;
}

export function TransferNoticeWorkbench(props: CaseWorkbenchProps) {
  const rows = props.objects.slice(0, 12);
  const selected = payloadOf(props.selected);
  return <main className={`${styles.product} ${styles.noticeProduct}`} aria-label="调剂信息新鲜度核验台">
    <RoleStateBar props={props} eyebrow="B022 · 教育信息服务" title="调剂信息新鲜度核验" accent="#185bd7" />
    <section className={styles.noticeFilters}><label><School size={15}/>学校 <input aria-label="学校筛选" value="全部学校" readOnly /></label><label><Building2 size={15}/>专业 <input aria-label="专业筛选" value="全部专业" readOnly /></label><b><AlertTriangle size={15}/>全部为 2021 历史快照，不代表当前名额</b></section>
    <section className={styles.noticeGrid}>
      <section className={styles.noticeList}><header><span>通知标题</span><span>院校 / 专业</span><span>发布日期</span><span>状态</span></header>{rows.map((item)=>{const row=payloadOf(item);return <button key={item.objectId} type="button" data-active={item.objectId===props.selected.objectId} onClick={()=>props.onSelect(item.objectId)}><FileCheck2 size={16}/><span><b>{value(row,"notice_title").slice(0,31)}</b><small>{value(row,"school_name")} · {value(row,"major_name").slice(0,20)}</small></span><time>{value(row,"published_date")}</time><em>{value(row,"freshness_status")}</em></button>})}</section>
      <article className={styles.noticeDocument}><header><span>历史原文快照</span><b>{value(selected,"notice_title")}</b><small>{value(selected,"school_name")} · {value(selected,"published_date")}</small></header><div className={styles.documentPaper}><School size={34}/><h2>{value(selected,"school_name")}</h2><h3>{value(selected,"notice_title")}</h3><p>专业：{value(selected,"major_name")}</p><p>来源路径：{value(selected,"source_relative_url")}</p><i/><i/><i/><i/></div><footer>页面仅保存历史字段，官方页面内容须重新核验。</footer></article>
      <aside className={styles.verifyQueue}><header><strong>回源核验队列</strong><span>3 项</span></header>{["招生单位官网通知","研招网院校页面","发布日期与专业口径"].map((label,index)=><article key={label}><i>{index+1}</i><div><b>{label}</b><span>{index===0?"优先核对":"待核对"}</span></div><Check size={15}/></article>)}<section><b>核验原则</b><p>历史信息只用于练习筛选。没有官方当前页面，就不能写“仍有名额”。</p></section></aside>
    </section>
    <ActionFooter props={props} operator="create_verification_task" supervisor="confirm_verified_list" label="加入官方回源清单" reason="该通知属于历史快照，已保存院校、专业、日期和来源路径，等待官方当前页面核验。" data={{ noticeId:value(selected,"notice_id"), sourcePath:value(selected,"source_relative_url"), snapshotYear:value(selected,"snapshot_year"), requiredChecks:["school-official","yz-chsi","date-major"] }} />
  </main>;
}

export function SpringFestivalScreeningWorkbench(props: CaseWorkbenchProps) {
  const films = props.objects.slice(0, 8);
  const schedule = props.supportingArtifacts["screening-schedule.csv"] ?? [];
  const champion = value(payloadOf(films[0] ?? props.selected), "movie_name", "影片 A");
  const times = ["09:30","12:10","15:00","17:50","20:30","23:10"];
  return <main className={`${styles.product} ${styles.cinemaProduct}`} aria-label="春节档排片沙盘">
    <RoleStateBar props={props} eyebrow="B023 · 影院经营 · 历史演练" title="春节档排片沙盘" accent="#d89a25" />
    <section className={styles.cinemaSummary}><span><Film size={17}/>大年初七 · 6 个影厅</span><b><TicketCheck size={17}/>黄金场 6</b><span>历史排片记录 {schedule.length} 条</span><em><AlertTriangle size={14}/>容量预警：晚场周转偏紧</em></section>
    <section className={styles.cinemaGrid}>
      <section className={styles.scheduleBoard}><header><b>影厅</b>{times.map(time=><time key={time}>{time}</time>)}</header>{Array.from({length:6},(_,hall)=><div className={styles.hallRow} key={hall}><strong>{hall+1}号厅<small>{[356,450,286,356,220,160][hall]} 座</small></strong>{times.map((time,index)=>{const film=films[(hall*2+index)%Math.max(1,films.length)] ?? props.selected;const row=payloadOf(film);const golden=index===3 || (hall===1&&index===4);return <button type="button" key={time} data-golden={golden} onClick={()=>props.onSelect(film.objectId)}><i>{value(row,"main_genre","剧情")}</i><b>{value(row,"movie_name").slice(0,8)}</b><small>{value(row,"runtime_minutes","120")} 分 · 历史占比 {number(row,"latest_schedule_share_pct").toFixed(1)}%</small></button>})}</div>)}</section>
      <aside className={styles.cinemaInsights}><article><header><strong>整场上座率走势</strong><span>历史沙盘</span></header><svg viewBox="0 0 330 120" role="img" aria-label="历史上座率走势"><path d="M10 102 C42 88 57 43 91 57 S139 104 170 77 S219 31 248 52 S287 71 320 38"/><circle cx="320" cy="38" r="5"/></svg><small>峰值约 78%，不是本影院实时数据</small></article><article><header><strong>影片比较</strong><span>片长 / 历史受众</span></header>{films.slice(0,4).map((film,index)=>{const row=payloadOf(film);return <div key={film.objectId}><i style={{height:`${34+index*12}px`}}/><span><b>{value(row,"movie_name").slice(0,9)}</b><small>{value(row,"runtime_minutes")} 分 · {number(row,"cumulative_audience").toLocaleString("zh-CN")} 人次</small></span></div>})}</article><section><AlertTriangle size={18}/><div><b>黄金场不要只看总票房</b><p>还要同时看片长、散场间隔、影厅容量和本地预售。</p></div></section></aside>
    </section>
    <ActionFooter props={props} operator="save_screening_draft" supervisor="confirm_screening_plan" label="保存排片草案" reason="已在六个影厅内平衡片长、历史受众和黄金场数量，方案仍需结合本影院实时售票复核。" data={{ champion, goldenSlots:6, halls:6, basis:"historical-sandbox" }} />
  </main>;
}

export function SupermarketReplenishmentWorkbench(props: CaseWorkbenchProps) {
  const allPressure = props.supportingArtifacts["sales-pressure.csv"] ?? [];
  const pressure = allPressure.slice(0, 6);
  const active = pressure[0] ?? payloadOf(props.selected);
  const stores = [...new Set(allPressure.map((row)=>value(row,"store_id","")).filter(Boolean))].slice(0,5);
  return <main className={`${styles.product} ${styles.storeProduct}`} aria-label="连锁门店补货排序台">
    <RoleStateBar props={props} eyebrow="B024 · 连锁零售" title="成都门店补货排序" accent="#079153" />
    <section className={styles.storeSummary}><b><Truck size={18}/>配送容量 <strong>12 托盘</strong></b><span><AlertTriangle size={15}/>销量不是库存</span><em>历史交易 {props.datasetRowCount.toLocaleString("zh-CN")} 条</em></section>
    <section className={styles.storeGrid}>
      <aside className={styles.pressureList}><header><strong>补货核对顺序</strong><span>按历史销量压力排序</span></header>{pressure.map((row,index)=><article key={`${value(row,"store_id")}-${value(row,"category_id")}`}><i>{index+1}</i><Store size={19}/><div><b>{value(row,"store_id")} · 品类 {value(row,"category_id").slice(-4)}</b><span>{number(row,"units_sold").toLocaleString("zh-CN")} 件 / {value(row,"active_days")} 个活跃日</span></div><em>{index<2?"高":index<4?"中":"低"}</em></article>)}<p>排序只决定先核对谁，不直接生成补货量。</p></aside>
      <section className={styles.storeMap} aria-label="成都门店网络"><div className={styles.mapGrid}/><svg viewBox="0 0 620 500" role="img" aria-label="配送中心与门店连接"><path d="M305 244 L142 128 M305 244 L475 105 M305 244 L511 308 M305 244 L165 376 M305 244 L374 418"/><circle cx="305" cy="244" r="15"/></svg><b className={styles.warehouse}><PackageCheck size={19}/>配送中心</b>{stores.map((store,index)=><article key={store} style={{left:["18%","72%","78%","21%","57%"][index],top:["20%","16%","59%","72%","79%"][index]}}><Store size={16}/><b>{store}</b></article>)}</section>
      <aside className={styles.storeEvidence}><article><header><strong>历史销量节奏</strong><span>{value(active,"store_id")} · {value(active,"category_id")}</span></header><svg viewBox="0 0 330 125" role="img" aria-label="七日历史销量节奏"><path d="M8 101 L58 82 L105 56 L153 87 L202 70 L250 34 L320 64"/><circle cx="250" cy="34" r="5"/></svg><small>销量速度 {number(active,"sales_velocity_units_per_day").toFixed(2)} 件/活跃日</small></article><section><header><strong>库存核对资料</strong><span>0 / 3</span></header>{[["在库","当前门店可用量"],["在途","配送中心已发未到"],["货架容量","门店可陈列上限"]].map(([label,note])=><label key={label}><input type="checkbox"/><i/><span><b>{label}</b><small>{note}</small></span></label>)}<p><AlertTriangle size={14}/>三项资料未齐，任务只能停在库存核对。</p></section></aside>
    </section>
    <ActionFooter props={props} operator="create_inventory_check" supervisor="confirm_replenishment" label="创建库存核对任务" reason="根据历史销量压力确定优先核对门店和品类；在库、在途、货架容量未补齐前不生成补货量。" data={{ storeId:value(active,"store_id"), categoryId:value(active,"category_id"), salesPressureRank:value(active,"sales_pressure_rank"), missingEvidence:["on-hand","in-transit","shelf-capacity"], palletCapacity:12 }} />
  </main>;
}
