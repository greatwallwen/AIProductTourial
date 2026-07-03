import { join } from 'node:path';

export const config = {
  port: Number(process.env.PORT ?? 3004),
  dbPath: process.env.DB_PATH ?? join(import.meta.dirname, '..', 'data', 'app.db'),
};
