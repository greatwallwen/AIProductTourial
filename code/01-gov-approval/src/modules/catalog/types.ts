export interface CatalogItem {
  id: number;
  itemCode: string;
  itemName: string;
  implementOrg: string;
  itemType: '许可' | '登记';
  /** 法定办结时限（工作日），依据《行政许可法》第四十二条 */
  legalDays: number;
  /** 承诺办结时限（工作日），政务服务事项页真实字段 */
  promiseDays: number;
  requiredMaterials: string[];
}
