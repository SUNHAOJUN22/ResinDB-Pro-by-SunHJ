import React, { useEffect, useRef, useMemo } from 'react';
import * as echarts from 'echarts';
import { SimilarityNode, SimilarityEdge } from '../../lib/similarityWorker';

interface SimilarityGraphProps {
  nodes: SimilarityNode[];
  edges: SimilarityEdge[];
  theme: 'light' | 'dark';
}

export const SimilarityGraph: React.FC<SimilarityGraphProps> = React.memo(({ nodes, edges, theme }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  // Group nodes by category to assign colors automatically
  const categories = useMemo(() => Array.from(new Set(nodes.map(n => n.category))).map(name => ({ name })), [nodes]);

  useEffect(() => {
    if (!chartRef.current || nodes.length === 0) return;

    if (!chartInstance.current) {
        chartInstance.current = echarts.getInstanceByDom(chartRef.current) || echarts.init(chartRef.current, theme === 'dark' ? 'dark' : undefined);
    }
    
    // Convert to ECharts Graph Data Format
    const graphNodes = nodes.map(n => ({
        id: n.id,
        name: n.name,
        category: n.category,
        symbolSize: Math.max(10, Math.min(30, n.value * 2)),
        itemStyle: {
            borderColor: theme === 'dark' ? '#0f172a' : '#ffffff',
            borderWidth: 1,
        }
    }));
    
    const graphEdges = edges.map(e => ({
        source: e.source,
        target: e.target,
        value: e.value,
        lineStyle: {
            width: Math.max(0.5, (e.value - 0.5) * 5), // dynamic thickness based on similarity
            opacity: e.value
        }
    }));

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      tooltip: {
          formatter: (params: echarts.DefaultLabelFormatterCallbackParams) => {
              if (params.dataType === 'node') {
                  const data = params.data as Record<string, unknown>;
                  return `<div class="font-bold text-sm mb-1">${String(data.name)}</div>
                          <div class="text-xs text-slate-500">Degree: ${String(data.value)}</div>
                          <div class="text-[10px] uppercase mt-2 opacity-70">${String(data.category)}</div>`;
              } else if (params.dataType === 'edge') {
                   return `<div class="font-bold text-xs">Similarity: ${(parseFloat(String(params.value)) * 100).toFixed(1)}%</div>`;
              }
              return '';
          }
      },
      legend: {
          type: 'scroll',
          bottom: 10,
          textStyle: {
              color: theme === 'dark' ? '#94a3b8' : '#64748b',
              fontSize: 10
          }
      },
      series: [
        {
          type: 'graph',
          layout: 'force',
          data: graphNodes,
          links: graphEdges,
          categories: categories,
          roam: true,
          label: {
            show: true,
            position: 'right',
            formatter: '{b}',
            fontSize: 10,
            color: theme === 'dark' ? '#cbd5e1' : '#475569',
            distance: 5
          },
          force: {
              repulsion: 150,
              edgeLength: [30, 80],
              gravity: 0.1
          },
          emphasis: {
            focus: 'adjacency',
            lineStyle: {
              width: 3
            }
          },
          lineStyle: {
            color: 'source',
            curveness: 0.1,
            opacity: 0.6
          }
        }
      ]
    };

    chartInstance.current.setOption(option);
    
    // Add Click listener for focus
    chartInstance.current.off('click');
    chartInstance.current.on('click', (params: echarts.ECElementEvent) => {
       if (params.dataType === 'node') {
            // Can be expanded to trigger other UI
       }
    });

  }, [nodes, edges, categories, theme]);

  useEffect(() => {
    const ro = new ResizeObserver(() => { if (chartInstance.current) chartInstance.current.resize(); });
    if (chartRef.current) ro.observe(chartRef.current);
    return () => ro.disconnect();
  }, []);

  return <div ref={chartRef} className="w-full h-full" />;
});
