<div align="center">

# ResinDB Pro

### 合成树脂数据管理与材料分析工作台

**Synthetic Resin Data Management & Materials Analysis Workbench**

[![CI](https://github.com/SUNHAOJUN22/ResinDB-Pro-by-SunHJ/actions/workflows/ci.yml/badge.svg)](https://github.com/SUNHAOJUN22/ResinDB-Pro-by-SunHJ/actions/workflows/ci.yml)
![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Storage](https://img.shields.io/badge/default-IndexedDB-5A0FC8)
![Branch](https://img.shields.io/badge/branch-main-181717?logo=github)

面向树脂牌号、实验记录和多维物性数据的浏览器端管理、检索、比较和探索性分析应用。

</div>

> **使用边界**：本项目是研究和工程演示工具，不是经过认证的 LIMS、ERP、质量放行系统或法规判定系统。界面计算、演示数据和 AI 输出均不得替代原始检测报告、标准方法或专业审核。

## 1. 当前能力

| 模块 | 状态 | 说明 |
|---|---:|---|
| 牌号数据管理 | 可用 | 新增、编辑、删除、批量编辑、标签和优先级 |
| 本地持久化 | 默认启用 | IndexedDB，无服务器也可使用 |
| 检索与筛选 | 可用 | 文本、分类、完整度、数值条件和高级筛选 |
| 导入 | 可用 | CSV、JSON、TXT；导入前提供字段映射与预览 |
| 导出 | 可用 | CSV、JSON、XML、PDF |
| 分析与比较 | 可用 | Dashboard、Analytics、Pivot、牌号比较、关系图 |
| 公式引擎 | 可用 | 白名单数值语法，不执行任意 JavaScript |
| 本地计算沙箱 | 可用 | Carreau、WLF、Weibull 透明公式计算 |
| AI API | 可选 | 用户自行填写 OpenAI-compatible endpoint 和模型 |
| 远程数据库 | 仅前端适配器 | 本仓库不包含服务端实现 |
| 登录角色 | 演示模式 | 不是正式身份认证或授权系统 |

仓库内置的是小规模演示数据集。其用途是验证界面流程，不应被视为制造商完整牌号库。

## 2. 本轮工程治理

仓库已移除不属于产品源码的内容，包括：

- 大体积 AI 会话和迁移历史；
- IDE/Agent 自动生成目录；
- 重复 DOCX、日志、检查结果和临时修复脚本；
- README 专用截图和无运行价值的图片资产；
- 未使用的 Firebase 项目配置；
- 重复认证组件和不可达源码；
- 固定供应商 AI SDK、CLI 和伪造 MCP/仪器遥测逻辑；
- 未使用的 Firebase 运行时依赖和不再维护的浏览器 XLSX 解析器；

关键行为也已收敛：刷新失败不再显示成功或覆盖当前数据；沙箱不再声称执行外部软件、连接真实仪器或生成虚假实验日志。

## 3. 快速启动

### 3.1 环境

- Node.js 22 LTS
- npm 10 或更高版本
- Chrome、Edge、Firefox 或 Safari 的近期版本

### 3.2 Windows PowerShell

```powershell
git clone https://github.com/SUNHAOJUN22/ResinDB-Pro-by-SunHJ.git
cd ResinDB-Pro-by-SunHJ
Copy-Item .env.example .env.local
npm ci
npm run dev
```

### 3.3 macOS / Linux

```bash
git clone https://github.com/SUNHAOJUN22/ResinDB-Pro-by-SunHJ.git
cd ResinDB-Pro-by-SunHJ
cp .env.example .env.local
npm ci
npm run dev
```

浏览器访问终端显示的本地地址，默认通常为：

```text
http://localhost:5173
```

不配置 AI 和远程 API 时，核心数据管理功能仍可正常运行。

## 4. 实机操作演示

以下流程与仓库 CI 使用同一套命令和代码路径。

### 4.1 工程验证

```bash
npm ci
npm run validate
```

`validate` 顺序执行：

```text
ESLint → TypeScript → Vitest → Vite production build → HTTP smoke test
```

验证通过应满足：

```text
lint       PASS (zero warnings)
typecheck  PASS
test       PASS
build      PASS
smoke      PASS (preview page contains #root)
```

也可以逐项执行：

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run smoke
```

### 4.2 首次进入

1. 启动 `npm run dev`；
2. 在演示角色页选择 Viewer、Editor 或 Admin；
3. 进入 Dashboard；
4. 确认牌号数量、分类和数据完整度卡片正常显示；
5. 打开浏览器开发者工具，确认没有启动错误。

角色页只控制前端演示权限。正式部署必须由服务端完成身份认证和授权。

### 4.3 新增和编辑牌号

1. 点击 **Add Product**；
2. 填写牌号、制造商和分类；
3. 为物性填写数值、单位、标准和温度条件；
4. 保存后在表格中搜索该牌号；
5. 打开详情抽屉复核字段；
6. 编辑后刷新页面，确认 IndexedDB 中的数据仍存在。

建议把测试条件写完整，例如：

```text
MFR = 2.3 g/10 min, ISO 1133, 230 °C / 2.16 kg
```

不要把不同温度、载荷或试样状态的数据直接放在同一列比较。

### 4.4 CSV 导入

推荐表头：

```csv
Grade,Manufacturer,Category,Density,Density Unit,MFR,MFR Unit
Demo-PP-01,Example Lab,PP,0.905,g/cm3,3.2,g/10min
```

操作步骤：

1. 打开 **Import**；
2. 选择 CSV、JSON 或 TXT；
3. 检查编码、表头和预览行；
4. 将原始字段映射到 ResinDB 字段；
5. 核对数值和单位；
6. 执行导入；
7. 搜索新牌号并抽样复核。

XLS/XLSX 不再由浏览器直接解析。请先使用可信办公软件转换为 CSV，并在导入预览中核对字段、单位与数值。

### 4.5 搜索和筛选

普通搜索：

```text
T30S
Sinopec
密度
```

数值语法示例：

```text
密度:>0.90
熔体质量流动速率:1-5
弯曲模量:>=1200
```

启用分类和高级筛选后，顶部 Active Filters 会显示当前条件。删除条件或点击清除即可恢复完整数据集。

### 4.6 比较与分析

1. 在 Data Grid 勾选多个牌号；
2. 打开 Comparison；
3. 核对属性单位和缺失值；
4. 切换 Analytics，选择 X/Y 属性和分组；
5. 对异常点返回详情页检查原始字段；
6. 导出筛选结果和分析记录。

图表只反映当前数据。样本量不足、缺失值较多或测试条件不一致时，不应得出材料优劣结论。

### 4.7 本地计算沙箱

Sandbox 提供三个确定性模型：

- Carreau：剪切速率与黏度；
- WLF：温时等效位移因子；
- Weibull：给定时间下的生存概率。

界面会显示所用公式和输入。它不会连接设备、启动 WebSocket、执行 RDKit/LAMMPS，也不会生成“已完成实验”的虚假日志。

## 5. AI API 配置

AI 完全可选。项目不内置供应商、模型名称或专用 SDK。

### 5.1 界面配置

1. 点击右下角 AI 按钮；
2. 打开设置；
3. 填写完整 chat-completions Endpoint；
4. 填写模型标识符；
5. 填写受限开发 Key；
6. 点击 **Test**；
7. 成功后保存。

Endpoint 和模型保存在 `localStorage`；API Key 仅保存在当前浏览器会话的 `sessionStorage`。关闭会话后需重新输入。

### 5.2 环境变量

```bash
VITE_AI_API_ENDPOINT=https://provider.example/v1/chat/completions
VITE_AI_MODEL=your-model-id
VITE_AI_API_KEY=restricted-development-key
```

所有 `VITE_*` 变量都会进入浏览器构建产物，生产密钥不得放在前端。推荐架构：

```text
Browser → authenticated company gateway → selected AI provider
```

客户端要求 HTTPS；只有 `localhost` 允许 HTTP 开发地址。

## 6. 数据适配器

### 6.1 IndexedDB

```bash
VITE_DATABASE_ADAPTER_TYPE=indexeddb
```

数据位于当前浏览器。清理站点数据、无痕模式限制或更换浏览器都会影响可用性，使用前请导出备份。

### 6.2 Remote REST API

```bash
VITE_DATABASE_ADAPTER_TYPE=remote_api
VITE_REMOTE_API_BASE_URL=https://your-server.example/api
VITE_REMOTE_READ_FALLBACK=false
```

前端期望至少提供：

```text
GET    /products
POST   /products
PUT    /products/:id
POST   /products/batch-update
POST   /products/batch-create
POST   /products/batch-delete
POST   /products/export
POST   /products/restore-snapshot
```

远程写入失败不会静默写入 IndexedDB，因为那会制造服务端与浏览器两套相互冲突的数据。

## 7. 公式引擎

允许：

```text
Props['密度'] * Props['拉伸屈服应力']
sqrt(Props['弯曲模量'])
max(Props['MFR'], 0)
```

支持数值、属性引用、括号、算术运算和文档化数学函数。未知标识符、任意属性访问、`eval` 和 `new Function` 均被拒绝。

## 8. 项目结构

```text
.
├── .github/workflows/ci.yml
├── scripts/smoke-test.mjs
├── src/
│   ├── components/
│   ├── config/
│   ├── contexts/
│   ├── data/
│   ├── hooks/
│   ├── lib/
│   ├── services/
│   ├── types/
│   ├── utils/
│   └── workers/
├── tests/
├── README.md
├── SECURITY.md
├── package.json
└── vite.config.ts
```

仓库只保存源码、配置、测试和必要文档。截图、办公文档、Prompt 历史、IDE 记录、构建产物和本地报告不应提交。

## 9. 生产构建

```bash
npm ci
npm run validate
npm run build
```

输出位于 `dist/`。静态服务器需要把未知前端路由回退到 `index.html`，并配置 CSP、HTTPS、安全响应头和缓存策略。

## 10. 已知限制

- 内置身份角色是演示逻辑；
- 远程服务端不在本仓库中；
- AI 兼容层主要面向 OpenAI-compatible chat completions；
- 浏览器端无法安全保存高权限密钥；
- 分析模型未替代实验校准和不确定度评估；
- 当前没有单独 LICENSE 文件，因此不要推定额外授权条款。

## 11. 开发规则

- 最终维护分支为 `main`；
- 提交前运行 `npm run validate`；
- 不提交 `.env`、凭据、用户数据和大体积生成文件；
- 不在界面中伪造外部服务、实验、认证或实时设备连接；
- 对科学计算写明公式、单位、假设和适用范围；
- 修改数据写入流程时必须测试成功、失败和部分失败路径。
