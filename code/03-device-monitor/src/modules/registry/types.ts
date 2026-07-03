export interface Device {
  id: number;
  deviceCode: string;
  name: string;
  /** 真实存在的设备型号，如阿特拉斯·科普柯 GA 37+（厂商公开资料） */
  model: string;
  vendor: string;
  /** 接入网关（PLC 型号） */
  gateway: string;
  location: string;
  installedAt: string;
}
