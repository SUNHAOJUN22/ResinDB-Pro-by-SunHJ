import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ refresh: vi.fn(async () => undefined), translate: (key: string, fallback?: string) => fallback ?? key }));
vi.mock('@/contexts/DataContext', () => ({ useData: () => ({ formulas: [], togglePin: vi.fn(), refreshData: state.refresh, isRefreshing: false }) }));
vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ t: state.translate, tProp: state.translate, language: 'en' }) }));
vi.mock('@/contexts/ToastContext', () => ({ useToasts: () => ({ addToast: vi.fn() }) }));
vi.mock('@/contexts/ModalContext', () => ({ useModals: () => ({ openModals: new Set(), viewingProduct: null, analyzingProduct: null }) }));
vi.mock('@/hooks/workers/useDataGridWorker', () => ({ useDataGridWorker: () => ({ sortedData: [], sortConfig: [], topsisTop3Ids: [] }) }));
vi.mock('@/hooks/workers/useParetoWorker', () => ({ useParetoWorker: () => ({ paretoFrontIds: new Set() }) }));
vi.mock('@/hooks/math/useMahalanobis', () => ({ useMahalanobisWorker: () => ({ outlierResults: [] }) }));
import { DataGrid } from '@/components/features/DataGrid/DataGrid';

afterEach(cleanup);
it('the grid refresh button invokes the actual catalog refresh entry point', () => {
  render(<DataGrid data={[]} columns={[]} isLoading={false} onDelete={vi.fn()} onUpdate={vi.fn()} onBatchUpdate={vi.fn()} onCategorySelect={vi.fn()} onViewDetails={vi.fn()} selectedIds={new Set()} onSelectionChange={vi.fn()} />);
  fireEvent.click(screen.getByTitle('refreshData'));
  expect(state.refresh).toHaveBeenCalledOnce();
});
