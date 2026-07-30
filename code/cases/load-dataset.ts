import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "csv-parse/sync";
import { computeCaseMetrics, decideCaseRow } from "./case-rules";
import type { CaseDecision, CaseDefinition, CaseMetric } from "./contracts";
import { resolveFeaturedObject } from "./featured-object";

export type DatasetProjection = {
  sourcePath: string;
  sha256: string;
  rowCount: number;
  metrics: CaseMetric[];
  sceneRows: Record<string, unknown>[];
  supportingArtifacts: Record<string, Record<string, unknown>[]>;
  rows: Array<
    Record<string, unknown> & {
      objectId: string;
      decision: CaseDecision;
    }
  >;
};

type DatasetManifest = {
  datasets?: Array<{
    case_id?: string;
    primary_file?: string;
  }>;
};

type DatasetSchema = {
  supplemental_artifacts?: Array<{ path?: string }>;
};

function primaryFileFor(definition: CaseDefinition): string {
  const manifestPath = resolve(process.cwd(), "../../dataset", "manifest.json");
  const manifest = JSON.parse(
    readFileSync(manifestPath, "utf8"),
  ) as DatasetManifest;
  return (
    manifest.datasets?.find((item) => item.case_id === definition.id)
      ?.primary_file ?? "case.csv"
  );
}

function objectIdFor(
  definition: CaseDefinition,
  row: Record<string, string>,
  index: number,
): string {
  const identity = definition.identityFields
    .map((field) => row[field])
    .filter((value) => value && value.trim())
    .join("-");
  const normalized = (identity || `${definition.id}-${index + 1}`)
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .slice(0, 70);
  return `${definition.id}-${normalized || index + 1}`;
}

function architectureWindowRows(
  rows: Record<string, string>[],
  supportingArtifacts: Record<string, Record<string, unknown>[]>,
): Record<string, string>[] {
  const operational = supportingArtifacts["operational-evidence.csv"] ?? [];
  const grouped = new Map<string, Record<string, unknown>[]>();
  for (const row of operational) {
    const facilityCode = String(row.facility_code ?? "");
    const scenarioDate = String(row.scenario_date ?? "");
    const key = `${facilityCode}:${scenarioDate}`;
    if (!facilityCode || !scenarioDate) continue;
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }
  return [...grouped.values()]
    .map((windowRows) => {
      const first = windowRows[0];
      const fulfillment = windowRows.find((row) => row.domain === "履约") ?? {};
      const delivery = windowRows.find((row) => row.domain === "配送交接") ?? {};
      return {
        facility_code: String(first.facility_code ?? ""),
        facility_label: String(first.facility_label ?? ""),
        scenario_date: String(first.scenario_date ?? ""),
        domain_count: String(windowRows.length),
        fulfillment_request_count: String(fulfillment.request_count ?? ""),
        fulfillment_p95_latency_ms: String(fulfillment.p95_latency_ms ?? ""),
        fulfillment_release_count: String(fulfillment.release_count ?? ""),
        fulfillment_incident_minutes: String(fulfillment.incident_minutes ?? ""),
        fulfillment_recovery_minutes: String(fulfillment.recovery_minutes ?? ""),
        delivery_request_count: String(delivery.request_count ?? ""),
        public_order_rows: String(rows.length),
        data_nature: "deterministic-synthetic-cn-operations",
      };
    })
    .sort((left, right) => right.scenario_date.localeCompare(left.scenario_date));
}

function metroInvestigationRows(rows: Record<string, string>[]): Record<string, string>[] {
  const before = rows.find((row) => row.timestamp === "2020-04-18 00:18:07");
  const after = rows.find((row) => row.timestamp === "2020-04-18 00:23:59");
  if (!before || !after) {
    throw new Error("metro_gap_boundary_missing");
  }
  const seconds = Math.round(
    (Date.parse(after.timestamp.replace(" ", "T") + "Z") -
      Date.parse(before.timestamp.replace(" ", "T") + "Z")) /
      1_000,
  );
  const normalized = (value: string | undefined) =>
    String(Math.round(Number(value) * 1_000_000) / 1_000_000);
  return [{
    investigation_id: "METROPT-20200418-GAP-01",
    source_id: String(before.source_id ?? "DATA-09"),
    gap_start: before.timestamp,
    gap_end: after.timestamp,
    gap_seconds: String(seconds),
    tp2_before: normalized(before.TP2),
    tp2_after: normalized(after.TP2),
    oil_temperature_before: normalized(before.Oil_temperature),
    oil_temperature_after: normalized(after.Oil_temperature),
    motor_current_before: normalized(before.Motor_current),
    motor_current_after: normalized(after.Motor_current),
    maintenance_action_allowed: "False",
    data_nature: "public-derived-contiguous-slice",
  }];
}

function modelAdmissionRows(rows: Record<string, string>[]): Record<string, string>[] {
  const candidates = new Map<string, Record<string, string>[]>();
  for (const row of rows) {
    const key = `${row.candidate_id ?? ""}:${row.policy_version ?? ""}`;
    candidates.set(key, [...(candidates.get(key) ?? []), row]);
  }
  return [...candidates.values()].map((checks) => (
    checks.find((row) => row.result !== "pass" || row.evidence_status !== "complete") ?? checks[0]
  ));
}

function coldChainInvestigationRows(rows: Record<string, string>[]): Record<string, string>[] {
  const investigations = new Map<string, Record<string, string>[]>();
  for (const row of rows) {
    const key = `${row.investigation_id ?? ""}:${row.route_id ?? ""}`;
    investigations.set(key, [...(investigations.get(key) ?? []), row]);
  }
  return [...investigations.values()].map((records) => (
    records.reduce((peak, row) => Number(row.temperature_c) > Number(peak.temperature_c) ? row : peak)
  ));
}

function flotationEventRows(
  rows: Record<string, string>[],
  supportingArtifacts: Record<string, Record<string, unknown>[]>,
): Record<string, string>[] {
  const hourlyByTimestamp = new Map(rows.map((row) => [row.monitor_hour, row]));
  return (supportingArtifacts["events.csv"] ?? []).flatMap((event) => {
    const endHour = String(event.end_hour ?? "");
    const hourly = hourlyByTimestamp.get(endHour);
    if (!hourly) return [];
    const eventFields = Object.fromEntries(
      Object.entries(event).map(([key, value]) => [key, String(value ?? "")]),
    );
    const priorityCellIds = [...String(event.dominant_deviation ?? "").matchAll(/(\d+)号浮选柱风量/gu)]
      .map((match) => match[1])
      .filter((value): value is string => Boolean(value));
    return [{
      ...hourly,
      ...eventFields,
      monitor_hour: endHour,
      priority_cell_ids: [...new Set(priorityCellIds)].join("|"),
    }];
  });
}

function boilerEventRows(
  rows: Record<string, string>[],
  supportingArtifacts: Record<string, Record<string, unknown>[]>,
): Record<string, string>[] {
  const minuteByTimestamp = new Map(rows.map((row) => [row.monitor_minute, row]));
  return (supportingArtifacts["events.csv"] ?? []).flatMap((event) => {
    const endMinute = String(event.end_time ?? "").slice(0, 16);
    const minute = minuteByTimestamp.get(endMinute);
    if (!minute) return [];
    return [{
      ...minute,
      ...Object.fromEntries(Object.entries(event).map(([key, value]) => [key, String(value ?? "")])),
      monitor_minute: endMinute,
      window_start_minute: String(event.start_time ?? "").slice(0, 16),
      window_end_minute: endMinute,
    }];
  });
}

function projectionRowsFor(
  definition: CaseDefinition,
  rows: Record<string, string>[],
  supportingArtifacts: Record<string, Record<string, unknown>[]>,
): Record<string, string>[] {
  if (definition.id === "B007") return architectureWindowRows(rows, supportingArtifacts);
  if (definition.id === "B009") return metroInvestigationRows(rows);
  if (definition.id === "B011") return modelAdmissionRows(rows);
  if (definition.id === "B012") return coldChainInvestigationRows(rows);
  if (definition.id === "B014") return flotationEventRows(rows, supportingArtifacts);
  if (definition.id === "B018") return boilerEventRows(rows, supportingArtifacts);
  return rows;
}

function representativeRows(
  definition: CaseDefinition,
  rows: Record<string, string>[],
  limit: number,
): DatasetProjection["rows"] {
  const projected: DatasetProjection["rows"] = rows.map((row, index) => ({
    ...row,
    objectId: objectIdFor(definition, row, index),
    decision: decideCaseRow(row, definition.rules),
  }));
  if (projected.length <= limit) return projected;

  if (definition.id === "B005") {
    const latestByTransport = new Map<string, DatasetProjection["rows"][number]>();
    for (const row of projected) {
      const transportId = String(row.transport_id ?? "");
      const current = latestByTransport.get(transportId);
      if (!current || Number(row.event_version) > Number(current.event_version)) {
        latestByTransport.set(transportId, row);
      }
    }
    const featured = resolveFeaturedObject(projected, definition.featuredObjectId);
    return [
      ...(featured ? [featured] : []),
      ...[...latestByTransport.values()].filter(
        (row) => row.objectId !== featured?.objectId,
      ),
    ].slice(0, limit);
  }

  if (definition.id === "B006") {
    const featured = resolveFeaturedObject(projected, definition.featuredObjectId);
    const featuredDate = String(featured?.observed_at ?? "").slice(0, 10);
    const sameDate = projected.filter((row) => String(row.observed_at ?? "").startsWith(featuredDate));
    const selected = [
      ...(featured ? [featured] : []),
      ...sameDate.filter((row) => row.objectId !== featured?.objectId),
    ];
    const selectedIds = new Set(selected.map((row) => row.objectId));
    const representedStations = new Set(selected.map((row) => String(row.station ?? "")));
    for (const row of projected) {
      if (selected.length >= limit) break;
      if (Number(row.missing_pollutant_count ?? 0) > 0 && !representedStations.has(String(row.station ?? ""))) {
        selected.push(row);
        selectedIds.add(row.objectId);
        representedStations.add(String(row.station ?? ""));
      }
    }
    for (const row of projected) {
      if (selected.length >= limit) break;
      if (!selectedIds.has(row.objectId)) selected.push(row);
    }
    return selected.slice(0, limit);
  }

  if (definition.id === "B012") {
    const peakByInvestigation = new Map<string, DatasetProjection["rows"][number]>();
    for (const row of projected) {
      const investigationId = String(row.investigation_id ?? "");
      const current = peakByInvestigation.get(investigationId);
      if (!current || Number(row.temperature_c) > Number(current.temperature_c)) {
        peakByInvestigation.set(investigationId, row);
      }
    }
    const featured = resolveFeaturedObject(projected, definition.featuredObjectId);
    return [
      ...(featured ? [featured] : []),
      ...[...peakByInvestigation.values()].filter((row) => row.objectId !== featured?.objectId),
    ].slice(0, limit);
  }

  const selected: DatasetProjection["rows"] = [];
  const selectedIds = new Set<string>();
  const featured = resolveFeaturedObject(projected, definition.featuredObjectId);
  if (featured && definition.featuredObjectId) {
    selected.push(featured);
    selectedIds.add(featured.objectId);
  }
  if (definition.id === "B001") {
    const selectedInvoices = new Set(
      selected.map((item) => String(item.invoice_id ?? "")),
    );
    for (const row of projected) {
      if (selected.length >= Math.min(limit, 16)) break;
      const invoiceId = String(row.invoice_id ?? "");
      if (
        row.is_cancellation_proxy === "True" &&
        invoiceId.startsWith("C") &&
        !selectedIds.has(row.objectId) &&
        !selectedInvoices.has(invoiceId)
      ) {
        selected.push(row);
        selectedIds.add(row.objectId);
        selectedInvoices.add(invoiceId);
      }
    }
  }
  for (const row of projected) {
    if (!selected.some((item) => item.decision.label === row.decision.label)) {
      selected.push(row);
      selectedIds.add(row.objectId);
    }
  }
  for (const row of projected) {
    if (selected.length >= limit) break;
    if (!selectedIds.has(row.objectId)) {
      selected.push(row);
      selectedIds.add(row.objectId);
    }
  }
  return selected.slice(0, limit);
}

function readArtifactRows(path: string): Record<string, unknown>[] {
  const bytes = readFileSync(path);
  if (path.endsWith(".csv")) {
    return parse(bytes, {
      columns: true,
      bom: true,
      skip_empty_lines: true,
      relax_column_count: true,
    }) as Record<string, unknown>[];
  }
  if (path.endsWith(".jsonl")) {
    return bytes
      .toString("utf8")
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
  }
  return [];
}

function supportingArtifactsFor(
  definition: CaseDefinition,
  datasetRoot: string,
): Record<string, Record<string, unknown>[]> {
  const schemaPath = resolve(datasetRoot, "schema.json");
  const schema = JSON.parse(readFileSync(schemaPath, "utf8")) as DatasetSchema;
  const names = new Set(
    (schema.supplemental_artifacts ?? [])
      .map((item) => item.path)
      .filter((name): name is string => Boolean(name)),
  );
  if (definition.id === "B009") names.add("knowledge.jsonl");
  const result: Record<string, Record<string, unknown>[]> = {};
  for (const name of names) {
    const artifactPath = resolve(datasetRoot, name);
    if (!artifactPath.startsWith(`${datasetRoot}\\`) || !existsSync(artifactPath)) continue;
    const artifactRows = readArtifactRows(artifactPath);
    result[name] = definition.id === "B017" && name === "waveform.csv"
      ? artifactRows.slice(0, 2500)
      : artifactRows.slice(0, 200);
  }
  return result;
}

function sceneRowsFor(
  definition: CaseDefinition,
  rows: Record<string, string>[],
  supportingArtifacts: Record<string, Record<string, unknown>[]>,
): Record<string, unknown>[] {
  if (definition.id === "B002") {
    // The trial builder displays an exact, filterable cohort distribution.
    // 5,000 compact rows remain small enough for the local teaching runtime,
    // and avoid presenting a 96-row preview as if it represented the dataset.
    return rows;
  }
  if (definition.id === "B001") {
    const featuredIndex = rows.findIndex(
      (row, index) => objectIdFor(definition, row, index) === definition.featuredObjectId,
    );
    if (featuredIndex < 0) return rows.slice(0, 96);

    const featured = rows[featuredIndex];
    const featuredAt = Date.parse(featured.invoice_at);
    const seen = new Set<Record<string, string>>();
    const selected: Record<string, string>[] = [];
    const add = (candidates: Record<string, string>[]) => {
      for (const row of candidates) {
        if (selected.length >= 96) break;
        if (!seen.has(row)) {
          selected.push(row);
          seen.add(row);
        }
      }
    };
    const addAtMost = (candidates: Record<string, string>[], count: number) => {
      add(candidates.slice(0, count));
    };
    const byDistanceFromFeatured = (left: Record<string, string>, right: Record<string, string>) => {
      const leftDistance = Math.abs(Date.parse(left.invoice_at) - featuredAt);
      const rightDistance = Math.abs(Date.parse(right.invoice_at) - featuredAt);
      if (leftDistance !== rightDistance) return leftDistance - rightDistance;
      return rows.indexOf(left) - rows.indexOf(right);
    };
    const sameCustomer = rows
      .filter((row) => row !== featured && row.customer_id === featured.customer_id)
      .sort(byDistanceFromFeatured);
    const positiveOriginalCandidates = rows
      .filter(
        (row) =>
          row.stock_code === featured.stock_code &&
          row.is_cancellation_proxy !== "True" &&
          Number(row.quantity) > 0,
      )
      .sort(byDistanceFromFeatured);
    const nearbyCancellations = rows
      .filter((row) => row !== featured && row.is_cancellation_proxy === "True")
      .sort(byDistanceFromFeatured);
    const sameProduct = rows
      .filter((row) => row !== featured && row.stock_code === featured.stock_code)
      .sort(byDistanceFromFeatured);

    add([featured]);
    // Keep the work queue useful as well as the featured investigation useful:
    // a nearby cancellation cohort fills the left rail, while same-customer
    // positives provide honest original-order candidates for the centre pane.
    addAtMost(nearbyCancellations, 31);
    addAtMost(sameCustomer, 48);
    addAtMost(positiveOriginalCandidates, 8);
    add(sameProduct);
    add(rows);
    return selected;
  }
  if (definition.id === "B011" || definition.id === "B013") {
    return rows;
  }
  if (definition.id === "B012") return rows;
  if (definition.id === "B014") {
    const featuredEventId = definition.featuredObjectId?.replace(/^B014-/u, "");
    const featuredEvent = (supportingArtifacts["events.csv"] ?? [])
      .find((event) => event.event_id === featuredEventId);
    const featuredEnd = String(featuredEvent?.end_hour ?? "");
    const featuredIndex = rows.findIndex((row) => row.monitor_hour === featuredEnd);
    if (featuredIndex < 71) return [];
    // FQ-0016 is shown against the 72 real, consecutive observations ending
    // at the event boundary. Recovery time remains an event fact, not a 73rd
    // point silently folded into a view labelled "72 hours".
    return rows.slice(featuredIndex - 71, featuredIndex + 1);
  }
  if (definition.id === "B015") {
    const featured = rows.find(
      (row, index) => objectIdFor(definition, row, index) === definition.featuredObjectId,
    );
    return featured
      ? [featured, ...rows.filter((row) => row !== featured).slice(0, 23)]
      : rows.slice(0, 24);
  }
  if (definition.id === "B016") {
    // The fleet selector exposes all 134 turbines. Keep the compact seven-day
    // aggregates for every turbine so a lazily loaded object never degrades to
    // a single-row pseudo investigation.
    return rows;
  }
  if (definition.id === "B017") {
    return rows;
  }
  if (definition.id === "B018") {
    const featuredEventId = definition.featuredObjectId?.replace(/^B018-/u, "");
    const featuredEvent = (supportingArtifacts["events.csv"] ?? [])
      .find((event) => event.event_id === featuredEventId);
    const startMinute = String(featuredEvent?.start_time ?? "").slice(0, 16);
    const endMinute = String(featuredEvent?.end_time ?? "").slice(0, 16);
    if (!startMinute || !endMinute) return [];
    return rows.filter((row) => row.monitor_minute >= startMinute && row.monitor_minute <= endMinute);
  }
  if (definition.id === "B019") {
    const featuredIndex = rows.findIndex(
      (row, index) => objectIdFor(definition, row, index) === definition.featuredObjectId,
    );
    if (featuredIndex < 0) return rows.slice(0, 49);
    return rows.slice(Math.max(0, featuredIndex - 24), featuredIndex + 25);
  }
  if (definition.id === "B020") {
    // All 5,327 compact station-day aggregates are under 1 MB on disk. The
    // station and date selectors expose the full matrix, so retain it rather
    // than showing a misleading featured-station-only trend after navigation.
    return rows;
  }
  if (definition.id === "B006") {
    const featured = rows.find(
      (row, index) => objectIdFor(definition, row, index) === definition.featuredObjectId,
    );
    if (!featured) return rows.slice(0, 48);
    const featuredIndex = rows.indexOf(featured);
    const nearby = rows.slice(Math.max(0, featuredIndex - 24), featuredIndex + 25);
    const featuredDate = String(featured.observed_at ?? "").slice(0, 10);
    const sameDate = rows.filter((row) => String(row.observed_at ?? "").startsWith(featuredDate));
    return [...sameDate, ...nearby].filter(
      (row, index, all) => all.findIndex((item) => item.No === row.No && item.station === row.station) === index,
    );
  }
  if (definition.id === "B008") {
    return rows;
  }
  if (definition.id === "B009") {
    return rows.filter((row) => (
      row.timestamp >= "2020-04-17 23:57:30" && row.timestamp <= "2020-04-18 00:02:30"
    ) || (
      row.timestamp >= "2020-04-18 00:16:00" && row.timestamp <= "2020-04-18 00:28:59"
    ));
  }
  return rows.slice(0, 96);
}

export function loadDatasetProjection(
  definition: CaseDefinition,
  limit = 24,
): DatasetProjection {
  const datasetRoot = resolve(process.cwd(), "../../dataset", definition.datasetFolder);
  const sourcePath = resolve(datasetRoot, primaryFileFor(definition));
  const bytes = readFileSync(sourcePath);
  const rows = parse(bytes, {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as Record<string, string>[];
  const supportingArtifacts = supportingArtifactsFor(definition, datasetRoot);
  const projectionRows = projectionRowsFor(definition, rows, supportingArtifacts);
  const metricRows = definition.id === "B007" || definition.id === "B009"
    ? projectionRows
    : rows;
  return {
    sourcePath,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    rowCount: rows.length,
    metrics: computeCaseMetrics(metricRows, definition.rules),
    sceneRows: sceneRowsFor(definition, rows, supportingArtifacts),
    supportingArtifacts,
    rows: representativeRows(definition, projectionRows, limit),
  };
}
