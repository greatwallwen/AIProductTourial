/** ticket 模块唯一公共出口 */
export { createTicketService, type TicketService, TRANSITIONS, allowedActionsFrom } from './service.ts';
export { ticketRoutes } from './routes.ts';
export { STATUSES, ACTIONS, PRIORITIES, type Status, type Action, type Priority, type TenantContext } from './types.ts';
