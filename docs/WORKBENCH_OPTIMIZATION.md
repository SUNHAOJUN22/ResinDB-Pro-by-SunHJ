# Workbench optimization / 工作台优化

## Implemented changes / 已实现的改动

The existing analysis methods remain available. The method selector is now a
searchable, grouped navigation component rather than an inline list in the
large Legacy visualizer. The method panel is tied to the active analysis and
shows only that method's implemented formula, where one is registered. Its
filtered-record count is **not** a valid-sample or fitted-sample count.

已有分析方法继续保留。方法选择器改为可搜索、分组的独立导航组件，不再在大型
Legacy 可视化组件中内联维护。方法面板绑定当前分析，仅展示已登记且对应实现的
公式；其中的筛选记录数**不是**有效样本数或拟合样本数。

Heavy tools mount only on first activation. A local Suspense boundary prevents
an unopened modal or AI assistant from suspending the rest of the workspace.
After first use, the original component stays mounted so closing a tool does not
silently discard an unfinished draft. This is not an automatic memory-eviction
policy. The optional dashboard trends section is also loaded on demand.

重型工具仅在首次启用时挂载。局部 Suspense 边界防止未打开的弹窗或 AI 助手阻塞
整个工作区。首次使用后保留组件，关闭工具不应悄悄丢弃未完成草稿；这不是自动
内存淘汰机制。可选的仪表板趋势区也改为按需加载。

## Complete static JavaScript budget / 完整静态脚本预算

`vite.config.ts` emits the Vite build manifest. `scripts/lib/build-budget.mjs`
walks the entry's transitive **static** imports, deduplicates cycles/chunks and
reconciles the actual gzip sizes. Dynamic imports are excluded from this
specific budget, not from performance responsibility. First-use latency of a
lazy tool must still be measured separately.

Vite 生成构建清单；预算程序遍历入口的全部传递**静态**导入，对循环和重复块去重，
核对实际 gzip 大小。动态导入仅不计入这一特定预算，不能因此省略首次使用延迟验证。

The new hard budget is **400,000 gzip bytes** for the entry plus its static
JavaScript closure. The original entry-only 350,000-byte and ECharts raw
900,000-byte limits remain in force. A missing or inconsistent manifest fails
closed; a receipt cannot pass on an entry-only size report.

新增硬门槛为入口加静态 JavaScript 依赖合计 **400,000 gzip 字节**。原入口单文件
350,000 字节和 ECharts 原始 900,000 字节门槛保持。清单缺失或不一致时拒绝通过；
只有入口体积的旧报告不能取得新的构建预算回执。

This is compressed build-asset evidence, not a browser download-time, INP or
end-to-end speedup measurement. CSS, fonts, dynamic chunks and external data
have distinct costs and must remain visible in real browser acceptance.

这属于压缩构建资源证据，不是浏览器下载时间、INP 或端到端加速比。CSS、字体、
动态块和外部数据的成本需要在真实浏览器验收中另行核对。

## Scientific chart lifecycle / 科学图表生命周期

A chart-owned scheduler coalesces resize requests into at most one animation
frame callback and one layout read. Unchanged dimensions do not trigger another
resize unless font loading explicitly invalidates text layout. Hidden hosts
wait for a positive size; unmount and language-driven reconstruction cancel the
owned callback. Full option replacement is deliberately preserved, preventing
stale series from surviving a change of scientific method.

图表自有调度器将 resize 请求合并为每帧至多一次回调和一次布局读取。尺寸未变化时
不重复 resize，字体加载明确使文本布局失效时除外。隐藏容器等待非零尺寸；卸载和
切换语言重建时取消自身回调。保留 option 完整替换，避免切换科学方法后残留旧曲线。

## Numerical and observation contract / 数值与观测合同

Mahalanobis Worker messages admit only own-property, finite `number` values.
`null`, booleans, blank strings and numeric strings are not silently coerced to
zero or observations. Diagnostics separately report supplied, excluded and
used records. Real zero values remain valid.

Mahalanobis Worker 仅接受自有字段中的有限 `number`。`null`、布尔、空字符串和
数字字符串不会被静默转换为零或观测。诊断分别报告输入、排除和使用记录数；真实零
仍然有效。

The Worker now uses a numerical inverse chi-square survival function:

$$
Q(\nu/2,q/2)=\alpha,\qquad q_{\nu=2}=-2\ln\alpha.
$$

Integer degrees of freedom are bounded to 1 through 1,000,000 and
$0<\alpha<0.5$. Other degrees use a bounded log-tail incomplete-gamma evaluation
and bracketed inversion. The explicitly named Wilson–Hilferty compatibility
function remains approximate, but no longer loses the tail through `1-alpha`.
The permanent reference fixture records SciPy version and independent inverse
survival values across ordinary and extreme tails.

自由度限定为 1 到 1,000,000 的整数，且 $0<\alpha<0.5$。其他自由度使用有界的
对数尾部不完全伽马计算与括区间求逆。明确命名的 Wilson–Hilferty 兼容函数仍为近似，
但不再通过 `1-alpha` 丢失极小尾部。永久参考夹具记录 SciPy 版本及普通、极端尾部
的独立逆生存函数数值。

The Worker model version is `regularized-cholesky-mahalanobis-3.0.0` and its
threshold diagnostic is `numerical-inverse-gamma`. More accurate distribution
quantiles do **not** establish calibrated false-positive rates for covariance
estimated/regularized on the same observations. These outputs remain screening,
not causal inference, independent validation or material release certification.

Worker 模型版本为 `regularized-cholesky-mahalanobis-3.0.0`，阈值诊断为
`numerical-inverse-gamma`。更准确的分布分位数**不等于**对同一数据拟合或正则化
协方差后的误报率已校准。输出继续属于筛查，不是因果推断、独立验证或材料放行认证。

## Regression commands / 回归命令

```bash
npm run validate:ci
node --test scripts/tests/build-budget-contract.node.mjs scripts/tests/validation-receipt-contract.node.mjs
npx vitest run tests/science/mahalanobisTailAndAdmission.test.ts tests/unit/deferredMount.test.tsx tests/unit/analysisWorkbench.test.tsx tests/unit/chartResizeScheduler.test.ts
```

Actual CI and browser evidence must be bound to the committed tree. This
document does not declare a future run successful or reuse six-hour receipts
from an older revision.

实际 CI 和浏览器证据必须绑定提交树。本文不预先宣称未来运行成功，也不复用旧版本
六小时回执。
