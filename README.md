<div align="center">

# ResinDB Pro by SunHJ

**浏览器端合成树脂数据管理、检索、比较、可视化与探索性计算平台**

[![CI](https://github.com/SUNHAOJUN22/ResinDB-Pro-by-SunHJ/actions/workflows/ci.yml/badge.svg)](https://github.com/SUNHAOJUN22/ResinDB-Pro-by-SunHJ/actions/workflows/ci.yml)
![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Storage](https://img.shields.io/badge/default-IndexedDB-5A0FC8)
![Branch](https://img.shields.io/badge/branch-main-181717?logo=github)

</div>

> [!IMPORTANT]
> ResinDB Pro 是研究与工程演示平台，不是经过认证的 LIMS、ERP、质量放行系统、制造商官方牌号库或法规判定系统。演示数据、范围筛查、公式计算、统计模型和 AI 输出不能替代原始检测报告、标准方法、计量溯源、实验复核与专业审核。

## 1. 平台定位

ResinDB Pro 用于在一个浏览器应用中组织树脂牌号、实验记录和多维物性数据，主要能力包括：

- 牌号新增、编辑、删除、批量操作、标签、优先级与历史快照；
- 分类树、全文检索、数值条件和高级筛选；
- CSV、JSON、TXT 导入及字段映射预览；
- CSV、JSON、XML、PDF 导出；
- Dashboard、Analytics、Pivot、牌号比较和材料关系图；
- 白名单公式引擎与透明的材料计算演示；
- 中文/英文偏好、明暗模式和七套配色主题控制；
- 可选的 OpenAI-compatible AI 接口；
- IndexedDB 本地存储与可配置的远程 REST 客户端适配器。

默认模式完全在浏览器中运行。仓库不包含生产级身份认证服务、远程数据库服务、企业权限系统或仪器连接服务。

## 2. 真实能力与边界

| 模块 | 状态 | 说明 |
|---|---:|---|
| 数据管理 | 可用 | CRUD、批量编辑、标签、优先级、快照恢复 |
| 本地持久化 | 默认启用 | IndexedDB，数据保存在当前浏览器配置文件中 |
| 检索筛选 | 可用 | 文本、分类、完整度、数值和高级条件 |
| 导入 | 可用 | CSV、JSON、TXT；浏览器不直接解析 XLS/XLSX |
| 导出 | 可用 | CSV、JSON、XML、PDF |
| 分析比较 | 可用 | Dashboard、Analytics、Pivot、Comparison、关系图 |
| 界面偏好 | 可用 | 中英文偏好、明暗模式、七套配色；保存在本地浏览器 |
| 公式引擎 | 可用 | 白名单数值与逻辑语法，不执行任意 JavaScript |
| 本地计算 | 可用 | Carreau、WLF、Weibull 等透明演示模型 |
| AI | 可选 | 用户自行配置兼容接口和模型；无内置供应商或生产密钥 |
| 远程数据库 | 仅客户端适配器 | 服务端必须由部署方实现并负责认证、授权、校验和审计 |
| Viewer/Editor/Admin | 演示角色 | 只控制前端演示流程，不构成安全边界 |

### 数据解释原则

1. 用户录入或导入值应记录来源、单位、测试方法、温度、载荷、试样状态和批次。
2. 演示或估计值只能用于界面和算法流程演示，不得冒充测量值或制造商规格。
3. AI 输出只能作为待验证假设或草案，不是实验结果、认证结论或安全判断。
4. 范围筛查未发现明显异常，不等于符合某项标准或质量要求。
5. 作者、年份或来源缺失时不得自动补入虚构元数据，应由数据维护者补齐。

## 3. 技术栈

- React 19
- TypeScript 5.8（严格检查）
- Vite 7
- Tailwind CSS 4
- IndexedDB / `idb`
- Vitest + Testing Library
- ECharts、D3、Recharts
- Motion for React

依赖版本以 `package.json` 和 `package-lock.json` 为唯一准确信息。

## 4. 快速启动

### 环境要求

- Node.js 22 LTS
- npm 10 或更高版本
- 近期版本的 Chrome、Edge、Firefox 或 Safari

```bash
git clone https://github.com/SUNHAOJUN22/ResinDB-Pro-by-SunHJ.git
cd ResinDB-Pro-by-SunHJ
npm ci
npm run dev
```

开发服务器默认地址：

```text
http://127.0.0.1:3000
```

不配置 AI 或远程 API 时，本地数据管理、筛选、比较、导入、导出和计算功能仍可运行。

## 5. 语言、主题与配色

平台右上角提供独立偏好控制器：

- 中文 / English 偏好；
- Light / Dark 模式；
- Indigo、Emerald、Rose、Blue、Amber、Violet、High Contrast 七套配色。

控制器通过受限本地存储保存偏好，并以自定义浏览器事件同步到现有语言和主题 Provider。部分牌号、专业字段、测试方法和原始数据仍保留原始语言，避免翻译改变技术含义。

## 6. 公式引擎

允许的表达式示例：

```text
Props['拉伸强度'] / Props['密度']
log10(Props['MFR'])
sqrt(Props['弯曲模量'])
max(Props['MFR'], 0)
Props['密度'] || Props['备用密度'] || 0
Props['MFR'] && Props['弯曲模量']
```

支持：

- 数值、属性引用、括号和算术运算；
- `&&`、`||` 逻辑运算与短路求值；
- 白名单常量和数学函数；
- 多公式批量编译时的单条故障隔离。

某条自定义公式语法错误时，该条公式返回安全降级结果，其他有效公式继续执行。未知标识符、任意属性访问、`eval`、`new Function` 和未列入白名单的调用会被拒绝。

## 7. 自动测试与验证

### 常规验证

```bash
npm ci
npm run validate
```

`validate` 串行执行：

```text
ESLint（零警告）
→ TypeScript 类型检查
→ Vitest 全量测试
→ Vite 生产构建
→ 生产预览 HTTP smoke test
```

### 分项与增强验证

```bash
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

`test:ui` 启动真实生产预览并使用 Chromium 检查：

- Demo Admin 会话进入；
- Dashboard 与 13 条种子记录渲染；
- 浏览器控制台错误拦截；
- 中英文、明暗模式和配色切换；
- 偏好持久化；
- 真实页面截图输出到 `artifacts/`。

### 2026-07-23 验证快照

- ESLint：通过，零警告；
- TypeScript：通过；
- Vitest：6 个测试文件、48 个测试用例全部通过；
- 覆盖率：Statements 51.90%、Branches 39.42%、Functions 53.00%、Lines 54.95%；
- Vite：4469 个模块完成转换，生产构建通过；
- HTTP smoke：通过；
- Chromium UI smoke：通过，实际渲染 13 条记录并验证语言、主题和配色持久化。

这些数字是特定提交的审计快照，不是永久保证，当前状态以最新 CI 为准。

## 8. AI 配置

AI 功能完全可选，使用 OpenAI-compatible chat-completions 接口，不绑定特定供应商。

```bash
VITE_AI_API_ENDPOINT=https://provider.example/v1/chat/completions
VITE_AI_MODEL=your-model-id
VITE_AI_API_KEY=restricted-development-key
```

存储行为：

- Endpoint 和 Model：`localStorage`；
- API Key：`sessionStorage`；
- 关闭浏览器会话后需要重新输入 Key。

所有 `VITE_*` 变量都会进入浏览器构建产物。生产密钥不得放在前端。推荐架构：

```text
Browser → authenticated server-side gateway → selected AI provider
```

## 9. 数据适配器

### IndexedDB（默认）

```bash
VITE_DATABASE_ADAPTER_TYPE=indexeddb
```

数据位于当前浏览器。清理站点数据、无痕模式限制或更换浏览器均可能导致数据不可用，重要记录应定期导出备份。

### Remote REST API

```bash
VITE_DATABASE_ADAPTER_TYPE=remote_api
VITE_REMOTE_API_BASE_URL=https://your-server.example/api
VITE_REMOTE_READ_FALLBACK=false
```

服务端必须由部署方实现并负责认证、授权、输入校验、限流和审计。远程写入失败不会静默改写本地 IndexedDB，以避免生成相互冲突的两套数据。

## 10. 项目结构

```text
.
├── .github/workflows/       # CI
├── scripts/                 # HTTP 与 Chromium smoke 测试
├── src/
│   ├── components/          # UI、图表、视图和模态框
│   ├── config/              # 分类树与演示目录
│   ├── contexts/            # 应用状态、语言与主题上下文
│   ├── hooks/               # 数据与交互 hooks
│   ├── lib/adapters/        # IndexedDB / Remote API 适配器
│   ├── lib/formula/         # 安全表达式解析器
│   ├── services/            # AI 与应用服务
│   ├── workers/             # 计算 worker
│   └── types/               # TypeScript 类型
├── tests/unit/              # UI 与偏好测试
├── tests/science/           # 公式、材料与数据库测试
├── package.json
└── vite.config.ts
```

## 11. 安全与隐私

- 不提交 `.env`、密钥、令牌、用户数据或生产连接串；
- 演示头像只接受本地 PNG、JPEG、WebP data URL；
- 导入配置只接受白名单键和受限大小 JSON；
- 用户公式由白名单解析器处理；
- AI Key 仅用于当前浏览器会话；
- 前端演示角色不是授权边界；
- 生产部署需配置 HTTPS、CSP、安全响应头、服务端校验、限流和审计日志。

更多内容见 `SECURITY.md`。

## 12. 已知限制与依赖可用性

- 本仓库不含生产级认证服务或远程数据库服务；
- 浏览器无法安全保管高权限生产密钥；
- 演示数据和模型不能替代实验校准与不确定度评估；
- 当前仓库没有单独的 `LICENSE` 文件，不应推定额外授权条款；
- 大型图表依赖仍会产生较大的前端 bundle；
- 当前覆盖率主要集中在公式、材料校验、IndexedDB 和偏好逻辑，复杂交互流程仍需持续补充测试。

`npm ci` 和 `npm audit` 依赖 npm registry 或企业代理可用。若出现大范围 HTTP 503、DNS 或代理错误，应先修复外部依赖分发基础设施，不应通过提交 `node_modules`、跳过完整性校验或自制不兼容第三方包来绕过。

## 13. 维护规则

- 唯一长期维护分支为 `main`；
- 提交前至少运行 `npm run validate`，正式发布运行完整 CI 门禁；
- 不提交构建产物、覆盖率、本地报告、临时触发文件或 IDE/Agent 状态；
- 不在界面或文档中伪造云服务、实验执行、认证结果、实时仪器连接或性能指标；
- 科学计算必须说明公式、单位、假设和适用范围；
- README 的功能和测试描述必须跟随源码与 CI 同步更新。
