import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { canonicalizeCoreProperty } from '@/lib/quantityRecord';
import type { Product } from '@/types/index';

const chart = vi.hoisted(() => ({ setOption: vi.fn(), dispose: vi.fn(), resize: vi.fn(), translate: (key: string, fallback?: string) => fallback ?? key }));
vi.mock('@/lib/echarts', () => ({ getInstanceByDom: () => null, init: () => chart }));
vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ t: chart.translate, tProp: chart.translate, language: 'en' }) }));
vi.mock('@/contexts/ThemeContext', () => ({ useTheme: () => ({ theme: 'light' }) }));
import { ComparisonView } from '@/components/views/ComparisonView';
import { BulkReorderModal } from '@/components/modals/BulkReorderModal';

function product(id: string, density: number, unit: string, isExperimental = false): Product {
  return { id, gradeName: id, manufacturer: 'Lab', manufacturerId: 'lab', categoryIds: [], createdAt: '2026-01-01', updatedAt: '2026-01-01', isExperimental,
    properties: { 密度: { value: density, unit, quantity: canonicalizeCoreProperty('密度', { value: density, unit }, [`sample-${id}`]) } } };
}
function mount(products: Product[]) {
  return render(<ComparisonView isOpen products={products} onClose={vi.fn()} onRemoveProduct={vi.fn()} />);
}
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('actual comparison and reorder UI uses comparable observations', () => {
  it('compares 900 kg/m³ to 0.9 g/cm³ without reporting a 99,900 percent deviation', () => {
    const view = mount([product('sample', 900, 'kg/m³', true), product('reference', 0.9, 'g/cm³')]);
    expect(view.container.textContent).not.toContain('99900.0%');
    expect(view.container.textContent).toContain('0.0%');
    expect(view.container.textContent).not.toContain('diag_perfect_fit');
  });
  it('does not manufacture missing radar axes as zero-valued physical observations', () => {
    mount([product('sample', 900, 'kg/m³', true), product('reference', 0.9, 'g/cm³')]);
    expect(chart.setOption).not.toHaveBeenCalled();
  });
  it('keeps invalid measurements out of fit percentages and best-value highlights', () => {
    const sample = product('sample', 900, 'kg/m³', true);
    sample.properties['密度'].quantity!.status = 'UNKNOWN';
    delete sample.properties['密度'].quantity!.canonical;
    const view = mount([sample, product('reference', 0.9, 'g/cm³')]);
    expect(view.container.textContent).not.toMatch(/99900\.0%|diag_perfect_fit/);
    expect(view.container.textContent).toContain('noComparison');
  });
  it('sorts real density aliases by converted values and leaves missing observations last', () => {
    const missing = { ...product('missing', 1, 'g/cm³'), properties: {} };
    const low = product('low', 900, 'kg/m³');
    const high = product('high', 1.1, 'g/cm³');
    const save = vi.fn();
    render(<BulkReorderModal isOpen selectedProducts={[missing, low, high]} onClose={vi.fn()} onSave={save} />);
    fireEvent.click(screen.getByRole('button', { name: /density/i }));
    fireEvent.click(screen.getByRole('button', { name: /save|apply/i }));
    expect(save).toHaveBeenCalledWith([{ id: 'high', priority: 1 }, { id: 'low', priority: 2 }, { id: 'missing', priority: 3 }]);
  });
});
