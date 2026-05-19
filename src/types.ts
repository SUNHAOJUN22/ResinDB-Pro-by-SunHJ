
export type Language = 'zh' | 'en';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  avatar?: string;
}

export interface Category {
  id: string;
  name: string;
  nameEn?: string;
  children?: Category[];
}

export interface Reference {
  id: string;
  name: string;
  author?: string;
  year?: string;
}

export interface Manufacturer {
  id: string;
  name: string;
  website?: string;
  description?: string;
  country?: string;
}

export interface PropertyValue {
  value: string | number;
  unit?: string;
  // 二维描述扩展
  standard?: string;    // 测试标准
  temperature?: string; // 测试温度
  referenceId?: string; // 参考文献ID (Data Source)
  instrument?: string;  // 来源仪器/设备 (Source Machine)
  sourceUrl?: string;   // 来源链接 (Website Link)
  annotation?: string;  // 中文标注
  // 统计学数据扩展
  mean?: number;
  stdDev?: number;
  min?: number;
  max?: number;
  count?: number;
}

export interface Product {
  id: string;
  gradeName: string; 
  manufacturerId: string; // 关联厂家ID
  manufacturer: string;   // 冗余显示名
  categoryIds: string[]; 
  properties: Record<string, PropertyValue>;
  createdAt: string;
  updatedAt: string;
}

export type ViewMode = 'grid' | 'chart';
export type AppView = 'dashboard' | 'analytics' | 'pivot' | 'settings';

export interface Toast { id: string; type: 'success' | 'error' | 'info'; message: string; }

export interface FormulaConfig {
  id: string;
  name: string;
  expression: string; // e.g., "props['Density'] * props['Tensile']"
  unit?: string;
  description?: string;
}

export interface ColumnConfig {
  key: string;
  label: string;
  visible: boolean;
  isSystem?: boolean;
  isComputed?: boolean;
  type?: 'string' | 'number';
  formulaId?: string;
  unit?: string;
  isPinned?: boolean; // New: Support for sticky columns
}

export interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

export type FilterOperator = 'contains' | 'equals' | 'startsWith' | 'endsWith' | 'gt' | 'lt' | 'gte' | 'lte' | 'isEmpty' | 'isNotEmpty';

export interface FilterCondition {
  id: string;
  field: string;
  operator: FilterOperator;
  value: unknown;
}

export interface FilterGroup {
  id: string;
  type: 'group';
  logic: 'AND' | 'OR';
  conditions: (FilterCondition | FilterGroup)[];
}

export interface PropertyUpdate {
  [key: string]: string | number | PropertyValue;
}

export interface ProductUpdates extends Partial<Product> {
  _propertyUpdates?: PropertyUpdate;
}

export interface AiAction {
  type: string;
  payload: Product | string[] | BatchUpdateResult | Record<string, unknown> | unknown;
  label: string;
}

/**
 * Describes the result of a batch update operation.
 */
export interface BatchUpdateResult {
  ids: string[];
  updates: ProductUpdates;
}

export interface FilterItem {
  id: string;
  label: string;
  type: 'search' | 'category' | 'numeric' | 'advanced';
  onRemove: () => void;
}

export interface SavedView {
  id: string;
  name: string;
  query: string;
  filters: FilterGroup | null;
  columns: ColumnConfig[];
}
