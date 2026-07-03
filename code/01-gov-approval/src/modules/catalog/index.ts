/** catalog 模块唯一公共出口：其他模块只能从这里 import */
export { createCatalogService, type CatalogService } from './service.ts';
export { catalogRoutes } from './routes.ts';
export type { CatalogItem } from './types.ts';
