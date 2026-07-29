# ResinDB Pro 数理程式全面审计与计算加速记录

## 1. 审计目标

本审计覆盖 `src/workers` 下全部 24 个 Worker，以及 `src/compute` 数值基础层。目标是同时控制四类风险：

1. 公式名称与真实计算不一致；
2. 显式求逆、病态矩阵和无界迭代造成数值不稳定；
3. O(N²) 或大规模对象保存造成交互延迟和内存膨胀；
4. 未记录 seed、算法版本、模型假设和近似方法，导致结果不可复现或被过度宣传。

本记录不把工程优化直接等同于销量增长。代码可提升速度、可信度、演示效果和采购评估通过率，但销量还取决于数据质量、目标客户、定价、部署、培训和销售渠道。

## 2. 本轮已完成的数值基础建设

新增或统一：

- `random.ts`：`xoshiro128** 1.0.0`、稳定 seed 派生和正态采样；
- `leastSquares.ts`：Householder QR 与 Jacobi-SVD 伪逆；
- `gaussianProcess.ts`：单次 RBF 核分解、Float64Array 输入与 scratch 复用；
- `linearAlgebra.ts`：尺度自适应 Cholesky、三角求解和点积；
- `pareto.ts`：二维排序扫描与多维增量前沿；
- `distributions.ts`：Acklam 标准正态分位数与 Wilson–Hilferty 卡方上尾分位数；
- Lazy Worker Pool、任务优先级、取消、超时、进度、空闲销毁和 Transferable 通道。

## 3. 全部 Worker 审计结论

| Worker | 数学/性能结论 | 当前状态 | 下一动作 |
|---|---|---|---|
| Arrhenius | `ln(time)` 对 `1/T` 线性化可用于对数寿命模型；原 `lnA` 名称可能被误读为速率预指数因子 | 已补正 | 保留兼容字段，新增截距真实含义与模型版本 |
| Weibull | Bernard 中位秩线性回归有效，但不是 MLE；必须要求正形状和正尺度 | 已补正 | 输出估计器类型与 5% 失效分位定义 |
| KDE | 原二维 KDE 使用单变量 Scott 指数且缺少密度归一化 | 已修复 | 使用 `n^(-1/6)` 与 `1/(2πnhxhy)` |
| Spearman | 平均秩与秩 Pearson 逻辑正确 | 通过 | 后续增加大矩阵 TypedArray 输出 |
| RSM | 原法方程显式求逆不稳定 | 已修复 | QR 默认、SVD 回退、秩/条件数/残差证据 |
| History | 数据历史处理，不属于科学模型 | 非数值模型 | 维持数据合同测试 |
| Pareto | 二目标已具备 O(N log N) 路线；多目标原为全量 O(N²) | 已统一 | 二维排序扫描，多维增量前沿维护 |
| Similarity | 缺失物性被当作真实零值；全量两两相似度仍为 O(N²D)，边数量可能爆炸 | 阻断项 | 均值/显式缺失策略、top-k 稀疏边、规模门限 |
| SPC | Cp/Cpk 公式正确；原代码未过滤非有限值，PPM 隐含正态假设 | 已补正 | 样本标准差、正态 PPM 假设和观测数显式返回 |
| Copula | Gaussian copula PDF 公式可用；原秩未处理 ties | 已修复 | 平均秩、中心化 normal scores、共享分位数函数 |
| Kinetics | Kissinger 线性化可用；由峰温拟合直接生成一级等温转化曲线属于额外模型假设 | 已补正 | 明确一级转化假设、单位和模型版本 |
| WLF | 注释称水平移位，实际同时执行 `x+log(aT)` 与 `y-log(aT)`；缺少垂直移位定义 | 科学阻断项 | 在确认黏度/模量主曲线定义、`aT` 与 `bT` 后重写 |
| Prony | 广义 Maxwell 储能/损耗公式正确；原投影梯度上限 100,000 次且无收敛证据 | 已加速 | 非负 FISTA、谱步长、10,000 上限和收敛诊断 |
| Carreau | Carreau–Yasuda 公式主体正确；参数拟合只是粗网格 + 固定步长梯度，`a` 未连续优化 | 高风险待改 | 有界信赖域/LM 或多起点 Nelder–Mead，输出参数置信度 |
| Data | 数据排序/聚合，不属于科学模型 | 非数值模型 | 维持性能与数据完整性测试 |
| MOO | 原 10,000 候选后 O(C²) Pareto，重复 GP 代码与不可复现随机 | 已加速 | 单次核分解、多目标共享、Seeded RNG、二维排序扫描、reservoir sample |
| Mahalanobis | 原显式协方差逆、固定绝对正则和仅三个 alpha | 已修复 | Cholesky 求解、尺度正则、任意合法 alpha、平方距离定义 |
| Bayes | 原保存并排序全部候选但只返回 5 个，且随机不可复现 | 已加速 | 单次核分解、streaming top-5、Seeded RNG、性能证据 |
| Feature Importance | 原 `(XᵀX+λI)⁻¹Xᵀy` 显式求逆 | 已修复 | Ridge 增广系统 + QR/SVD，返回求解诊断 |
| K-Means | 已 Seeded RNG；完整 Silhouette 对多个 k 仍可能为 O(KN²D) | 待规模优化 | 小样本完整 Silhouette，中样本抽样，大样本 CH 指标/MiniBatch |
| Monte Carlo | 已可复现并有证据；逐样本构造 Product 对象仍有对象分配成本 | 待批处理 | 编译公式的数值向量入口、批量 TypedArray、WASM/WebGPU 候选 |
| Sobol | 已明确 Jansen/Saltelli 伪随机正态设计，不再冒充 Sobol 序列 | 边界已纠正 | 真正低差异 Sobol 序列属于后续独立内核 |
| Data Quality | 数据质量统计，不属于物理模型 | 非数值模型 | 维持规则和缺失定义测试 |
| Forecasting | 先按经验系数合成历史，再对合成数据预测；不是基于真实时序或老化试验的预测 | 声明阻断项 | UI 改称“情景模拟”，禁止宣传为验证寿命预测 |

## 4. 本轮复杂度与内存改进

| 模块 | 原实现 | 当前实现 |
|---|---|---|
| Bayes 候选保存 | O(C) 对象并全排序 | 仅保留 top-5，存储 O(1) |
| MOO 二目标 Pareto | O(C²) | O(C log C) 排序扫描 |
| MOO 展示候选 | 全量打乱后截取 | Seeded reservoir，保留上限 1,000 |
| GP | Bayes/MOO 各自复制数值循环 | 统一 Float64Array 核与 scratch 复用 |
| Feature Importance | 显式逆矩阵 | Ridge 增广 + QR/SVD |
| Mahalanobis | 显式协方差逆 | Cholesky 一次分解 + 每样本三角求解 |
| Prony 优化 | 最多 100,000 次固定步长 PGD | 最多 10,000 次谱步长 FISTA |
| Pareto Worker | 多处自建支配判断 | 统一前沿求解器 |

上述为复杂度和实现结构改进，不是未经 benchmark 验证的倍数承诺。

## 5. 商业化与销量相关的可验证改进

可以作为产品竞争力证据：

- 同 seed 完全复现，便于客户验收和科研审计；
- 每个模型返回算法版本、估计器、近似方法和假设；
- 长任务有进度、取消和资源上限；
- Bayes/MOO/Prony 的候选和迭代成本显著受控；
- 病态矩阵不再依赖静默求逆；
- 对“情景模拟”和“验证预测”建立声明边界。

不得直接宣传：

- “GPU 加速若干倍”，除非完成同机 benchmark；
- “Sobol 序列”，当前只计算 Sobol 指数；
- “真实寿命预测”，当前 Forecasting 使用合成情景；
- “Abaqus 完整体积与剪切松弛辨识”，当前 Prony 卡片使用相同松弛比假设；
- “WLF 标准主曲线”，直到移位定义完成证据核验。

## 6. 后续优先级

### P0：当前精确树验收

- TypeScript、全部科学测试、覆盖率、生产构建、UI smoke、依赖审计；
- 新增 benchmark 前不宣传具体速度倍数。

### P1：规模性能

1. Similarity：缺失值策略、top-k 稀疏图和边上限；
2. K-Means：分规模评价指标和 MiniBatch；
3. Monte Carlo/Sobol：批量数值输入与对象分配消除；
4. RSM/K-Means TypedArray Transferable 端到端适配。

### P2：模型证据

1. WLF 主曲线定义与垂直移位因子；
2. Carreau–Yasuda 有界非线性求解器；
3. Forecasting 重命名为情景模拟，或接入真实时序/加速老化数据；
4. Weibull MLE 与置信区间作为专业模式。

### P3：产品转化

- 在结果页展示“可复现收据”和“模型适用边界”；
- 提供一键 benchmark 报告；
- 为采购/研发评审提供 PDF 计算证据；
- 用真实客户数据建立案例，而不是用未经验证的性能倍数或预测声明。
