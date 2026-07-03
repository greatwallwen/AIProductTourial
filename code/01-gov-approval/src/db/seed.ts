import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { openDb } from '../shared/db.ts';
import { config } from '../config.ts';
import { runMigrations } from './migrate.ts';
import { createCatalogService } from '../modules/catalog/index.ts';
import { createApplicationService } from '../modules/application/index.ts';

/**
 * 种子数据。
 * 事项名称为真实存在的行政审批事项（公开目录信息）；受理区划取自 GB/T 2260 真实行政区划
 * （dataset/01-gov-approval/divisions.json，见 dataset/MANIFEST.md），实施机关按真实区划名限定。
 * 企业名/人名为虚构，证件号为脱敏格式。
 * 铁律：时间字段一律相对 Date.now() 偏移，保证超期演示任何日期运行都真实命中。
 */
const db = openDb(config.dbPath);
runMigrations(db);

// 受理大厅所在区划：据真实 GB/T 2260 数据集校验 config.divisionCode，并用真实区划名限定实施机关
const DIVISIONS = JSON.parse(
  readFileSync(join(import.meta.dirname, '..', '..', '..', '..', 'dataset', '01-gov-approval', 'divisions.json'), 'utf8')
) as Array<{ code: string; name: string; city: string; province: string }>;
const HALL = DIVISIONS.find((d) => d.code === config.divisionCode);
if (!HALL) throw new Error(`区划码 ${config.divisionCode} 不在真实行政区划数据集内`);
console.log(`受理区划：${HALL.province} ${HALL.city} ${HALL.name}（${HALL.code}）`);

const insertItem = db.prepare(
  `INSERT INTO catalog_items
     (item_code, item_name, implement_org, item_type, legal_days, promise_days, required_materials)
   VALUES (?, ?, ?, ?, ?, ?, ?)`
);

// 实施机关以 "区" 占位，落库时替换为真实区划名（如 徐汇区市场监督管理局）
const ITEMS: Array<[string, string, string, '许可' | '登记', number, number, string[]]> = [
  ['SCJG-XK-001', '食品经营许可证新办', '区市场监督管理局', '许可', 20, 10,
    ['营业执照复印件', '经营场所平面布局图', '食品安全管理制度', '从业人员健康证明']],
  ['WSJK-XK-003', '公共场所卫生许可证核发', '区卫生健康委员会', '许可', 20, 7,
    ['卫生检测报告', '场所平面图']],
  ['SW-XK-002', '城镇污水排入排水管网许可', '区水务局', '许可', 20, 12,
    ['排水许可申请表', '排水水质检测报告']],
  ['GH-XK-005', '建设工程规划许可证核发', '区规划和自然资源局', '许可', 20, 15,
    ['建设工程设计方案', '土地权属证明']],
  ['SCJG-DJ-011', '个体工商户设立登记', '区市场监督管理局', '登记', 1, 1,
    ['经营者身份证明', '经营场所证明']],
];
for (const [code, name, org, type, legal, promise, materials] of ITEMS) {
  const realOrg = HALL.name + org.replace(/^区/, ''); // 区市场监督管理局 → 徐汇区市场监督管理局
  insertItem.run(code, name, realOrg, type, legal, promise, JSON.stringify(materials));
}

const catalog = createCatalogService({ db });
const application = createApplicationService({ db, catalog, divisionCode: config.divisionCode });

function materialsFor(code: string) {
  return catalog.getByCode(code).requiredMaterials.map((name) => ({
    materialName: name,
    fileRef: `file://demo/${code}/${name}.pdf`,
  }));
}

interface SeedApp {
  itemCode: string;
  applicant: string;
  idNo: string;
  phone: string;
  actions: Array<{ action: Parameters<typeof application.act>[1]['action']; operator: string; opinion?: string }>;
  /** 受理时间回拨天数（演示超期预警） */
  backdateAcceptedDays?: number;
}

const APPS: SeedApp[] = [
  {
    itemCode: 'SCJG-XK-001',
    applicant: '上海鲜丰餐饮管理有限公司',
    idNo: '91310104MA1FL***XX',
    phone: '021-6408****',
    actions: [],
  },
  {
    itemCode: 'WSJK-XK-003',
    applicant: '上海悦泉酒店管理有限公司',
    idNo: '91310104MA1GT***XX',
    phone: '021-5425****',
    actions: [{ action: 'accept', operator: '窗口-李芳' }],
  },
  {
    itemCode: 'SW-XK-002',
    applicant: '上海精工机械制造有限公司',
    idNo: '91310104MA1KQ***XX',
    phone: '021-6431****',
    actions: [
      { action: 'accept', operator: '窗口-李芳' },
      { action: 'request_supplement', operator: '窗口-李芳', opinion: '水质检测报告已过有效期，请补充近三个月内报告' },
    ],
  },
  {
    // 超期件：承诺 10 个工作日，受理时间回拨 15 天
    itemCode: 'SCJG-XK-001',
    applicant: '上海隆盛食品贸易有限公司',
    idNo: '91310104MA1HH***XX',
    phone: '021-6470****',
    actions: [
      { action: 'accept', operator: '窗口-李芳' },
      { action: 'start_review', operator: '科员-赵磊' },
    ],
    backdateAcceptedDays: 15,
  },
  {
    itemCode: 'GH-XK-005',
    applicant: '上海城建置业发展有限公司',
    idNo: '91310104MA1PB***XX',
    phone: '021-6486****',
    actions: [
      { action: 'accept', operator: '窗口-李芳' },
      { action: 'start_review', operator: '科员-赵磊' },
      { action: 'approve', operator: '科长-王建国', opinion: '设计方案符合控制性详细规划' },
    ],
  },
  {
    itemCode: 'SCJG-DJ-011',
    applicant: '张伟明（个体经营者）',
    idNo: '310104********0012',
    phone: '138****5678',
    actions: [
      { action: 'accept', operator: '窗口-李芳' },
      { action: 'start_review', operator: '科员-赵磊' },
      { action: 'approve', operator: '科长-王建国' },
      { action: 'conclude', operator: '窗口-李芳' },
    ],
  },
];

for (const seed of APPS) {
  const { applyNo } = application.submit({
    itemCode: seed.itemCode,
    applicantName: seed.applicant,
    applicantIdNo: seed.idNo,
    applicantPhone: seed.phone,
    materials: materialsFor(seed.itemCode),
  });
  for (const step of seed.actions) {
    application.act(applyNo, step);
  }
  if (seed.backdateAcceptedDays) {
    const past = new Date(Date.now() - seed.backdateAcceptedDays * 86_400_000).toISOString();
    db.prepare('UPDATE applications SET accepted_at = ? WHERE apply_no = ?').run(past, applyNo);
  }
  console.log(`已生成申报单 ${applyNo}（${seed.applicant}）`);
}

const summary = db
  .prepare('SELECT status, COUNT(*) AS n FROM applications GROUP BY status ORDER BY status')
  .all() as Array<{ status: string; n: number }>;
console.log('状态分布：' + summary.map((s) => `${s.status}=${s.n}`).join(', '));
db.close();
