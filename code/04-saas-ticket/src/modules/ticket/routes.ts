import type { FastifyPluginAsync } from 'fastify';
import type { TicketService } from './service.ts';
import { ACTIONS, PRIORITIES, STATUSES } from './types.ts';
import type { Action, CreateTicketInput } from './types.ts';

interface TransitionBody {
  action: Action;
  actorEmail: string;
  note?: string;
}

/**
 * 工单路由：本插件整体注册在挂了鉴权钩子的子作用域内（见 app.ts），
 * 进入任一 handler 时 req.tenant 必已就位——安全边界在作用域上，不在每个 handler 里。
 */
export function ticketRoutes(service: TicketService): FastifyPluginAsync {
  return async (app) => {
    app.post<{ Body: CreateTicketInput }>('/tickets', {
      schema: {
        tags: ['ticket'],
        summary: '创建工单（编号每租户独立发号）',
        body: {
          type: 'object',
          required: ['title', 'priority', 'createdBy'],
          additionalProperties: false,
          properties: {
            title: { type: 'string', minLength: 2 },
            priority: { type: 'string', enum: [...PRIORITIES] },
            createdBy: { type: 'string', minLength: 3 },
            assignee: { type: 'string', minLength: 3 },
          },
        },
      },
    }, async (req, reply) => {
      const result = service.create(req.tenant, req.body);
      return reply.code(201).send(result);
    });

    app.get<{ Querystring: { status?: string; priority?: string } }>('/tickets', {
      schema: {
        tags: ['ticket'],
        summary: '工单列表（只含本租户，支持状态/优先级筛选）',
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            status: { type: 'string', enum: [...STATUSES] },
            priority: { type: 'string', enum: [...PRIORITIES] },
          },
        },
      },
    }, async (req) => service.list(req.tenant, req.query));

    app.get<{ Params: { ticketNo: string } }>('/tickets/:ticketNo', {
      schema: {
        tags: ['ticket'],
        summary: '工单详情（含完整事件流；他租户工单一律 404）',
        params: {
          type: 'object',
          properties: { ticketNo: { type: 'string' } },
          required: ['ticketNo'],
        },
      },
    }, async (req) => service.detail(req.tenant, req.params.ticketNo));

    app.post<{ Params: { ticketNo: string }; Body: TransitionBody }>('/tickets/:ticketNo/transition', {
      schema: {
        tags: ['ticket'],
        summary: '执行工单动作（状态机流转）',
        params: {
          type: 'object',
          properties: { ticketNo: { type: 'string' } },
          required: ['ticketNo'],
        },
        body: {
          type: 'object',
          required: ['action', 'actorEmail'],
          additionalProperties: false,
          properties: {
            action: { type: 'string', enum: [...ACTIONS] },
            actorEmail: { type: 'string', minLength: 3 },
            note: { type: 'string' },
          },
        },
      },
    }, async (req) => service.transition(req.tenant, req.params.ticketNo, req.body));
  };
}
