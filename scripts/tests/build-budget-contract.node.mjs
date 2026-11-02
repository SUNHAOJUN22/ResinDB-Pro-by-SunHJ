import assert from 'node:assert/strict';
import test from 'node:test';
import { assertStartupEntryIsolation, assertVendorChunkIsolation, initialJavaScriptBudget, initialJavaScriptFiles } from '../lib/build-budget.mjs';
const manifest = {
  'index.html': { isEntry: true, file: 'assets/index.js', imports: ['react', 'shared'], dynamicImports: ['report'] },
  react: { file: 'assets/react.js', imports: ['shared'] },
  shared: { file: 'assets/shared.js', imports: ['react'] },
  report: { file: 'assets/report.js' },
};
const rows = ['index', 'react', 'shared', 'report'].map(name => ({ file: `assets/${name}.js`, gzipBytes: 100 }));
test('counts transitive imports once, terminates cycles and excludes dynamic tools', () => {
  assert.deepEqual(initialJavaScriptFiles(manifest), ['assets/index.js', 'assets/react.js', 'assets/shared.js']);
  assert.equal(initialJavaScriptBudget(manifest, rows).gzipBytes, 300);
});
test('rejects missing and incomplete manifests rather than counting entry only', () => {
  for (const data of [null, {}, { ...manifest, shared: undefined }, { ...manifest, 'index.html': { file: 'assets/index.js' } }]) {
    assert.throws(() => initialJavaScriptFiles(data));
  }
});
test('rejects missing, Boolean and invalid compressed sizes', () => {
  for (const value of [null, undefined, NaN, Infinity, true, -1, 0, '100']) {
    assert.throws(() => initialJavaScriptBudget(manifest, rows.map(row => row.file.endsWith('shared.js') ? { ...row, gzipBytes: value } : row)));
  }
});
test('does not silently ignore duplicate metrics or unresolved imports', () => {
  assert.throws(() => initialJavaScriptBudget(manifest, [...rows, rows[0]]));
  assert.throws(() => initialJavaScriptFiles({ ...manifest, react: { file: 'assets/react.js', imports: ['absent'] } }));
});
test('rejects traversal and external manifest paths', () => {
  for (const file of ['../other.js', '/assets/shared.js', 'https://example.com/a.js', 'assets\\shared.js']) {
    assert.throws(() => initialJavaScriptFiles({ ...manifest, shared: { file } }));
  }
});

test('rejects self-import and vendor-to-entry startup back edges', () => {
  for (const data of [
    { ...manifest, 'index.html': { ...manifest['index.html'], imports: ['index.html'] } },
    { ...manifest, shared: { ...manifest.shared, imports: ['index.html'] } },
    { ...manifest, shared: { file: 'assets/index.js' } },
  ]) assert.throws(() => assertStartupEntryIsolation(data), /imports application entry/);
});
test('permits shared vendor cycles and lazy tools without an entry back edge', () => {
  assert.doesNotThrow(() => assertStartupEntryIsolation(manifest));
  assert.doesNotThrow(() => assertStartupEntryIsolation({ ...manifest,
    report: { file: 'assets/report.js', imports: ['index.html'] },
  }));
});

test('rejects vendor dependencies on direct or indirect lazy application registration', () => {
  const chunks = {
    'index.html': { isEntry: true, file: 'assets/index.js' },
    chart: { name: 'echarts-core', file: 'assets/echarts-core.js', imports: ['helpers'] },
    helpers: { file: 'assets/helpers.js' },
    registration: { isDynamicEntry: true, file: 'assets/registration.js', imports: ['chart'] },
  };
  for (const dependency of ['registration', 'index.html']) {
    assert.throws(() => assertVendorChunkIsolation({ ...chunks,
      chart: { ...chunks.chart, imports: [dependency] },
    }), /Vendor chunk imports application module/);
    assert.throws(() => assertVendorChunkIsolation({ ...chunks,
      helpers: { ...chunks.helpers, imports: [dependency] },
    }), /Vendor chunk imports application module/);
  }
});

test('permits helper-only vendor cycles and rejects incomplete vendor closures', () => {
  const chunks = {
    chart: { name: 'echarts-core', file: 'assets/echarts-core.js', imports: ['helpers'] },
    helpers: { file: 'assets/helpers.js', imports: ['chart'] },
    registration: { isDynamicEntry: true, file: 'assets/registration.js', imports: ['chart'] },
  };
  assert.doesNotThrow(() => assertVendorChunkIsolation(chunks));
  for (const data of [null, [], {}, { ...chunks, alias: { ...chunks.chart } }]) {
    assert.throws(() => assertVendorChunkIsolation(data));
  }
  assert.throws(() => assertVendorChunkIsolation({ ...chunks,
    helpers: { ...chunks.helpers, imports: ['absent'] },
  }), /Missing static import/);
});
