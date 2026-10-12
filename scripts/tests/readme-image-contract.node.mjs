import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { localImageTargets, validateImageInventory } from '../readme-image-contract.mjs';

test('Markdown and HTML local images are checked together, excluding remote badges', () => {
  assert.deepEqual(localImageTargets('![zh](docs/zh.svg) <img src="docs/en.svg"> ![CI](https://example.org/badge.svg)'),
    ['docs/zh.svg', 'docs/en.svg']);
});
test('the complete explicit inventory is required, including localized paths', () => {
  const root = mkdtempSync(join(tmpdir(), 'readme-images-'));
  try {
    mkdirSync(join(root, 'docs'));
    for (const language of ['zh', 'en']) writeFileSync(join(root, `docs/${language}.svg`), '<svg/>');
    const expected = ['docs/zh.svg', 'docs/en.svg'];
    const source = '![zh](docs/zh.svg) <img src="docs/en.svg">';
    assert.deepEqual(validateImageInventory(source, expected, root), expected);
    assert.throws(() => validateImageInventory('![zh](docs/zh.svg)', expected, root), /inventory/);
    assert.throws(() => validateImageInventory(source + ' ![copy](docs/zh.svg)', expected, root), /Duplicate/);
    assert.throws(() => validateImageInventory(source + ' ![extra](docs/extra.svg)', expected, root), /inventory/);
    assert.throws(() => validateImageInventory('![missing](docs/absent.svg)', ['docs/absent.svg'], root), /Missing/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test('encoded traversal, backslashes, absolute paths and data URLs are rejected', () => {
  for (const path of ['../escape.svg', '%2E%2E/escape.svg', '/etc/file.svg', 'docs\\escape.svg', 'data:image/svg+xml;base64,AA==']) {
    assert.throws(() => localImageTargets(`![x](${path})`), /Unsafe/);
  }
});
