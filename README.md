# ResinDB Pro by SunHJ

<p align="center">
  <img src="docs/assets/resindb-ai-platform-overview.svg" alt="ResinDB Pro 平台总览：本地树脂数据空间、可视化分析、科学计算与可选 AI 助手" width="100%" />
</p>

<p align="center">
  <a href="https://github.com/SUNHAOJUN22/ResinDB-Pro-by-SunHJ/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/SUNHAOJUN22/ResinDB-Pro-by-SunHJ/actions/workflows/ci.yml/badge.svg?branch=main" /></a>
  <img alt="Node.js 22" src="https://img.shields.io/badge/Node.js-22-339933?logo=nodedotjs&logoColor=white" />
  <img alt="React 19" src="https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white" />
  <img alt="Version" src="https://img.shields.io/badge/version-3.0.0-7C3AED" />
  <img alt="Branch" src="https://img.shields.io/badge/maintained%20branch-main-0EA5E9" />
</p>

**ResinDB Pro** 是一个浏览器端合成树脂数据管理、检索、比较、可视化与探索性计算平台。它把材料记录、分类目录、知识关系、统计模型、科学计算 Worker、报告导出和可选 AI 辅助分析组织在同一个可审计工作区中。

> [!IMPORTANT]
> ResinDB Pro 是研究与工程演示软件，不是经过认证的 LIMS、ERP、质量放行系统、制造商官方牌号库或法规判定系统。演示数据、公式、统计模型和 AI 输出必须由原始检测报告、标准方法和专业人员复核。

## 为什么使用 ResinDB Pro

| 场景 | 可用能力 | 设计边界 |
|---|---|---|
| 树脂数据管理 | 牌号 CRUD、批量编辑、筛选、分类、标签、历史与快照 | 默认保存在当前浏览器 IndexedDB |
| 数据交换 | CSV、JSON、TXT 导入；CSV、JSON、XML、PDF 导出 | 导入数据需自行确认来源、单位和授权 |
| 材料分析 | Dashboard、Analytics、Pivot、牌号比较、关系网络 | 结果用于探索，不替代标准试验 |
| 科学计算 | 流变、动力学、可靠性、统计、敏感性、优化与质量分析 | 强制检查有限结果和异常输入 |
| AI 辅助 | 可选 OpenAI-compatible 接口，结合所选记录形成分析建议 | 不内置供应商，不自动替代专业判断 |
| 数据适配 | 本地 IndexedDB 或可选远程 REST 适配器 | 远程认证、授权和审计需由服务端实现 |
| 反馈诊断 | 本地反馈队列、环境摘要、敏感字段脱敏、JSON 导出 | 当前仓库不包含反馈服务端 |

## 平台架构

ResinDB Pro 采用本地优先架构：UI、数据上下文、科学 Worker 和浏览器持久化彼此解耦；远程数据库与 AI 服务均为显式可选项。

- **界面层**：React 19、响应式布局、中文/英文、明暗模式和多套配色；
- **数据层**：外置 JSON 目录、统一 loader、结构校验、IndexedDB 适配器；
- **分析层**：图表组件、白名单公式引擎、独立 Web Worker；
- **集成层**：OpenAI-compatible chat-completions endpoint 与远程 REST adapter；
- **验证层**：ESLint、TypeScript、Vitest、Coverage、Vite build、HTTP smoke、Chromium UI smoke 和生产依赖审计。

## 数据生命周期

<p align="center">
  <img src="docs/assets/resindb-data-lifecycle.svg" alt="树脂数据从导入、校验、归一化、本地持久化到可移植导出的生命周期" width="100%" />
</p>

树脂分类、目录、关系和材料记录均保存在 `src/data/`，没有重新硬编码进 React 组件：

| 文件 | 用途 |
|---|---|
| `resin-taxonomy.json` | 树脂分类树 |
| `resin-category-aliases.json` | 分类代码与别名映射 |
| `resin-property-groups.json` | 物性字段分组 |
| `resin-manufacturers.json` | 厂家目录 |
| `resin-references.json` | 参考来源目录 |
| `resin-network.json` | 原料、树脂和关系网络 |
| `polymerDatabase.json` | 演示材料数据库 |
| `myLabUniverse.json` | 独立实验室记录数据集 |
| `openMarketUniverse.json` | 独立市场记录数据集 |
| `resinData.ts` | loader、结构校验与确定性 fallback |

Loader 同时接受旧数组格式和带 `schemaVersion`、`dataKind`、`sourceType`、`recordStatus`、`updatedAt`、`data` 元数据的版本化文档，并检查损坏记录、重复 ID 和分类环路。演示记录不得冒充实测数据或制造商正式规格。

## 科学计算引擎

<p align="center">
  <img src="docs/assets/resindb-scientific-engine.svg" alt="ResinDB Pro 科学计算引擎：流变、动力学、可靠性、统计、优化与质量控制" width="100%" />
</p>

主要计算能力包括：

- **流变与松弛**：Carreau、WLF、Prony；
- **动力学与可靠性**：Arrhenius、Kissinger、Avrami、Weibull、耐久性分析；
- **统计与不确定度**：Monte Carlo、Sobol、Copula、KDE、Bayes、预测；
- **相似性与多变量分析**：Mahalanobis、Spearman、K-Means、PCA、相似度；
- **优化与质量**：Pareto、MOO、RSM、SPC、数据质量、特征重要性；
- **公式计算**：白名单表达式解析，支持算术、比较、`&&`、`||`、短路求值和单公式故障隔离。

计算密集型任务优先在独立 Worker 中运行。科学回归测试要求主要 Worker 对有效输入返回有限数值，并避免未处理的 `ERROR`、`NaN` 或 `Infinity`。

## 树脂知识网络

<p align="center">
  <img src="docs/assets/resindb-knowledge-network.svg" alt="树脂牌号与聚合物类别、物性、工艺、厂家、参考来源及相似牌号之间的关系网络" width="100%" />
</p>

关系网络用于浏览树脂家族、牌号、厂家、来源和可比较材料之间的连接。它是探索入口，不代表因果关系，也不应把目录邻接关系直接解释为结构—性能机理。

## AI 辅助分析

<p align="center">
  <img src="docs/assets/resindb-ai-workflow.svg" alt="AI 辅助分析闭环：研究问题、证据选择、确定性计算、解释与人工复核" width="100%" />
</p>

AI 能力默认关闭，平台不内置或强制选择任何供应商。启用时，推荐流程是：

1. 明确研究问题和接受标准；
2. 选择并核对材料记录；
3. 由公式引擎和科学 Worker 执行确定性计算；
4. AI 对已选择的数据和结果进行组织与解释；
5. 由研究人员核对来源、单位、适用范围和结论。

AI 输出不构成试验事实、法规结论、牌号认证、质量放行或安全建议。

## 本地优先与隐私边界

<p align="center">
  <img src="docs/assets/resindb-local-first-privacy.svg" alt="浏览器本地工作区与可选远程 AI、REST 网关之间的隐私边界" width="100%" />
</p>

默认配置使用 IndexedDB。语言、主题、配色、历史和待处理反馈均保存在浏览器侧。远程适配器和 AI endpoint 只有在显式配置后才会使用。

> [!WARNING]
> 所有 `VITE_*` 环境变量都会进入前端构建。只能使用受限的本地开发密钥；生产环境必须通过有认证、授权、限流和审计的服务端网关调用外部服务。

## 典型科研工作流

<p align="center">
  <img src="docs/assets/resindb-research-workflow.svg" alt="从材料问题定义、数据整理、模型分析、方案比较到证据包导出的科研工作流" width="100%" />
</p>

一个可复核的使用路径是：定义材料问题 → 整理记录 → 执行模型与不确定度分析 → 比较候选牌号 → 导出数据、图表和 QA 报告。导出文件应与原始报告、测试条件、公式参数和人工复核记录一同保存。

## 快速开始

### 环境要求

- Node.js **22 LTS**；
- npm **10+**；
- Chromium-compatible browser（仅 `test:ui` 需要）。

### 安装与运行

```bash
git clone https://github.com/SUNHAOJUN22/ResinDB-Pro-by-SunHJ.git
cd ResinDB-Pro-by-SunHJ
npm ci
npm run dev
```

默认开发地址为 `http://127.0.0.1:3000`。

登录页提供 Demo Admin、Demo Editor 和 Demo Viewer 三个演示角色。它们只用于前端能力展示，不执行真实身份认证，也不构成权限安全边界。

### 环境配置

```bash
cp .env.example .env.local
```

| 变量 | 说明 |
|---|---|
| `VITE_AI_API_ENDPOINT` | 完整 OpenAI-compatible chat-completions endpoint |
| `VITE_AI_MODEL` | 由所选服务端要求的模型标识 |
| `VITE_AI_API_KEY` | 仅限受限的本地开发 token |
| `VITE_DATABASE_ADAPTER_TYPE` | `indexeddb`（默认）或 `remote_api` |
| `VITE_REMOTE_API_BASE_URL` | 远程 REST 基础路径 |
| `VITE_REMOTE_READ_FALLBACK` | 远程读取/导出的本地 fallback 开关 |

远程写入失败不会静默回退到 IndexedDB，以免浏览器与服务器形成分叉数据库。

## 自动测试与质量门

<p align="center">
  <img src="docs/assets/resindb-quality-gates.svg" alt="安装、静态检查、科学回归、构建、浏览器 UI 和依赖安全质量门" width="100%" />
</p>

提交前执行：

```bash
npm run validate
```

完整验证执行：

```bash
npm run validate:ci
```

也可以逐项执行：

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

`validate` 串联 lint、typecheck、完整测试、生产构建和 HTTP smoke；`validate:ci` 进一步执行隔离的单元测试、科学测试、覆盖率、Chromium UI 和生产依赖审计。

最新自动审计基线使用 Node.js 22 / npm 10 / Linux，验证 **9 个测试文件、79 个测试用例**，并通过中文浅色和英文深色 Dashboard UI smoke。覆盖率是当前测试范围的证据，不是对未来提交的永久承诺。完整结果见 [`reports/final-validation-20260726/REPORT.md`](reports/final-validation-20260726/REPORT.md) 和 [`docs/VALIDATION.md`](docs/VALIDATION.md)。

## 可复现视觉资产

本 README 的八张功能图采用统一视觉系统，由 AI 辅助设计并通过仓库脚本确定性生成，不依赖外部图片链接：

```bash
python3 scripts/generate-readme-visuals.py
```

生成器使用 Python 标准库，并在写入前解析每个 SVG，确保 XML 结构有效。每张图均包含 `<title>`、`<desc>` 和无障碍关联属性。图示只描述仓库中实际存在的功能或明确标注的边界，不作为运行截图或测试证据。

## 项目结构

```text
.
├── .github/workflows/ci.yml       # main 分支永久质量门
├── docs/
│   ├── VALIDATION.md              # 验证合同与最新基线
│   └── assets/                    # README 功能图
├── scripts/
│   ├── generate-readme-visuals.py
│   ├── run-test-files.mjs
│   ├── smoke-test.mjs
│   └── ui-smoke-test.mjs
├── src/
│   ├── components/                # 页面、图表、功能与弹窗
│   ├── contexts/                  # 数据、认证、语言、主题与 UI 状态
│   ├── data/                      # 外置树脂数据与目录
│   ├── hooks/                     # 应用、数学和 Worker hooks
│   ├── lib/                       # 适配器、公式与材料计算工具
│   ├── services/                  # AI 与数学服务
│   └── workers/                   # 科学计算 Worker
├── tests/
│   ├── science/                   # 科学、数据、公式和 Worker 回归
│   └── unit/                      # UI 与应用单元测试
├── package.json
└── vite.config.ts
```

## 安全与部署边界

- Demo 角色不是安全认证；
- 远程身份、权限、审计、仪器连接和质量放行流程不包含在本仓库中；
- 生产部署应启用 HTTPS、CSP、安全响应头、服务端校验、限流、备份和审计；
- 浏览器 IndexedDB 数据应定期导出备份；
- 公式引擎不使用 `eval` 或 `new Function` 执行用户表达式；
- 第三方 API、制造商数据和法规要求必须由部署方独立核验。

更多安全说明见 [`SECURITY.md`](SECURITY.md)。

## 分支策略

唯一长期维护分支为 **`main`**。仓库 CI 在 `main` push 时核对远程分支清单，并拒绝存在额外远程分支的发布验证。所有长期维护代码、测试、数据和文档以 `main` 为准。
