#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_OUTPUT = resolve(ROOT, 'docs/images')
const BUNDLE_PATH = resolve(ROOT, 'scripts/readme-visuals.bundle.json')

function fail(message) {
  throw new Error(message)
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

function loadBundle() {
  const bundle = JSON.parse(readFileSync(BUNDLE_PATH, 'utf8'))
  if (bundle.schemaVersion !== 1 || bundle.encoding !== 'gzip+base64') {
    fail('Unsupported README visual bundle format')
  }
  const entries = Object.entries(bundle.files ?? {}).sort(([a], [b]) => a.localeCompare(b))
  if (entries.length !== bundle.fileCount || entries.length !== 22) {
    fail(`README visual bundle must contain 22 files; found ${entries.length}`)
  }
  return { bundle, entries }
}

function decodeEntry(filename, metadata) {
  if (!/^[a-z0-9-]+\.svg$/.test(filename) || !filename.startsWith('resindb-')) {
    fail(`Invalid bundled visual filename: ${filename}`)
  }
  const compressed = Buffer.from(metadata.gzipBase64, 'base64')
  const content = gunzipSync(compressed)
  if (content.length !== metadata.size) {
    fail(`${filename}: size mismatch in visual bundle`)
  }
  if (sha256(content) !== metadata.sha256) {
    fail(`${filename}: SHA-256 mismatch in visual bundle`)
  }
  validateSvg(content.toString('utf8'), filename)
  return content
}

function validateSvg(content, filename) {
  const required = [
    /<svg\b[^>]*\brole="img"/,
    /<svg\b[^>]*\baria-labelledby="[^"]+"/,
    /<svg\b[^>]*\bdata-design-system="resindb-uiux-pro-max-v1"/,
    /<title\b[^>]*>[^<]+<\/title>/,
    /<desc\b[^>]*>[^<]+<\/desc>/,
    /<metadata>[^<]+<\/metadata>/,
  ]
  if (!content.startsWith('<svg ') || !content.endsWith('</svg>\n')) {
    fail(`${filename}: canonical SVG envelope is invalid`)
  }
  for (const pattern of required) {
    if (!pattern.test(content)) fail(`${filename}: required accessibility/design metadata is missing`)
  }
  if (!/\bwidth="1200"/.test(content) || !/\bheight="640"/.test(content)) {
    fail(`${filename}: expected 1200 × 640 canvas`)
  }
}

function visualNames(directory) {
  if (!existsSync(directory)) return []
  return readdirSync(directory)
    .filter((name) => name.startsWith('resindb-') && name.endsWith('.svg'))
    .sort()
}

function generate(outputDirectory) {
  const { entries } = loadBundle()
  mkdirSync(outputDirectory, { recursive: true })
  const expected = new Set(entries.map(([filename]) => filename))
  for (const filename of visualNames(outputDirectory)) {
    if (!expected.has(filename)) rmSync(resolve(outputDirectory, filename))
  }
  for (const [filename, metadata] of entries) {
    const content = decodeEntry(filename, metadata)
    writeFileSync(resolve(outputDirectory, filename), content)
    console.log(`generated ${filename}`)
  }
}

function check() {
  const { entries } = loadBundle()
  const expected = entries.map(([filename]) => filename)
  const actual = visualNames(DEFAULT_OUTPUT)
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    const expectedSet = new Set(expected)
    const actualSet = new Set(actual)
    const missing = expected.filter((name) => !actualSet.has(name))
    const extra = actual.filter((name) => !expectedSet.has(name))
    fail(`visual inventory mismatch; missing=${JSON.stringify(missing)}, extra=${JSON.stringify(extra)}`)
  }
  const changed = []
  for (const [filename, metadata] of entries) {
    const canonical = decodeEntry(filename, metadata)
    const current = readFileSync(resolve(DEFAULT_OUTPUT, filename))
    if (!current.equals(canonical)) changed.push(filename)
  }
  if (changed.length) fail(`visuals are not deterministic/current: ${JSON.stringify(changed)}`)
  console.log(`validated ${entries.length} deterministic UI UX Pro Max README visuals`)
}

function parseArguments(argv) {
  let checkOnly = false
  let output = DEFAULT_OUTPUT
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--check') {
      checkOnly = true
    } else if (argument === '--output') {
      const value = argv[index + 1]
      if (!value) fail('--output requires a directory')
      output = resolve(process.cwd(), value)
      index += 1
    } else {
      fail(`Unknown argument: ${argument}`)
    }
  }
  return { checkOnly, output }
}

try {
  const { checkOnly, output } = parseArguments(process.argv.slice(2))
  if (checkOnly) check()
  else generate(output)
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
