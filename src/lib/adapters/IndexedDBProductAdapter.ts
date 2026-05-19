import { logger } from '@/lib/logger';
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Category, Product, ProductUpdates, PropertyValue } from '@/types/index';
import { PRODUCT_CATALOG, CATEGORY_TREE } from '@/config/constants';
import { IProductAdapter } from "@/lib/adapters/types";

interface ResinDB extends DBSchema {
  products: {
    key: string;
    value: Product;
    indexes: {
      'by-gradeName': string;
      'by-manufacturer': string;
    };
  };
}

export class IndexedDBProductAdapter implements IProductAdapter {
  private dbPromise: Promise<IDBPDatabase<ResinDB>> | null = null;

  constructor() {
    // Lazy initialization happens in getDB()
  }

  private async getDB(): Promise<IDBPDatabase<ResinDB>> {
    if (!this.dbPromise) {
      this.dbPromise = this.initDB();
    }
    
    try {
      return await this.dbPromise;
    } catch (error) {
      // If initialization failed, clear the promise so the next call can retry
      this.dbPromise = null;
      throw error;
    }
  }

  private async initDB(): Promise<IDBPDatabase<ResinDB>> {
    try {
      // Renamed to resin-db-v3 to force a reset and ensure the new 300 products are loaded
      const dbPromise = openDB<ResinDB>('resin-db-v3', 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('products')) {
            const store = db.createObjectStore('products', {
              keyPath: 'id',
            });
            store.createIndex('by-gradeName', 'gradeName');
            store.createIndex('by-manufacturer', 'manufacturer');
          }
        },
      });

      const db = await dbPromise;
      
      // Seed initial data if empty
      const count = await db.count('products');
      if (count === 0) {
        const tx = db.transaction('products', 'readwrite');
        for (const product of PRODUCT_CATALOG) {
          tx.store.add(product);
        }
        await tx.done;
      }
      
      return db;
    } catch (error) {
      logger.error("Failed to initialize database:", error);
      throw new Error(`Database connection failed: ${error instanceof Error ? error.message : "Unknown error"}. This may be caused by Private Browsing mode or insufficient disk space.`);
    }
  }

  private async simulateLatency(ms?: number): Promise<void> {
    // In actual local deployment, we can set this to 0 or very low
    const isProd = import.meta.env?.PROD ?? true;
    const delay = ms ?? (isProd ? 0 : 50);
    if (delay <= 0) return;
    return new Promise((resolve) => setTimeout(resolve, delay));
  }

  async search(query: string, categoryId: string | null): Promise<Product[]> {
    await this.simulateLatency();
    const db = await this.getDB();
    const allProducts = await db.getAll('products');
    
    const lowerQuery = query.toLowerCase().trim();
    
    // Resolve all sub-category IDs if categoryId is provided
    const targetCategoryIds = new Set<string>();
    if (categoryId) {
      const findAndAddSubcategories = (id: string, tree: Category[]): boolean => {
        for (const node of tree) {
          if (node.id === id) {
            const collect = (n: Category) => {
              targetCategoryIds.add(n.id);
              n.children?.forEach(collect);
            };
            collect(node);
            return true;
          }
          if (node.children && findAndAddSubcategories(id, node.children)) return true;
        }
        return false;
      };
      findAndAddSubcategories(categoryId, CATEGORY_TREE);
    }

    return allProducts.filter(p => {
      const matchesSearch = !lowerQuery || 
        p.gradeName.toLowerCase().includes(lowerQuery) ||
        p.manufacturer.toLowerCase().includes(lowerQuery) ||
        Object.keys(p.properties).some(k => k.toLowerCase().includes(lowerQuery));
      
      const matchesCategory = !categoryId || p.categoryIds.some(id => targetCategoryIds.has(id));
      
      return matchesSearch && matchesCategory;
    });
  }

  async create(product: Partial<Product>): Promise<Product> {
    await this.simulateLatency();
    
    if (!product.gradeName) {
      throw new Error("400 Bad Request: Missing gradeName");
    }

    const newProduct: Product = {
      id: product.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `p-${Math.random().toString(36).substr(2, 9)}`),
      gradeName: product.gradeName,
      manufacturer: product.manufacturer || "Unknown",
      manufacturerId: product.manufacturerId || "m-unknown",
      categoryIds: product.categoryIds || [],
      properties: product.properties || {},
      updatedAt: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString().split('T')[0],
    };

    const db = await this.getDB();
    try {
      await db.add('products', newProduct);
    } catch (e) {
      logger.error("IndexedDB Create Failed:", e);
      // If ID collision, try one more time with a different ID
      if (e instanceof Error && e.name === 'ConstraintError') {
        newProduct.id = `p-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        await db.add('products', newProduct);
      } else {
        throw e;
      }
    }
    
    return newProduct;
  }

  async update(product: Product): Promise<Product> {
    await this.simulateLatency();
    
    if (!product.id || !product.gradeName) {
      throw new Error("400 Bad Request: Missing required fields");
    }

    const updatedProduct = {
      ...product,
      updatedAt: new Date().toISOString().split('T')[0]
    };

    const db = await this.getDB();
    // Check if exists
    const existing = await db.get('products', product.id);
    if (!existing) {
      throw new Error(`404 Not Found: Product ${product.id} does not exist`);
    }

    await db.put('products', updatedProduct);
    
    return updatedProduct;
  }

  async batchUpdate(ids: string[], updates: ProductUpdates): Promise<void> {
    await this.simulateLatency();
    
    if (!ids.length) return; // Silent return for empty batch

    const db = await this.getDB();
    const tx = db.transaction('products', 'readwrite');
    const { _propertyUpdates, ...restUpdates } = updates;

    for (const id of ids) {
      const p = await tx.store.get(id);
      if (p) {
        const newProperties = { ...p.properties };
        if (_propertyUpdates) {
          Object.entries(_propertyUpdates).forEach(([key, updateVal]) => {
            if (updateVal !== null && typeof updateVal === "object" && "value" in updateVal) {
              newProperties[key] = { ...newProperties[key], ...updateVal as PropertyValue };
            } else {
              newProperties[key] = { 
                ...(newProperties[key] || { unit: "" }), 
                value: updateVal as string | number 
              };
            }
          });
        }
        
        await tx.store.put({
          ...p,
          ...restUpdates,
          properties: newProperties,
          updatedAt: new Date().toISOString().split('T')[0]
        });
      }
    }
    await tx.done;
  }

  async batchCreate(products: Partial<Product>[]): Promise<Product[]> {
    await this.simulateLatency();
    if (!products.length) return [];

    const db = await this.getDB();
    const tx = db.transaction('products', 'readwrite');
    const createdProducts: Product[] = [];

    const now = new Date().toISOString().split('T')[0];

    for (const p of products) {
      const newProduct: Product = {
        id: p.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `p-${Math.random().toString(36).substr(2, 9)}`),
        gradeName: p.gradeName || "New Product",
        manufacturer: p.manufacturer || "Unknown",
        manufacturerId: p.manufacturerId || "m-unknown",
        categoryIds: p.categoryIds || [],
        properties: p.properties || {},
        updatedAt: now,
        createdAt: now,
      };
      
      try {
        await tx.store.add(newProduct);
        createdProducts.push(newProduct);
      } catch (err) {
        logger.warn(`Skipping product due to error during batch export: ${newProduct.id}`, err);
        // Continue with others
      }
    }
    await tx.done;
    return createdProducts;
  }

  async delete(ids: string[]): Promise<void> {
    await this.simulateLatency();
    
    if (!ids.length) throw new Error("400 Bad Request: No IDs provided");
    
    const db = await this.getDB();
    const tx = db.transaction('products', 'readwrite');
    for (const id of ids) {
      await tx.store.delete(id);
    }
    await tx.done;
  }

  async exportReport(products: Product[], _format: 'csv' | 'xlsx'): Promise<Blob> {
    await this.simulateLatency();

    if (products.length === 0) {
      throw new Error("400 Bad Request: No data to export");
    }

    const headers = ['ID', 'Grade', 'Manufacturer', 'Category', 'Updated'];
    const allPropKeys = new Set<string>();
    products.forEach(p => Object.keys(p.properties).forEach(k => allPropKeys.add(k)));
    const propKeys = Array.from(allPropKeys);
    
    const allHeaders = [...headers, ...propKeys].join(',');

    const rows = products.map(p => {
      const basic = [
        p.id, 
        p.gradeName, 
        p.manufacturer, 
        p.categoryIds.join('|'), 
        p.updatedAt
      ];
      
      const formatCsvValue = (val: unknown) => {
        const s = String(val ?? '');
        if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      };

      const props = propKeys.map(k => formatCsvValue(p.properties[k]?.value));
      return [...basic.map(formatCsvValue), ...props].join(',');
    });

    const csvContent = [allHeaders, ...rows].join('\n');
    return new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  }

  async restoreSnapshot(products: Product[]): Promise<void> {
    await this.simulateLatency();
    const db = await this.getDB();
    const tx = db.transaction('products', 'readwrite');
    await tx.store.clear();
    for (const p of products) {
      await tx.store.add(p);
    }
    await tx.done;
  }
}
