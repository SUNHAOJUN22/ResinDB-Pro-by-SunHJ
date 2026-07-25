# ResinDB Pro by SunHJ

![ResinDB AI Platform Overview](docs/assets/resindb-ai-platform-overview.svg)

浏览器端合成树脂数据管理、检索、比较、可视化与探索性计算平台。

> ResinDB Pro 是研究与工程演示软件，不是经过认证的 LIMS、ERP、质量放行系统、制造商官方牌号库或法规判定系统。演示数据、公式、统计模型和 AI 输出必须由原始检测报告、标准方法和专业人员复核。

![AI Workflow](docs/assets/resindb-ai-workflow.svg)

## 核心能力

- 树脂牌号 CRUD、批量操作、分类、筛选、快照与 IndexedDB 持久化；
- CSV、JSON、TXT 导入和 CSV、JSON、XML、PDF 导出；
- Dashboard、Analytics、Pivot、材料关系网络和牌号比较；
- Carreau、WLF、Prony、Weibull、Arrhenius、Kissinger/Avrami、Monte Carlo、Sobol、Copula、Mahalanobis、K-Means、Pareto、KDE、SPC、Spearman、RSM、相似度、耐久性和数据质量分析；
- 白名单公式解析器，支持安全表达式计算和故障隔离；
- 中文/英文、明暗模式、多套配色；
- 本地反馈诊断与 JSON 导出；
- 可选 OpenAI-compatible AI 接口及远程 REST 数据适配器。

## 数据架构

树脂数据独立保存于 `src/data/`，避免将材料数据库硬编码进入 UI：

- 分类、别名、物性字段组；
- 厂家与参考来源目录；
- 原料-树脂关系网络；
- 独立材料记录数据集；
- 统一 loader、结构校验和 demo fallback。

## 安装

```bash
git clone https://github.com/SUNHAOJUN22/ResinDB-Pro-by-SunHJ.git
cd ResinDB-Pro-by-SunHJ
npm ci
npm run dev
```

要求 Node.js 22 LTS 和 npm 10+。

## 自动测试闭环

提交前执行：

```bash
npm run validate
```

完整 CI 检查：

```bash
npm run validate:ci
```

包含：

- ESLint 静态检查；
- TypeScript 类型检查；
- 单元测试与科学计算回归测试；
- Coverage 检查；
- Vite 生产构建；
- Smoke 测试；
- UI 自动化验证；
- 生产依赖安全审计。

## AI 可视化资产

README 中的视觉图用于展示平台定位、数据流和科研工作流程。后续可继续扩展：

- 树脂结构-性能关系图；
- 流变模型分析流程图；
- 数据质量控制流程图；
- 材料知识网络图；
- AI 辅助科研决策流程图。

## 安全边界

- Demo Viewer/Editor/Admin 仅为前端演示角色，不构成安全边界；
- `VITE_*` 变量会进入前端构建，生产密钥必须放在服务端网关；
- 远程数据库服务、身份认证、授权、审计和仪器连接不包含在本仓库中；
- 用户数据默认保存在浏览器 IndexedDB，应定期导出备份；
- 公式引擎不执行 `eval` 或任意 JavaScript。

## 分支策略

唯一长期维护分支：`main`。

所有修复、优化和文档升级直接进入 main，避免多分支漂移。
