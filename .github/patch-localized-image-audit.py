from __future__ import annotations

from pathlib import Path

path = Path('scripts/validate-i18n-visuals.mjs')
source = path.read_text(encoding='utf-8')
old = r'''function readmeLocalImages() {
  const readmePaths = ['README.md', 'README.zh-CN.md', 'README.en.md'];
  return readmePaths.flatMap((relativePath) => {
    const readme = readUtf8(join(ROOT, relativePath));
    return [...readme.matchAll(/!\[[^\n]*?\]\(([^)\n]+)\)/gu)]
      .map((match) => match[1].trim().split(/[?#]/u, 1)[0])
      .filter((target) => target && !/^(?:https?:|data:)/u.test(target));
  });
}
'''
new = r'''function readmeLocalImages() {
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
'''
if source.count(old) != 1:
    raise SystemExit(f'localized README image scanner anchor count={source.count(old)}')
path.write_text(source.replace(old, new, 1), encoding='utf-8', newline='\n')
print('localized README image discovery now covers Markdown and HTML syntax')
