import type { Product } from '@/types/index';
import type { IProductAdapter } from '@/lib/adapters/types';

/** Use a local atomic transaction when available. Remote writes use documented
 * update/create endpoints; remote multi-request atomicity is not assumed. */
export async function persistImportedProducts(adapter: IProductAdapter, incoming: Product[], existing: Product[]): Promise<Product[]> {
  const ids = new Set<string>();
  for (const product of incoming) {
    if (!product.id || !product.gradeName.trim() || ids.has(product.id)) throw new Error('DUPLICATE_OR_MISSING_IMPORT_IDENTITY');
    ids.add(product.id);
  }
  if (adapter.importRecords) return adapter.importRecords(incoming);
  const knownIds = new Set(existing.map(product => product.id));
  const saved: Product[] = [];
  for (const product of incoming.filter(product => knownIds.has(product.id))) {
    const updated = await adapter.update(product);
    if (updated.id !== product.id) throw new Error('IMPORT_UPDATE_IDENTITY_MISMATCH');
    saved.push(updated);
  }
  const newProducts = incoming.filter(product => !knownIds.has(product.id));
  if (newProducts.length) {
    const created = await adapter.batchCreate(newProducts);
    const expected = new Set(newProducts.map(product => product.id));
    if (created.length !== newProducts.length || new Set(created.map(product => product.id)).size !== created.length || created.some(product => !expected.has(product.id))) throw new Error('IMPORT_CREATE_RESULT_MISMATCH');
    saved.push(...created);
  }
  return saved;
}
