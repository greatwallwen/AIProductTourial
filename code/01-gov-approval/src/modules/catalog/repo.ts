import type { Db } from '../../shared/db.ts';
import type { CatalogItem } from './types.ts';

interface Row {
  id: number;
  item_code: string;
  item_name: string;
  implement_org: string;
  item_type: string;
  legal_days: number;
  promise_days: number;
  required_materials: string;
}

function toItem(r: Row): CatalogItem {
  return {
    id: r.id,
    itemCode: r.item_code,
    itemName: r.item_name,
    implementOrg: r.implement_org,
    itemType: r.item_type as CatalogItem['itemType'],
    legalDays: r.legal_days,
    promiseDays: r.promise_days,
    requiredMaterials: JSON.parse(r.required_materials) as string[],
  };
}

export function createCatalogRepo(db: Db) {
  return {
    list(): CatalogItem[] {
      const rows = db.prepare('SELECT * FROM catalog_items ORDER BY item_code').all() as unknown as Row[];
      return rows.map(toItem);
    },
    getByCode(code: string): CatalogItem | undefined {
      const row = db.prepare('SELECT * FROM catalog_items WHERE item_code = ?').get(code) as unknown as
        | Row
        | undefined;
      return row ? toItem(row) : undefined;
    },
  };
}

export type CatalogRepo = ReturnType<typeof createCatalogRepo>;
