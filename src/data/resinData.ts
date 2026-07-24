import type { Category, Manufacturer, Product, Reference } from '@/types/index';
import type { MaterialRecord } from '@/lib/adapters/types';
import taxonomyDoc from './resin-taxonomy.json';
import propertyGroupsDoc from './resin-property-groups.json';
import manufacturersDoc from './resin-manufacturers.json';
import referencesDoc from './resin-references.json';
import productDoc from './polymerDatabase.json';
import labDoc from './myLabUniverse.json';
import marketDoc from './openMarketUniverse.json';
import networkDoc from './resin-network.json';
import aliasesDoc from './resin-category-aliases.json';

export interface VersionedDataDocument<T> {
  schemaVersion: string;
  dataKind: string;
  sourceType: string;
  recordStatus: 'demo' | 'reference' | 'measured' | 'imported';
  updatedAt: string;
  data: T;
}

export interface ResinNetworkNode { id: string; group: 'chemical' | 'resin'; radius?: number; desc?: string; formula?: string; cas?: string }
export interface ResinNetworkLink { source: string; target: string; value?: number }
export interface CategoryAlias { categoryId: string; canonicalName: string; aliases: string[] }

const EXPECTED_SCHEMA = '1.0.0';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateDocument<T>(raw: unknown, kind: string, validateData: (value: unknown) => value is T): VersionedDataDocument<T> {
  if (!isRecord(raw) || raw.schemaVersion !== EXPECTED_SCHEMA || raw.dataKind !== kind || !validateData(raw.data)) {
    throw new Error(`Invalid or unsupported ResinDB data document: ${kind}`);
  }
  return raw as unknown as VersionedDataDocument<T>;
}

const isArray = (value: unknown): value is unknown[] => Array.isArray(value);
const isCategoryArray = (value: unknown): value is Category[] => Array.isArray(value) && value.every((item) => isRecord(item) && typeof item.id === 'string' && typeof item.name === 'string');
const isProductArray = (value: unknown): value is Product[] => Array.isArray(value) && value.every((item) => isRecord(item) && typeof item.id === 'string' && typeof item.gradeName === 'string' && Array.isArray(item.categoryIds) && isRecord(item.properties));
const isMaterialRecordArray = (value: unknown): value is MaterialRecord[] => Array.isArray(value) && value.every((item) => isRecord(item) && typeof item.id === 'string' && typeof item.grade === 'string' && isRecord(item.properties));

function assertUniqueIds(items: Array<{ id: string }>, label: string): void {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) throw new Error(`Duplicate ${label} id: ${item.id}`);
    seen.add(item.id);
  }
}

function flattenCategories(tree: Category[], stack = new Set<string>(), out: Category[] = []): Category[] {
  for (const node of tree) {
    if (stack.has(node.id)) throw new Error(`Category cycle detected at ${node.id}`);
    stack.add(node.id);
    out.push(node);
    if (node.children) flattenCategories(node.children, stack, out);
    stack.delete(node.id);
  }
  return out;
}

const fallbackProducts: Product[] = [
  {
    id: 'demo-fallback-hdpe', gradeName: 'HDPE Demo Fallback', manufacturerId: 'demo-manufacturer', manufacturer: 'Demo dataset',
    categoryIds: ['root_plastic', 'cat_pe', 'sub_hdpe'], createdAt: '2026-07-24', updatedAt: '2026-07-24',
    properties: { 密度: { value: 0.95, unit: 'g/cm³', annotation: 'Deterministic demo fallback; not a manufacturer specification.' } },
  },
];

function safeLoad<T>(raw: unknown, kind: string, validateData: (value: unknown) => value is T, fallback: T, allowLegacyArray = false): T {
  try {
    if (allowLegacyArray && validateData(raw)) return raw;
    return validateDocument(raw, kind, validateData).data;
  } catch (error) {
    console.warn(`[ResinDB data fallback] ${kind}`, error);
    return fallback;
  }
}

export const CATEGORY_TREE = safeLoad(taxonomyDoc, 'resin-taxonomy', isCategoryArray, [] as Category[]);
const flatCategories = flattenCategories(CATEGORY_TREE);
assertUniqueIds(flatCategories, 'category');

export const PROPERTY_GROUPS = safeLoad(propertyGroupsDoc, 'resin-property-groups', (v): v is Record<string, string[]> => isRecord(v) && Object.values(v).every((x) => Array.isArray(x) && x.every((s) => typeof s === 'string')), {});
export const MANUFACTURERS = safeLoad(manufacturersDoc, 'resin-manufacturers', (v): v is Manufacturer[] => Array.isArray(v) && v.every((x) => isRecord(x) && typeof x.id === 'string' && typeof x.name === 'string'), []);
export const REFERENCES = safeLoad(referencesDoc, 'resin-references', (v): v is Reference[] => Array.isArray(v) && v.every((x) => isRecord(x) && typeof x.id === 'string' && typeof x.name === 'string'), []);
assertUniqueIds(MANUFACTURERS, 'manufacturer');
assertUniqueIds(REFERENCES, 'reference');

export const PRODUCT_CATALOG = safeLoad(productDoc, 'resin-seed-products', isProductArray, fallbackProducts, true);
assertUniqueIds(PRODUCT_CATALOG, 'product');
export const LAB_RECORDS = safeLoad(labDoc, 'laboratory-material-records', isMaterialRecordArray, [] as MaterialRecord[], true);
export const OPEN_MARKET_RECORDS = safeLoad(marketDoc, 'market-material-records', isMaterialRecordArray, [] as MaterialRecord[], true);

export const RESIN_NETWORK = safeLoad(networkDoc, 'resin-reaction-network', (v): v is { nodes: ResinNetworkNode[]; links: ResinNetworkLink[] } => isRecord(v) && isArray(v.nodes) && isArray(v.links), { nodes: [], links: [] });
export const CATEGORY_ALIASES = safeLoad(aliasesDoc, 'resin-category-aliases', (v): v is CategoryAlias[] => Array.isArray(v) && v.every((x) => isRecord(x) && typeof x.categoryId === 'string' && typeof x.canonicalName === 'string' && Array.isArray(x.aliases)), []);

export function categoryIdFromText(text: string): string {
  const normalized = text.trim().toLowerCase();
  const match = CATEGORY_ALIASES.find((entry) => entry.aliases.some((alias) => normalized === alias.toLowerCase() || normalized.includes(alias.toLowerCase())));
  return match?.categoryId ?? 'root_plastic';
}

export function categoryNameFromId(id: string): string {
  return CATEGORY_ALIASES.find((entry) => entry.categoryId === id)?.canonicalName ?? flatCategories.find((entry) => entry.id === id)?.name ?? 'Resin';
}
