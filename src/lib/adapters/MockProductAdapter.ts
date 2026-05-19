import { Product, ProductUpdates, PropertyValue } from '@/types/index';
import { PRODUCT_CATALOG } from '@/config/constants';
import { IProductAdapter } from "@/lib/adapters/types";

const DELAY_MS = 800;

export class MockProductAdapter implements IProductAdapter {
  private products: Product[] = [...PRODUCT_CATALOG];

  private simulateLatency(ms: number = DELAY_MS): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private simulateNetworkCondition() {
    const rand = Math.random();
    if (rand > 0.99) {
      throw new Error("503 Service Unavailable: Connection timeout");
    }
  }

  async search(query: string, categoryId: string | null): Promise<Product[]> {
    await this.simulateLatency();
    this.simulateNetworkCondition();

    const lowerQuery = query.toLowerCase().trim();
    return this.products.filter(p => {
      if (categoryId && !p.categoryIds.includes(categoryId)) return false;
      if (!lowerQuery) return true;
      return (
        p.gradeName.toLowerCase().includes(lowerQuery) ||
        p.manufacturer.toLowerCase().includes(lowerQuery) ||
        Object.keys(p.properties).some(k => k.toLowerCase().includes(lowerQuery))
      );
    });
  }

  async create(product: Partial<Product>): Promise<Product> {
    await this.simulateLatency(1000);
    this.simulateNetworkCondition();

    if (!product.gradeName) {
      throw new Error("400 Bad Request: Missing gradeName");
    }

    const newProduct: Product = {
      id: product.id || `p-${Math.random().toString(36).substr(2, 9)}`,
      gradeName: product.gradeName,
      manufacturer: product.manufacturer || "Unknown",
      manufacturerId: product.manufacturerId || "m-unknown",
      categoryIds: product.categoryIds || [],
      properties: product.properties || {},
      updatedAt: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString().split('T')[0],
    };

    this.products = [newProduct, ...this.products];
    return newProduct;
  }

  async batchCreate(products: Partial<Product>[]): Promise<Product[]> {
    await this.simulateLatency();
    this.simulateNetworkCondition();
    const created: Product[] = [];
    for (const p of products) {
        created.push(await this.create(p));
    }
    return created;
  }

  async update(product: Product): Promise<Product> {
    await this.simulateLatency(1200);
    this.simulateNetworkCondition();

    if (!product.id || !product.gradeName) {
      throw new Error("400 Bad Request: Missing required fields");
    }

    const updatedProduct = {
      ...product,
      updatedAt: new Date().toISOString().split('T')[0]
    };

    this.products = this.products.map(p => p.id === product.id ? updatedProduct : p);
    return updatedProduct;
  }

  async batchUpdate(ids: string[], updates: ProductUpdates): Promise<void> {
    await this.simulateLatency(1500);
    this.simulateNetworkCondition();

    if (!ids.length) throw new Error("400 Bad Request: No IDs provided");

    const { _propertyUpdates, ...restUpdates } = updates;

    this.products = this.products.map(p => {
      if (!ids.includes(p.id)) return p;

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

      return { ...p, ...restUpdates, properties: newProperties, updatedAt: new Date().toISOString().split('T')[0] };
    });
  }

  async delete(ids: string[]): Promise<void> {
    await this.simulateLatency(1000);
    this.simulateNetworkCondition();

    if (!ids.length) throw new Error("400 Bad Request: No IDs provided");
    this.products = this.products.filter(p => !ids.includes(p.id));
  }

  async exportReport(products: Product[], _format: 'csv' | 'xlsx'): Promise<Blob> {
    await this.simulateLatency(1500);
    this.simulateNetworkCondition();

    if (products.length === 0) {
      throw new Error("400 Bad Request: No data to export");
    }

    const headers = ['ID', 'Grade', 'Manufacturer', 'Category', 'Updated'];
    const allPropKeys = new Set<string>();
    products.forEach(p => Object.keys(p.properties).forEach(k => allPropKeys.add(k)));
    const propKeys = Array.from(allPropKeys);
    
    const allHeaders = [...headers, ...propKeys].join(',');

    const rows = products.map(p => {
      const basic = [p.id, p.gradeName, p.manufacturer, p.categoryIds.join('|'), p.updatedAt];
      const props = propKeys.map(k => {
          const val = p.properties[k]?.value;
          const strVal = String(val ?? '');
          return strVal.includes(',') || strVal.includes('"') ? `"${strVal.replace(/"/g, '""')}"` : strVal;
      });
      return [...basic, ...props].join(',');
    });

    const csvContent = [allHeaders, ...rows].join('\n');
    return new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  }

  async restoreSnapshot(products: Product[]): Promise<void> {
    await this.simulateLatency(1000);
    this.products = [...products];
  }
}
