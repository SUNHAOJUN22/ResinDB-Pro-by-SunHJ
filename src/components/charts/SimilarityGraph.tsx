import React, { useMemo } from 'react';
import type { EChartsOption } from '@/lib/echarts';
import { useLanguage } from '@/contexts/LanguageContext';
import { ADVANCED_CHART_TEXT } from './advancedChartText';
import type { SimilarityNode, SimilarityEdge } from '@/workers/similarityWorker';
import { ScientificEChart } from './ScientificEChart';
import { escapeScientificHtml, formatScientificNumber, scientificTooltipItem } from './scientificFigurePolicy';

interface SimilarityGraphProps { nodes: SimilarityNode[]; edges: SimilarityEdge[]; theme: 'light' | 'dark' }

export const SimilarityGraph: React.FC<SimilarityGraphProps> = React.memo(({ nodes, edges, theme }) => {
  const { language } = useLanguage();
  const text = ADVANCED_CHART_TEXT[language].similarity;
  const option = useMemo<EChartsOption>(() => {
    const categories = Array.from(new Set(nodes.map((node) => node.category))).map((name) => ({ name }));
    return {
      title: { text: text.title, subtext: text.subtitle, left: 'center', top: 6, textStyle: { fontSize: 14, fontWeight: 650 }, subtextStyle: { fontSize: 10 } },
      legend: { bottom: 4, data: categories.map((entry) => entry.name) },
      tooltip: { formatter: (params: unknown) => {
        const item = scientificTooltipItem(params);
        if (item?.dataType === 'node') {
          const data = item.data as { name?: string; value?: number; category?: string } | undefined;
          return data ? `<strong>${escapeScientificHtml(data.name)}</strong><br/>${text.degree}: ${formatScientificNumber(Number(data.value))}<br/>${text.category}: ${escapeScientificHtml(data.category)}` : '';
        }
        const data = item?.data as { rawCosine?: number; featureCoverage?: number; sharedFeatures?: number } | undefined;
        return `${text.adjusted}: ${formatScientificNumber(Number(item?.value) * 100)}%<br/>${text.raw}: ${formatScientificNumber(Number(data?.rawCosine) * 100)}%<br/>${text.coverage}: ${formatScientificNumber(Number(data?.featureCoverage) * 100)}%<br/>${text.shared}: ${formatScientificNumber(Number(data?.sharedFeatures))}`;
      } },
      series: [{
        name: text.series,
        type: 'graph',
        layout: 'force',
        data: nodes.map((node) => ({ id: node.id, name: node.name, value: node.value, category: node.category, symbolSize: Math.max(8, Math.min(24, node.value * 1.6)), itemStyle: { borderColor: theme === 'dark' ? '#0f172a' : '#ffffff', borderWidth: 1 } })),
        links: edges.map((edge) => ({ source: edge.source, target: edge.target, value: edge.value, rawCosine: edge.rawCosine, featureCoverage: edge.featureCoverage, sharedFeatures: edge.sharedFeatures, lineStyle: { width: Math.max(0.4, (edge.value - 0.5) * 3), opacity: Math.max(0.15, Math.min(0.75, edge.value)) } })),
        categories,
        roam: true,
        label: { show: nodes.length <= 80, position: 'right', formatter: '{b}', fontSize: 9, distance: 4 },
        force: { repulsion: nodes.length > 200 ? 55 : 130, edgeLength: [30, 76], gravity: 0.08, layoutAnimation: false },
        emphasis: { focus: 'adjacency', lineStyle: { width: 2.2 } },
        lineStyle: { color: 'source', curveness: 0.08, opacity: 0.45 },
        progressive: 1_000,
      }],
    };
  }, [text, edges, nodes, theme]);
  return <ScientificEChart option={option} theme={theme} ariaLabel={text.aria} description={text.description} exportName="cosine-similarity-network" dataCount={nodes.length + edges.length} empty={nodes.length === 0} />;
});
