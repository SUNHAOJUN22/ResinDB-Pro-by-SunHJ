/** Static Vite imports form the startup dependency closure; dynamic imports do not. */
export function initialJavaScriptFiles(manifest, entryKey = 'index.html') {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)
      || !Object.hasOwn(manifest, entryKey) || manifest[entryKey]?.isEntry !== true) {
    throw new Error('Missing Vite entry manifest');
  }
  const keys = new Set();
  const files = new Set();
  const queue = [entryKey];
  while (queue.length) {
    const key = queue.pop();
    if (keys.has(key)) continue;
    keys.add(key);
    if (!Object.hasOwn(manifest, key)) throw new Error(`Missing static import: ${key}`);
    const chunk = manifest[key];
    const file = chunk?.file;
    if (typeof file !== 'string' || !file.endsWith('.js') || file.startsWith('/')
        || file.includes('\\') || file.split('/').some(part => part === '..' || part === '')) {
      throw new Error(`Unsafe or non-JavaScript manifest chunk: ${key}`);
    }
    files.add(file);
    const imports = chunk.imports ?? [];
    if (!Array.isArray(imports) || imports.some(item => typeof item !== 'string' || !item)) {
      throw new Error(`Invalid static imports for ${key}`);
    }
    queue.push(...imports);
  }
  return [...files].sort();
}

export function initialJavaScriptBudget(manifest, rows) {
  const byFile = new Map(rows.map(row => [row.file, row]));
  if (byFile.size !== rows.length) throw new Error('Duplicate build metric files');
  const files = initialJavaScriptFiles(manifest).map(file => {
    const gzipBytes = byFile.get(file)?.gzipBytes;
    if (!Number.isSafeInteger(gzipBytes) || gzipBytes <= 0) throw new Error(`Missing compressed size: ${file}`);
    return { file, gzipBytes };
  });
  const gzipBytes = files.reduce((sum, row) => sum + row.gzipBytes, 0);
  if (!Number.isSafeInteger(gzipBytes)) throw new Error('Invalid startup size total');
  return { scope: 'entry-and-transitive-static-imports', files, gzipBytes };
}

/** Startup dependencies must not execute the app entry in order to initialize themselves. */
export function assertStartupEntryIsolation(manifest, entryKey = 'index.html') {
  // Reuse the fail-closed shape/path validation, including all reachable chunks.
  initialJavaScriptFiles(manifest, entryKey);
  const visited = new Set();
  const queue = [entryKey];
  while (queue.length) {
    const key = queue.pop();
    if (visited.has(key)) continue;
    visited.add(key);
    for (const dependency of manifest[key].imports ?? []) {
      if (dependency === entryKey || manifest[dependency].file === manifest[entryKey].file) {
        throw new Error(`Startup chunk imports application entry: ${key} -> ${dependency}`);
      }
      queue.push(dependency);
    }
  }
}
