import { admittedPropertyValue, refreshProperties, verifyPropertyQuantities } from '@/lib/propertyAdmission';
import { logger } from '@/lib/logger';
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Category, Product, ProductUpdates } from '@/types/index';
import { PRODUCT_CATALOG, CATEGORY_TREE } from '@/config/constants';
import { IProductAdapter } from "@/lib/adapters/types";
import { UniversalStorageBridge } from './UniversalStorageBridge';
import { generateId } from '@/lib/utils';
import { applyProductUpdates } from '@/lib/productMutations';
import { completeTransaction } from '@/lib/idbTransaction';

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

function collectSubcategories(node: Category, targetSet: Set<string>) {
  targetSet.add(node.id);
  node.children?.forEach(c => collectSubcategories(c, targetSet));
}

function findAndAddSubcategories(id: string, tree: Category[], targetSet: Set<string>): boolean {
  for (const node of tree) {
    if (node.id === id) {
      collectSubcategories(node, targetSet);
      return true;
    }
    if (node.children && findAndAddSubcategories(id, node.children, targetSet)) return true;
  }
  return false;
}

function formatCsvValue(val: unknown): string {
  let s = String(val ?? '');
  let prefixedForSpreadsheet = false;
  if (typeof val === 'string') {
    if (s.charCodeAt(0) <= 0x1f) {
      s = `'${s}`;
      prefixedForSpreadsheet = true;
    } else {
      const firstNonWhitespace = s.trimStart();
      if (/^[=+\-@]/u.test(firstNonWhitespace)) {
        // OWASP's Excel-oriented mitigation keeps the formula marker as text inside a quoted cell.
        s = `\t${s}`;
        prefixedForSpreadsheet = true;
      } else if (/^[＝＋－＠]/u.test(firstNonWhitespace)) {
        // Some locales recognize full-width formula markers; use a conservative text prefix.
        s = `'${s}`;
        prefixedForSpreadsheet = true;
      }
    }
  }
  if (prefixedForSpreadsheet || /[,;"\n\r\t]/u.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export class IndexedDBProductAdapter implements IProductAdapter {
  private dbPromise: Promise<IDBPDatabase<ResinDB>> | null = null;
  private cachedProducts: Product[] | null = null;
  private categoryInvertedIndex: Map<string, Set<string>> = new Map();
  private propertyIndex: Map<string, Array<{ id: string; value: number }>> = new Map();
  private indicesRebuilt: boolean = false;

  constructor() {
    // Lazy initialization happens in getDB()
  }

  private rebuildIndices(): void {
    if (!this.cachedProducts) return;
    this.categoryInvertedIndex.clear();
    this.propertyIndex.clear();

    for (const product of this.cachedProducts) {
      this.indexProduct(product);
    }
    this.sortPropertyIndices();
    this.indicesRebuilt = true;
  }

  private indexProduct(product: Product): void {
    // Index categories
    if (product.categoryIds) {
      for (const catId of product.categoryIds) {
        if (!this.categoryInvertedIndex.has(catId)) {
          this.categoryInvertedIndex.set(catId, new Set());
        }
        this.categoryInvertedIndex.get(catId)!.add(product.id);
      }
    }

    // Index numeric properties
    if (product.properties) {
      for (const [key, prop] of Object.entries(product.properties)) {
        if (prop && prop.value !== undefined && prop.value !== null) {
          const numValue = admittedPropertyValue(prop, key);
          if (numValue !== null) {
            if (!this.propertyIndex.has(key)) {
              this.propertyIndex.set(key, []);
            }
            this.propertyIndex.get(key)!.push({ id: product.id, value: numValue });
          }
        }
      }
    }
  }

  private deindexProduct(productId: string): void {
    // Remove from category index
    for (const set of this.categoryInvertedIndex.values()) {
      set.delete(productId);
    }

    // Remove from property index
    for (const arr of this.propertyIndex.values()) {
      const idx = arr.findIndex(item => item.id === productId);
      if (idx !== -1) {
        arr.splice(idx, 1);
      }
    }
  }

  private sortPropertyIndices(): void {
    for (const arr of this.propertyIndex.values()) {
      arr.sort((a, b) => a.value - b.value);
    }
  }

  private registerMutationCreate(product: Product): void {
    if (this.cachedProducts) {
      this.cachedProducts.push(product);
    }
    if (this.indicesRebuilt) {
      this.indexProduct(product);
      this.sortPropertyIndices();
    }
  }

  private registerMutationUpdate(product: Product): void {
    if (this.cachedProducts) {
      const idx = this.cachedProducts.findIndex(p => p.id === product.id);
      if (idx !== -1) {
        this.cachedProducts[idx] = product;
      } else {
        this.cachedProducts.push(product);
      }
    }
    if (this.indicesRebuilt) {
      this.deindexProduct(product.id);
      this.indexProduct(product);
      this.sortPropertyIndices();
    }
  }

  private registerMutationDelete(ids: string[]): void {
    const deletedIds = new Set(ids);
    if (this.cachedProducts) {
      this.cachedProducts = this.cachedProducts.filter(p => !deletedIds.has(p.id));
    }
    if (this.indicesRebuilt) {
      for (const id of ids) {
        this.deindexProduct(id);
      }
    }
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
      // Versioned database name preserves compatibility with the current browser schema.
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
        let labProducts: Product[] = [];
        try {
          labProducts = UniversalStorageBridge.getLabRecords().map(lab => UniversalStorageBridge.recordToProduct(lab));
        } catch (error) {
          logger.error('Failed to read initial experimental products', error);
        }
        const tx = db.transaction('products', 'readwrite');
        await completeTransaction(tx, async () => {
          for (const product of PRODUCT_CATALOG) await tx.store.add(product);
          for (const product of labProducts) await tx.store.add(product);
        });
      }
      
      return db;
    } catch (error) {
      logger.error("Failed to initialize database:", error);
      throw new Error(
        `Database connection failed: ${error instanceof Error ? error.message : "Unknown error"}. This may be caused by Private Browsing mode or insufficient disk space.`,
        { cause: error },
      );
    }
  }

  private async simulateLatency(ms?: number): Promise<void> {
    // In actual local deployment, we can set this to 0 or very low
    const isProd = import.meta.env?.PROD ?? true;
    const delay = ms ?? (isProd ? 0 : 50);
    if (delay <= 0) return;
    return new Promise((resolve) => setTimeout(resolve, delay));
  }

  async readAuthoritative(): Promise<Product[]> {
    const db = await this.getDB();
    this.cachedProducts = (await db.getAll('products')).map(product => ({
      ...product, properties: verifyPropertyQuantities(product.properties),
    }));
    this.rebuildIndices();
    // A confirmed snapshot must not share its array with incremental cache
    // maintenance or miss changes committed by another browser connection.
    return [...this.cachedProducts];
  }

  async search(query: string, categoryId: string | null): Promise<Product[]> {
    await this.simulateLatency();
    const db = await this.getDB();
    if (!this.cachedProducts) {
      this.cachedProducts = (await db.getAll('products')).map(product => ({
        ...product, properties: verifyPropertyQuantities(product.properties),
      }));
      this.rebuildIndices();
    } else if (!this.indicesRebuilt) {
      this.rebuildIndices();
    }
    
    const lowerQuery = query.toLowerCase().trim();
    
    // Resolve all sub-category IDs if categoryId is provided
    const targetCategoryIds = new Set<string>();
    if (categoryId) {
      findAndAddSubcategories(categoryId, CATEGORY_TREE, targetCategoryIds);
    }

    // QUERY PLANNER: Seek candidate product IDs via inverted index if categoryId is active
    let candidateIds: Set<string> | null = null;
    if (categoryId) {
      candidateIds = new Set<string>();
      for (const catId of targetCategoryIds) {
        const productIds = this.categoryInvertedIndex.get(catId);
        if (productIds) {
          for (const id of productIds) {
            candidateIds.add(id);
          }
        }
      }
      // If category has no items mapped, fast-bail with empty array
      if (candidateIds.size === 0) {
        return [];
      }
    }

    // Filter candidate list or complete cached catalog
    const productsToFilter = candidateIds
      ? this.cachedProducts.filter(p => candidateIds!.has(p.id))
      : this.cachedProducts;

    return productsToFilter.filter(p => {
      const matchesSearch = !lowerQuery || 
        p.gradeName.toLowerCase().includes(lowerQuery) ||
        p.manufacturer.toLowerCase().includes(lowerQuery) ||
        Object.keys(p.properties).some(k => k.toLowerCase().includes(lowerQuery));
      
      return matchesSearch;
    });
  }

  async create(product: Partial<Product>): Promise<Product> {
    await this.simulateLatency();
    
    if (!product.gradeName) {
      throw new Error("400 Bad Request: Missing gradeName");
    }

    const newProduct: Product = {
      ...product,
      id: product.id || generateId(),
      gradeName: product.gradeName,
      manufacturer: product.manufacturer || "Unknown",
      manufacturerId: product.manufacturerId || "m-unknown",
      categoryIds: product.categoryIds || [],
      properties: refreshProperties(product.properties || {}),
      updatedAt: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString().split('T')[0],
      isExperimental: product.isExperimental ?? false,
    };

    const db = await this.getDB();
    try {
      await db.add('products', newProduct);
      this.registerMutationCreate(newProduct);
      
      // Sync to UniversalStorageBridge if experimental
      if (newProduct.isExperimental) {
        try {
          const rec = UniversalStorageBridge.productToRecord(newProduct, 'my_lab');
          UniversalStorageBridge.saveLabRecord(rec);
        } catch (err) {
          logger.error("Failed to sync experimental create to storage bridge", err);
        }
      }
    } catch (e) {
      logger.error("IndexedDB Create Failed:", e);
      // If ID collision, try one more time with a different ID
      if (e instanceof Error && e.name === 'ConstraintError') {
        newProduct.id = generateId();
        await db.add('products', newProduct);
        this.registerMutationCreate(newProduct);
        
        if (newProduct.isExperimental) {
          try {
            const rec = UniversalStorageBridge.productToRecord(newProduct, 'my_lab');
            UniversalStorageBridge.saveLabRecord(rec);
          } catch (err) {
            logger.error("Failed to sync experimental collision-recreated to storage bridge", err);
          }
        }
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

    const db = await this.getDB();
    const existing = await db.get('products', product.id);
    if (!existing) throw new Error(`404 Not Found: Product ${product.id} does not exist`);
    const updatedProduct = {
      ...product,
      properties: refreshProperties(product.properties, existing.properties),
      updatedAt: new Date().toISOString().split('T')[0],
    };

    await db.put('products', updatedProduct);
    this.registerMutationUpdate(updatedProduct);

    // Sync to UniversalStorageBridge if experimental
    if (updatedProduct.isExperimental) {
      try {
        const rec = UniversalStorageBridge.productToRecord(updatedProduct, 'my_lab');
        UniversalStorageBridge.saveLabRecord(rec);
      } catch (err) {
        logger.error("Failed to sync experimental update to storage bridge", err);
      }
    }
    
    return updatedProduct;
  }

  async batchUpdate(ids: string[], updates: ProductUpdates): Promise<void> {
    await this.simulateLatency();
    if (!ids.length) return;
    const db = await this.getDB();
    const tx = db.transaction('products', 'readwrite');
    const updated: Product[] = [];
    await completeTransaction(tx, async () => {
      for (const id of new Set(ids)) {
        const product = await tx.store.get(id);
        if (!product) throw new Error(`404 Not Found: Product ${id} does not exist`);
        const saved = applyProductUpdates(product, updates);
        await tx.store.put(saved);
        updated.push(saved);
      }
    });
    for (const product of updated) {
      this.registerMutationUpdate(product);
      if (product.isExperimental) {
        try { UniversalStorageBridge.saveLabRecord(UniversalStorageBridge.productToRecord(product, 'my_lab')); }
        catch (error) { logger.error('Lab mirror failed after batch update commit', error); }
      }
    }
  }

  async batchCreate(products: Partial<Product>[]): Promise<Product[]> {
    await this.simulateLatency();
    if (!products.length) return [];

    const db = await this.getDB();
    const tx = db.transaction('products', 'readwrite');
    const createdProducts: Product[] = [];

    const now = new Date().toISOString().split('T')[0];

    await completeTransaction(tx, async () => {
      for (const p of products) {
        const newProduct: Product = {
          ...p,
          id: p.id || generateId(),
          gradeName: p.gradeName || "New Product",
          manufacturer: p.manufacturer || "Unknown",
          manufacturerId: p.manufacturerId || "m-unknown",
          categoryIds: p.categoryIds || [],
          properties: refreshProperties(p.properties || {}),
          updatedAt: now,
          createdAt: now,
          isExperimental: p.isExperimental ?? false,
        };

        await tx.store.add(newProduct);
        createdProducts.push(newProduct);
      }
    });
    // A failed transaction must not publish lab mirrors or cache entries.
    for (const product of createdProducts.filter(product => product.isExperimental)) {
      try { UniversalStorageBridge.saveLabRecord(UniversalStorageBridge.productToRecord(product, 'my_lab')); }
      catch (error) { logger.error('Lab mirror failed after batch create commit', error); }
    }


    // Update cache and indices in bulk
    for (const product of createdProducts) {
      if (this.cachedProducts) {
        this.cachedProducts.push(product);
      }
      if (this.indicesRebuilt) {
        this.indexProduct(product);
      }
    }
    if (this.indicesRebuilt) {
      this.sortPropertyIndices();
    }
    
    return createdProducts;
  }

  async importRecords(products: Product[]): Promise<Product[]> {
    await this.simulateLatency();
    if (!products.length) return [];
    const ids = new Set<string>();
    for (const product of products) {
      if (!product.id || !product.gradeName.trim() || ids.has(product.id)) throw new Error('DUPLICATE_OR_MISSING_IMPORT_IDENTITY');
      ids.add(product.id);
    }
    const db = await this.getDB();
    const tx = db.transaction('products', 'readwrite');
    const imported: Product[] = [];
    await completeTransaction(tx, async () => {
      for (const product of products) {
        const previous = await tx.store.get(product.id);
        const saved: Product = {
          ...product,
          createdAt: previous?.createdAt ?? product.createdAt,
          updatedAt: new Date().toISOString().split('T')[0],
          properties: refreshProperties(product.properties, previous?.properties),
        };
        await tx.store.put(saved);
        imported.push(saved);
      }
    });
    if (this.cachedProducts) {
      const replacements = new Map(imported.map(product => [product.id, product]));
      this.cachedProducts = [...this.cachedProducts.filter(product => !replacements.has(product.id)), ...imported];
      this.rebuildIndices();
    }
    // Secondary lab mirroring happens only after the main transaction commits.
    for (const product of imported.filter(product => product.isExperimental)) {
      try { UniversalStorageBridge.saveLabRecord(UniversalStorageBridge.productToRecord(product, 'my_lab')); }
      catch (error) { logger.error('Lab mirror failed after import commit', error); }
    }
    return imported;
  }

  async delete(ids: string[]): Promise<void> {
    await this.simulateLatency();
    
    if (!ids.length) throw new Error("400 Bad Request: No IDs provided");
    
    const db = await this.getDB();
    const tx = db.transaction('products', 'readwrite');
    await completeTransaction(tx, async () => {
      for (const id of ids) await tx.store.delete(id);
    });
    // A failed transaction rolls back IndexedDB changes; mirror only after commit.
    for (const id of ids) {
      try {
        UniversalStorageBridge.deleteLabRecord(id);
      } catch (err) {
        logger.error("Failed to sync delete to storage bridge", err);
      }
    }
    this.registerMutationDelete(ids);
  }

  async exportReport(products: Product[], format: 'csv' | 'json' | 'xml'): Promise<Blob> {
    await this.simulateLatency();

    if (products.length === 0) {
      throw new Error("400 Bad Request: No data to export");
    }

    if (format === 'json') {
      const jsonContent = JSON.stringify(products, null, 2);
      return new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    }

    const xml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]!);
    if (format === 'xml') {
      const xmlContent = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<Products>',
        ...products.map(p => {
          const props = Object.entries(p.properties)
            .map(([k, v]) => `      <Property name="${xml(k)}" value="${xml(v.value)}" unit="${xml(v.unit)}"><Metadata>${xml(JSON.stringify(v))}</Metadata></Property>`)
            .join('\n');
          return `  <Product id="${xml(p.id)}">
    <GradeName>${xml(p.gradeName)}</GradeName>
    <Manufacturer>${xml(p.manufacturer)}</Manufacturer>
    <Categories>${xml(p.categoryIds.join(','))}</Categories>
    <UpdatedAt>${xml(p.updatedAt)}</UpdatedAt>
    <Governance>${xml(JSON.stringify(p.governance ?? null))}</Governance>
    <Properties>
${props}
    </Properties>
  </Product>`;
        }),
        '</Products>'
      ].join('\n');
      return new Blob([xmlContent], { type: 'application/xml;charset=utf-8;' });
    }

    const headers = ['ID', 'Grade', 'Manufacturer', 'Category', 'Updated'];
    const allPropKeys = new Set<string>();
    products.forEach(p => Object.keys(p.properties).forEach(k => allPropKeys.add(k)));
    const propKeys = Array.from(allPropKeys);
    
    const allHeaders = [...headers, ...propKeys, 'GovernanceJSON', 'PropertiesJSON', 'RecordJSON'].map(formatCsvValue).join(',');

    const rows = products.map(p => {
      const basic = [
        p.id, 
        p.gradeName, 
        p.manufacturer, 
        p.categoryIds.join('|'), 
        p.updatedAt
      ];
      const props = propKeys.map(k => formatCsvValue(p.properties[k]?.value));
      return [...basic.map(formatCsvValue), ...props, ...[p.governance ?? null, p.properties, p].map(value => formatCsvValue(JSON.stringify(value)))].join(',');
    });

    const csvContent = [allHeaders, ...rows].join('\n');
    return new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  }

  async restoreSnapshot(products: Product[]): Promise<void> {
    await this.simulateLatency();
    const db = await this.getDB();
    const tx = db.transaction('products', 'readwrite');
    await completeTransaction(tx, async () => {
      await tx.store.clear();
      for (const product of products) await tx.store.add(product);
    });
    this.cachedProducts = products.map(product => ({
      ...product, properties: verifyPropertyQuantities(product.properties),
    }));
    this.rebuildIndices();
  }
}
