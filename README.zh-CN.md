# ResinDB Pro by SunHJ — 中文设计版

[English design edition](README.en.md) · [双语完整技术文档](README.md)


<!-- CLOSURE_STATUS_START -->
## 当前代码资格与使用边界

- `CI` 是完整软件门；`contracts-v17` 只补充 Linux/Windows 跨平台筛查回归。
- 已删除重复的 exact-tree、V19 自定义状态和第二套 full-qualification 工作流；主 CI 本身生成 exact-tree 证据。
- Spearman 相关矩阵使用统一有限数解析与完整案例筛选；缺失、空白、布尔、格式错误及非有限值保持为“未观测”，不再静默改写为物理零。
- 浏览器 AI 仅可调用同源 `/api/ai/proxy`，不保存供应商密钥，并默认拒绝牌号、厂商、配方和自由文本出站。
- 软件通过不代表服务器代理已部署，也不代表密钥托管、隐私/法务、材料放行、法规合规或实验真实性已经获批。
<!-- CLOSURE_STATUS_END -->

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

多变量异常度使用 Mahalanobis 距离：

$$
D_M(\mathbf{x})=
\sqrt{(\mathbf{x}-\boldsymbol{\mu})^{\mathsf T}
\boldsymbol{\Sigma}^{-1}
(\mathbf{x}-\boldsymbol{\mu})}.
$$

非牛顿流变代理采用 Carreau–Yasuda 形式：

$$
\eta(\dot\gamma)=
\eta_\infty+
(\eta_0-\eta_\infty)
\left[1+(\lambda\dot\gamma)^a\right]^{(n-1)/a}.
$$

决策观测量的不确定度预算保持参数、采样、模型和尺度迁移项分离：

$$
\boldsymbol{\Sigma}_y
\approx
\mathbf{J}\boldsymbol{\Sigma}_\theta\mathbf{J}^{\mathsf T}
+
\boldsymbol{\Sigma}_{\mathrm{sample}}
+
\boldsymbol{\Sigma}_{\mathrm{model}}
+
\boldsymbol{\Sigma}_{\mathrm{transfer}}.
$$

科学图表只有在数值有限、语义标签完整、ECharts 完成绘制且 Canvas 非空时才进入验收：

$$
C_{\mathrm{figure}}
=
C_{\mathrm{finite}}
\land C_{\mathrm{labeled}}
\land C_{\mathrm{finished}}
\land C_{\mathrm{nonblank}}.
$$

以上分项直接相加，以及概念图中的平方和预算，要求各项已映射到同一观测量、采用一致单位且互不相关。相关输入应保留交叉协方差；一般的一阶传播为 $u_y^2\approx\sum_{i,j}J_iJ_j\operatorname{Cov}(x_i,x_j)$。这些预算公式说明建模条件，不宣称软件已经验证任意材料系统的不确定度。

## 相似度与雷达图：已实现的数值合同

对应实现为 `src/services/mathUtils.ts`，永久回归位于 `tests/unit/mathUtils.test.ts`。先统一单位，再解析完整十进制或科学计数法；空字符串、布尔值、部分数字字符串、NaN 和无穷均不作为观测值。

对有限特征的最小值 $a$、最大值 $b$，常规归一化为 $z=(x-a)/(b-a)$。有限的异号端点仍可能使浮点差值 $b-a$ 溢出；此时先取 $s=\max(|a|,|b|)$，采用等价形式：

$$
z=\frac{x/s-a/s}{b/s-a/s}.
$$

结果限制在 $[0,1]$。现有常量特征判据保持不变：数值范围必须大于 $32\epsilon\max(1,|a|,|b|)$，并至少存在两个有限观测；这个阈值是软件的数值筛选规则，不是测量仪器分辨率。

令 $q$ 为目标的可比较有效特征数，$m$ 为候选与目标的共同有效特征数。候选必须满足 $m\ge2$，评分为：

$$
S=\operatorname{round}\left[
100\frac{m}{q}\max\left(0,1-
\sqrt{\frac{1}{m}\sum_{j=1}^{m}(z_{tj}-z_{pj})^2}
\right)\right].
$$

缺失维度通过 $m/q$ 降低可信覆盖度，不填充为零。雷达图使用同一组全局范围，显示 $100z$，且只保留所有选中牌号都有有限值的维度。

欧氏距离以逐项 `Math.hypot` 累积，避免直接平方把可表示的距离变成无穷或零。若真实距离本身超过浮点表示范围，调用方仍须拒绝非有限结果进入图形。特征统计使用无原型字典，`__proto__`、`constructor` 和 `toString` 不再与对象继承属性混淆。

定向复现命令（先安装锁定依赖）：

```bash
npm ci
npx vitest run tests/unit/mathUtils.test.ts --pool=forks --maxWorkers=1
npm run validate:unicode
npm run validate:scientific-ui
```

回归覆盖大数、极小数、601 个数量级、极大异号范围、保留属性名、普通覆盖度评分和雷达坐标。定向回归通过不等于完整 CI、浏览器视觉验收或六小时耐久测试通过。

## 使用策略

1. 先校验数据 Schema、单位、标准、温度、来源和证据等级。
2. 只对有限且量纲一致的数据执行统计、拟合和材料筛选。
3. 区分观测值、拟合值、代理量和情景预测，统计关联不得升级为因果结论。
4. 聚合物或 LAMMPS 模板必须经外部力场、平衡态和实验验证后才能形成科学结论。
5. 中文界面与科研图表必须通过 CJK 字体、ECharts `finished` 事件、非空 Canvas 和 PNG 证据门。
6. README、SVG 和翻译资源统一接受 UTF-8、Unicode、控制字符、CJK 字体和本地图片路径审计。

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

软件验收只覆盖数据合同、计算实现、界面显示和可重复证据；牌号放行、实验真实性、力场适用性和工业决策仍需独立资格证据。

<!-- CURRENT_MAIN_ACCEPTANCE_V2:START -->
## 当前实现：代码、数学与使用策略

![中文代码与数学合同概念图](docs/current-main/resindb-current-main-zh.svg)

> ResinDB Pro 是本地优先的科学数据与分析工作台，不是经认证的 LIMS/ERP、商业力场、工业牌号放行系统或自动科研批准器。

#### 连续坐标的核密度

$$
\widehat f(x,y)=\frac{1}{2\pi n h_xh_y}\sum_{i=1}^n\exp\!\left[-\frac12\left(\frac{x-x_i}{h_x}\right)^2-\frac12\left(\frac{y-y_i}{h_y}\right)^2\right]
$$

二维独立高斯核使用正带宽；密度具有 x、y 单位乘积的倒数单位。新绘图层使用连续坐标自定义单元格，保留原始密度，不把坐标冒充类别索引。有限显示窗口的积分一般小于 1；颜色强度或“相对最大值”不是概率。

源码对应: [`src/compute/gaussianKde.ts`](src/compute/gaussianKde.ts) · [`src/components/charts/kdeFigure.ts`](src/components/charts/kdeFigure.ts)

#### Weibull 中位秩拟合

$$
F(v)=1-e^{-(v/\eta)^m},\qquad \ln[-\ln(1-F(v))]=m\ln v-m\ln\eta,\qquad B_5=\eta[-\ln(0.95)]^{1/m}
$$

v、η 必须为正，m 为形状参数。界面采用 Bernard 中位秩的普通最小二乘线性化，而非极大似然估计（not MLE）。B5 是模型的 5% 失效分位数，不是 95% 参数置信下限，也不是安全放行保证。中文与英文标题、图例及提示随语言切换。

源码对应: [`src/components/charts/WeibullChart.tsx`](src/components/charts/WeibullChart.tsx)

#### 图形交付门

$$
C_{\mathrm{figure}}=C_{\mathrm{finite}}\land C_{\mathrm{labels}}\land C_{\mathrm{finished}}\land C_{\mathrm{nonblank}}
$$

这是绘图验收的解释性合同：记录有限数据量、轴标签、完成事件和非空画布证据，并区分无数据与图形引擎不可用。它不是只凭截图就能推定成立的科学正确性证明；浏览器、主题、语言与重新打开图表均需测试。

源码对应: [`src/components/charts/ScientificEChart.tsx`](src/components/charts/ScientificEChart.tsx)

### 使用与验收顺序

1. 先核对安装环境、输入结构、单位、有效范围与执行权限。
2. 按上面的源码锚点区分原生实现、解释性合同和外部执行要求。
3. 先运行快速回归和完整质量门，再用固定提交执行长期回归。
4. 逐项保存原始日志、机器报告和限制；任何缺失证据不得写成 PASS。

```bash
npm ci
npm run validate:ci
```

每次修复均须绑定新提交重新测试。基线回归、两段各三小时的重复回归、浏览器图形检查和外部工程认证是不同证据，不可互相替代。没有原始回执时，不宣称已完成六小时验收。

源码锚点: [`src/data/dataContract.ts`](src/data/dataContract.ts) · [`src/services/mathUtils.ts`](src/services/mathUtils.ts) · [`src/compute/capabilityProbe.ts`](src/compute/capabilityProbe.ts)

<!-- CURRENT_MAIN_ACCEPTANCE_V2:END -->
