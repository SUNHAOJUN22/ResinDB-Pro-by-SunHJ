import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { ScientificEChart } from '@/components/charts/ScientificEChart';
import { LanguageProvider } from '@/contexts/LanguageContext';

const { chart, handlers } = vi.hoisted(() => {
  const eventHandlers = new Map<string, () => void>();
  const chartMock = {
    clear: vi.fn(),
    dispose: vi.fn(),
    isDisposed: vi.fn(() => false),
    resize: vi.fn(),
    setOption: vi.fn(() => eventHandlers.get('finished')?.()),
    on: vi.fn((event: string, handler: () => void) => eventHandlers.set(event, handler)),
    off: vi.fn((event: string, handler: () => void) => {
      if (eventHandlers.get(event) === handler) eventHandlers.delete(event);
    }),
  };
  return { chart: chartMock, handlers: eventHandlers };
});

vi.mock('@/lib/echarts', () => ({
  getInstanceByDom: vi.fn(() => null),
  init: vi.fn(() => chart),
}));

beforeEach(() => {
  window.localStorage.clear();
  handlers.clear();
  vi.clearAllMocks();
  chart.isDisposed.mockReturnValue(false);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
});

test('a missing option has an explicit bilingual unavailable state, not a blank canvas', () => {
  const { container } = render(
    <LanguageProvider>
      <ScientificEChart option={null} theme="light" ariaLabel="测试图表" />
    </LanguageProvider>,
  );
  expect(container.querySelector('[data-scientific-figure="true"]'))
    .toHaveAttribute('data-scientific-figure-state', 'unavailable');
  expect(screen.getByRole('status')).toHaveTextContent('图表暂不可用');
  expect(screen.getByText('尚未收到有效图表配置，请重新计算或调整输入。')).toBeInTheDocument();
  act(() => {
    window.dispatchEvent(new CustomEvent('resindb-language-change', { detail: 'en-US' }));
  });
  expect(screen.getByRole('status')).toHaveTextContent('Figure unavailable');
  expect(screen.getByText('No valid chart configuration is available. Recalculate or adjust the inputs.'))
    .toBeInTheDocument();
  expect(chart.setOption).not.toHaveBeenCalled();
});
