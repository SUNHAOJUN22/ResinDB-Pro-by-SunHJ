import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BulkValidation } from '@/components/features/Dashboard/BulkValidation';
import { EditProductModal } from '@/components/modals/EditProductModal';
import { FormulaEditorModal } from '@/components/modals/FormulaEditorModalLegacy';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { useMahalanobisWorker } from '@/hooks/math/useMahalanobis';
import { canonicalizeCoreProperty } from '@/lib/quantityRecord';
import { getComparableNumericPropertyKeys } from '@/utils/productUtils';
import { UniversalStorageBridge } from '@/lib/adapters/UniversalStorageBridge';
import type { MaterialRecord } from '@/lib/adapters/types';
import type { Product } from '@/types/index';
const mocks = vi.hoisted(() => ({ addToast: vi.fn(), runAnalysis: vi.fn() }));
vi.mock('@/contexts/ToastContext', () => ({ useToasts: () => ({ addToast: mocks.addToast }) }));
vi.mock('@/hooks/workers/useMahalanobisWorker', () => ({ useMahalanobisWorker: () => ({ isCalculating: false, result: null, runAnalysis: mocks.runAnalysis }) }));
beforeEach(() => { vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} }); localStorage.clear(); localStorage.setItem('resindb-language', 'en'); vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const record = (id = 'a'): Product => ({ id, gradeName: 'Grade', manufacturer: 'M', manufacturerId: 'm', categoryIds: [], createdAt: '2026-10-22', updatedAt: '2026-10-22', governance: { sourceType: 'MEASURED', recordStatus: 'NOT_FOR_RELEASE', confidentiality: 'RESTRICTED', license: 'private', provenanceRefs: ['lab'] }, properties: { density: { value: 1000, unit: 'kg/m³', method: 'ISO 1183', load: 'declared load', sampleId: 's', batchId: 'b', provenanceRefs: ['lab'], quantity: canonicalizeCoreProperty('density', { value: 1000, unit: 'kg/m³' }, ['lab']) }, yield: { value: 25, unit: 'MPa' } } });
const wrapper = ({ children }: { children: React.ReactNode }) => <LanguageProvider>{children}</LanguageProvider>;
const renderFormula = () => render(<LanguageProvider><FormulaEditorModal isOpen onClose={vi.fn()} formulas={[]} onAdd={vi.fn()} onUpdate={vi.fn()} onRemove={vi.fn()} allProducts={[record()]} /></LanguageProvider>);
const enterExpression = () => fireEvent.change(screen.getByPlaceholderText("props['Density'] * 0.1"), { target: { value: "props['yield'] / props['density']" } });

describe('actual acceptance UI actions', () => {
  it('keeps the editor open until persistence succeeds and supplies its original edit base', async () => {
    const original = record();
    let finish!: (saved: boolean) => void;
    const onSave = vi.fn(() => new Promise<boolean>(resolve => { finish = resolve; }));
    const onClose = vi.fn();
    render(<LanguageProvider><EditProductModal isOpen product={original} onClose={onClose} onSave={onSave} /></LanguageProvider>);
    fireEvent.change(screen.getByDisplayValue('1000'), { target: { value: '1200' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => { finish(false); });
    expect(onClose).not.toHaveBeenCalled();
    expect(onSave.mock.calls[0][1]).toEqual(original);
    expect(original.properties.density.value).toBe(1000);
  });
  it('saves unchanged property metadata and governance through EditProductModal', async () => {
    const original = record(); const onSave = vi.fn().mockResolvedValue(true);
    render(<LanguageProvider><EditProductModal isOpen product={original} onClose={vi.fn()} onSave={onSave} /></LanguageProvider>);
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0].properties).toEqual(original.properties);
    expect(onSave.mock.calls[0][0].governance).toEqual(original.governance);
  });
  it('rebuilds quantity after a real edit while retaining sample metadata', async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    render(<LanguageProvider><EditProductModal isOpen product={record()} onClose={vi.fn()} onSave={onSave} /></LanguageProvider>);
    fireEvent.change(screen.getByDisplayValue('1000'), { target: { value: '1200' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0].properties.density).toMatchObject({ value: 1200, sampleId: 's', batchId: 'b', load: 'declared load', quantity: { canonical: { value: 1.2 } } });
  });
  it('shows and synchronizes nested-only MFR temperature through edit and storage', async () => {
    const source: MaterialRecord = {
      id: 'nested-temperature', source: 'my_lab', category: 'PP', grade: 'PP-NESTED-TEMP',
      manufacturer: 'Research Lab', timestamp: Date.parse('2026-10-24T00:00:00Z'),
      properties: {
        density: { value: 0.91, unit: 'g/cm³' },
        mfr: {
          value: 2.1, unit: 'g/10min', method: 'ISO 1133',
          raw: { value: 2.1, unit: 'g/10min', method: 'ISO 1133', conditions: { temperature: '190 °C', load: '2.16 kg' } },
        },
      },
    };
    const original = UniversalStorageBridge.recordToProduct(source);
    const onSave = vi.fn().mockResolvedValue(true);
    render(<LanguageProvider><EditProductModal isOpen product={original} onClose={vi.fn()} onSave={onSave} /></LanguageProvider>);
    fireEvent.click(screen.getAllByTitle('More Options')[1]);
    const temperature = screen.getByDisplayValue('190 °C');
    fireEvent.change(temperature, { target: { value: '200 °C' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));

    const edited = onSave.mock.calls[0][0] as Product;
    const persisted = UniversalStorageBridge.productToRecord(edited);
    expect(persisted.properties.mfr?.raw).toMatchObject({
      temperature: '200 °C',
      conditions: { temperature: '200 °C', load: '2.16 kg' },
    });
    expect(original.properties['熔体质量流动速率'].quantity?.raw.conditions?.temperature).toBe('190 °C');

    const sameConditionRecord: MaterialRecord = {
      ...source,
      id: 'same-condition',
      properties: {
        ...source.properties,
        mfr: {
          ...source.properties.mfr!,
          temperature: '200 °C',
          raw: {
            ...source.properties.mfr!.raw!,
            temperature: '200 °C',
            conditions: { temperature: '200 °C', load: '2.16 kg' },
          },
        },
      },
    };
    const comparison = UniversalStorageBridge.recordToProduct(sameConditionRecord);
    const restored = UniversalStorageBridge.recordToProduct(persisted);
    expect(restored.properties['熔体质量流动速率'].quantity?.raw.conditions?.temperature).toBe('200 °C');
    expect(getComparableNumericPropertyKeys([restored, comparison])).toContain('熔体质量流动速率');
  });
  it('passes the actual output unit from the formula Test control', () => {
    renderFormula(); enterExpression();
    fireEvent.change(screen.getByPlaceholderText('e.g. MPa, g/cm³'), { target: { value: 'MPa·cm³/g' } });
    fireEvent.click(screen.getByRole('button', { name: /^test$/i }));
    expect(screen.getByText(/25\.0000/).textContent).toContain('MPa·cm³/g');
  });
  it('does not execute a formula with an empty output unit', () => {
    renderFormula(); enterExpression();
    fireEvent.click(screen.getByRole('button', { name: /^test$/i }));
    expect(screen.getByText(/Declare the output unit/)).toBeTruthy();
    expect(screen.queryByText(/25\.0000/)).toBeNull();
  });
  it('displays an incompatible output dimension instead of a numeric result', () => {
    renderFormula(); enterExpression();
    fireEvent.change(screen.getByPlaceholderText('e.g. MPa, g/cm³'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: /^test$/i }));
    expect(screen.getByText('INCOMPATIBLE_OUTPUT_DIMENSION')).toBeTruthy();
  });
  it('validates Mahalanobis n > p after complete-case filtering', () => {
    const { result } = renderHook(useMahalanobisWorker, { wrapper });
    const missing = record('b'); delete missing.properties.yield;
    const malformed = record('c'); malformed.properties.yield = { value: '12abc' };
    act(() => result.current.detectOutliers([record(), missing, malformed], ['density', 'yield']));
    expect(mocks.runAnalysis).not.toHaveBeenCalled();
    expect(mocks.addToast).toHaveBeenCalledWith('error', expect.stringContaining('1 complete records, 2 features'));
  });
  it('keeps missing quantities and invalid formulas out of clean batch results', () => {
    render(<LanguageProvider><BulkValidation allProducts={[record()]} formulas={[{ id: 'bad', name: 'Bad formula', expression: "1 / (p['yield'] - p['yield'])", unit: '1' }]} /></LanguageProvider>);
    expect(screen.getByText(/MFR is unassessed/)).toBeTruthy();
    expect(screen.getByText(/Bad formula is unassessed/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Within configured thresholds.*0/ })).toBeTruthy();
    expect(screen.queryByText(/Assessed quantities and formulas did not trigger/)).toBeNull();
  });

  it('localizes built-in formula templates while preserving user-authored template text', () => {
    localStorage.setItem('resindb-custom-templates', JSON.stringify([{ id: 'user-template', name: 'Specific strength', description: 'User-authored description', category: 'User domain', unit: '1', baseExpression: '1', parameters: [] }]));
    renderFormula();
    act(() => window.dispatchEvent(new CustomEvent('resindb-language-change', { detail: 'zh' })));
    fireEvent.click(screen.getByRole('button', { name: '模板' }));
    expect(screen.getByText('比强度')).toBeTruthy();
    expect(screen.queryByText('Screening formulas')).toBeNull();
    fireEvent.click(screen.getByText('Specific strength'));
    expect(screen.getAllByText('Specific strength')).toHaveLength(2);
    expect(screen.getAllByText('User-authored description')).toHaveLength(2);
    expect(screen.getByRole('button', { name: '应用模板参数' })).toBeTruthy();
    act(() => window.dispatchEvent(new CustomEvent('resindb-language-change', { detail: 'en' })));
    expect(screen.getByRole('button', { name: 'Apply Template Parameters' })).toBeTruthy();
    expect(screen.queryByText('比强度')).toBeNull();
  });

});
