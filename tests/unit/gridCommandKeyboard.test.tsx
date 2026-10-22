import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataGrid } from '@/components/features/DataGrid/DataGrid';
import { CommandPalette } from '@/components/features/Navigation/CommandPalette';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ModalProvider, useModals } from '@/contexts/ModalContext';
import type { Product } from '@/types/index';

const callbacks = vi.hoisted(() => ({ select: vi.fn(), details: vi.fn(), navigate: vi.fn(), scroll: vi.fn() }));
vi.mock('@/contexts/DataContext', () => ({ useData: () => ({
  formulas: [], togglePin: vi.fn(), recentSearches: [], setSearchQuery: vi.fn(),
  setAdvancedFilterGroup: vi.fn(), setSelectedCategoryIds: vi.fn(),
}) }));
vi.mock('@/contexts/UIContext', () => ({ useUI: () => ({ clickFeedbackEnabled: false, setClickFeedbackEnabled: vi.fn() }) }));
vi.mock('@/contexts/ToastContext', () => ({ useToasts: () => ({ addToast: vi.fn() }) }));
// This regression exercises the two real interactive components together; worker
// transport and layout measurement are outside the keyboard ownership contract.
vi.mock('@/hooks/workers/useDataGridWorker', () => ({ useDataGridWorker: ({ data }: { data: Product[] }) => ({
  sortedData: data, sortConfig: [], setSortConfig: vi.fn(), toggleSelection: callbacks.select,
  isComputing: false, useTopsis: false, setUseTopsis: vi.fn(), topsisTop3Ids: [],
}) }));
vi.mock('@/hooks/workers/useParetoWorker', () => ({ useParetoWorker: () => ({ paretoFrontIds: new Set(), computePareto: vi.fn(), isComputingPareto: false }) }));
vi.mock('@/hooks/math/useMahalanobis', () => ({ useMahalanobisWorker: () => ({ outlierResults: {}, isDetecting: false, detectOutliers: vi.fn(), clearOutliers: vi.fn() }) }));
vi.mock('@tanstack/react-virtual', () => ({ useVirtualizer: () => ({ getVirtualItems: () => [], getTotalSize: () => 0, scrollToIndex: callbacks.scroll }) }));

const products: Product[] = [{ id: 'keyboard-record', gradeName: 'Keyboard record', manufacturer: 'Test lab', manufacturerId: 'test', categoryIds: [], properties: {}, createdAt: '2026-10-21', updatedAt: '2026-10-21' }];
function Workbench() {
  const { openModal, closeModal, isModalOpen } = useModals();
  const [selectedIds, setSelectedIds] = useState(new Set<string>());
  return <>
    <button onClick={() => openModal('commandPalette')}>Open commands</button>
    <input aria-label="Unrelated text field" />
    <DataGrid data={products} columns={[]} isLoading={false} onDelete={vi.fn()} onUpdate={vi.fn()} onBatchUpdate={vi.fn()} onCategorySelect={vi.fn()} onViewDetails={callbacks.details} selectedIds={selectedIds} onSelectionChange={setSelectedIds} />
    <CommandPalette isOpen={isModalOpen('commandPalette')} onClose={() => closeModal('commandPalette')} onNavigate={callbacks.navigate} onToggleTheme={vi.fn()} onOpenProfile={vi.fn()} onOpenHelp={vi.fn()} onOpenFeedback={vi.fn()} onOpenAdmin={vi.fn()} products={products} manufacturers={[]} onViewProduct={vi.fn()} />
  </>;
}
const mount = () => render(<LanguageProvider><ModalProvider><Workbench /></ModalProvider></LanguageProvider>);
beforeEach(() => { localStorage.clear(); localStorage.setItem('resindb-language', 'en'); vi.clearAllMocks(); });
afterEach(cleanup);

describe('keyboard ownership across the real grid and command palette', () => {
  it.each(['ArrowDown', 'ArrowUp'])('runs a command after an empty result and %s without opening a grid record', async key => {
    mount();
    const grid = screen.getByRole('region', { name: 'Material data grid' });
    act(() => grid.focus());
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    expect(callbacks.scroll).toHaveBeenCalledWith(0, { align: 'auto' });
    callbacks.scroll.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Open commands' }));
    const search = screen.getByPlaceholderText('Search commands or features...');
    act(() => search.focus());
    fireEvent.change(search, { target: { value: 'no-match-98b5' } });
    fireEvent.keyDown(search, { key });
    fireEvent.change(search, { target: { value: '' } });
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(callbacks.navigate).toHaveBeenCalledWith('dashboard');
    expect(callbacks.details).not.toHaveBeenCalled();
    expect(callbacks.scroll).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByPlaceholderText('Search commands or features...')).toBeNull());
  });

  it('preserves focused-grid navigation while leaving text input and modal keys alone', () => {
    mount();
    const grid = screen.getByRole('region', { name: 'Material data grid' });
    act(() => grid.focus());
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    fireEvent.keyDown(grid, { key: ' ' });
    fireEvent.keyDown(grid, { key: 'Enter' });
    expect(callbacks.select).toHaveBeenCalledExactlyOnceWith('keyboard-record');
    expect(callbacks.details).toHaveBeenCalledExactlyOnceWith(products[0]);
    callbacks.select.mockClear(); callbacks.details.mockClear(); callbacks.scroll.mockClear();
    const input = screen.getByRole('textbox', { name: 'Unrelated text field' });
    act(() => input.focus());
    for (const key of ['ArrowDown', 'ArrowUp', ' ', 'Enter', 'Delete', 'Backspace']) {
      expect(fireEvent.keyDown(input, { key })).toBe(true);
    }
    fireEvent.click(screen.getByRole('button', { name: 'Open commands' }));
    act(() => grid.focus());
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    expect(callbacks.select).not.toHaveBeenCalled();
    expect(callbacks.details).not.toHaveBeenCalled();
    expect(callbacks.scroll).not.toHaveBeenCalled();
  });
});
