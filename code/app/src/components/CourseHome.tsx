"use client";

import { useState } from "react";
import type { CatalogCase } from "../lib/catalog-adapter";
import { CaseCatalog } from "./CaseCatalog";
import { CourseCapabilityMap } from "./CourseCapabilityMap";

export function CourseHome({ cases }: { cases: CatalogCase[] }) {
  const [screen, setScreen] = useState<"map" | "cases">("map");

  if (screen === "cases") {
    return <CaseCatalog cases={cases} onBackToMap={() => setScreen("map")} />;
  }

  return <CourseCapabilityMap onOpenCases={() => setScreen("cases")} />;
}
