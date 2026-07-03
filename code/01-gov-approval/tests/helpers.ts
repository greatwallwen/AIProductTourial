import { buildApp } from '../src/app.ts';

/** 测试夹具：内存库 + 一个真实存在的行政审批事项（公开目录信息） */
export async function createTestApp() {
  const app = await buildApp({ dbPath: ':memory:' });
  app.db
    .prepare(
      `INSERT INTO catalog_items
        (item_code, item_name, implement_org, item_type, legal_days, promise_days, required_materials)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      'SCJG-XK-001',
      '食品经营许可证新办',
      '区市场监督管理局',
      '许可',
      20,
      10,
      JSON.stringify(['营业执照复印件', '经营场所平面布局图', '食品安全管理制度', '从业人员健康证明'])
    );
  return app;
}

export const validSubmission = {
  itemCode: 'SCJG-XK-001',
  applicantName: '上海鲜丰餐饮管理有限公司',
  applicantIdNo: '91310104MA1FL***XX',
  applicantPhone: '021-6408****',
  materials: [
    { materialName: '营业执照复印件', fileRef: 'oss://demo/yyzz.pdf' },
    { materialName: '经营场所平面布局图', fileRef: 'oss://demo/layout.pdf' },
    { materialName: '食品安全管理制度', fileRef: 'oss://demo/zhidu.pdf' },
    { materialName: '从业人员健康证明', fileRef: 'oss://demo/health.pdf' },
  ],
};

/** 推动申报单执行一个动作 */
export async function act(
  app: Awaited<ReturnType<typeof createTestApp>>,
  applyNo: string,
  action: string,
  operator = '测试员',
  opinion?: string
) {
  return await app.inject({
    method: 'POST',
    url: `/api/applications/${applyNo}/actions`,
    payload: { action, operator, ...(opinion ? { opinion } : {}) },
  });
}
