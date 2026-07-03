/** registry 模块唯一公共出口：其他模块只能从这里 import */
export { createRegistryService, type RegistryService } from './service.ts';
export { registryRoutes } from './routes.ts';
export type { Device } from './types.ts';
