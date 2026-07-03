import type { FastifyPluginAsync } from 'fastify';
import type { ApprovalService } from './service.ts';
import { DECISIONS } from './types.ts';
import type { Decision } from './types.ts';

interface DecisionBody {
  decision: Decision;
  operator: string;
  opinion?: string;
}

export function approvalRoutes(service: ApprovalService): FastifyPluginAsync {
  return async (app) => {
    app.post<{ Params: { contractNo: string } }>('/contracts/:contractNo/submit', {
      schema: {
        tags: ['approval'],
        summary: '提交审批：按金额生成审批链并物化任务（驳回件重提 round+1）',
        params: {
          type: 'object',
          properties: { contractNo: { type: 'string' } },
          required: ['contractNo'],
        },
      },
    }, async (req) => service.submit(req.params.contractNo));

    app.get<{ Params: { contractNo: string } }>('/contracts/:contractNo/approvals', {
      schema: {
        tags: ['approval'],
        summary: '审批链全貌（含历史轮次）',
        params: {
          type: 'object',
          properties: { contractNo: { type: 'string' } },
          required: ['contractNo'],
        },
      },
    }, async (req) => service.listChain(req.params.contractNo));

    app.post<{ Params: { taskId: number }; Body: DecisionBody }>('/approvals/:taskId/decision', {
      schema: {
        tags: ['approval'],
        summary: '审批决策（顺序状态机：只有当前步可决策）',
        params: {
          type: 'object',
          properties: { taskId: { type: 'integer' } },
          required: ['taskId'],
        },
        body: {
          type: 'object',
          required: ['decision', 'operator'],
          additionalProperties: false,
          properties: {
            decision: { type: 'string', enum: [...DECISIONS] },
            operator: { type: 'string', minLength: 1 },
            opinion: { type: 'string' },
          },
        },
      },
    }, async (req) => service.decide(req.params.taskId, req.body));
  };
}
