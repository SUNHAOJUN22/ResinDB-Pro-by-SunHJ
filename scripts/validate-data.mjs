import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const dataRoot = path.join(root, 'data');
const resinDir = path.join(dataRoot, 'resins');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const readJson = async (file) => { const raw=await readFile(file); return {raw,json:JSON.parse(raw.toString('utf8'))}; };
const uniqueIds = (items,label) => { const seen=new Set(); for (const item of items) { assert(isRecord(item)&&typeof item.id==='string'&&item.id,`${label} contains invalid id`); assert(!seen.has(item.id),`Duplicate ${label} id: ${item.id}`); seen.add(item.id); } return seen; };
function flatten(nodes, stack=new Set(), out=[]) { assert(Array.isArray(nodes),'Taxonomy must be an array'); for (const node of nodes) { assert(isRecord(node)&&typeof node.id==='string'&&typeof node.name==='string','Invalid taxonomy node'); assert(!stack.has(node.id),`Taxonomy cycle: ${node.id}`); stack.add(node.id); out.push(node); if (node.children!==undefined) flatten(node.children,stack,out); stack.delete(node.id); } return out; }
function envelope(doc,kind,file) { assert(isRecord(doc),`${file} must be object`); assert(doc.schemaVersion==='1.0.0',`${file} schemaVersion`); assert(doc.dataKind===kind,`${file} dataKind`); assert(typeof doc.sourceType==='string',`${file} sourceType`); assert(['demo','reference','measured','imported'].includes(doc.recordStatus),`${file} recordStatus`); assert(/^\d{4}-\d{2}-\d{2}$/.test(doc.updatedAt),`${file} updatedAt`); assert('data' in doc,`${file} data`); }

const {json:version}=await readJson(path.join(dataRoot,'version.json')); envelope(version,'resin-data-version','version.json'); assert(version.data.release==='3.2.0','Data release must be 3.2.0');
const {json:metadata}=await readJson(path.join(dataRoot,'metadata.json')); envelope(metadata,'resin-data-metadata','metadata.json');
const {json:rootManifest}=await readJson(path.join(dataRoot,'manifest.json')); envelope(rootManifest,'governed-data-manifest','manifest.json');
for (const entry of rootManifest.data.assets) { const raw=await readFile(path.join(dataRoot,entry.file)); assert(raw.byteLength===entry.bytes,`${entry.file} bytes`); assert(createHash('sha256').update(raw).digest('hex')===entry.sha256,`${entry.file} SHA-256`); }
const {json:manifest}=await readJson(path.join(resinDir,'manifest.json')); envelope(manifest,'resin-data-manifest','resins/manifest.json'); assert(manifest.data.basePath==='/data/resins','Runtime base path');
const docs=new Map();
for (const entry of manifest.data.assets) { const {raw,json}=await readJson(path.join(resinDir,entry.file)); assert(raw.byteLength===entry.bytes,`${entry.file} bytes`); assert(createHash('sha256').update(raw).digest('hex')===entry.sha256,`${entry.file} SHA-256`); envelope(json,entry.dataKind,entry.file); docs.set(entry.dataKind,json.data); }
const categories=flatten(docs.get('resin-taxonomy')); const categoryIds=uniqueIds(categories,'category'); const manufacturerIds=uniqueIds(docs.get('resin-manufacturers'),'manufacturer'); uniqueIds(docs.get('resin-references'),'reference');
const products=docs.get('resin-seed-products'); uniqueIds(products,'product'); for (const p of products) { assert(manufacturerIds.has(p.manufacturerId),`${p.id} manufacturer`); for (const id of p.categoryIds) assert(categoryIds.has(id),`${p.id} category ${id}`); assert(isRecord(p.properties)&&Object.keys(p.properties).length>=2,`${p.id} properties`); }
uniqueIds(docs.get('laboratory-material-records'),'laboratory record'); uniqueIds(docs.get('market-material-records'),'market record');
const network=docs.get('resin-reaction-network'); const nodeIds=uniqueIds(network.nodes,'network node'); for (const link of network.links) { assert(nodeIds.has(String(link.source)),`Unknown source ${link.source}`); assert(nodeIds.has(String(link.target)),`Unknown target ${link.target}`); }
for (const alias of docs.get('resin-category-aliases')) assert(categoryIds.has(alias.categoryId),`Unknown alias category ${alias.categoryId}`);
console.log(`Data validation passed: ${rootManifest.data.assets.length} governed files, ${manifest.data.assets.length} resin assets, ${categories.length} categories, ${products.length} products, ${network.nodes.length} network nodes.`);
