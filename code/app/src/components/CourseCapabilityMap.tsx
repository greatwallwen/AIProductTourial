"use client";

import {
  ArrowUpRight,
  Check,
  CircleDot,
  GalleryHorizontalEnd,
  Landmark,
  Lightbulb,
  RotateCcw,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CAPABILITY_STORAGE_KEY, COURSE_CAPABILITIES, type CapabilityId } from "../lib/course-capabilities";
import { SpotlightCard } from "./react-bits/SpotlightCard";
import styles from "./CourseCapabilityMap.module.css";

type CourseCapabilityMapProps = {
  onOpenCases: () => void;
};

function readStoredCapabilities(): CapabilityId[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(CAPABILITY_STORAGE_KEY) ?? "[]") as unknown;
    if (!Array.isArray(value)) return [];
    const allowed = new Set(COURSE_CAPABILITIES.map((item) => item.id));
    return value.filter((item): item is CapabilityId => typeof item === "string" && allowed.has(item as CapabilityId));
  } catch {
    return [];
  }
}

export function CourseCapabilityMap({ onOpenCases }: CourseCapabilityMapProps) {
  const [selectedId, setSelectedId] = useState<CapabilityId>(COURSE_CAPABILITIES[0].id);
  const [litIds, setLitIds] = useState<CapabilityId[]>([]);
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    setLitIds(readStoredCapabilities());
    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    window.localStorage.setItem(CAPABILITY_STORAGE_KEY, JSON.stringify(litIds));
  }, [litIds, storageReady]);

  const selected = COURSE_CAPABILITIES.find((item) => item.id === selectedId) ?? COURSE_CAPABILITIES[0];
  const litSet = useMemo(() => new Set(litIds), [litIds]);
  const selectedIsLit = litSet.has(selected.id);

  const toggleSelected = () => {
    setLitIds((current) =>
      current.includes(selected.id) ? current.filter((id) => id !== selected.id) : [...current, selected.id],
    );
  };

  const reset = () => setLitIds([]);

  return (
    <main className={styles.shell}>
      <header className={styles.masthead}>
        <div className={styles.brand}>
          <Landmark aria-hidden="true" size={18} />
          <span>AI PRODUCT ENGINEERING</span>
        </div>
        <nav className={styles.mastActions} aria-label="课程入口">
          <button type="button" onClick={reset} disabled={litIds.length === 0}>
            <RotateCcw aria-hidden="true" size={15} />重置点亮
          </button>
          <button type="button" onClick={onOpenCases}>
            <GalleryHorizontalEnd aria-hidden="true" size={16} />案例驾驶舱
            <ArrowUpRight aria-hidden="true" size={15} />
          </button>
        </nav>
      </header>

      <section className={styles.workspace} aria-label="课程能力地图">
        <div className={styles.mapPanel}>
          <header className={styles.mapHeader}>
            <p>COURSE CAPABILITY MAP</p>
            <h1>从一句好 Prompt，到一套能交付的智能系统</h1>
            <span>点击节点查看本层要解决的问题；授课完成后由讲师手动点亮。地图记录课堂推进，不代表学员认证。</span>
          </header>

          <div className={styles.progress} aria-live="polite">
            <strong>{litIds.length} / {COURSE_CAPABILITIES.length}</strong>
            <span>本机授课进度</span>
            <div className={styles.progressBar} aria-hidden="true"><i style={{ width: `${(litIds.length / COURSE_CAPABILITIES.length) * 100}%` }} /></div>
          </div>

          <svg className={styles.connections} viewBox="0 0 1000 560" aria-hidden="true" preserveAspectRatio="none">
            <defs>
              <linearGradient id="capability-path-gradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#20bad8" />
                <stop offset=".5" stopColor="#3b7cf0" />
                <stop offset="1" stopColor="#7b5ae1" />
              </linearGradient>
            </defs>
            {COURSE_CAPABILITIES.slice(0, -1).map((node, index) => {
              const next = COURSE_CAPABILITIES[index + 1];
              const path = `M ${node.position.x * 10} ${node.position.y * 5.6} C ${(node.position.x + 7) * 10} ${node.position.y * 5.6}, ${(next.position.x - 7) * 10} ${next.position.y * 5.6}, ${next.position.x * 10} ${next.position.y * 5.6}`;
              const isLit = litSet.has(node.id) && litSet.has(next.id);
              return <path key={`${node.id}-${next.id}`} d={path} className={isLit ? styles.connectionLit : styles.connectionBase} />;
            })}
          </svg>

          {COURSE_CAPABILITIES.map((node) => (
            <button
              type="button"
              key={node.id}
              className={styles.node}
              style={{ left: `${node.position.x}%`, top: `${node.position.y}%` }}
              data-tone={node.tone}
              data-lit={litSet.has(node.id)}
              data-selected={selected.id === node.id}
              aria-label={`${node.order}. ${node.title}${litSet.has(node.id) ? "，已点亮" : "，未点亮"}`}
              aria-pressed={selected.id === node.id}
              onClick={() => setSelectedId(node.id)}
            >
              <span className={styles.plate} aria-hidden="true" />
              <span className={styles.nodeLabel}><b>{node.order}</b><strong>{node.title}</strong></span>
            </button>
          ))}

          <div className={styles.legend} aria-label="地图图例">
            <span><i />已点亮</span><span><i />待讲授</span>
          </div>
        </div>

        <SpotlightCard className={styles.detail} color="rgb(43 141 236 / 18%)">
          <div className={styles.detailTop}><span>{selected.eyebrow}</span><b>{String(selected.order).padStart(2, "0")}</b></div>
          <div className={styles.detailBody}>
            <h2>{selected.title}</h2>
            <p className={styles.question}>{selected.question}</p>
            <p className={styles.outcome}>{selected.outcome}</p>
            <ul className={styles.points}>
              {selected.points.map((point) => <li key={point}><Check aria-hidden="true" size={16} />{point}</li>)}
            </ul>
            <p className={styles.resource}><CircleDot aria-hidden="true" size={14} />{selected.resources}</p>
          </div>
          <div className={styles.detailActions}>
            <button type="button" onClick={toggleSelected}>
              <Lightbulb aria-hidden="true" size={17} />{selectedIsLit ? "取消点亮" : "点亮当前层"}
            </button>
            {selected.id === "business-cases" ? (
              <button type="button" onClick={onOpenCases}>进入 24 个综合案例 <ArrowUpRight aria-hidden="true" size={16} /></button>
            ) : null}
            <small>只保存在当前浏览器，可随时重置。</small>
          </div>
        </SpotlightCard>
      </section>
    </main>
  );
}
