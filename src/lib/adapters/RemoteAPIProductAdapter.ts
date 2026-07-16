import { IProductAdapter } from "@/lib/adapters/types";
import { Product, ProductUpdates } from '@/types/index';

/**
 * 🚀 RemoteAPIProductAdapter 
 * 
 * 这是一个工业级的数据适配器，实现了抽象的核心 `IProductAdapter` 接口。
 * 它将前端所有的增删改查及批操作，转换为向后端 REST API 服务器发起的标准 HTTP 请求。
 * 
 * 本适配器采用“防御性优雅回退模式 (Defensive Graceful Fallback)”机制：
 * 1. 当后端服务已部署（如连接 MySQL/MongoDB Express 服务），将无感、完全同步地把数据交互流推送到对应生产级数据库；
 * 2. 在本地纯开发/离线模式下，如若请求发生超时或因无环境配置导致失败，将会自动降级日志并输出警告，确保系统的高可靠性和高复用。
 */
export class RemoteAPIProductAdapter implements IProductAdapter {
  private apiBaseUrl: string;
  private fallbackAdapter: IProductAdapter | null = null;

  constructor(apiBaseUrl: string = '/api') {
    this.apiBaseUrl = apiBaseUrl;
  }

  private async getFallback(): Promise<IProductAdapter> {
    if (!this.fallbackAdapter) {
      const { IndexedDBProductAdapter } = await import("./IndexedDBProductAdapter");
      this.fallbackAdapter = new IndexedDBProductAdapter();
    }
    return this.fallbackAdapter;
  }

  /**
   * 按关键字和类别查询物性产品
   */
  async search(query: string, categoryId: string | null): Promise<Product[]> {
    try {
      const params = new URLSearchParams();
      if (query) params.append('q', query);
      if (categoryId) params.append('categoryId', categoryId);

      const resp = await fetch(`${this.apiBaseUrl}/products?${params.toString()}`);
      if (!resp.ok) {
        throw new Error(`HTTP error! status: ${resp.status}`);
      }
      return await resp.json() as Product[];
    } catch (e) {
      console.warn("⚠️ Remote SQL/MongoDB API unreachable, utilizing IndexedDB as fallback. Error Detail:", e);
      // 作为备用级熔断机制，若服务器不通，动态用 LocalDB 代替，保证界面永不瘫痪
      const fallback = await this.getFallback();
      return fallback.search(query, categoryId);
    }
  }

  /**
   * 单一物性牌号/自测实验记录建库（支持真实的 MongoDB Document 写入 / MySQL Row 插入）
   */
  async create(product: Partial<Product>): Promise<Product> {
    try {
      const resp = await fetch(`${this.apiBaseUrl}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(product)
      });
      if (!resp.ok) {
        throw new Error(`HTTP error! status: ${resp.status}`);
      }
      return await resp.json() as Product;
    } catch (e) {
      console.warn("⚠️ Remote api write failed, falling back to local storage.", e);
      const fallback = await this.getFallback();
      return fallback.create(product);
    }
  }

  /**
   * 物性大盘标准规格 / 实验室修改热更新接口
   */
  async update(product: Product): Promise<Product> {
    try {
      const resp = await fetch(`${this.apiBaseUrl}/products/${product.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(product)
      });
      if (!resp.ok) {
        throw new Error(`HTTP error! status: ${resp.status}`);
      }
      return await resp.json() as Product;
    } catch (e) {
      console.warn("⚠️ Remote api update failed, falling back to local.", e);
      const fallback = await this.getFallback();
      return fallback.update(product);
    }
  }

  /**
   * 物性大参数组合批量变动
   */
  async batchUpdate(ids: string[], updates: ProductUpdates): Promise<void> {
    try {
      const resp = await fetch(`${this.apiBaseUrl}/products/batch-update`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, updates })
      });
      if (!resp.ok) {
        throw new Error(`HTTP error! status: ${resp.status}`);
      }
    } catch (e) {
      console.warn("⚠️ Remote API batch update failed, fallback implemented.", e);
      const fallback = await this.getFallback();
      return fallback.batchUpdate(ids, updates);
    }
  }

  /**
   * 批次自测实验参数多条快速并库入座 (Batch Seed / Input)
   */
  async batchCreate(products: Partial<Product>[]): Promise<Product[]> {
    try {
      const resp = await fetch(`${this.apiBaseUrl}/products/batch-create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products })
      });
      if (!resp.ok) {
        throw new Error(`HTTP error! status: ${resp.status}`);
      }
      return await resp.json() as Product[];
    } catch (e) {
      console.warn("⚠️ Remote batch create failed, falling back.", e);
      const fallback = await this.getFallback();
      return fallback.batchCreate(products);
    }
  }

  /**
   * 物理级数据库批次彻底清除 (Delete cascade)
   */
  async delete(ids: string[]): Promise<void> {
    try {
      const resp = await fetch(`${this.apiBaseUrl}/products/batch-delete`, {
        method: "POST", // 采用 POST 或 DELETE payload
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids })
      });
      if (!resp.ok) {
        throw new Error(`HTTP error! status: ${resp.status}`);
      }
    } catch (e) {
      console.warn("⚠️ Remote batch delete failed, fallback triggered.", e);
      const fallback = await this.getFallback();
      return fallback.delete(ids);
    }
  }

  /**
   * 科学 data 报告导出（由后端进行强力 D3 处理、或者是返回 Blob 的离线缓存格式）
   */
  async exportReport(products: Product[], format: 'csv' | 'xlsx' | 'json' | 'xml'): Promise<Blob> {
    try {
      const resp = await fetch(`${this.apiBaseUrl}/products/export?format=${format}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products })
      });
      if (!resp.ok) {
        throw new Error(`HTTP error! status: ${resp.status}`);
      }
      return await resp.blob();
    } catch (e) {
      console.warn("⚠️ Remote export report failed, using client-side generator.", e);
      const fallback = await this.getFallback();
      return fallback.exportReport(products, format);
    }
  }

  /**
   * 快照状态持久化数据库还原 (Snapshot Recovery)
   */
  async restoreSnapshot(products: Product[]): Promise<void> {
    try {
      const resp = await fetch(`${this.apiBaseUrl}/products/restore-snapshot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products })
      });
      if (!resp.ok) {
        throw new Error(`HTTP error! status: ${resp.status}`);
      }
    } catch (e) {
      console.warn("⚠️ Backup snapshot restoration remote fail, fallback active.", e);
      const fallback = await this.getFallback();
      return fallback.restoreSnapshot(products);
    }
  }
}

// v3.1.0-sync

// v3.1.0-sync-fixed
