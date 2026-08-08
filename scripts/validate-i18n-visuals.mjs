#!/usr/bin/env node

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const ARTIFACT_ROOT = join(ROOT, 'artifacts');
const TEXT_EXTENSIONS = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.svg',
  '.ts',
  '.tsx',
  '.txt',
  '.yaml',
  '.yml',
]);
const SCAN_ROOTS = ['src', 'scripts', 'docs', 'data', 'schemas'];
const EXCLUDED_DIRECTORIES = new Set([
  '.git',
  'artifacts',
  'coverage',
  'dist',
  'node_modules',
]);
const MOJIBAKE_PATTERN = /\uFFFD|\u00C3[\u0080-\u00BF]|\u00C2[\u0080-\u00BF]|\u00E2[\u0080-\u00BF]{1,2}|\u00F0\u0178|\u00EF\u00BB\u00BF|\u951F\u65A4\u62F7/u;
const HAN_PATTERN = /\p{Script=Han}/u;
const CJK_FONT_PATTERN = /Noto Sans (?:SC|CJK)|Microsoft YaHei|PingFang SC|WenQuanYi Micro Hei/u;
const REQUIRED_LOCALIZED_KEYS = [
  'chart_feature_importance',
  'desc_feature_importance',
  'materialDurabilityForecast',
  'predictiveTrends',
  'resinCapacityForecast',
  'sysHealthNoEvents',
  'sysHealthSubtitle',
];

const failures = [];
const warnings = [];

function repositoryPath(path) {
  return relative(ROOT, path).split(sep).join('/');
}

function walk(directory) {
  if (!existsSync(directory)) return [];
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && EXCLUDED_DIRECTORIES.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(path));
    else files.push(path);
  }
  return files.sort();
}

function hasForbiddenControlCharacter(value) {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint === undefined) continue;
    if (
      (codePoint >= 0 && codePoint <= 8)
      || codePoint === 11
      || codePoint === 12
      || (codePoint >= 14 && codePoint <= 31)
      || codePoint === 127
    ) {
      return true;
    }
  }
  return false;
}

function readUtf8(path) {
  const bytes = readFileSync(path);
  const text = bytes.toString('utf8');
  const label = repositoryPath(path);
  if (text.includes('\uFFFD')) failures.push(`${label}: invalid UTF-8 replacement character`);
  if (MOJIBAKE_PATTERN.test(text)) failures.push(`${label}: probable mojibake sequence`);
  if (hasForbiddenControlCharacter(text)) failures.push(`${label}: forbidden control character`);
  if (text.charCodeAt(0) === 0xfeff) warnings.push(`${label}: UTF-8 BOM present`);
  return text;
}

function propertyName(node) {
  if (ts.isIdentifier(node) || ts.isStringLiteralLike(node) || ts.isNumericLiteral(node)) {
    return node.text;
  }
  return null;
}

function exportedLocaleMap(path, variableName) {
  const sourceText = readUtf8(path);
  const source = ts.createSourceFile(
    repositoryPath(path),
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  let rootObject = null;
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name)
        && declaration.name.text === variableName
        && declaration.initializer
        && ts.isObjectLiteralExpression(declaration.initializer)
      ) {
        rootObject = declaration.initializer;
      }
    }
  }
  if (!rootObject) {
    failures.push(`${repositoryPath(path)}: ${variableName} object was not found`);
    return { zh: new Map(), en: new Map() };
  }

  const output = { zh: new Map(), en: new Map() };
  for (const localeProperty of rootObject.properties) {
    if (!ts.isPropertyAssignment(localeProperty)) continue;
    const locale = propertyName(localeProperty.name);
    if (
      (locale !== 'zh' && locale !== 'en')
      || !ts.isObjectLiteralExpression(localeProperty.initializer)
    ) {
      continue;
    }
    for (const entry of localeProperty.initializer.properties) {
      if (!ts.isPropertyAssignment(entry)) continue;
      const key = propertyName(entry.name);
      if (!key) continue;
      if (!ts.isStringLiteralLike(entry.initializer)) {
        failures.push(
          `${repositoryPath(path)}: ${variableName}.${locale}.${key} must be a string literal`,
        );
        continue;
      }
      output[locale].set(key, entry.initializer.text.normalize('NFC'));
    }
  }
  return output;
}

function validateLocaleMaps() {
  const translations = exportedLocaleMap(join(ROOT, 'src/config/i18n.ts'), 'translations');
  const overrides = exportedLocaleMap(
    join(ROOT, 'src/config/scientificUiOverrides.ts'),
    'scientificUiOverrides',
  );
  const zhKeys = [...translations.zh.keys()].sort();
  const enKeys = [...translations.en.keys()].sort();
  const missingEnglish = zhKeys.filter((key) => !translations.en.has(key));
  const missingChinese = enKeys.filter((key) => !translations.zh.has(key));
  if (missingEnglish.length) {
    failures.push(`translations.en missing keys: ${JSON.stringify(missingEnglish)}`);
  }
  if (missingChinese.length) {
    failures.push(`translations.zh missing keys: ${JSON.stringify(missingChinese)}`);
  }

  const overrideZhKeys = [...overrides.zh.keys()].sort();
  const overrideEnKeys = [...overrides.en.keys()].sort();
  if (JSON.stringify(overrideZhKeys) !== JSON.stringify(overrideEnKeys)) {
    failures.push('scientificUiOverrides zh/en key sets differ');
  }

  const effectiveZh = new Map([...translations.zh, ...overrides.zh]);
  const effectiveEn = new Map([...translations.en, ...overrides.en]);
  for (const key of REQUIRED_LOCALIZED_KEYS) {
    const zh = effectiveZh.get(key) ?? '';
    const en = effectiveEn.get(key) ?? '';
    if (!HAN_PATTERN.test(zh)) failures.push(`${key}: Chinese UI value lacks Chinese text`);
    if (HAN_PATTERN.test(en)) failures.push(`${key}: English UI value leaks Chinese text`);
    if (MOJIBAKE_PATTERN.test(zh) || MOJIBAKE_PATTERN.test(en)) {
      failures.push(`${key}: localized UI value contains mojibake`);
    }
  }

  return {
    translationKeys: zhKeys.length,
    overrideKeys: overrideZhKeys.length,
    requiredLocalizedKeys: REQUIRED_LOCALIZED_KEYS.length,
  };
}

function readmeLocalImages() {
  const readmePaths = ['README.md', 'README.zh-CN.md', 'README.en.md'];
  return readmePaths.flatMap((relativePath) => {
    const readme = readUtf8(join(ROOT, relativePath));
    const markdownTargets = [...readme.matchAll(/!\[[^\n]*?\]\(([^)\n]+)\)/gu)]
      .map((match) => match[1]);
    const htmlTargets = [...readme.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/giu)]
      .map((match) => match[1]);
    return [...markdownTargets, ...htmlTargets]
      .map((target) => target.trim().split(/[?#]/u, 1)[0])
      .filter((target) => target && !/^(?:https?:|data:)/u.test(target));
  });
}

function validateSvg(path) {
  const text = readUtf8(path);
  const label = repositoryPath(path);
  if (!/<svg\b/u.test(text)) failures.push(`${label}: SVG root is missing`);
  if (!/\bviewBox=/u.test(text)) failures.push(`${label}: SVG viewBox is missing`);
  if (!/<title(?:\s|>)/u.test(text)) failures.push(`${label}: accessible title is missing`);
  if (!/<desc(?:\s|>)/u.test(text)) failures.push(`${label}: accessible description is missing`);
  if (HAN_PATTERN.test(text) && !CJK_FONT_PATTERN.test(text)) {
    failures.push(`${label}: CJK text lacks an explicit CJK font fallback`);
  }
  if (/<script\b|javascript:/iu.test(text)) {
    failures.push(`${label}: active script content is forbidden`);
  }
}

function validateVisualAssets() {
  const images = readmeLocalImages();
  const unique = [...new Set(images)].sort();
  for (const target of unique) {
    const path = resolve(ROOT, target);
    if (!path.startsWith(ROOT + sep) || !existsSync(path)) {
      failures.push(`README image target missing or unsafe: ${target}`);
      continue;
    }
    if (extname(path).toLowerCase() === '.svg') validateSvg(path);
  }
  return {
    readmeLocalImages: images.length,
    uniqueReadmeLocalImages: unique.length,
    readmeSvgImages: unique.filter((target) => extname(target).toLowerCase() === '.svg').length,
  };
}

const textFiles = [
  ...SCAN_ROOTS.flatMap((directory) => walk(join(ROOT, directory))),
  join(ROOT, 'README.md'),
  join(ROOT, 'README.zh-CN.md'),
  join(ROOT, 'README.en.md'),
  join(ROOT, 'package.json'),
].filter((path) => TEXT_EXTENSIONS.has(extname(path).toLowerCase()));
for (const path of [...new Set(textFiles)].sort()) readUtf8(path);

const localeMetrics = validateLocaleMaps();
const visualMetrics = validateVisualAssets();
const report = {
  schemaVersion: 'resindb-i18n-visual-audit-1.0.0',
  scannedTextFiles: [...new Set(textFiles)].length,
  ...localeMetrics,
  ...visualMetrics,
  warnings,
  failures,
  acceptance: failures.length ? 'FAIL' : 'PASS',
};
mkdirSync(ARTIFACT_ROOT, { recursive: true });
writeFileSync(
  join(ARTIFACT_ROOT, 'i18n-visual-audit.json'),
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(JSON.stringify(report, null, 2));
if (failures.length) {
  throw new Error(`i18n and visual integrity audit failed:\n${failures.join('\n')}`);
}
