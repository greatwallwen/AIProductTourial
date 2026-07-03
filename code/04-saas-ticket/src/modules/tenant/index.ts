/** tenant 模块唯一公共出口：其他模块只能从这里 import */
export { createTenantService, sha256Hex, type TenantService } from './service.ts';
export { tenantRoutes } from './routes.ts';
export { createApiKeyAuthHook } from './auth.ts';
export { PLANS, ROLES, type Plan, type Role, type TenantIdentity, type RegisterInput } from './types.ts';
