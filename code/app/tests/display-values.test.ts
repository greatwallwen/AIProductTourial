import { describe, expect, it } from "vitest";
import {
  formatBusinessValue,
  formatBusinessRole,
} from "../src/components/families/SharedPanels";

describe("business display values", () => {
  it("localizes workflow enums and booleans", () => {
    expect(formatBusinessValue("conflict_type", "late_event")).toBe("迟到事件");
    expect(formatBusinessValue("event_type", "correction_appended")).toBe("追加更正");
    expect(formatBusinessValue("known_failure_window", "True")).toBe("是");
    expect(formatBusinessValue("quality_label", "fail")).toBe("未通过");
    expect(formatBusinessValue("symptom_category", "brake")).toBe("制动");
    expect(formatBusinessValue("income_evidence_status", "missing")).toBe("缺失");
    expect(formatBusinessValue("identity_verification_status", "verified")).toBe("已核验");
    expect(formatBusinessValue("consent_status", "not_confirmed")).toBe("未确认");
    expect(formatBusinessRole("dispatcher")).toBe("服务调度");
  });

  it("renders ratio and money fields with Chinese business formats", () => {
    expect(formatBusinessValue("underperformance_share", "0.125")).toBe("12.5%");
    expect(formatBusinessValue("line_amount_cny", "-18186.26")).toContain("18,186.26");
    expect(formatBusinessValue("line_amount_cny", "-18186.26")).toMatch(/[¥￥]/);
  });
});
