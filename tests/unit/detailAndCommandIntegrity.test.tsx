import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ProductDetailDrawer } from '@/components/features/Product/ProductDetailDrawer';
import { CommandPalette } from '@/components/features/Navigation/CommandPalette';
import { ShortcutsModal } from '@/components/modals/ShortcutsModal';
import type { Product } from '@/types/index';

vi.mock('@/contexts/DataContext', () => ({ useData: () => ({
  recentSearches: [], setSearchQuery: vi.fn(), setAdvancedFilterGroup: vi.fn(), setSelectedCategoryIds: vi.fn(),
}) }));
vi.mock('@/contexts/UIContext', () => ({ useUI: () => ({ clickFeedbackEnabled: false, setClickFeedbackEnabled: vi.fn() }) }));
vi.mock('@/lib/echarts', () => ({ getInstanceByDom: () => undefined, init: () => ({ setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn(), clear: vi.fn() }) }));
vi.mock('@/components/charts/SimilarProductsRadar', () => ({ SimilarProductsRadar: () => null }));
vi.mock('@/components/charts/DegradationSimulator', () => ({ DegradationSimulator: () => null }));
vi.mock('@/components/features/Export/PdfReportTemplate', () => ({ PdfReportTemplate: () => null }));

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('resindb-language', 'en');
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const switchLanguage = (language: 'zh' | 'en') => act(() => {
  window.dispatchEvent(new CustomEvent('resindb-language-change', { detail: language }));
});

describe('record provenance and command navigation', () => {
  it('shows the selected record metadata without inventing operators or approval events', async () => {
    const product: Product = {
      id: 'record-without-audit-events', gradeName: 'Traceable sample', manufacturer: 'Declared laboratory',
      manufacturerId: 'lab', categoryIds: [], properties: {}, createdAt: '2025-02-03', updatedAt: '2025-04-05',
    };
    render(<LanguageProvider><ProductDetailDrawer isOpen product={product} onClose={vi.fn()} onCategoryClick={vi.fn()} /></LanguageProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'History', exact: true }));
    const history = await screen.findByTestId('product-record-history');
    expect(within(history).getByText(product.createdAt)).toBeTruthy();
    expect(within(history).getByText(product.updatedAt)).toBeTruthy();
    expect(history.textContent).toContain('does not provide verifiable audit events');
    expect(history.textContent).not.toMatch(/@|2026-03-25|2026-04-02|审核并通过/);
    switchLanguage('zh');
    expect(history.textContent).toContain('未提供可核验的逐条审计事件');
    expect(history.textContent).not.toContain('Stored record timestamps');
  });

  it.each(['ArrowDown', 'ArrowUp'])('recovers keyboard selection after %s on an empty result set', (key) => {
    const navigate = vi.fn(), close = vi.fn();
    render(<LanguageProvider><CommandPalette isOpen onClose={close} onNavigate={navigate}
      onToggleTheme={vi.fn()} onOpenProfile={vi.fn()} onOpenHelp={vi.fn()} onOpenFeedback={vi.fn()}
      onOpenAdmin={vi.fn()} products={[]} manufacturers={[]} onViewProduct={vi.fn()} /></LanguageProvider>);
    const search = screen.getByPlaceholderText('Search commands or features...');
    fireEvent.change(search, { target: { value: 'no-matching-command-9f4a' } });
    fireEvent.keyDown(window, { key });
    fireEvent.change(search, { target: { value: '' } });
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(navigate).toHaveBeenCalledWith('dashboard');
    expect(close).toHaveBeenCalledOnce();
  });

  it('localizes shortcut descriptions and the close control reactively', () => {
    render(<LanguageProvider><ShortcutsModal isOpen onClose={vi.fn()} /></LanguageProvider>);
    expect(screen.getByText('Focus search')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Close shortcuts' })).toBeTruthy();
    switchLanguage('zh');
    expect(screen.getByText('聚焦搜索框')).toBeTruthy();
    expect(screen.getByRole('button', { name: '关闭快捷键' })).toBeTruthy();
    expect(screen.queryByText('Focus search')).toBeNull();
  });
});
