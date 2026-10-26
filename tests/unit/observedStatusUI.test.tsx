import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product, SyncEvent } from '@/types/index';

const mocks = vi.hoisted(() => ({ insight: vi.fn(), translate: (key: string, fallback?: string) => fallback ?? key }));
vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ t: mocks.translate, tProp: mocks.translate, language: 'en' }) }));
vi.mock('@/contexts/ThemeContext', () => ({ useTheme: () => ({ theme: 'light' }) }));
vi.mock('@/lib/echarts', () => ({ getInstanceByDom: () => null, init: () => ({ setOption: vi.fn(), dispose: vi.fn(), resize: vi.fn(), clear: vi.fn() }) }));
vi.mock('@/services/aiService', () => ({ getAiInsights: mocks.insight }));
vi.mock('@/components/features/Export/PdfReportTemplate', () => ({ PdfReportTemplate: () => null }));
vi.mock('@/components/charts/ScientificEChart', () => ({ ScientificEChart: () => null }));
import { DashboardStats } from '@/components/features/Dashboard/DashboardStats';
import { ProductDetailDrawer } from '@/components/features/Product/ProductDetailDrawer';
import { SystemNav } from '@/components/layout/SystemNav';
import { AdminModal } from '@/components/modals/AdminModal';

const product = (id: string): Product => ({ id, gradeName: id, manufacturer: 'Unverified source', manufacturerId: 'unknown', categoryIds: [], properties: {}, createdAt: '2026-01-01', updatedAt: '2026-01-01' });
const drawer = (row: Product) => <ProductDetailDrawer isOpen product={row} onClose={vi.fn()} onCategoryClick={vi.fn()} />;
beforeEach(() => {
  vi.resetAllMocks(); localStorage.clear();
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('displayed status follows observed events and response identity', () => {
  it('counts actual successful refresh events and does not invent cloud synchronization', () => {
    const now = Date.now();
    const events: SyncEvent[] = [{ id: '1', timestamp: now, status: 'success', message: 'Refreshed' }, { id: '2', timestamp: now, status: 'error', message: 'Failed' }];
    const view = render(<DashboardStats allProducts={[]} showSummary t={mocks.translate} syncEvents={events} />);
    expect(view.container.textContent).not.toContain('42');
    expect(view.container.textContent).not.toContain('realtimeCloudSync');
    expect(view.container.textContent).toContain('1');
  });
  it('does not display unperformed external verification on a product', () => {
    const view = render(drawer(product('sample')));
    expect(view.container.textContent).not.toContain('Data verified against PetroChina Standards Database');
  });
  it('does not attach a late AI insight to a different selected product', async () => {
    let finish!: (value: string) => void;
    mocks.insight.mockImplementationOnce(() => new Promise<string>(resolve => { finish = resolve; }));
    mocks.insight.mockResolvedValue('Current product insight');
    const view = render(drawer(product('first')));
    fireEvent.click(screen.getByRole('button', { name: 'AI' }));
    await waitFor(() => expect(mocks.insight).toHaveBeenCalledTimes(1));
    view.rerender(drawer(product('second')));
    await act(async () => { finish('Old product insight'); });
    fireEvent.click(screen.getByRole('button', { name: 'AI' }));
    await waitFor(() => expect(view.container.textContent).not.toContain('Computing'));
    expect(view.container.textContent).not.toContain('Old product insight');
    await waitFor(() => expect(mocks.insight.mock.calls.some(([rows]) => rows[0].id === 'second')).toBe(true));
  });
  it('does not invent network latency or relabel an error as synchronization', () => {
    const view = render(<SystemNav activeView="dashboard" setActiveView={vi.fn()} showAppMenu setShowAppMenu={vi.fn()} showSidebar setShowSidebar={vi.fn()} systemStatus="error" openModal={vi.fn()} t={mocks.translate} />);
    expect(view.container.textContent).not.toContain('12ms');
    expect(view.container.textContent).toContain('SYS.ERROR');
  });
  it('does not present a fabricated governance percentage as an assessment', async () => {
    const view = render(<AdminModal isOpen onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'systemInfra' }));
    await waitFor(() => expect(view.container.textContent).toContain('governance'));
    expect(view.container.textContent).not.toContain('88%');
  });
});
