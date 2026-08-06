import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '../..')
const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))

describe('stage-one Node-only tooling', () => {
  it('contains no Python scripts', () => {
    const pythonFiles = readdirSync(resolve(root, 'scripts')).filter((name) => name.endsWith('.py'))
    expect(pythonFiles).toEqual([])
  })

  it('uses Node.js for the governed validation commands', () => {
    expect(packageJson.scripts).toMatchObject({
      'validate:docs': 'node scripts/validate-repository-docs.mjs',
      'validate:source': 'node scripts/validate-source-hygiene.mjs',
      'validate:compute': 'node scripts/validate-compute-surface.mjs',
      'validate:data': 'node scripts/validate-data.mjs',
      'report:pdf': 'node scripts/generate-validation-pdf.mjs',
    })
    expect(packageJson.scripts['visuals:bundle']).toBeUndefined()
    expect(packageJson.scripts['visuals:generate']).toBeUndefined()
    expect(packageJson.scripts['visuals:check']).toBeUndefined()

    const receiptScript = readFileSync(resolve(root, 'scripts/generate-validation-receipt.mjs'), 'utf8')
    expect(receiptScript).toContain("const branchProofRequired = context.ref === 'refs/heads/main'")
    expect(receiptScript).toContain('singleMainBranch: !branchProofRequired || branchProofValid')
  })

  it('uses eight real UI screenshots and no synthetic visual generator inventory', () => {
    const imageDirectory = resolve(root, 'docs/images')
    const screenshots = readdirSync(imageDirectory)
      .filter((name) => /^ui-.*\.png$/.test(name))
      .sort()
    const syntheticVisuals = readdirSync(imageDirectory)
      .filter((name) => /^resindb-.*\.svg$/.test(name))
    const readme = readFileSync(resolve(root, 'README.md'), 'utf8')

    expect(screenshots).toHaveLength(8)
    expect(screenshots.length).toBeLessThanOrEqual(10)
    expect(syntheticVisuals).toEqual([])
    expect(existsSync(resolve(root, 'scripts/readme-visuals.bundle.json'))).toBe(false)
    expect(existsSync(resolve(root, 'scripts/generate-readme-visuals.mjs'))).toBe(false)
    expect(existsSync(resolve(root, 'scripts/bundle-readme-visuals.mjs'))).toBe(false)

    for (const screenshot of screenshots) {
      expect(statSync(resolve(imageDirectory, screenshot)).size).toBeGreaterThan(20_000)
      expect(readme).toContain(`docs/images/${screenshot}`)
    }
  })

  it('rejects future stage-one delta transport residue', () => {
    const residueDirectory = resolve(root, '.github/.resindb-stage1-delta-test')
    mkdirSync(residueDirectory, { recursive: true })
    writeFileSync(resolve(residueDirectory, 'part-999.txt'), 'TRANSPORT_PLACEHOLDER\n', 'utf8')

    try {
      const result = spawnSync(
        process.execPath,
        [resolve(root, 'scripts/validate-repository-docs.mjs')],
        { cwd: root, encoding: 'utf8', timeout: 30_000 },
      )
      expect(result.status).not.toBe(0)
      expect(`${result.stdout}${result.stderr}`).toContain(
        'Temporary migration/diagnostic residue remains',
      )
      expect(`${result.stdout}${result.stderr}`).toContain('.resindb-stage1-delta-test')
    } finally {
      rmSync(residueDirectory, { recursive: true, force: true })
    }
  })

  it('writes machine-readable audit JSON without npm-run banner noise', () => {
    const workflow = readFileSync(resolve(root, '.github/workflows/ci.yml'), 'utf8')
    expect(workflow).toContain(
      'npm audit --omit=dev --audit-level=high --json > artifacts/npm-audit-prod.json',
    )
    expect(workflow).toContain(
      'npm audit --audit-level=high --json > artifacts/npm-audit-all.json',
    )
    expect(workflow).not.toContain('npm run audit:prod -- --json')
    expect(workflow).not.toContain('npm run audit:all -- --json')
  })

  it('documents the stage-one implementation contract', () => {
    const taskbook = readFileSync(resolve(root, 'docs/PHASE_1_IMPLEMENTATION_TASKBOOK.md'), 'utf8')
    expect(taskbook).toContain('工具链统一与跨平台兼容基线')
    expect(taskbook).toContain('禁止创建临时开发分支和 PR')
    expect(taskbook).toContain('永久 CI 对正式 `main` 提交全绿')
  })
})
