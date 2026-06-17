import { Product, ProductUpdates } from '@/types/index';

// 统一的物性快照结构，供开源数据与实验数据共同遵守
export interface MaterialPhysicsSpecs {
  density?: { value: number; unit: string; standard?: string };       // 密度 (ISO 1183)
  mfr?: { value: number; unit: string; standard?: string; temp?: string; load?: string }; // 熔指 (ISO 1133)
  tensileYield?: { value: number; unit: string; standard?: string };  // 拉伸产量强度 (ISO 527)
  flexuralModulus?: { value: number; unit: string; standard?: string };// 弯曲模量 (ISO 178)
  izodImpact?: { value: number; unit: string; standard?: string };     // 缺口冲击强度 (ISO 179/180)
}

// 独立的牌号/实验数据模型
export interface MaterialRecord {
  id: string;               // 唯一标示 (如 "EX-HDPE-2026-001")
  source: 'open_market' | 'my_lab'; // 数据源标记：开源专业大盘 vs 我的实验室数据
  batchNo?: string;         // 实验批次号（开源数据可为空）
  category: string;         // 树脂大类 (如 "HDPE", "PP", "ABS")
  grade: string;            // 牌号名称 (如 "5000S", "实验改性料-A1")
  manufacturer: string;     // 生产商 / 研发组
  description?: string;     // 备注说明
  properties: MaterialPhysicsSpecs; // 核心力学/物理指标
  timestamp: number;        // 录入/测试时间戳
}

export interface HistoryRecord {
  id: string;
  timestamp: number;
  description: string;
  snapshot: Product[];
}


export interface IProductAdapter {
  search(query: string, categoryId: string | null): Promise<Product[]>;
  create(product: Partial<Product>): Promise<Product>;
  update(product: Product): Promise<Product>;
  batchUpdate(ids: string[], updates: ProductUpdates): Promise<void>;
  batchCreate(products: Partial<Product>[]): Promise<Product[]>;
  delete(ids: string[]): Promise<void>;
  exportReport(products: Product[], format: 'csv' | 'xlsx' | 'json' | 'xml'): Promise<Blob>;
  restoreSnapshot(products: Product[]): Promise<void>;
}
