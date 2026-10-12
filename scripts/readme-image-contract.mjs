/** Local README images are an explicit contract, not an approximate image count. */
import { existsSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';

export function localImageTargets(markdown) {
  const targets = [];
  const patterns = [/!\[[^\]]*]\(\s*<?([^\s)>]+)>?(?:\s+["'][^"']*["'])?\s*\)/g,
    /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi];
  for (const pattern of patterns) {
    for (const match of markdown.matchAll(pattern)) {
      const raw = match[1];
      if (/^https?:\/\//i.test(raw)) continue;
      const target = decodeURIComponent(raw.split(/[?#]/, 1)[0]);
      if (!target || isAbsolute(target) || /^[a-z][a-z0-9+.-]*:/i.test(target)
          || target.includes('\\') || target.split('/').some((part) => !part || part === '.' || part === '..')) {
        throw new Error(`Unsafe local README image: ${raw}`);
      }
      targets.push(target);
    }
  }
  return targets;
}

export function validateImageInventory(markdown, expected, root) {
  if (new Set(expected).size !== expected.length) throw new Error('Duplicate expected image entry');
  const targets = localImageTargets(markdown);
  if (new Set(targets).size !== targets.length) throw new Error('Duplicate local README image');
  const missing = expected.filter((target) => !targets.includes(target));
  const unexpected = targets.filter((target) => !expected.includes(target));
  if (missing.length || unexpected.length) {
    throw new Error(`README image inventory mismatch: ${JSON.stringify({ missing, unexpected })}`);
  }
  const canonicalRoot = realpathSync(root);
  for (const target of targets) {
    const path = resolve(root, target);
    if (!existsSync(path) || !statSync(path).isFile()) throw new Error(`Missing README image: ${target}`);
    const inside = relative(canonicalRoot, realpathSync(path));
    if (isAbsolute(inside) || inside === '..' || inside.startsWith(`..${sep}`)) {
      throw new Error(`README image escapes repository: ${target}`);
    }
  }
  return targets;
}
