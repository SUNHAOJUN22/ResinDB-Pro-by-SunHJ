#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const README_PATH = resolve(ROOT, 'README.md')
const PACKAGE_PATH = resolve(ROOT, 'package.json')
const VALIDATION_PATH = resolve(ROOT, 'docs/VALIDATION.md')
const IMAGE_DIR = resolve(ROOT, 'docs/images')
const DESIGN_PATH = resolve(ROOT, 'docs/README_VISUAL_DESIGN_SYSTEM.md')
const BUNDLE_PATH = resolve(ROOT, 'scripts/readme-visuals.bundle.json')
const EXPECTED = [
  'resindb-ai-platform-overview.svg', 'resindb-data-lifecycle.svg',
  'resindb-data-governance.svg', 'resindb-scientific-engine.svg',
  'resindb-worker-architecture.svg', 'resindb-formula-engine.svg',
  'resindb-structure-property.svg', 'resindb-molecular-analysis.svg',
  'resindb-rheology-model.svg', 'resindb-thermal-analysis.svg',
  'resindb-mechanical-analysis.svg', 'resindb-electrical-analysis.svg',
  'resindb-multiscale-simulation.svg', 'resindb-ai-material-discovery.svg',
  'resindb-ai-workflow.svg', 'resindb-knowledge-network.svg',
  'resindb-comparison-decision.svg', 'resindb-local-first-privacy.svg',
  'resindb-import-export.svg', 'resindb-security-deployment.svg',
  'resindb-research-workflow.svg', 'resindb-quality-gates.svg',
].sort()
const FORBIDDEN = [
  '.github/apply-final-v2.trigger', '.github/workflows/apply-final-v2.yml',
  '.github/apply-final-small.trigger', '.github/workflows/apply-final-small.yml',
  '.github/apply-final-optimization.trigger', '.github/workflows/apply-final-optimization.yml',
  '.github/diagnose-final-blobs.trigger', '.github/workflows/diagnose-final-blobs.yml',
  '.github/diagnose-original-head.trigger', '.github/workflows/diagnose-original-head.yml',
  '.github/final-source-export.trigger', '.github/workflows/final-source-export.yml',
  '.github/remediate-lockfile-20260726.trigger', '.github/workflows/remediate-lockfile-20260726.yml',
  'reports/_final_source_export', 'reports/patch-diagnostic.json', '.resindb-delete-manifest.txt',
  '.github/.resindb-final-patch', '.github/.resindb-v320-delta',
  '.github/.resindb-stage1-delta',
]
const FORBIDDEN_PATH_PATTERNS = [
  /^\.github\/\.resindb-[^/]*(?:delta|patch|transport)[^/]*(?:\/|$)/i,
]

function fail(message) { throw new Error(message) }
function sha256(content) { return createHash('sha256').update(content).digest('hex') }

function listRepositoryPaths(relativeRoot) {
  const absoluteRoot = resolve(ROOT, relativeRoot)
  if (!existsSync(absoluteRoot)) return []
  const paths = []
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = resolve(directory, entry.name)
      const repositoryPath = relative(ROOT, absolutePath).split(sep).join('/')
      paths.push(repositoryPath)
      if (entry.isDirectory()) visit(absolutePath)
    }
  }
  visit(absoluteRoot)
  return paths
}

function validateLinks(text) {
  const patterns = [/<(?:img|a)\b[^>]*(?:src|href)="([^"]+)"/gi, /!?\[[^\]]*]\(([^)]+)\)/g]
  const missing = []
  const seen = new Set()
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const raw = match[1]
      const target = raw.trim().split(/\s+/, 1)[0].replace(/^<|>$/g, '').split('#', 1)[0].split('?', 1)[0]
      if (!target || /^(https?:|mailto:|data:|#)/.test(target) || seen.has(target)) continue
      seen.add(target)
      if (!existsSync(resolve(ROOT, target))) missing.push(target)
    }
  }
  if (missing.length) fail(`README contains missing local targets: ${JSON.stringify(missing.sort())}`)
}

function validateSvg(content, name) {
  const required = [
    /<svg\b[^>]*\brole="img"/,
    /<svg\b[^>]*\baria-labelledby="[^"]+"/,
    /<svg\b[^>]*\bdata-design-system="resindb-uiux-pro-max-v1"/,
    /<title\b[^>]*>[^<]+<\/title>/,
    /<desc\b[^>]*>[^<]+<\/desc>/,
    /<metadata>[^<]+<\/metadata>/,
  ]
  for (const pattern of required) if (!pattern.test(content)) fail(`${name}: accessibility/design metadata missing`)
}

const readme = readFileSync(README_PATH, 'utf8')
const packageJson = JSON.parse(readFileSync(PACKAGE_PATH, 'utf8'))
const validation = readFileSync(VALIDATION_PATH, 'utf8')
const version = packageJson.version
if (version !== '3.2.0' || !readme.includes(`version-${version}-`) || !validation.includes(`\`${version}\``)) {
  fail('Version drift between package, README and validation contract')
}
validateLinks(readme)
const actual = readdirSync(IMAGE_DIR).filter((name) => /^resindb-.*\.svg$/.test(name)).sort()
if (JSON.stringify(actual) !== JSON.stringify(EXPECTED)) fail('Visual inventory mismatch')
const bundle = JSON.parse(readFileSync(BUNDLE_PATH, 'utf8'))
if (bundle.fileCount !== 22 || Object.keys(bundle.files ?? {}).length !== 22) fail('README visual bundle must contain 22 assets')
for (const name of EXPECTED) {
  const relativePath = `docs/images/${name}`
  if (readme.split(relativePath).length - 1 !== 1) fail(`${relativePath} must be referenced exactly once`)
  const content = readFileSync(resolve(IMAGE_DIR, name))
  validateSvg(content.toString('utf8'), name)
  const metadata = bundle.files[name]
  if (!metadata || metadata.size !== content.length || metadata.sha256 !== sha256(content)) {
    fail(`${name}: bundle metadata differs from committed SVG`)
  }
}
if (!readme.includes('22 张')) fail('README must declare the 22-diagram scientific visual system')
if (!existsSync(DESIGN_PATH) || !readFileSync(DESIGN_PATH, 'utf8').includes('UI/UX Pro Max')) fail('Visual design system document missing')
const requiredScripts = {
  'visuals:bundle': 'node scripts/bundle-readme-visuals.mjs',
  'visuals:generate': 'node scripts/generate-readme-visuals.mjs',
  'visuals:check': 'node scripts/generate-readme-visuals.mjs --check',
  'validate:docs': 'node scripts/validate-repository-docs.mjs',
  'validate:source': 'node scripts/validate-source-hygiene.mjs',
  'audit:all': 'npm audit --audit-level=high',
  'report:pdf': 'node scripts/generate-validation-pdf.mjs',
}
for (const [key, value] of Object.entries(requiredScripts)) {
  if (packageJson.scripts?.[key] !== value) fail(`package script drift: ${key}`)
}
for (const path of ['data/manifest.json', 'data/version.json', 'data/metadata.json', 'data/resins/manifest.json']) {
  if (!existsSync(resolve(ROOT, path))) fail('Governed root data contract is incomplete')
}
const discoveredPaths = [
  ...listRepositoryPaths('.github'),
  ...listRepositoryPaths('reports'),
]
const residue = [...new Set([
  ...FORBIDDEN.filter((path) => existsSync(resolve(ROOT, path))),
  ...discoveredPaths.filter((path) => FORBIDDEN_PATH_PATTERNS.some((pattern) => pattern.test(path))),
])].sort()
if (residue.length) fail(`Temporary migration/diagnostic residue remains: ${JSON.stringify(residue)}`)
const pythonFiles = readdirSync(resolve(ROOT, 'scripts')).filter((name) => name.endsWith('.py'))
if (pythonFiles.length) fail(`Stage-one Node-only tooling is incomplete: ${JSON.stringify(pythonFiles)}`)
const ci = readFileSync(resolve(ROOT, '.github/workflows/ci.yml'), 'utf8')
for (const phrase of ['branches: [main]', 'contents: read', 'npm run validate:docs', 'npm run validate:source', 'npm audit --omit=dev --audit-level=high --json', 'npm audit --audit-level=high --json', 'npm run report:pdf']) {
  if (!ci.includes(phrase)) fail(`Permanent CI missing: ${phrase}`)
}
if (ci.includes('contents: write')) fail('Permanent CI must be read-only')
if (/\bpython(?:3)?\b/i.test(ci)) fail('Permanent CI must not depend on Python')
console.log(`Validated README links, ${EXPECTED.length} deterministic scientific visuals, version ${version}, Node-only tooling, governed data contract and repository hygiene.`)
