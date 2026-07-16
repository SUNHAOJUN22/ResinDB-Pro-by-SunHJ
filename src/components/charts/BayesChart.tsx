import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { useLanguage } from "@/contexts/LanguageContext";

interface BayesChartProps {
  historical: { index: number; y: number; y_pred: number; y_std: number }[];
  suggestions: { params: Record<string, number>; mean: number; std: number; ei: number }[];
  targetName: string;
  maximize: boolean;
  theme: "light" | "dark";
}

export const BayesChart: React.FC<BayesChartProps> = React.memo(({ historical, suggestions, targetName, maximize, theme }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const { t } = useLanguage();

  useEffect(() => {
    if (!chartRef.current) return;
    
    if (!chartInstance.current) {
        chartInstance.current = echarts.getInstanceByDom(chartRef.current) || echarts.init(chartRef.current);
    }
    
    const textColor = theme === 'dark' ? '#cbd5e1' : '#475569';
    const splitLineColor = theme === 'dark' ? '#334155' : '#e2e8f0';

    // X-axis is pseudo index (ordered by true y value)
    const xAxisData = historical.map((_, i) => i + 1);
    const trueY = historical.map(h => h.y);
        
    // Confidence interval: Mean ± 2 * std
    const lbound = historical.map(h => h.y_pred - 2 * h.y_std);
    const ubound = historical.map(h => h.y_pred + 2 * h.y_std);
    
    // Suggestion Point placed at the end of the graph, visually separated
    xAxisData.push(historical.length + 2); // gap
    const bestNext = suggestions[0];
    
    const predScatterData = historical.map((h, i) => [i + 1, h.y_pred]);
    predScatterData.push([historical.length + 2, bestNext.mean]);

    const option: echarts.EChartsOption = {
      title: {
         text: t("bayesChartTitle"),
         left: 'center',
         textStyle: { color: textColor, fontSize: 13 }
      },
      tooltip: {
        trigger: 'axis',
        
         
        formatter: (params: any) => {
            const dataIndex = params[0].dataIndex;
            if (dataIndex === historical.length) {
                // This is the prediction
                return `<strong>💡 ${t("bayesChartTooltipBest")}</strong><br/>
                        ${t("bayesChartTooltipMean")} (Mean): ${bestNext.mean.toFixed(3)}<br/>
                        ${t("bayesChartTooltipStd")} (Std): ${bestNext.std.toFixed(3)}<br/>
                        ${t("bayesChartTooltipEi")}: ${(bestNext.ei).toExponential(2)}`;
            } else {
                const h = historical[dataIndex];
                if (!h) return '';
                return `<strong>${t("bayesChartTooltipFeedback")}</strong><br/>
                        ${t("bayesChartTooltipActual")} ${targetName}: ${h.y.toFixed(3)}<br/>
                        ${t("bayesChartTooltipGpMean")}: ${h.y_pred.toFixed(3)}<br/>
                        ${t("bayesChartTooltipGpStd")}: ${h.y_std.toFixed(3)}`;
            }
        }
      },
      legend: {
        bottom: '0%',
        textStyle: { color: textColor }
      },
      grid: { top: '15%', bottom: '15%', left: '8%', right: '8%' },
      xAxis: {
        type: 'category',
        data: xAxisData,
        name: t("bayesChartXAxis"),
        nameLocation: 'middle',
        nameGap: 30,
        axisLabel: { show: false }, // hide abstract indices
        axisTick: { show: false }
      },
      yAxis: {
        type: 'value',
        name: targetName,
        nameLocation: 'middle',
        nameGap: 50,
        scale: true,
        axisLabel: { color: textColor },
        splitLine: { lineStyle: { color: splitLineColor, type: 'dashed' } }
      },
      series: [
        {
          name: t("bayesChartGroundTruth"),
          type: 'line',
          data: trueY,
          itemStyle: { color: '#64748b' },
          lineStyle: { width: 4, opacity: 0.3 },
          symbol: 'circle',
          symbolSize: 6
        },
        {
          name: t("bayesChartMean"),
          type: 'scatter',
          data: predScatterData,
          itemStyle: { color: '#8b5cf6' }, // violet-500
          symbol: 'diamond',
          symbolSize: 10,
          z: 3
        },
        {
            name: t("bayesChartLowerConfidence"),
            type: 'line',
            data: lbound,
            itemStyle: { color: '#a78bfa' },
            lineStyle: { opacity: 0 },
            symbol: 'none',
            stack: 'confidence' // use stack internally but not effectively for fill here, wait echarts band fill
        },
        {
            name: t("bayesChartConfidenceInterval"),
            type: 'line',
            data: ubound.map((u, i) => u - lbound[i]),
            itemStyle: { color: 'rgba(139, 92, 246, 0.2)' },
            lineStyle: { opacity: 0 },
            areaStyle: { color: 'rgba(139, 92, 246, 0.2)' },
            symbol: 'none',
            stack: 'confidence'
        },
        // Highlight the new suggested point
        {
           name: t("bayesChartNextBest"),
           type: 'effectScatter',
           data: [[historical.length + 2, bestNext.mean]],
           itemStyle: { color: '#ec4899' }, // pink-500
           symbol: 'pin',
           symbolSize: 20,
           z: 5
        }
      ]
    };

    chartInstance.current.setOption(option);
    
    const ro = new ResizeObserver(() => { if(chartInstance.current) chartInstance.current.resize(); });
    if (chartRef.current) ro.observe(chartRef.current);
    return () => {
      ro.disconnect();
    };
  }, [historical, suggestions, targetName, maximize, theme, t]);

  return <div ref={chartRef} className="w-full h-full" />;
});

// v3.1.0-sync

// v3.1.0-sync-fixed
