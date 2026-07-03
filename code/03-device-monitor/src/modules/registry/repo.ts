import type { Db } from '../../shared/db.ts';
import type { Device } from './types.ts';

interface Row {
  id: number;
  device_code: string;
  name: string;
  model: string;
  vendor: string;
  gateway: string;
  location: string;
  installed_at: string;
}

function toDevice(r: Row): Device {
  return {
    id: r.id,
    deviceCode: r.device_code,
    name: r.name,
    model: r.model,
    vendor: r.vendor,
    gateway: r.gateway,
    location: r.location,
    installedAt: r.installed_at,
  };
}

export function createRegistryRepo(db: Db) {
  return {
    list(): Device[] {
      const rows = db.prepare('SELECT * FROM devices ORDER BY device_code').all() as unknown as Row[];
      return rows.map(toDevice);
    },
    getByCode(code: string): Device | undefined {
      const row = db.prepare('SELECT * FROM devices WHERE device_code = ?').get(code) as unknown as
        | Row
        | undefined;
      return row ? toDevice(row) : undefined;
    },
  };
}

export type RegistryRepo = ReturnType<typeof createRegistryRepo>;
