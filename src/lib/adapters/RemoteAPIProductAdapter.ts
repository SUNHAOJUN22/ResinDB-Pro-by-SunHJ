import { logger } from '@/lib/logger';
import { IProductAdapter } from '@/lib/adapters/types';
import { Product, ProductUpdates } from '@/types/index';

const DEFAULT_TIMEOUT_MS = 15_000;

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * REST-backed product adapter.
 *
 * Read fallback is opt-in because switching data sources changes the meaning of
 * a query. Mutating requests never fall back to IndexedDB: silently applying a
 * write to a different database creates split-brain state and false success.
 */
export class RemoteAPIProductAdapter implements IProductAdapter {
  private readonly apiBaseUrl: string;
  private readonly readFallbackEnabled: boolean;
  private fallbackAdapter: IProductAdapter | null = null;

  constructor(
    apiBaseUrl = import.meta.env.VITE_REMOTE_API_BASE_URL || '/api',
    readFallbackEnabled = import.meta.env.VITE_REMOTE_READ_FALLBACK === 'true',
  ) {
    this.apiBaseUrl = apiBaseUrl.replace(/\/$/, '');
    this.readFallbackEnabled = readFallbackEnabled;
  }

  private async getFallback(): Promise<IProductAdapter> {
    if (!this.fallbackAdapter) {
      const { IndexedDBProductAdapter } = await import('./IndexedDBProductAdapter');
      this.fallbackAdapter = new IndexedDBProductAdapter();
    }
    return this.fallbackAdapter;
  }

  private async request(path: string, init?: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const response = await fetch(`${this.apiBaseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          ...init?.headers,
        },
      });

      if (!response.ok) {
        const details = await response.text().catch(() => '');
        throw new Error(
          `Remote API ${init?.method || 'GET'} ${path} failed with HTTP ${response.status}${
            details ? `: ${details.slice(0, 300)}` : ''
          }`,
        );
      }
      return response;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error(`Remote API request timed out after ${DEFAULT_TIMEOUT_MS} ms`);
      }
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  private async withReadFallback<T>(
    operation: () => Promise<T>,
    fallback: (adapter: IProductAdapter) => Promise<T>,
    label: string,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (!this.readFallbackEnabled) throw error;
      logger.warn(`${label}; using explicitly enabled IndexedDB read fallback`, error);
      return fallback(await this.getFallback());
    }
  }

  async search(query: string, categoryId: string | null): Promise<Product[]> {
    return this.withReadFallback(
      async () => {
        const params = new URLSearchParams();
        if (query) params.set('q', query);
        if (categoryId) params.set('categoryId', categoryId);
        const suffix = params.size > 0 ? `?${params.toString()}` : '';
        const response = await this.request(`/products${suffix}`);
        return (await response.json()) as Product[];
      },
      (adapter) => adapter.search(query, categoryId),
      'Remote product search failed',
    );
  }

  async create(product: Partial<Product>): Promise<Product> {
    try {
      const response = await this.request('/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product),
      });
      return (await response.json()) as Product;
    } catch (error) {
      throw new Error(`Remote create failed; no local write was applied: ${describeError(error)}`);
    }
  }

  async update(product: Product): Promise<Product> {
    try {
      const response = await this.request(`/products/${encodeURIComponent(product.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product),
      });
      return (await response.json()) as Product;
    } catch (error) {
      throw new Error(`Remote update failed; no local write was applied: ${describeError(error)}`);
    }
  }

  async batchUpdate(ids: string[], updates: ProductUpdates): Promise<void> {
    if (ids.length === 0) return;
    try {
      await this.request('/products/batch-update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, updates }),
      });
    } catch (error) {
      throw new Error(
        `Remote batch update failed; no local write was applied: ${describeError(error)}`,
      );
    }
  }

  async batchCreate(products: Partial<Product>[]): Promise<Product[]> {
    if (products.length === 0) return [];
    try {
      const response = await this.request('/products/batch-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products }),
      });
      return (await response.json()) as Product[];
    } catch (error) {
      throw new Error(
        `Remote batch create failed; no local write was applied: ${describeError(error)}`,
      );
    }
  }

  async delete(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    try {
      await this.request('/products/batch-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
    } catch (error) {
      throw new Error(`Remote delete failed; no local write was applied: ${describeError(error)}`);
    }
  }

  async exportReport(
    products: Product[],
    format: 'csv' | 'xlsx' | 'json' | 'xml',
  ): Promise<Blob> {
    return this.withReadFallback(
      async () => {
        const response = await this.request(
          `/products/export?format=${encodeURIComponent(format)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ products }),
          },
        );
        return response.blob();
      },
      (adapter) => adapter.exportReport(products, format),
      'Remote report export failed',
    );
  }

  async restoreSnapshot(products: Product[]): Promise<void> {
    try {
      await this.request('/products/restore-snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products }),
      });
    } catch (error) {
      throw new Error(
        `Remote snapshot restore failed; no local write was applied: ${describeError(error)}`,
      );
    }
  }
}
