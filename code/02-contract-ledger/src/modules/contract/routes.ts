import type { FastifyPluginAsync } from 'fastify';
import type { ContractService } from './service.ts';
import { CONTRACT_STATUSES } from './types.ts';
import type { ContractStatus, DraftInput } from './types.ts';

/** 金额：元字符串，最多两位小数（换算成分在 service 边界完成） */
const AMOUNT_PATTERN = '^\\d+(\\.\\d{1,2})?$';
const DATE_PATTERN = '^\\d{4}-\\d{2}-\\d{2}$';

export function contractRoutes(service: ContractService): FastifyPluginAsync {
  return async (app) => {
    app.post<{ Body: DraftInput }>('/contracts', {
      schema: {
        tags: ['contract'],
        summary: '起草合同（生成台账编号，进入 draft）',
        body: {
          type: 'object',
          required: ['title', 'counterparty', 'amount', 'signDate', 'effectiveDate', 'expireDate', 'owner'],
          additionalProperties: false,
          properties: {
            title: { type: 'string', minLength: 2 },
            counterparty: { type: 'string', minLength: 2 },
            amount: { type: 'string', pattern: AMOUNT_PATTERN, description: '金额（元），如 "1280000.00"' },
            signDate: { type: 'string', pattern: DATE_PATTERN },
            effectiveDate: { type: 'string', pattern: DATE_PATTERN },
            expireDate: { type: 'string', pattern: DATE_PATTERN },
            owner: { type: 'string', minLength: 1 },
          },
        },
      },
    }, async (req, reply) => {
      const result = service.draft(req.body);
      return reply.code(201).send(result);
    });

    app.get<{ Querystring: { status?: ContractStatus; expireBefore?: string } }>('/contracts', {
      schema: {
        tags: ['contract'],
        summary: '合同台账（expired 为查询时派生状态，不落库）',
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            status: { type: 'string', enum: [...CONTRACT_STATUSES] },
            expireBefore: { type: 'string', pattern: DATE_PATTERN, description: '到期日不晚于该日期' },
          },
        },
      },
    }, async (req) => service.list(req.query));

    app.get<{ Querystring: { days: number } }>('/contracts/reminders', {
      schema: {
        tags: ['contract'],
        summary: '到期提醒：[今天, 今天+days] 内到期的 active 件（零调度器，一条 SQL）',
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            days: { type: 'integer', minimum: 1, maximum: 365, default: 30 },
          },
        },
      },
    }, async (req) => service.reminders(req.query.days));

    app.get<{ Params: { contractNo: string } }>('/contracts/:contractNo', {
      schema: {
        tags: ['contract'],
        summary: '合同详情',
        params: {
          type: 'object',
          properties: { contractNo: { type: 'string' } },
          required: ['contractNo'],
        },
      },
    }, async (req) => service.detail(req.params.contractNo));

    app.post<{ Params: { contractNo: string }; Body: { operator: string; reason?: string } }>(
      '/contracts/:contractNo/terminate',
      {
        schema: {
          tags: ['contract'],
          summary: '终止合同（active → terminated）',
          params: {
            type: 'object',
            properties: { contractNo: { type: 'string' } },
            required: ['contractNo'],
          },
          body: {
            type: 'object',
            required: ['operator'],
            additionalProperties: false,
            properties: {
              operator: { type: 'string', minLength: 1 },
              reason: { type: 'string' },
            },
          },
        },
      },
      async (req) => service.terminate(req.params.contractNo, req.body.reason)
    );
  };
}
