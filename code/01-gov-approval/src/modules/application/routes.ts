import type { FastifyPluginAsync } from 'fastify';
import type { ApplicationService } from './service.ts';
import { ACTIONS } from './types.ts';
import type { Action } from './types.ts';

interface SubmitBody {
  itemCode: string;
  applicantName: string;
  applicantIdNo: string;
  applicantPhone: string;
  materials: Array<{ materialName: string; fileRef: string }>;
}

interface ActionBody {
  action: Action;
  operator: string;
  opinion?: string;
}

export function applicationRoutes(service: ApplicationService): FastifyPluginAsync {
  return async (app) => {
    app.post<{ Body: SubmitBody }>('/applications', {
      schema: {
        tags: ['application'],
        summary: '提交申报',
        body: {
          type: 'object',
          required: ['itemCode', 'applicantName', 'applicantIdNo', 'applicantPhone', 'materials'],
          additionalProperties: false,
          properties: {
            itemCode: { type: 'string', minLength: 1 },
            applicantName: { type: 'string', minLength: 2 },
            applicantIdNo: { type: 'string', minLength: 6 },
            applicantPhone: { type: 'string', minLength: 6 },
            materials: {
              type: 'array',
              items: {
                type: 'object',
                required: ['materialName', 'fileRef'],
                additionalProperties: false,
                properties: {
                  materialName: { type: 'string', minLength: 1 },
                  fileRef: { type: 'string', minLength: 1 },
                },
              },
            },
          },
        },
      },
    }, async (req, reply) => {
      const result = service.submit(req.body);
      return reply.code(201).send(result);
    });

    app.get<{ Querystring: { status?: string; overdue?: boolean } }>('/applications', {
      schema: {
        tags: ['application'],
        summary: '申报单列表（支持超期筛选）',
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            status: { type: 'string' },
            overdue: { type: 'boolean' },
          },
        },
      },
    }, async (req) => service.list(req.query));

    app.get<{ Params: { applyNo: string } }>('/applications/:applyNo', {
      schema: {
        tags: ['application'],
        summary: '申报单详情（含材料与流转历史）',
        params: {
          type: 'object',
          properties: { applyNo: { type: 'string' } },
          required: ['applyNo'],
        },
      },
    }, async (req) => service.detail(req.params.applyNo));

    app.post<{ Params: { applyNo: string }; Body: ActionBody }>('/applications/:applyNo/actions', {
      schema: {
        tags: ['application'],
        summary: '执行审批动作（状态机流转）',
        params: {
          type: 'object',
          properties: { applyNo: { type: 'string' } },
          required: ['applyNo'],
        },
        body: {
          type: 'object',
          required: ['action', 'operator'],
          additionalProperties: false,
          properties: {
            action: { type: 'string', enum: [...ACTIONS] },
            operator: { type: 'string', minLength: 1 },
            opinion: { type: 'string' },
          },
        },
      },
    }, async (req) => service.act(req.params.applyNo, req.body));
  };
}
