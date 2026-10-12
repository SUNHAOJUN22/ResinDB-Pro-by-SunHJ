import { describe, expect, it } from 'vitest';
import * as echarts from '@/lib/echarts';
import { SVGRenderer } from 'echarts/renderers';
import { buildDensityCells, buildKdeFigure, KDE_FIGURE_TEXT } from '@/components/charts/kdeFigure';

const grid = [
  { x: 0, y: 10, z: 0.1 }, { x: 2, y: 10, z: 0.2 },
  { x: 0, y: 14, z: 0.3 }, { x: 2, y: 14, z: 0.4 },
];
echarts.use([SVGRenderer]);

describe('continuous-coordinate KDE figure', () => {
  it('preserves physical coordinates, density and mid-point cell boundaries', () => {
    const cells = buildDensityCells(grid);
    expect(cells[0]).toEqual([0, 10, 0.1, -1, 1, 8, 12]);
    expect(cells[3]).toEqual([2, 14, 0.4, 1, 3, 12, 16]);
    expect(cells.map((cell) => cell[2])).toEqual(grid.map((point) => point.z));
  });

  it('omits invalid densities and reports the number actually plotted', () => {
    const figure = buildKdeFigure([...grid, { x: 1, y: 12, z: NaN }, { x: 1, y: 12, z: -1 }], [{ x: 1, y: 12 }, { x: Infinity, y: 12 }], 'X', 'Y', 'zh', 'light');
    expect(figure.dataCount).toBe(5);
    expect(figure.description).toContain('未绘制的无效网格点: 2');
    expect(buildDensityCells([{ x: 0, y: 0, z: 1 }])).toEqual([]);
    expect(buildKdeFigure([], [], 'X', 'Y', 'en', 'light').option).toBeNull();
  });

  it.each(['zh', 'en'] as const)('renders a nonempty SVG in the real ECharts engine (%s)', (language) => {
    const figure = buildKdeFigure(grid, [{ x: 1, y: 12 }], 'X', 'Y', language, 'light');
    const chart = echarts.init(null, undefined, { renderer: 'svg', ssr: true, width: 800, height: 500 });
    try {
      expect(() => chart.setOption(figure.option!)).not.toThrow();
      const svg = chart.renderToSVGString();
      expect(svg).toContain(KDE_FIGURE_TEXT[language].title);
      expect(svg.match(/<(?:path|rect)\b/g)?.length ?? 0).toBeGreaterThan(4);
    } finally {
      chart.dispose();
    }
  });

  it('keeps the original unsupported heatmap/value-axis combination as a negative control', () => {
    const chart = echarts.init(null, undefined, { renderer: 'svg', ssr: true, width: 800, height: 500 });
    try {
      expect(() => chart.setOption({ xAxis: { type: 'value' }, yAxis: { type: 'value' }, visualMap: { min: 0, max: 1 }, series: [{ type: 'heatmap', data: grid.map(({ x, y, z }) => [x, y, z]) }] })).toThrow(/category/);
    } finally {
      chart.dispose();
    }
  });
});
