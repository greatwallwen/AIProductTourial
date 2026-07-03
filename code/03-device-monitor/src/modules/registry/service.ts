import type { Db } from '../../shared/db.ts';
import { AppError } from '../../shared/errors.ts';
import { createRegistryRepo } from './repo.ts';
import type { Device } from './types.ts';

export function createRegistryService(deps: { db: Db }) {
  const repo = createRegistryRepo(deps.db);
  return {
    list(): Device[] {
      return repo.list();
    },
    getByCode(code: string): Device {
      const device = repo.getByCode(code);
      if (!device) throw new AppError('DEVICE_NOT_FOUND', 404, `设备未注册：${code}`);
      return device;
    },
  };
}

export type RegistryService = ReturnType<typeof createRegistryService>;
