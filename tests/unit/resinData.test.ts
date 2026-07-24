import { describe, expect, it } from 'vitest';
import {
  CATEGORY_TREE, MANUFACTURERS, REFERENCES, PRODUCT_CATALOG,
  LAB_RECORDS, OPEN_MARKET_RECORDS, RESIN_NETWORK,
  CATEGORY_ALIASES, categoryIdFromText, categoryNameFromId,
  validateDocument,
} from '@/data/resinData';

const flatten=(nodes:any[]):any[]=>nodes.flatMap((node)=>[node,...flatten(node.children??[])]);

describe('versioned resin data assets',()=>{
  it('loads a non-empty, acyclic taxonomy with unique ids',()=>{
    const all=flatten(CATEGORY_TREE); expect(all.length).toBeGreaterThan(20);
    expect(new Set(all.map((x)=>x.id)).size).toBe(all.length);
  });
  it('loads directories and deterministic product records',()=>{
    expect(MANUFACTURERS.length).toBeGreaterThan(10);expect(REFERENCES.length).toBeGreaterThan(5);expect(PRODUCT_CATALOG.length).toBeGreaterThan(5);
    expect(new Set(PRODUCT_CATALOG.map((x)=>x.id)).size).toBe(PRODUCT_CATALOG.length);
  });
  it('loads lab and market demo records',()=>{expect(LAB_RECORDS.length).toBeGreaterThan(0);expect(OPEN_MARKET_RECORDS.length).toBeGreaterThan(0);});
  it('loads a clickable network dataset',()=>{expect(RESIN_NETWORK.nodes.length).toBeGreaterThan(10);expect(RESIN_NETWORK.links.length).toBeGreaterThan(10);});
  it('keeps category aliases outside UI code',()=>{expect(CATEGORY_ALIASES.length).toBeGreaterThan(8);expect(categoryIdFromText('random copolymer PP')).toBe('sub_pp_rand');expect(categoryNameFromId('cat_abs')).toBe('ABS');});
  it('rejects an incompatible schema version',()=>{expect(()=>validateDocument({schemaVersion:'9',dataKind:'x',data:[]},'x',(x):x is unknown[]=>Array.isArray(x))).toThrow(/Invalid or unsupported/);});
});
