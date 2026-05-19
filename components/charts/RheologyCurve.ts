import * as echarts from "echarts";
import { Product } from "../../types";

import { materialEngine } from "../../lib/materialScience";

// Carreau-Yasuda parameters for polymer melt simulation
// η = η0 * [1 + (λ * γ̇)^a]^((n-1)/a)
const simulateCarreauYasuda = (
  mfr: number,
  tempOffset: number,
  rate: number,
) => {
  // Physical Scaling: Low MFR -> High Viscosity
  // We use Power Law base for Zero-Shear Viscosity approximation
  const eta0 = (80000 / Math.pow(Math.max(0.1, mfr), 0.8)) * Math.exp(tempOffset * -0.025);
  const lambda = 0.5 * Math.pow(Math.max(0.1, mfr), 0.4); 
  const n = 0.32; // Pseudoplasticity index
  const a = 2.0; // Transition parameter

  const viscosity = eta0 * Math.pow(1 + Math.pow(lambda * rate, a), (n - 1) / a);
  return viscosity;
};

// Chart 4: Rheology Viscosity Curve Option Configuration - Premium Scientific Render
export const getRheologyChartOption = (
  products: Product[],
  theme: "light" | "dark",
  temps: number[] = [190, 210, 230],
): echarts.EChartsOption => {
  const isDark = theme === "dark";
  const colorPalette = ["#3b82f6", "#f43f5e", "#10b981", "#8b5cf6", "#f59e0b"];
  const gridLineColor = isDark ? "rgba(148, 163, 184, 0.05)" : "rgba(100, 116, 139, 0.05)";
  const axisColor = isDark ? "#94a3b8" : "#475569";

  const series = products.flatMap((p: Product, idx: number) => {
    const flowVal = p.properties['熔体质量流动速率']?.value || 
                    p.properties['MFR']?.value || 
                    p.properties['MFI']?.value || 
                    p.properties['门尼粘度']?.value || 
                    p.properties['Mooney Viscosity']?.value;
    
    const mfr = parseFloat(String(flowVal || 5));
    const safeMfr = isNaN(mfr) ? 5 : mfr;
    const baseColor = colorPalette[idx % colorPalette.length];

    const tempsToUse = products.length === 1 ? temps : [temps[0] || 190];

    return tempsToUse.map((temp, tIdx) => {
      const data = [];
      // Scientific log space for shear rates
      for (let i = -2; i <= 6; i += 0.25) {
        const rate = Math.pow(10, i);
        data.push([rate, simulateCarreauYasuda(safeMfr, temp - 190, rate)]);
      }

      return {
        name: `${p.gradeName}${tempsToUse.length > 1 ? ` @ ${temp}°C` : ""}`,
        type: "line" as const,
        smooth: true,
        showSymbol: false,
        data: data,
        lineStyle: {
          width: 3.5,
          color: baseColor,
          opacity: tIdx === 0 ? 1 : 0.6,
          type: tIdx === 0 ? "solid" : (tIdx === 1 ? "dashed" : "dotted"),
          shadowBlur: 10,
          shadowColor: "rgba(0,0,0,0.1)"
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: baseColor + "33" },
            { offset: 1, color: "transparent" },
          ]),
        },
      };
    });
  });

  return {
    backgroundColor: "transparent",
    color: colorPalette,
    grid: {
      left: "8%",
      right: "5%",
      bottom: "15%",
      top: "10%",
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
              SHEAR RATE (γ̇): ${Number(paramList[0].axisValue).toExponential(2)} s⁻¹
            </div>
        `;
        
        paramList.forEach((item) => {
          const s = series[item.seriesIndex];
          // Identify the relevant range for Power Law Calculation (High shear region)
          const highShearPoints = (s.data as [number, number][])
            .filter((d) => d[0] > 10)
            .map((d) => ({ rate: d[0], stress: d[0] * d[1] }));
          const powerLaw = materialEngine.calculatePowerLawIndex(highShearPoints);
          
          html += `
            <div style="margin-bottom: 12px;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                <div style="width: 8px; height: 8px; border-radius: 2px; background: ${item.color};"></div>
                <span style="font-weight: 800; font-size: 13px;">${item.seriesName}</span>
              </div>
              <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px; padding-left: 16px;">
                <div style="display: flex; flex-direction: column;">
                  <span style="font-size: 9px; opacity: 0.6; text-transform: uppercase;">Viscosity (η)</span>
                  <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700;">${item.value[1].toExponential(2)}</span>
                </div>
                <div style="display: flex; flex-direction: column;">
                  <span style="font-size: 9px; opacity: 0.6; text-transform: uppercase;">Flow Index (n)</span>
                  <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 900; color: #f59e0b;">${powerLaw ? powerLaw.n.toFixed(3) : '-'}</span>
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
      type: "scroll"
    },
    xAxis: {
      type: "log",
      name: "γ̇ (s⁻¹)",
      nameLocation: "middle",
      nameGap: 30,
      nameTextStyle: { color: axisColor, fontWeight: 700 },
      axisLabel: { color: axisColor, fontSize: 10 },
      splitLine: { lineStyle: { color: gridLineColor } },
      axisLine: { lineStyle: { color: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" } },
    },
    yAxis: {
      type: "log",
      name: "η (Pa·s)",
      nameLocation: "middle",
      nameGap: 40,
      nameTextStyle: { color: axisColor, fontWeight: 700 },
      axisLabel: { color: axisColor, fontSize: 10 },
      splitLine: { lineStyle: { color: gridLineColor } },
      axisLine: { lineStyle: { color: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" } },
    },
    series: series as echarts.SeriesOption[],
  };
};
