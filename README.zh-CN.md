# ResinDB Pro by SunHJ — 中文设计版

[English design edition](README.en.md) · [双语完整技术文档](README.md)

<!-- LOCALIZED_VISION_ZH:START -->
## 中文项目愿景图：从树脂数据到材料决策与科学可视化

<p align="center">
  <img src="docs/localized-vision/resindb-vision-zh.svg" width="100%" alt="ResinDB Pro 中文材料数据与科学决策架构">
</p>

> 图中每个模块和公式对应当前数据、计算、Worker、ECharts 与验收代码；图本身不是树脂实验数据、牌号认证或力场验证结果。

<!-- LOCALIZED_VISION_ZH:END -->

## 平台定位

ResinDB Pro 把树脂牌号、实验/参考属性、统计模型、科学计算 Worker、聚合物物理模板和可重复验收放进同一条证据链。它不是经认证的 LIMS、ERP、材料放行系统或已验证力场平台。

## 数理核心

$$
D_M(\mathbf x)=\sqrt{(\mathbf x-oldsymbol\mu)^\mathsf T\Sigma^{-1}(\mathbf x-oldsymbol\mu)}
$$

$$
\eta(\dot\gamma)=\eta_\infty+(\eta_0-\eta_\infty)\left[1+(\lambda\dot\gamma)^aight]^{(n-1)/a}
$$

$$
\Sigma_ypprox J\Sigma_	heta J^\mathsf T+\Sigma_{sample}+\Sigma_{model}+\Sigma_{transfer}
$$

## 使用策略

1. 先校验数据 Schema、单位、标准、温度、来源和证据等级。
2. 只对有限且量纲一致的数据执行统计、拟合和材料筛选。
3. 区分观测值、拟合值、代理量和情景预测。
4. 聚合物或 LAMMPS 模板必须经外部力场、平衡态和实验验证后才能形成科学结论。
5. 中文界面与科研图表必须通过 CJK 字体、ECharts 完成事件、非空 Canvas 和 PNG 证据门。

## 验收

```bash
npm ci
npm run validate:docs
npm run validate:i18n-visuals
npm run validate:scientific-ui
npm run typecheck
npm run test:unit
npm run build
npm run test:ui
```
