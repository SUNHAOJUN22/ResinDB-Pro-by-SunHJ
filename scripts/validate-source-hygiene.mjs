#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, extname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE_ROOT = resolve(ROOT, 'src')
const SOURCE_SUFFIXES = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs'])
const RULES = [
  ['TypeScript suppression', /@ts-(?:ignore|nocheck)/],
  ['ESLint suppression', /eslint-disable/],
  ['dynamic HTML injection', /dangerouslySetInnerHTML/],
  ['eval execution', /(^|[^A-Za-z0-9_$])eval\s*\(/],
  ['Function constructor execution', /\bnew\s+Function\s*\(/],
  ['unfinished marker', /\b(?:TODO|FIXME|HACK)\b/],
]

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = resolve(directory, entry.name)
      return entry.isDirectory() ? walk(path) : [path]
    })
    .sort()
}

if (!statSync(SOURCE_ROOT, { throwIfNoEntry: false })?.isDirectory()) {
  throw new Error(`production source directory is missing: ${SOURCE_ROOT}`)
}

const findings = []
let scannedFiles = 0
for (const path of walk(SOURCE_ROOT)) {
  if (!SOURCE_SUFFIXES.has(extname(path))) continue
  scannedFiles += 1
  const lines = readFileSync(path, 'utf8').split(/\r?\n/)
  lines.forEach((line, index) => {
    for (const [name, pattern] of RULES) {
      if (pattern.test(line)) {
        findings.push(`${relative(ROOT, path)}:${index + 1}: ${name}: ${line.trim()}`)
      }
    }
  })
}

if (scannedFiles === 0) throw new Error('production source hygiene scanned zero source files')
if (findings.length) throw new Error(`production source hygiene failed:\n${findings.join('\n')}`)
console.log(`validated production source hygiene across ${scannedFiles} files; negative security fixtures remain test-scoped`)
