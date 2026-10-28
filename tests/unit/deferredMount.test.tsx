import React, { lazy, useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DeferredMount } from '@/components/ui/DeferredMount';

it('does not evaluate a lazy tool before first use and preserves its draft across closing', async () => {
  const load = vi.fn(async () => ({ default: function Tool({ open }: { open: boolean }) {
    const [value, setValue] = useState('');
    return open ? <input aria-label="draft" value={value} onChange={event => setValue(event.target.value)} /> : null;
  } }));
  const Tool = lazy(load);
  const { rerender } = render(<DeferredMount active={false}><Tool open={false} /></DeferredMount>);
  expect(load).not.toHaveBeenCalled();
  await act(async () => rerender(<DeferredMount active><Tool open /></DeferredMount>));
  await waitFor(() => expect(screen.getByLabelText('draft')).toBeInTheDocument());
  fireEvent.change(screen.getByLabelText('draft'), { target: { value: 'retained scientific input' } });
  rerender(<DeferredMount active={false}><Tool open={false} /></DeferredMount>);
  expect(screen.queryByLabelText('draft')).not.toBeInTheDocument();
  rerender(<DeferredMount active><Tool open /></DeferredMount>);
  expect(screen.getByLabelText('draft')).toHaveValue('retained scientific input');
  expect(load).toHaveBeenCalledTimes(1);
});

describe('isolated suspension', () => {
  it('keeps a ready workspace visible while a tool is loading', () => {
    const Pending = lazy(() => new Promise<{ default: React.ComponentType }>(() => {}));
    render(<><div>Workspace remains visible</div><DeferredMount active fallback={<span role="status">Loading tool</span>}><Pending /></DeferredMount></>);
    expect(screen.getByText('Workspace remains visible')).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('Loading tool');
  });
});
