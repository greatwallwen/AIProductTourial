import { describe, expect, it } from "vitest";
import { createAssistProvider } from "../src/provider";

describe("dual-mode model provider", () => {
  it("returns a deterministic offline receipt without a key", async () => {
    const provider = createAssistProvider({ apiKey: "" });
    const first = await provider.assist({
      caseId: "B001",
      objectId: "01-489434",
      question: "还缺什么证据？",
      facts: { cancellation: true, amountCny: 81768.96 },
      mode: "offline",
    });
    const second = await provider.assist({
      caseId: "B001",
      objectId: "01-489434",
      question: "还缺什么证据？",
      facts: { cancellation: true, amountCny: 81768.96 },
      mode: "offline",
    });
    expect(first.mode).toBe("offline");
    expect(first.outputHash).toBe(second.outputHash);
    expect(first.verifiedLive).toBe(false);
  });

  it("refuses live mode when the environment key is absent", async () => {
    const provider = createAssistProvider({ apiKey: "" });
    await expect(
      provider.assist({
        caseId: "B005",
        objectId: "B005-T001",
        question: "整理交接冲突",
        facts: { state: "待会签" },
        mode: "live",
      }),
    ).rejects.toThrow("missing_api_key");
  });

  it("never exposes the key in a live receipt", async () => {
    const secret = "unit-test-secret";
    const provider = createAssistProvider({
      apiKey: secret,
      client: {
        complete: async () => ({
          id: "req-test",
          model: "qwen-plus",
          content: "{\"summary\":\"需补证\",\"nextSteps\":[\"核对原始记录\"]}",
          inputTokens: 21,
          outputTokens: 15,
        }),
      },
    });
    const receipt = await provider.assist({
      caseId: "B009",
      objectId: "09-1",
      question: "生成检查建议",
      facts: { pressure: "high" },
      mode: "live",
    });
    expect(JSON.stringify(receipt)).not.toContain(secret);
    expect(receipt.verifiedLive).toBe(true);
    expect(receipt.requestId).toBe("req-test");
  });
});
