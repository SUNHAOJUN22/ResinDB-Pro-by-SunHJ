import { Product, ProductUpdates } from "../../types";

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
  exportReport(products: Product[], format: 'csv' | 'xlsx'): Promise<Blob>;
  restoreSnapshot(products: Product[]): Promise<void>;
}
