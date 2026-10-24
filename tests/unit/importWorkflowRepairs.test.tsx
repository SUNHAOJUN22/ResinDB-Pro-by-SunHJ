import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImportModal } from '@/components/modals/ImportModal';
import { LanguageProvider } from '@/contexts/LanguageContext';
import type { Product } from '@/types/index';
const renderImport = (onImport = vi.fn().mockResolvedValue(true), allProducts: Product[] = []) => {
  render(<LanguageProvider><ImportModal isOpen onClose={vi.fn()} onImport={onImport} allProducts={allProducts} /></LanguageProvider>);
  return onImport;
};
const manual = () => {
  fireEvent.click(screen.getByRole('button', { name: /Enter one record/ }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Grade name' }), { target: { value: 'Measured-1' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Density' }), { target: { value: '0.95' } });
  fireEvent.click(screen.getByRole('button', { name: 'Prepare one record for review' }));
};
beforeEach(() => { localStorage.clear(); localStorage.setItem('resindb-language', 'en'); });
afterEach(cleanup);

describe('actual import workflow', () => {
  it('localizes system controls in file, clipboard, and mapping stages', () => {
    renderImport();
    expect(screen.getByRole('button', { name: '📁 Upload files' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '📋 Paste a table' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Table to import' }), { target: { value: 'Grade,Manufacturer,Density (g/cm³)\nA,Lab,0.95' } });
    fireEvent.click(screen.getByRole('button', { name: 'Parse table' }));
    expect(screen.getByText('Review column mappings')).toBeTruthy();
    expect(screen.getByText('Duplicate-grade policy')).toBeTruthy();
    act(() => window.dispatchEvent(new CustomEvent('resindb-language-change', { detail: 'zh' })));
    expect(screen.getByText('检查列映射')).toBeTruthy();
    expect(screen.getByText('重复牌号处理')).toBeTruthy();
  });
  it('previews a manual record and waits for persistence before showing completion', async () => {
    let resolve!: (saved: boolean) => void;
    const onImport = vi.fn<(products: Product[]) => Promise<boolean>>(() => new Promise<boolean>(done => { resolve = done; }));
    renderImport(onImport); manual();
    expect(screen.getByText('Import preview')).toBeTruthy();
    expect(onImport).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Confirm and merge\/import/ }));
    expect(screen.getByRole('button', { name: 'Saving…' }).hasAttribute('disabled')).toBe(true);
    expect(onImport.mock.calls[0][0][0]).toMatchObject({ gradeName: 'Measured-1', governance: { sourceType: 'MEASURED', recordStatus: 'NOT_FOR_RELEASE' }, properties: { 密度: { value: 0.95, unit: 'g/cm³', quantity: { status: 'VALID' } } } });
    await act(async () => resolve(true));
    expect(screen.queryByText('Import preview')).toBeNull();
    expect(screen.getByText('Saved 1 record')).toBeTruthy();
    expect(screen.getByText('Structural checks passed; physical results are unverified.')).toBeTruthy();
    expect(screen.queryByText(/100% EXCELLENT|ENRICHED SECURELY/)).toBeNull();
    act(() => window.dispatchEvent(new CustomEvent('resindb-language-change', { detail: 'zh' })));
    expect(screen.getByText('已保存 1 条记录')).toBeTruthy();
    expect(screen.getByText('结构检查通过；物理结果未验证。')).toBeTruthy();
  });
  it('keeps the preview available after a rejected save', async () => {
    const onImport = vi.fn().mockRejectedValue(new Error('Database write rejected'));
    renderImport(onImport); manual();
    fireEvent.click(screen.getByRole('button', { name: /Confirm and merge\/import/ }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Database write rejected'));
    expect(screen.getByText('Import preview')).toBeTruthy();
  });
  it('does not silently discard a malformed manual measurement', () => {
    const onImport = renderImport();
    fireEvent.click(screen.getByRole('button', { name: /Enter one record/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Grade name' }), { target: { value: 'Measured-1' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Density' }), { target: { value: '0.95oops' } });
    fireEvent.click(screen.getByRole('button', { name: 'Prepare one record for review' }));
    expect(screen.getByText(/Numeric fields cannot contain/)).toBeTruthy();
    expect(onImport).not.toHaveBeenCalled();
    expect(screen.queryByText('Import preview')).toBeNull();
  });
  it('marks example clipboard rows synthetic and preserves missing units as unknown', async () => {
    const onImport = renderImport();
    fireEvent.click(screen.getByRole('button', { name: '📋 Paste a table' }));
    fireEvent.click(screen.getByRole('button', { name: '💡 Fill synthetic example data' }));
    fireEvent.click(screen.getByRole('button', { name: 'Parse table' }));
    fireEvent.click(screen.getByRole('button', { name: 'Prepare import preview' }));
    fireEvent.click(screen.getByRole('button', { name: /Confirm and merge\/import/ }));
    await waitFor(() => expect(onImport).toHaveBeenCalledOnce());
    expect(onImport.mock.calls[0][0]).toHaveLength(2);
    expect(onImport.mock.calls[0][0][0].governance.sourceType).toBe('SYNTHETIC');
    expect(onImport.mock.calls[0][0][0].properties['熔体质量流动速率'].quantity.status).toBe('UNKNOWN');
  });
  it('allows ordinary clipboard text paste instead of preventing every paste event', () => {
    renderImport();
    const event = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', { value: { items: [{ kind: 'string' }] } });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
  it('retains the existing ID, taxonomy and manufacturer for a manual merge', async () => {
    const existing: Product = { id: 'existing', gradeName: 'Measured-1', manufacturer: 'Original maker', manufacturerId: 'original-maker', categoryIds: ['cat_pp'], properties: { label: { value: 'retain this' } }, createdAt: '2026-01-01', updatedAt: '2026-01-01' };
    const onImport = vi.fn().mockResolvedValue(true);
    renderImport(onImport, [existing]); manual();
    fireEvent.click(screen.getByRole('button', { name: /Confirm and merge\/import/ }));
    await waitFor(() => expect(onImport).toHaveBeenCalledOnce());
    expect(onImport.mock.calls[0][0][0]).toMatchObject({ id: 'existing', manufacturer: 'Original maker', manufacturerId: 'original-maker', categoryIds: ['cat_pp'], properties: { label: { value: 'retain this' }, 密度: { value: 0.95 } } });
  });

  it.each([
    { policy: 'Merge properties', expectedCount: 1, expectedDensity: 0.96 },
    { policy: 'Replace record', expectedCount: 1, expectedDensity: 0.96 },
    { policy: 'Skip duplicates', expectedCount: 1, expectedDensity: 0.95 },
  ])('applies $policy to duplicate grades inside one import batch', async ({ policy, expectedCount, expectedDensity }) => {
    const onImport = renderImport();
    fireEvent.click(screen.getByRole('button', { name: '📋 Paste a table' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Table to import' }), {
      target: { value: 'Grade,Manufacturer,Density (g/cm³)\nBatch-A,Lab,0.95\nBatch-A,Lab,0.96' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Parse table' }));
    fireEvent.click(screen.getByRole('radio', { name: new RegExp(policy) }));
    fireEvent.click(screen.getByRole('button', { name: 'Prepare import preview' }));
    fireEvent.click(screen.getByRole('button', { name: /Confirm and merge\/import/ }));

    await waitFor(() => expect(onImport).toHaveBeenCalledOnce());
    const imported = onImport.mock.calls[0][0];
    expect(imported).toHaveLength(expectedCount);
    expect(imported.map((product) => product.gradeName)).toEqual(Array(expectedCount).fill('Batch-A'));
    expect(imported[0].properties['密度'].value).toBe(expectedDensity);
  });

  it('keeps duplicate-grade batch rows only when the explicit keep-as-new policy is selected', async () => {
    const onImport = renderImport();
    fireEvent.click(screen.getByRole('button', { name: '📋 Paste a table' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Table to import' }), {
      target: { value: 'Grade,Manufacturer,Density (g/cm³)\nBatch-A,Lab,0.95\nBatch-A,Lab,0.96' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Parse table' }));
    fireEvent.click(screen.getByRole('radio', { name: /Keep as a new record/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Prepare import preview' }));
    fireEvent.click(screen.getByRole('button', { name: /Confirm and merge\/import/ }));

    await waitFor(() => expect(onImport).toHaveBeenCalledOnce());
    const imported = onImport.mock.calls[0][0];
    expect(imported).toHaveLength(2);
    expect(new Set(imported.map((product) => product.id)).size).toBe(2);
    expect(imported.map((product) => product.properties['密度'].value)).toEqual([0.95, 0.96]);
  });

});
