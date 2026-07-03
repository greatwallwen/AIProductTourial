/** application 模块唯一公共出口 */
export { createApplicationService, type ApplicationService, TRANSITIONS, allowedActionsFrom } from './service.ts';
export { applicationRoutes } from './routes.ts';
export { STATUSES, ACTIONS, type Status, type Action } from './types.ts';
