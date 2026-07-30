"use client";

import type { CSSProperties } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  Factory,
  Map,
  Landmark,
  Search,
  SearchCheck,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import type { CatalogCase } from "../lib/catalog-adapter";

const familyIcons = {
  commerce: BriefcaseBusiness,
  approval: ShieldCheck,
  investigation: SearchCheck,
  industrial: Factory,
};

function sceneSource(caseId: string) {
  return caseId === "B018"
    ? "/case-assets/case-B018/boiler-plant-scene.png"
    : `/case-assets/case-${caseId}/scene.png`;
}

function searchCases(cases: CatalogCase[], query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return cases;
  return cases.filter((item) =>
    [item.id, item.shortTitle, item.title, item.industry, item.scenario, item.familyLabel, ...item.journeySteps]
      .join(" ")
      .toLowerCase()
      .includes(needle),
  );
}

function ProductStage({ selected }: { selected: CatalogCase }) {
  const FamilyIcon = familyIcons[selected.family];
  return (
    <section
      className="catalog-stage"
      aria-label="案例舞台"
      data-family={selected.family}
      key={`case-${selected.id}`}
    >
      <img
        className="catalog-stage__scene"
        src={sceneSource(selected.runtimeId)}
        alt={`${selected.shortTitle}业务现场`}
        suppressHydrationWarning
      />
      <div className="catalog-stage__shade" aria-hidden="true" />
      <div className="catalog-stage__signal" aria-hidden="true"><i /><i /><i /><i /></div>
      <div className="catalog-stage__copy">
        <div className="catalog-stage__meta">
          <span>{selected.id}</span>
          <FamilyIcon aria-hidden="true" size={18} />
          <b>{selected.industry}</b>
          <em>{selected.familyLabel}</em>
        </div>
        <h1>{selected.shortTitle}</h1>
        <p className="catalog-stage__question">
          <a href={selected.href}>{selected.title}</a>
        </p>
        <p className="catalog-stage__scenario">{selected.scenario}</p>
        <div className="catalog-stage__object">
          <span>当前对象</span>
          <strong>{selected.objectLabel}：{selected.defaultObject}</strong>
        </div>
        <a href={selected.href} aria-label={`进入案例：${selected.shortTitle}`}>
          进入现场 <ArrowUpRight aria-hidden="true" size={18} />
        </a>
      </div>
      <div className="catalog-stage__journey">
        <header><span>业务推进</span><strong>{selected.journeySteps.length} 个可执行关口</strong></header>
        <ol aria-label="当前案例流程">
          {selected.journeySteps.map((step, index) => (
            <li key={`${selected.id}-${step}`}><b>{String(index + 1).padStart(2, "0")}</b><span>{step}</span></li>
          ))}
        </ol>
        <div className="catalog-stage__runtime">
          <span>离线可运行</span>
          {selected.runtime.optionalLiveModel ? <span>可选模型辅助</span> : null}
          {selected.runtime.recoverable ? <span>支持中断恢复</span> : null}
        </div>
      </div>
    </section>
  );
}

export function CaseCatalog({ cases, onBackToMap }: { cases: CatalogCase[]; onBackToMap?: () => void }) {
  const [query, setQuery] = useState("");
  const [selectedCaseId, setSelectedCaseId] = useState(cases[0]?.id ?? "");
  const filteredCases = searchCases(cases, query);
  const selected = filteredCases.find((item) => item.id === selectedCaseId) ?? filteredCases[0];

  const selectRelative = (offset: number) => {
    if (!selected || filteredCases.length === 0) return;
    const current = filteredCases.findIndex((item) => item.id === selected.id);
    const next = filteredCases[(current + offset + filteredCases.length) % filteredCases.length];
    setSelectedCaseId(next.id);
  };

  return (
    <main className="catalog-shell">
      <header className="catalog-masthead">
        <div className="catalog-brand"><Landmark aria-hidden="true" size={19} /><span>AI PRODUCT ENGINEERING</span></div>
        {onBackToMap ? (
          <button type="button" className="catalog-map-return" onClick={onBackToMap}>
            <Map aria-hidden="true" size={16} />能力地图
          </button>
        ) : null}
        <div className="catalog-search">
          <Search aria-hidden="true" size={17} />
          <label className="sr-only" htmlFor="catalog-query">搜索课程案例</label>
          <input
            id="catalog-query"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索场景、问题或行业"
          />
          <span>{filteredCases.length} / {cases.length}</span>
        </div>
      </header>

      {!selected ? (
        <section className="catalog-empty">
          <Search size={24} aria-hidden="true" />
          <h1>没有匹配结果</h1>
          <p>缩短关键词后再试。</p>
        </section>
      ) : (
        <ProductStage selected={selected} />
      )}

      {selected ? (
        <section
          className="catalog-filmstrip"
          aria-label="选择案例"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight") selectRelative(1);
            if (event.key === "ArrowLeft") selectRelative(-1);
          }}
          onWheel={(event) => selectRelative(event.deltaY >= 0 ? 1 : -1)}
        >
          <button type="button" className="catalog-filmstrip__arrow" aria-label="上一个" onClick={() => selectRelative(-1)}>
            <ArrowLeft aria-hidden="true" size={18} />
          </button>
          <div
            className="catalog-filmstrip__track"
            style={{ "--catalog-item-count": filteredCases.length } as CSSProperties}
          >
            {filteredCases.map((item) => (
              <button
                type="button"
                key={item.id}
                aria-label={`选择案例 ${item.id}：${item.shortTitle}`}
                aria-pressed={item.id === selected.id}
                data-family={item.family}
                onClick={() => setSelectedCaseId(item.id)}
              >
                <span>{item.id}</span>
                <strong>{item.shortTitle}</strong>
                <small>{item.industry}</small>
              </button>
            ))}
          </div>
          <button type="button" className="catalog-filmstrip__arrow" aria-label="下一个" onClick={() => selectRelative(1)}>
            <ArrowRight aria-hidden="true" size={18} />
          </button>
        </section>
      ) : null}
    </main>
  );
}
