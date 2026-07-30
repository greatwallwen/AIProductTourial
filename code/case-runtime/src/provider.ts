import OpenAI from "openai";
import { digest } from "./receipt";

const LIVE_CASES = new Set(["01", "05", "09", "10", "11", "15"]);

export type AssistMode = "offline" | "live";

export type AssistRequest = {
  caseId: string;
  objectId: string;
  question: string;
  facts: Record<string, unknown>;
  mode: AssistMode;
};

export type AssistCompletion = {
  id: string;
  model: string;
  content: string;
  inputTokens?: number;
  outputTokens?: number;
};

export type AssistClient = {
  complete: (input: {
    model: string;
    system: string;
    user: string;
  }) => Promise<AssistCompletion>;
};

export type AssistReceipt = {
  requestId: string;
  caseId: string;
  objectId: string;
  mode: AssistMode;
  model: string;
  content: string;
  promptHash: string;
  outputHash: string;
  inputTokens?: number;
  outputTokens?: number;
  elapsedMs: number;
  generatedAt: string;
  verifiedLive: boolean;
};

function defaultClient(apiKey: string, baseURL: string): AssistClient {
  const openai = new OpenAI({ apiKey, baseURL });
  return {
    complete: async ({ model, system, user }) => {
      const completion = await openai.chat.completions.create({
        model,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      });
      return {
        id: completion.id,
        model: completion.model,
        content: completion.choices[0]?.message.content ?? "{}",
        inputTokens: completion.usage?.prompt_tokens,
        outputTokens: completion.usage?.completion_tokens,
      };
    },
  };
}

function offlineContent(request: AssistRequest): string {
  const keys = Object.keys(request.facts).sort().slice(0, 4);
  return JSON.stringify({
    summary: `已整理 ${keys.length} 项已知事实，当前结论仅用于候选研判。`,
    evidenceUsed: keys,
    gaps: ["核对原始记录与当前对象版本", "由有权限角色确认最终动作"],
    nextSteps: ["补齐缺失证据", "提交确定性状态机校验"],
  });
}

export function createAssistProvider({
  apiKey = process.env.DASHSCOPE_API_KEY,
  model = process.env.AI_MODEL || "qwen-plus",
  baseURL = "https://dashscope.aliyuncs.com/compatible-mode/v1",
  client,
}: {
  apiKey?: string;
  model?: string;
  baseURL?: string;
  client?: AssistClient;
} = {}) {
  return {
    async assist(request: AssistRequest): Promise<AssistReceipt> {
      if (!LIVE_CASES.has(request.caseId)) {
        throw new Error("case_live_mode_disabled");
      }
      const promptInput = {
        caseId: request.caseId,
        objectId: request.objectId,
        question: request.question,
        facts: request.facts,
      };
      const promptHash = digest(promptInput);
      const startedAt = performance.now();
      if (request.mode === "offline") {
        const content = offlineContent(request);
        return {
          requestId: `offline-${promptHash.slice(0, 16)}`,
          caseId: request.caseId,
          objectId: request.objectId,
          mode: "offline",
          model: "frozen-course-replay-v1",
          content,
          promptHash,
          outputHash: digest(content),
          elapsedMs: Math.round(performance.now() - startedAt),
          generatedAt: new Date().toISOString(),
          verifiedLive: false,
        };
      }
      if (!apiKey) {
        throw new Error("missing_api_key");
      }
      const liveClient = client ?? defaultClient(apiKey, baseURL);
      const completion = await liveClient.complete({
        model,
        system:
          "你是业务证据整理助手。只使用输入事实，输出 JSON，字段为 summary、evidenceUsed、gaps、nextSteps。不要执行审批、金额计算或状态变更。",
        user: JSON.stringify(promptInput),
      });
      return {
        requestId: completion.id,
        caseId: request.caseId,
        objectId: request.objectId,
        mode: "live",
        model: completion.model,
        content: completion.content,
        promptHash,
        outputHash: digest(completion.content),
        inputTokens: completion.inputTokens,
        outputTokens: completion.outputTokens,
        elapsedMs: Math.round(performance.now() - startedAt),
        generatedAt: new Date().toISOString(),
        verifiedLive: true,
      };
    },
  };
}
