#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const IMAGE_DIR = resolve(ROOT, 'docs/images')
const BUNDLE_PATH = resolve(ROOT, 'scripts/readme-visuals.bundle.json')

const names = readdirSync(IMAGE_DIR)
  .filter((name) => name.startsWith('resindb-') && name.endsWith('.svg'))
  .sort()

if (names.length !== 22) throw new Error(`Expected 22 README visuals; found ${names.length}`)

const files = {}
for (const name of names) {
  const content = readFileSync(resolve(IMAGE_DIR, name))
  files[name] = {
    gzipBase64: gzipSync(content, { level: 9, mtime: 0 }).toString('base64'),
    sha256: createHash('sha256').update(content).digest('hex'),
    size: content.length,
  }
}

const bundle = {
  schemaVersion: 1,
  designSystem: 'resindb-uiux-pro-max-v1',
  encoding: 'gzip+base64',
  fileCount: names.length,
  files,
}

writeFileSync(BUNDLE_PATH, `${JSON.stringify(bundle, null, 2)}\n`)
console.log(`bundled ${names.length} deterministic README visuals into ${BUNDLE_PATH}`)
