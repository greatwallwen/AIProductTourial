import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CASES } from "@cases/registry";
import { CaseCatalog } from "@/components/CaseCatalog";
import { buildCatalogCases, type CourseManifest } from "@/lib/catalog-adapter";

function loadCourseManifest(): CourseManifest {
  const path = resolve(process.cwd(), "../../course-manifest.json");
  return JSON.parse(readFileSync(path, "utf8")) as CourseManifest;
}

export default function HomePage() {
  return <CaseCatalog cases={buildCatalogCases(CASES, loadCourseManifest())} />;
}
