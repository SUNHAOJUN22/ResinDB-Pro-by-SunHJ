# ResinDB Pro by SunHJ

浏览器端合成树脂数据管理、检索、比较、可视化与探索性计算平台。

> ResinDB Pro 是研究与工程演示软件，不是经过认证的 LIMS、ERP、质量放行系统、制造商官方牌号库或法规判定系统。演示数据、公式、统计模型和 AI 输出必须由原始检测报告、标准方法和专业人员复核。

## 主要能力

- 树脂牌号 CRUD、批量操作、分类、筛选、快照与 IndexedDB 持久化；
- CSV、JSON、TXT 导入和 CSV、JSON、XML、PDF 导出；
- Dashboard、Analytics、Pivot、材料关系网络和牌号比较；
- Carreau、WLF、Prony、Weibull、Arrhenius、Kissinger/Avrami、Monte Carlo、Sobol、Copula、Mahalanobis、K-Means、Pareto、KDE、SPC、Spearman、RSM、相似度、耐久性和数据质量等分析；
- 白名单公式解析器，支持算术、比较、`&&`、`||`、短路求值和单公式故障隔离；
- 中文/英文、明暗模式和多套配色；
- 隐私友好的本地反馈诊断与 JSON 导出；
- 可选 OpenAI-compatible AI 接口及远程 REST 数据适配器。

## 树脂数据外置

树脂数据不嵌入 React 组件，集中存放于 `src/data/`：

- `resin-taxonomy.json`：分类树；
- `resin-category-aliases.json`：分类代码和别名；
- `resin-property-groups.json`：物性字段分组；
- `resin-manufacturers.json`、`resin-references.json`；
- `polymerDatabase.json`、`myLabUniverse.json`、`openMarketUniverse.json`：版本化材料记录；
- `resin-network.json`：原料—树脂关系网络；
- `resinData.ts`：统一 loader、结构校验和确定性 demo fallback。

数据文档包含 `schemaVersion`、`dataKind`、`sourceType`、`recordStatus`、`updatedAt` 和 `data`。Loader 会拒绝不兼容版本、重复 ID、断裂父级、分类环路和损坏记录。演示数据不得冒充实测或制造商官方规格。

## 反馈

反馈窗口记录模块、类型、严重程度、标题、描述、复现步骤和环境摘要；疑似 token、密码和 API Key 会被脱敏。当前仓库没有反馈服务端，因此反馈保存在浏览器本地并可导出 JSON，不显示虚假的“已发送到服务器”。

## 安装与运行

```bash
git clone https://github.com/SUNHAOJUN22/ResinDB-Pro-by-SunHJ.git
cd ResinDB-Pro-by-SunHJ
npm ci
npm run dev
```

要求 Node.js 22 LTS 和 npm 10+。默认开发地址为 `http://127.0.0.1:3000`。

## 验证

```bash
npm ci
npm run lint
npm run typecheck
npm run test
npm run test:unit
npm run test:science
npm run test:coverage
npm run build
npm run smoke
npm run test:ui
npm run audit:prod
```

`test:ui` 启动真实生产预览并使用 Chromium 登录 Demo Admin，遍历主导航和科学图表，检查 SVG/Canvas、材料关系图、语言/主题/配色及反馈 JSON 导出，同时捕获 page error、console error 和失败请求。测试数量和覆盖率以最新 CI 为准，不作永久性能承诺。

## 安全与边界

- Demo Viewer/Editor/Admin 只是前端演示角色，不构成安全边界；
- `VITE_*` 变量会进入前端构建，生产密钥必须放在服务端网关；
- 远程数据库服务、身份认证、授权、审计和仪器连接不包含在本仓库中；
- 用户数据默认保存在当前浏览器 IndexedDB，应定期导出备份；
- 公式引擎不执行 `eval` 或任意 JavaScript；
- 生产部署应启用 HTTPS、CSP、安全响应头、服务端校验、限流和审计。

唯一长期维护分支为 `main`。提交前至少执行 `npm run validate`；正式发布还应执行覆盖率、UI smoke 和生产依赖审计。
