import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '../..')
const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const bundle = JSON.parse(readFileSync(resolve(root, 'scripts/readme-visuals.bundle.json'), 'utf8'))

describe('stage-one Node-only tooling', () => {
  it('contains no Python scripts', () => {
    const pythonFiles = readdirSync(resolve(root, 'scripts')).filter((name) => name.endsWith('.py'))
    expect(pythonFiles).toEqual([])
  })

  it('uses Node.js for all migrated package commands', () => {
    expect(packageJson.scripts).toMatchObject({
      'visuals:bundle': 'node scripts/bundle-readme-visuals.mjs',
      'visuals:generate': 'node scripts/generate-readme-visuals.mjs',
      'visuals:check': 'node scripts/generate-readme-visuals.mjs --check',
      'validate:docs': 'node scripts/validate-repository-docs.mjs',
      'validate:source': 'node scripts/validate-source-hygiene.mjs',
    })
  })

  it('pins all 22 visual assets by size and SHA-256', () => {
    expect(bundle.fileCount).toBe(22)
    expect(Object.keys(bundle.files)).toHaveLength(22)
    for (const [name, metadata] of Object.entries<any>(bundle.files)) {
      const path = resolve(root, 'docs/images', name)
      expect(existsSync(path)).toBe(true)
      const content = readFileSync(path)
      expect(content.length).toBe(metadata.size)
      expect(createHash('sha256').update(content).digest('hex')).toBe(metadata.sha256)
    }
  })

  it('documents the stage-one implementation contract', () => {
    const taskbook = readFileSync(resolve(root, 'docs/PHASE_1_IMPLEMENTATION_TASKBOOK.md'), 'utf8')
    expect(taskbook).toContain('工具链统一与跨平台兼容基线')
    expect(taskbook).toContain('禁止创建临时开发分支和 PR')
    expect(taskbook).toContain('永久 CI 对正式 `main` 提交全绿')
  })
})
