import * as echarts from "echarts";
import { Product } from "../../types";
import { materialEngine } from "../../lib/materialScience";

// Chart: GPC Molecular Weight Distribution Option Configuration
export const getGpcChartOption = (
  products: Product[],
  theme: "light" | "dark",
): echarts.EChartsOption => {
  const isDark = theme === "dark";
  const colorPalette = ["#3b82f6", "#f43f5e", "#10b981", "#8b5cf6", "#f59e0b"];
  const axisColor = isDark ? "#94a3b8" : "#475569";
  const gridLineColor = isDark ? "rgba(148, 163, 184, 0.05)" : "rgba(100, 116, 139, 0.05)";

  const series = products.map((p, idx) => {
    // ... logic remains same for simplicity of simulation
    const flowVal = p.properties['熔体质量流动速率']?.value || 
                    p.properties['MFR']?.value || 
                    p.properties['MFI']?.value || 
                    p.properties['门尼粘度']?.value || 
                    p.properties['Mooney Viscosity']?.value;
    
    const mfr = parseFloat(String(flowVal || 5));
    const safeMfr = isNaN(mfr) ? 5 : mfr;

    const peakLogMw = 5.8 - Math.log10(safeMfr) * 0.4;
    const isPolyethylene = p.gradeName.includes('PE') || p.categoryIds?.includes('聚乙烯');
    const width = isPolyethylene ? (p.gradeName.includes('LL') ? 0.35 : 0.5) : 0.45;

    const data: [number, number][] = [];
    for (let x = 2.5; x <= 8.5; x += 0.08) {
      data.push([x, Math.exp(-Math.pow(x - peakLogMw, 2) / (2 * Math.pow(width, 2)))]);
    }

    const color = colorPalette[idx % colorPalette.length];

    return {
      name: p.gradeName,
      type: "line",
      smooth: true,
      showSymbol: false,
      data: data,
      lineStyle: { width: 3, color, opacity: 0.9 },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: color + "44" },
          { offset: 1, color: "transparent" },
        ]),
      },
    };
  });

  return {
    backgroundColor: "transparent",
    color: colorPalette,
    grid: {
      left: "8%",
      right: "5%",
      bottom: "15%",
      top: "12%",
      containLabel: true,
    },
    tooltip: {
      trigger: "axis",
      padding: 0,
      backgroundColor: "transparent",
      borderWidth: 0,
      formatter: (params: { axisValue: number|string }[] | Record<string, unknown> | unknown) => {
        const paramList = Array.isArray(params) ? params as { axisValue: string|number; color: string; seriesName: string; seriesIndex: number; value: [number, number] }[] : [];
        if (paramList.length === 0) return '';

        let html = `
          <div style="background: ${isDark ? '#0f172a' : '#ffffff'}; border: 1px solid ${isDark ? '#334155' : '#e2e8f0'}; border-radius: 12px; padding: 12px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); min-width: 220px;">
            <div style="font-weight: 800; border-bottom: 1px solid rgba(0,0,0,0.05); margin-bottom: 8px; padding-bottom: 6px; font-size: 11px; color: ${isDark ? '#94a3b8' : '#64748b'}; letter-spacing: 0.05em;">
              LOG MW INTENSITY: ${Number(paramList[0].axisValue).toFixed(3)}
            </div>
        `;
        
        paramList.forEach((item) => {
          const s = series[item.seriesIndex];
          const points = (s.data as [number, number][]).map(([x, y]) => ({ x: Math.pow(10, x), y }));
          const moments = materialEngine.calculateMWDMoments(points);
          
          html += `
            <div style="margin-bottom: 12px;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                <div style="width: 8px; height: 8px; border-radius: 2px; background: ${item.color};"></div>
                <span style="font-weight: 800; font-size: 13px;">${item.seriesName}</span>
              </div>
              <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px; padding-left: 16px;">
                <div style="display: flex; flex-direction: column;">
                  <span style="font-size: 9px; opacity: 0.6; text-transform: uppercase;">Mw (Weight Avg)</span>
                  <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700;">${moments ? (moments.mw / 1000).toFixed(1) : '-'}k</span>
                </div>
                <div style="display: flex; flex-direction: column;">
                  <span style="font-size: 9px; opacity: 0.6; text-transform: uppercase;">PDI (Dispersity)</span>
                  <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 900; color: #10b981;">${moments ? moments.pdi.toFixed(2) : '-'}</span>
                </div>
              </div>
            </div>
          `;
        });
        
        html += `</div>`;
        return html;
      },
      extraCssText: "pointer-events: none;",
    },
    legend: {
      bottom: 0,
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { color: axisColor, fontSize: 10, fontWeight: 600 },
      type: "scroll",
    },
    xAxis: {
      type: "value",
      name: "Log(Mw)",
      nameLocation: "middle",
      nameGap: 30,
      nameTextStyle: { color: axisColor, fontWeight: 700 },
      axisLabel: { color: axisColor, fontSize: 10 },
      splitLine: { lineStyle: { color: gridLineColor } },
      axisLine: { lineStyle: { color: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" } },
    },
    yAxis: {
      type: "value",
      name: "dw/d(LogMw)",
      nameLocation: "middle",
      nameGap: 40,
      nameTextStyle: { color: axisColor, fontWeight: 700 },
      axisLabel: { show: false },
      splitLine: { show: false },
    },
    series: series as echarts.SeriesOption[],
  };
};
