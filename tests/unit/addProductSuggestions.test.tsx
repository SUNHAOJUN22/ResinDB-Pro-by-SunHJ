import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { refreshProperties, verifyPropertyQuantities } from '@/lib/propertyAdmission';
import type { Product } from '@/types/index';
vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ t: (key: string) => key, tProp: (key: string) => key, language: 'en' }) }));
vi.mock('@/contexts/ToastContext', () => ({ useToasts: () => ({ addToast: vi.fn() }) }));
vi.mock('@/services/aiService', () => ({ aiService: { generateProductProperties: () => { throw new Error('External AI disabled in local fixture'); } } }));
import { AddProductModal } from '@/components/modals/AddProductModal';
afterEach(() => cleanup());
function product(id: string, value: number, unit: string): Product {
 const props = refreshProperties({ '密度': { value, unit, referenceId: `synthetic-${id}` } });
 return { id, gradeName: id, manufacturer: 'Synthetic Lab', manufacturerId: 'fixture', categoryIds: [], createdAt: '2026-01-01', updatedAt: '2026-01-01', properties: verifyPropertyQuantities(props) };
}
function openRow(products: Product[], initialValue = '', initialUnit = '') {
 const save = vi.fn();
 render(<AddProductModal isOpen allProducts={products} onSave={save} onClose={vi.fn()} />);
 fireEvent.change(screen.getByPlaceholderText('e.g. Resin Pro 500'), { target: { value: 'Synthetic new grade' } });
 fireEvent.click(screen.getByRole('button', { name: 'addProperty' }));
 fireEvent.change(screen.getByPlaceholderText('propertyName'), { target: { value: '密度' } });
 fireEvent.change(screen.getByPlaceholderText('propertyValue'), { target: { value: initialValue } });
 if (initialUnit) fireEvent.change(screen.getByPlaceholderText('unit'), { target: { value: initialUnit } });
 fireEvent.focus(screen.getByPlaceholderText('propertyValue'));
 return save;
}
describe('AddProductModal preserves the source suggestion declaration', () => {
 it('applies the clicked value and its unit in the same batched event', async () => {
  const inputs = [product('single', 0.9, 'g/cm³')];
  const save = openRow(inputs, '0.75');
  fireEvent.click(screen.getByText('0.9', { selector: 'span' }));
  const displayed = { value: (screen.getByPlaceholderText('propertyValue') as HTMLInputElement).value, unit: (screen.getByPlaceholderText('unit') as HTMLInputElement).value };
  fireEvent.click(screen.getByRole('button', { name: 'createProduct' }));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  expect(displayed).toEqual({ value: '0.9', unit: 'g/cm³' });
 });
 it('does not relabel a kg/m³ observation as g/cm³ through unit-majority suggestions', async () => {
  const inputs = [product('a', 0.9, 'g/cm³'), product('b', 1.1, 'g/cm³'), product('c', 950, 'kg/m³')];
  const save = openRow(inputs, '', 'g/cm³');
  const option = screen.getByText('950', { selector: 'span' }).parentElement!;
  fireEvent.click(option);
  const displayed = { value: (screen.getByPlaceholderText('propertyValue') as HTMLInputElement).value, unit: (screen.getByPlaceholderText('unit') as HTMLInputElement).value };
  fireEvent.click(screen.getByRole('button', { name: 'createProduct' }));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  const saved = save.mock.calls[0][0];
  const downstream = refreshProperties(saved.properties)['密度'];
  expect(displayed).toEqual({ value: '950', unit: 'kg/m³' });
  expect(downstream.quantity?.canonical?.value).toBeCloseTo(0.95, 12);
  expect(saved.governance).toMatchObject({ sourceType: 'UNKNOWN', recordStatus: 'NOT_FOR_RELEASE' });
  expect(saved.properties['密度'].annotation).toContain('not a measurement of this product');
  expect(saved.properties['密度'].provenanceRefs).toEqual(['suggestion:c:密度']);
 });
 it.each(['UNKNOWN', 'INVALID'] as const)('does not suggest an explicitly %s observation', status => {
  const rejected = product('rejected', 0.9, 'g/cm³');
  rejected.properties['密度'].quantity!.status = status;
  delete rejected.properties['密度'].quantity!.canonical;
  openRow([rejected]);
  expect(screen.queryByText('0.9', { selector: 'span' })).toBeNull();
 });
 it('does not revive a VALID quantity that disagrees with its displayed declaration', () => {
  const mismatched = product('mismatched', 0.9, 'g/cm³');
  mismatched.properties['密度'].value = 900;
  openRow([mismatched]);
  expect(screen.queryByText('900', { selector: 'span' })).toBeNull();
 });
 it('preserves separate source conditions without pooling a misleading range', () => {
  const a = product('sample-a', 0.9, 'g/cm³');
  const b = product('sample-b', 1.1, 'g/cm³');
  a.properties['密度'].standard = 'ISO 1183';
  a.properties['密度'].quantity!.raw.standard = 'ISO 1183';
  b.properties['密度'].temperature = '80';
  b.properties['密度'].quantity!.raw.temperature = '80';
  openRow([a, b]);
  expect(screen.getByText('0.9', { selector: 'span' }).parentElement?.title).toContain('ISO 1183');
  expect(screen.getByText('1.1', { selector: 'span' }).parentElement?.title).toContain('80');
  expect(screen.queryByText('Historical Range')).toBeNull();
 });
 it('preserves manual input and does not label it as a copied suggestion', async () => {
  const save = openRow([], '1.05', 'g/cm³');
  fireEvent.click(screen.getByRole('button', { name: 'createProduct' }));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  const saved = save.mock.calls[0][0];
  expect(saved.properties['密度']).toMatchObject({ value: 1.05, unit: 'g/cm³' });
  expect(saved.properties['密度'].annotation).toBeUndefined();
  expect(saved.governance).toBeUndefined();
 });
});
