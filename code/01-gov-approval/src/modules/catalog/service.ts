import type { Db } from '../../shared/db.ts';
import { AppError } from '../../shared/errors.ts';
import { createCatalogRepo } from './repo.ts';
import type { CatalogItem } from './types.ts';

export function createCatalogService(deps: { db: Db }) {
  const repo = createCatalogRepo(deps.db);
  return {
    list(): CatalogItem[] {
      return repo.list();
    },
    getByCode(code: string): CatalogItem {
      const item = repo.getByCode(code);
      if (!item) throw new AppError('ITEM_NOT_FOUND', 404, `事项不存在：${code}`);
      return item;
    },
  };
}

export type CatalogService = ReturnType<typeof createCatalogService>;
