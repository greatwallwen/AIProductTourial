import { describe, expect, it } from "vitest";
import { loadDatasetProjection } from "../../cases/load-dataset";
import { getCaseDefinition } from "../../cases/registry";

describe("case 01 scene rows", () => {
  const definition = getCaseDefinition("01")!;

  it("keeps the featured cancellation and its real evidence neighbourhood", () => {
    const projection = loadDatasetProjection(definition);
    const sceneRows = projection.sceneRows as Array<Record<string, string>>;

    expect(sceneRows.length).toBeLessThanOrEqual(96);
    expect(projection.rows).toContainEqual(expect.objectContaining({
      objectId: "01-C496116-M",
    }));
    expect(sceneRows[0]).toMatchObject({
      invoice_id: "C496116",
      stock_code: "M",
      customer_id: "C17949",
      is_cancellation_proxy: "True",
    });
    expect(sceneRows).toContainEqual(expect.objectContaining({
      invoice_id: "C496114",
      stock_code: "M",
      is_cancellation_proxy: "True",
    }));
    expect(sceneRows).toContainEqual(expect.objectContaining({
      customer_id: "C17949",
      is_cancellation_proxy: "False",
    }));
    expect(sceneRows.some((row) =>
      row.stock_code === "M" &&
      row.is_cancellation_proxy === "False" &&
      Number(row.quantity) > 0,
    )).toBe(true);

    const queueInvoices = projection.rows
      .filter((row) => row.is_cancellation_proxy === "True")
      .map((row) => String(row.invoice_id));
    expect(queueInvoices.every((invoiceId) => invoiceId.startsWith("C"))).toBe(true);
    expect(new Set(queueInvoices).size).toBeGreaterThanOrEqual(8);
  });

  it("selects the same bounded case 01 slice on every load", () => {
    const first = loadDatasetProjection(definition).sceneRows;
    const second = loadDatasetProjection(definition).sceneRows;

    expect(first).toEqual(second);
    expect(first.length).toBeLessThanOrEqual(96);
  });
});

describe("case 05 transfer aggregates", () => {
  const definition = getCaseDefinition("05")!;

  it("seeds one latest event projection per transport and keeps the featured conflict first", () => {
    const projection = loadDatasetProjection(definition);
    const transports = projection.rows.map((row) => String(row.transport_id));

    expect(projection.rows[0]).toMatchObject({
      objectId: "05-TRN-0001-TRN-0001-06",
      transport_id: "TRN-0001",
      event_version: "6",
      late_event: "True",
    });
    expect(new Set(transports).size).toBe(transports.length);
    expect(projection.sceneRows.filter((row) => row.transport_id === "TRN-0001"))
      .toHaveLength(6);
  });
});

describe("case 07 to 09 product projections", () => {
  it("seeds case 07 as 14 facility-date review windows backed by 56 operations rows", () => {
    const projection = loadDatasetProjection(getCaseDefinition("07")!);

    expect(projection.rows).toHaveLength(14);
    expect(projection.rows[0]).toMatchObject({
      objectId: "07-CN-FC-COURSE-01-2026-07-14",
      facility_code: "CN-FC-COURSE-01",
      scenario_date: "2026-07-14",
      domain_count: "4",
      fulfillment_request_count: "7595",
      fulfillment_p95_latency_ms: "912",
      fulfillment_recovery_minutes: "39",
    });
    expect(projection.supportingArtifacts["operational-evidence.csv"]).toHaveLength(56);
  });

  it("seeds case 09 as one gap investigation and exposes the gap plus recovery window", () => {
    const projection = loadDatasetProjection(getCaseDefinition("09")!);
    const timestamps = projection.sceneRows.map((row) => String(row.timestamp));

    expect(projection.rows).toHaveLength(1);
    expect(projection.rows[0]).toMatchObject({
      objectId: "09-METROPT-20200418-GAP-01",
      investigation_id: "METROPT-20200418-GAP-01",
      gap_start: "2020-04-18 00:18:07",
      gap_end: "2020-04-18 00:23:59",
      gap_seconds: "352",
      tp2_before: "-0.018",
      tp2_after: "8.384",
      oil_temperature_before: "49.45",
      oil_temperature_after: "68.525",
      motor_current_before: "0.04",
      motor_current_after: "5.675",
    });
    expect(timestamps).toContain("2020-04-18 00:18:07");
    expect(timestamps).toContain("2020-04-18 00:23:59");
    expect(timestamps.some((item) => item >= "2020-04-18 00:24:00" && item <= "2020-04-18 00:28:59")).toBe(true);
  });
});
