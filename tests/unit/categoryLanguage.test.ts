import { describe, expect, it } from 'vitest';
import taxonomy from '../../data/resins/resin-taxonomy.json';
import { categoryLabel } from '@/i18n/categoryLabels';
import { scientificUiOverrides } from '@/config/scientificUiOverrides';
import type { Category } from '@/types/index';
describe('built-in category localization', () => {
  it('localizes every built-in category without mutating stored names', () => {
    const original = JSON.stringify(taxonomy);
    const categories: Category[] = [];
    const collect = (nodes: Category[]) => nodes.forEach(node => { categories.push(node); collect(node.children ?? []); });
    collect(taxonomy.data);
    expect(categories).toHaveLength(97);
    expect(categories.every(category => !/\p{Script=Han}/u.test(categoryLabel(category, 'en')))).toBe(true);
    expect(JSON.stringify(taxonomy)).toBe(original);
  });
  it('preserves custom names and explicit English labels', () => {
    expect(categoryLabel({ id: 'cat_pe', name: '用户材料集' }, 'en')).toBe('用户材料集');
    expect(categoryLabel({ id: 'custom', name: '自定义', nameEn: 'My category' }, 'en')).toBe('My category');
  });
  it('provides monolingual English system navigation', () => {
    for (const key of ['dataPivot', 'dependencyMap', 'hideSidebar', 'showSidebar', 'dbSync']) {
      expect(scientificUiOverrides.zh[key]).toMatch(/\p{Script=Han}/u);
      expect(scientificUiOverrides.en[key]).not.toMatch(/\p{Script=Han}/u);
    }
  });
});
