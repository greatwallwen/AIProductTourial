import { join } from 'node:path';

export const config = {
  port: Number(process.env.PORT ?? 3001),
  dbPath: process.env.DB_PATH ?? join(import.meta.dirname, '..', 'data', 'app.db'),
  /** 申报编号前缀：行政区划码（GB/T 2260 真实代码，310104 = 上海市徐汇区；种子据 dataset/01-gov-approval/divisions.json 校验） */
  divisionCode: process.env.DIVISION_CODE ?? '310104',
};
