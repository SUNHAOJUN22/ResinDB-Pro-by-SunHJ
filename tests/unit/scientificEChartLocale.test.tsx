import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { ScientificEChart } from '@/components/charts/ScientificEChart';
import { LanguageProvider } from '@/contexts/LanguageContext';

const { chart } = vi.hoisted(() => ({
  chart: {
    clear: vi.fn(),
    dispose: vi.fn(),
    isDisposed: vi.fn(() => false),
    resize: vi.fn(),
    setOption: vi.fn(),
  },
}));

vi.mock('@/lib/echarts', () => ({
  getInstanceByDom: vi.fn(() => null),
  init: vi.fn(() => chart),
}));

beforeEach(() => {
  window.localStorage.clear();
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

describe('ScientificEChart language states', () => {
  test('renders governed Chinese and English empty states without exposing internal keys', () => {
    render(
      <LanguageProvider>
        <ScientificEChart
          option={null}
          theme="light"
          ariaLabel="测试图表"
          exportName="locale-state"
          empty
        />
      </LanguageProvider>,
    );

    expect(screen.getByText('暂无可绘制数据')).toBeInTheDocument();
    expect(screen.getByText('请调整变量、筛选条件或样本选择。')).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new CustomEvent('resindb-language-change', { detail: 'en-US' }));
    });

    expect(screen.getByText('No plottable data')).toBeInTheDocument();
    expect(screen.getByText('Adjust the variables, filters, or sample selection.')).toBeInTheDocument();
  });
});
