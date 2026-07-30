import { describe, expect, it } from "vitest";
import { CASES, getCaseDefinition } from "../../cases/registry";

describe("case registry", () => {
  it("contains 20 unique cases across four product families", () => {
    expect(CASES).toHaveLength(20);
    expect(new Set(CASES.map((item) => item.id)).size).toBe(20);
    expect(new Set(CASES.map((item) => item.family))).toEqual(
      new Set(["commerce", "approval", "investigation", "industrial"]),
    );
    expect(CASES.filter((item) => item.tier === "flagship")).toHaveLength(6);
  });

  it("resolves routes by id and slug", () => {
    expect(getCaseDefinition("01")?.slug).toBe("retail-return-evidence");
    expect(getCaseDefinition("B01")?.slug).toBe("retail-return-evidence");
    expect(getCaseDefinition("b20")?.id).toBe("20");
    expect(getCaseDefinition("15-wafer-quality-review")?.id).toBe("15");
  });

  it("reserves supervisor steps exclusively for the supervisor role", () => {
    for (const definition of CASES) {
      for (const command of Object.values(definition.workflow.commands)) {
        if (command.roles.includes("supervisor")) {
          expect(command.roles).toEqual(["supervisor"]);
        }
      }
    }
  });

  it("keeps the refund and China application contracts within their evidence", () => {
    const returns = getCaseDefinition("01")!;
    expect(returns.workflow.commands).not.toHaveProperty("approve_refund");
    expect(returns.workflow.commands.submit_manual_review).toMatchObject({
      from: ["待补证"],
      to: "人工复核待处理",
    });

    const applications = getCaseDefinition("04")!;
    expect(applications.identityFields).toEqual(["application_id"]);
    expect(applications.displayFields.map((field) => field.key)).toEqual([
      "application_id",
      "city_name",
      "income_evidence_status",
      "state",
    ]);
    expect(applications.title).toContain("CR20260000001");
  });

  it("describes case 13 using only implemented safety-review branches", () => {
    const definition = getCaseDefinition("13")!;
    expect(definition.title).not.toContain("常规预约");
    expect(Object.keys(definition.workflow.commands)).toEqual([
      "submit_triage",
      "dispatch_rescue",
      "request_details",
    ]);
  });

  it("uses window, field-return and investigation contracts for cases 07 to 09", () => {
    const architecture = getCaseDefinition("07")!;
    expect(architecture.identityFields).toEqual(["facility_code", "scenario_date"]);
    expect(architecture.featuredObjectId).toBe("07-CN-FC-COURSE-01-2026-07-14");
    expect(Object.keys(architecture.workflow.commands)).toEqual([
      "verify_evidence",
      "keep_modular_monolith",
      "request_observability_evidence",
      "start_event_contract_pilot",
    ]);

    const aquaculture = getCaseDefinition("08")!;
    expect(aquaculture.shortTitle).toBe("水质冲突现场取证单");
    expect(aquaculture.workflow.commands.submit_field_return).toMatchObject({
      from: ["现场取证中"],
      to: "待主管采信",
      roles: ["field_operator"],
    });
    expect(aquaculture.workflow.commands.confirm_event).toMatchObject({
      from: ["待主管采信"],
      to: "现场记录已采信",
      roles: ["supervisor"],
    });

    const compressor = getCaseDefinition("09")!;
    expect(compressor.shortTitle).toBe("空压机遥测断档调查");
    expect(compressor.identityFields).toEqual(["investigation_id"]);
    expect(compressor.featuredObjectId).toBe("09-METROPT-20200418-GAP-01");
    expect(compressor.workflow.commands.run_retrieval.from).toContain("等待设备记录");
  });

  it("uses aggregate identities and evidence-bounded states for cases 10 to 12", () => {
    const telecom = getCaseDefinition("10")!;
    expect(telecom.shortTitle).toBe("通信请求恢复核查");
    expect(telecom.workflow.commands.close_task.to).toBe("课程恢复核查已关闭");
    expect(telecom.workflow.commands.keep_pending).toMatchObject({
      from: ["外部效果待核对"],
      to: "外部效果待核对",
    });

    const model = getCaseDefinition("11")!;
    expect(model.identityFields).toEqual(["candidate_id", "policy_version"]);
    expect(model.featuredObjectId).toBe("11-MODEL-ADMISSION-001-MODEL-GATE-2026-1");

    const coldChain = getCaseDefinition("12")!;
    expect(coldChain.shortTitle).toBe("县域冷链运输记录调查");
    expect(coldChain.identityFields).toEqual(["investigation_id", "route_id"]);
    expect(coldChain.featuredObjectId).toBe("12-CCI-2026-001-CN-SC-PZ-01");
    expect(coldChain.workflow.commands.hold_batch.to).toBe("等待补证");
    expect(coldChain.workflow.commands.quality_cosign.to).toBe("调查已复核");
  });
});
