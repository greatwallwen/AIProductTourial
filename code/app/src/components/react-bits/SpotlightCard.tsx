"use client";

// Adapted for this application from React Bits SpotlightCard at commit
// b9158acb37e7bdfd6c5bc5894da1826fe1d05a6b.
// Copyright (c) 2026 David Haz. MIT + Commons Clause; see assets/vendor/react-bits/LICENSE.md.
import type { MouseEventHandler, PropsWithChildren } from "react";
import { useRef } from "react";
import styles from "./SpotlightCard.module.css";

type SpotlightCardProps = PropsWithChildren<{
  className?: string;
  color?: string;
}>;

export function SpotlightCard({ children, className = "", color = "rgb(57 189 248 / 16%)" }: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  const trackPointer: MouseEventHandler<HTMLDivElement> = (event) => {
    const element = ref.current;
    if (!element) return;
    const bounds = element.getBoundingClientRect();
    element.style.setProperty("--spotlight-x", `${event.clientX - bounds.left}px`);
    element.style.setProperty("--spotlight-y", `${event.clientY - bounds.top}px`);
    element.style.setProperty("--spotlight-color", color);
  };

  return (
    <div ref={ref} className={`${styles.root} ${className}`} onMouseMove={trackPointer}>
      <div className={styles.content}>{children}</div>
    </div>
  );
}
