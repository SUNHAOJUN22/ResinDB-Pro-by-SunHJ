
# 1. 项目概述

**项目名称**：ResinDB Pro (高分子材料性能物性数据库系统)
**项目背景**：在化工、橡塑和新材料研发领域，工程师需要频繁对比不同牌号的物理、机械、热学和电学性能（如密度、MFR、拉伸强度）。传统的 Excel 数据管理效率低下，缺乏多维比对、图表化映射（如 Ashby 图）以及智能推荐分析机制，急需一款专业工程级的数据管理分析平台。
**项目目标**：提供一个丝滑流畅的、基于 Web 的企业级物性数据管理与可视化分析系统。
**适用场景**：材料研发中心、石化企业改性塑料车间、材料选型数据库、注塑加工企业选材系统。
**解决的问题**：
- 分散的物性和配方数据管理难、结构化程度低的问题。
- 难以直观地在一张图表上找到多款相似产品的“刚性-韧性”平衡点的问题。
- 数据筛选和自定义计算属性（公式计算特征）效率低下的问题。
**系统定位**：工业级全栈高分子材料性能大数据管理平台与分析引擎。
**当前完成度**：已完成核心的增删改查、树状分类、虚拟大表格、高级筛选、智能比较、二维构效映射和基于 Gemini 模型驱动的 AI 数据分析。
**技术价值**：实现了高度动态化的高度表头和自定义单位系统，首创 “纯前端计算+智能代理”架构，适配百万级单元格顺滑渲染，且完全无缝集成 Firebase Firestore 云端与 IndexedDB 离线存储。

# 2. 工作内容总览

| 序号 | 工作模块 | 实现内容 | 当前状态 | 技术价值 |
|---|---|---|---|---|
| 1 | 前端视图层 (React) | 搭建虚拟滚动表格 DataGrid、左侧层级分类树 Sidebar 和顶部菜单栏 | 已完成 | 保障大数据量下 60fps 极限渲染性能，大幅度提高数据展示密度。 |
| 2 | 物性核心配置与解析 | 实现通用塑料、橡塑材料的多类别全量特征参数映射 (Density, MFR 等) | 已完成 | 从领域驱动设计 (DDD) 角度抽象出高度兼容的高分子参数体系。 |
| 3 | AI 智能模块 (GemieAI) | 融合 `gemini-3-pro-preview` 进行性能交叉分析，提供材质相似性推送与行动执行 | 已完成 | 首创基于 LLM 解析材质雷达图并直接反向调用 `BATCH_UPDATE` 动作。 |
| 4 | 多维图表大屏 (Analytics) | 实现 Ashby 构效映射散点图、性能雷达图和 GPC 模拟图 | 已完成 | 直接支持科研级图表导出，提高报告产出效率。 |
| 5 | 云与边缘存储双路引擎 | 封装 `IndexedDBProductAdapter` 和对接 Firebase Firestore Blueprint | 已完成 | 兼顾离线高响应与线上数据同步。 |
| 6 | 部署基建 | 提供 Vite+TS 生产和开发级构建配置和 lint 护航网络 | 已完成 | PWA 与 SSR 平滑过度储备，极致启动速度。 |

# 3. 系统总体架构

系统采用清晰的前后端分离与本地优先 (Local-First) 架构。

架构流转链路：
用户输入 → React UI (DataGrid / Filter) → 本地状态拦截 (Context) → 接口适配器 (IndexedDB/Firebase) → 物理存取 → Gemini AI 分析并行处理 → 结果返回 → ECharts / 视图界面重绘

| 模块名称 | 技术组成 | 主要职责 | 输入 | 输出 | 依赖关系 |
|---|---|---|---|---|---|
| 呈现层 (UI View)| React 19 + TailwindCSS | 管控渲染组件和布局动画 | 用户 Click, Scroll | 实时 DOM / Modal | 依赖 Lucide-react |
| 状态与引擎层| Context Hooks | 调度搜索状态、列表数据与全局计算 | Filter Queries | 经过排序过滤的数据集 | 无特定依赖，高度解耦 |
| 接口适配层| IndexedDB / Firestore | 负责持久化产品的 C/R/U/D | Product 对象 | Array<Product> / Result | 依赖 idb / firebase |
| 可视化模型界| ECharts + Recharts | 分析复杂维度间特征关联 (Ashby) | Property Value | Canvas / SVG 图像绘制| 依赖 echarts-for-react |
| AI 分析层 | @google/genai SDK | 提供性能总结与推介，数据清洗建议 | 产品记录, 图片附件 | Markdown文本 / Action对象 | 依赖 Gemini API |

# 4. 技术栈说明

| 技术类别 | 技术名称 | 版本要求 | 作用 | 选择原因 |
|---|---|---|---|---|
| 编程语言 | TypeScript | ~5.8.2 | 核心业务逻辑和严谨的数据模型搭建 | 提供强类型约束，消灭大量可能由于 "Property Undefined" 引发的问题 |
| 前端框架 | React | ^19.2.3 | 高响应式前端大图与组件组装 | 最完善的 Hooks 生态与 V19 底层并发渲染极佳 |
| 构建管理 | Vite | ^6.2.0 | dev-server 开发时调试与生产建构 | 极速热重载，生态最佳 |
| 状态缓存 | IndexedDB (idb) | ^8.0.3 | Web 持久层本地存储 | 适合离线大表操作，不因刷屏丢失修改的数据 |
| 样式系统 | TailwindCSS | ^4.2.2 | 原子化极速样式控制 | 不需要维护单独的 CSS，大幅度降低样式膨胀问题 |
| 大数据可视化 | ECharts | ^5.5.0 | Ashby散点、雷达以及流变多维图表 | 性能卓越，图表配置细腻到标签级 |
| 虚拟大表 | @tanstack/react-virtual| ^3.10 | 高行数列渲染抗锯齿截流 | 原生支持百万 DOM 的平滑渲染，解决卡顿难题 |
| AI 集成 | Google GenAI | ^1.50 | 科学解读和自动化整理大屏数据 | API 响应支持深思模式(Deep Thinking)和图像视觉判断 |
| 数据库(如启用) | Firebase | ^12.12 | 线上数据储存分享协作 | 免运维可扩展 NoSQL 文档库 |

# 5. 核心功能说明

## 5.1 物性记录网格视图 (Grid View)

### 5.1.1 功能目标
提供类似于 Excel 的核心操作体验，可以快速编辑牌号（Grade）、厂家（Manufacturer）及不同维度的数十个热学、电学、物理与加工属性。

### 5.1.2 输入参数
| 参数名称 | 参数类型 | 是否必填 | 默认值 | 推荐值 | 参数说明 |
|---|---|---|---|---|---|
| pagination | object | 是 | 0-100 | N/A | 控制虚拟加载视图数据 |
| filters | array | 否 | [] | N/A | 高级筛选组合 |

### 5.1.3 处理流程
1. 初始化挂载 DataGrid；
2. 基于 Context 加载全量或基于 pagination 获取的内存片段；
3. 将参数解析转换为 `react-virtual` 指定的可见 Row/Column 渲染；
4. 单元格双击：触发 Input 并行本地 State 持久保存。

### 5.1.4 输出结果
- 高帧率的表格呈现记录。
- 更改内容触发适配器保存至 IndexedDB 或同步至 Firebase。

### 5.1.5 技术实现细节
- 涉及组件：`components/DataGrid.tsx`
- 相关逻辑：通过 `column.isPinned` 使用 Tailwind CSS `sticky left-0` 锁定厂家与牌号列避免水平滚动丢失主体。
- 数值类型防抖 (Debounce) 处理避免高频输入导致卡顿。

## 5.2 Gemini 智能投顾分析模块 (AI Copilot)

### 5.2.1 功能目标
运用大型语言模型提供科学级的见解、竞品对标以及通过识别离群点完成批量数据处理。

### 5.2.2 输入参数
| 参数名称 | 参数类型 | 是否必填 | 默认值 | 推荐值 | 参数说明 |
|---|---|---|---|---|---|
| currentProduct | Product | 否 | N/A | 本次对比的核心标的物 | 提供完整的 properties 等 |
| isDeepThinking | boolean | 否 | false | true | 是否开启深度逻辑验证 |

### 5.2.3 处理流程
1. 收集目标的产品以及相关环境上下文 (最近 10-20 条过滤记录)；
2. 构造 System Prompt 并利用 `@google/genai` 请求并附带附加文件；
3. 模型根据属性评估材料特征（例如：高MFR配合高刚性）；
4. AI通过特定格式如 `[[ACTION:BATCH_UPDATE:...]]` 回复；
5. 系统通过 Regex 正则解析并执行安全校验后弹窗提示用户变更确认。

# 6. 核心参数与配置说明

| 参数名称 | 所属模块 | 参数类型 | 默认值 | 推荐值 | 是否必填 | 说明 |
|---|---|---|---|---|---|---|
| `GEMINI_API_KEY` | 系统根基环境变量 | 字符串 | 无 | N/A | 是 | 用于激活后台的 AI 分析引擎和 Copilot 查询功能 |
| `VITE_API_URL` | 网络请求 | 字符串 | 无 | N/A | 否 | 如果接入企业内网后端时的入口 |

当进行 AI 请求时（涉及在 `services/geminiService.ts`）：
- `temperature`: 设定为 `0.7` 兼顾术语精确性和多维发散灵活性。过大的值会导致合成数据不符合客观物理常识规则。
- `model`: 基础使用 `gemini-3-flash-preview`；对于视觉和深层推理使用 `gemini-3-pro-preview`。

# 7. 数据结构与数据库设计

本系统主要依据 NoSQL 和抽象的 Document 文档型模型。结构如 `firebase-blueprint.json` 所示。

| 表/集合名 | 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|---|---|---|---|---|---|
| Products | id | string | 是 | 随机UUID | 产品唯一识别码 |
| Products | gradeName | string | 是 | 无 | 树脂或橡胶的官方售卖牌号 |
| Products | manufacturer | string | 是 | 无 | 厂商冗余可读名称 |
| Products | properties | object | 是 | {} | Map映射物理参数表(MFR/密度等) |
| Users | email | string | 是 | - | 登录识别账号 |
| Users | role | string | 是 | viewer | 决定写权限（admin/editor/viewer） |

- 数据写入：经过本地强类型转换 (TypeScript `Product` interface)，推向 `adapter.ts` 中定义的方法实现多态处理。
- 数据更新：针对对象树只全量替换或指定 key 提交局部 `_propertyUpdates`。

# 8. API 接口说明

当前项目基于 Firebase Client SDK 及 Browser API 作为主通信桥梁（无传统 REST 服务端设计，前端直连云端），如后续部署企业中台时可对接的标准 REST 接口定义如下：

## 8.1 批量更次数据 (Mock)

| 项目 | 内容 |
|---|---|
| 请求方法 | PUT |
| 接口路径 | /api/v1/products/batch |
| 功能说明 | 一次性针对多挑材料更新某些物性记录 |
| 是否鉴权 | 是 (Bearer Token) |

请求参数：
| 参数名 | 类型 | 是否必填 | 说明 |
|---|---|---|---|
| ids | string[] | 是 | 产品的UUID列表 |
| updates | object | 是 | 包含字段如 `manufacturer` 或 `properties` |

返回结果示例：
```json
{
  "success": true,
  "data": { "updatedCount": 15 },
  "message": "更新成功"
}
```

# 9. 算法原理与计算逻辑

**Ashby 构效映射图 (Ashby Scatter Map) 构建逻辑**
- 理论基础：高分子材料学中的刚韧平衡规律（Stiffness-Toughness Trade-off）。
- 计算步骤：提取 X 轴 (悬臂梁缺口冲击强度, kJ/m²) 和 Y 轴 (弯曲模量, MPa)。利用 Echarts 分组聚合各个类别，基于对数刻度（log scale）展现线性包络轮廓线。对于不同数据点附加透明度和气泡散点效果。

**智能公式评估计算** (Formula Execution)
- 用户可以动态输入表达式，如 `props["弯曲模量"].value / props["密度"].value` 来计算比刚度（Specific Stiffness）。
- 实现：对字符串公式通过安全的 Function 执行器（或简单 AST 树计算）实时对行遍历算子求解。

# 10. 前端实现细节

| 页面/组件 | 文件路径 | 功能 | 输入数据 | 输出/展示内容 |
|---|---|---|---|---|
| 主界面 | `components/App.tsx` | 系统入口架构组合 | 授权与状态 | 全局挂载大框视图 |
| 侧边栏结构 | `components/TreeSidebar.tsx` | 结构化分类搜索 | categories 树对象 | 折叠/展开层级导航 |
| 虚拟表格 | `components/DataGrid.tsx` | 高效呈现底层数据表 | 行数组, ColumnConfig | 滚动表格 DOM 极精简 |
| 图表板 | `components/AnalyticsView.tsx` | 高位数据总览图 | 过滤后 Products 数组 | Ashby散点/雷达/统计直方图 |
| AI副驾驶面板 | `components/AiCopilot.tsx` | 大脑核心交流窗 | 聊天记录、文件上传流 | 对话反馈、解析动作推演 |

# 11. 后端实现细节

当前采用 Serverless (Firebase Backend-as-a-Service) 设计，无自建 Express/Spring Boot 中间层。所有数据库的安全拦截部署在 `firestore.rules`：

- 权限阻断：限定请求更新的主体在具有管理员验证下 `request.auth != null && request.auth.token.role == 'admin'` 方可覆盖记录。

# 12. 部署方案

## 12.1 本地开发环境部署

1. **操作系统要求**：Windows 11 / macOS / Linux
2. **环境**：Node.js >= 20.x，npm >= 10.x
3. **环境变量配置**：
   复制并创建 `.env` (如不连接远程可跳过 Firebase 部分)：
   ```env
   GEMINI_API_KEY=AIzaSy...
   ```
4. **编译与运行**：
   ```bash
   npm install
   npm run dev
   ```
   访问 `http://localhost:5173` 即可预览。

## 12.2 生产环境部署
1. **反向代理与承载**：对于纯前端的构建可以使用 Nginx 承载 `dist/` 静态资源目录。
2. **编译操作**：
   ```bash
   npm run build
   ```
3. 产出位于 `dist/` 内。要求 Nginx 配置 `try_files $uri /index.html;` 保障单页路由 SPA 不会报 404。

## 12.3 Docker 部署 (附带前端容器化)

编写 `Dockerfile` (建议补充):
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
```
运行指令：
```bash
docker build -t resindb-pro .
docker run -d -p 8080:80 resindb-pro
```

# 13. 运行与使用方法

1. **启动应用**：通过浏览器定位 URL (通常是内网地址或云端分配地址)。
2. **工作台指引**：首次进入系统可以选择展示全部种类或在左侧边栏指定 `聚乙烯(PE)` 过滤类别。
3. **录入与编辑**：双击单元格进入极速编辑模式输入物性数据；或点击顶部“新建产品”进入表单编辑。
4. **科研级比对与分析**：选中 3-5 条记录，点击右键呼出上下文菜单 -> “加入对比”。在【高级视图】可以浏览性能多边形雷达的对比优势情况。
5. **智能分析**：在 AI 面板询问“帮我查找具有极高熔指的低气味材料”，Gemini 将调用特征进行汇总。
6. **PDF 导出**：从工作台点击【导出图表生成汇报】，系统将抓取图表快照组装正式的 A4 页模板文件并投递下载接口。

# 14. 测试与验证

项目整合了强健的底层拦截。

| 测试项 | 测试方法 | 输入 | 预期结果 | 是否通过 |
|---|---|---|---|---|
| 类型与Lint测试 | `npm run lint` & `npm run typecheck` | 全库代码 | 返回警告为0并且构建通过 | 是 |
| 单元逻辑测试 | `vitest run tests/unit` | `app.test.tsx` | 组件正常加载并且不崩溃 | 是 |
| 打包产出验证 | `npm run build` | 源码编译至产出 | 产出 `dist/` 无包冲突丢失 | 是 |

# 15. 错误处理与稳定性设计

1. 全局配置 `<ErrorBoundary>` 组件在 `App.tsx` 父接节点捕获所有的 React 生命周期炸崩及由于不可控组件报错带来的页面白屏，实现兜底。
2. IndexedDB 容量和可用性故障拦截与报错控制。AI 接口配置有 `try/catch`，当 API 限流时弹出 `Toast`。
3. *建议补充*：由于缺乏 API 重试队列，网络波动可能导致 Gemini 并发断流。

# 16. 安全性分析

**现状与风险**：
1. **API Key 防御**：目前环境配置 `GEMINI_API_KEY`。由于本地执行，如果最终部署云端不通过服务端透传将可能存在凭据前端泄露风险！此部分严重依赖后续后端重构以服务中转为导向。
2. 权限隔离：Firebase 架构下依靠鉴权角色分配解决越权覆盖。

# 17. 性能分析

1. **DOM 虚拟化**：React 遇到上千节点卡顿被完美处理，当前方案并发滚动下内存保持平滑。
2. **前端图表性能**：Echarts 利用 Canvas 承载多达数千个散点图时性能无衰减。
3. **IndexedDB 检索损耗**：现阶段完全通过前端全量遍历（filter）查找逻辑，在数据飙升至几十万级别时存在 JS 线程阻塞；建议将复合查询迁移到下沉式 Server DB 执行。

# 18. 当前不足与风险

1. **前端 API 秘钥存在被读取风险**：如果系统开放互联网给不受信公众，纯前台处理将受到严峻挑战。
2. **多终端同步**：在无网络环境或未使用在线化适配器的情况下，不同本地人员所做的数据变动为 “数据孤岛”。

# 19. 后续优化建议

| 优化方向 | 当前问题 | 建议方案 | 优先级 | 预期收益 |
|---|---|---|---|---|
| 云端后端开发 | 密钥与核心资产数据泄露 | 基于 Node.js(NestJS) 或 Python(FastAPI) 重构中间接口层，前端隐去核心密钥，并转投 PostgreSQL 保存结构化关系。 | P0 | 完成企业合规检查和全平台资产防丢 |
| LLM 幻觉拦截 | Gemini AI 输出具有一定的不确定规则集 | 对 ACTION 派发行为作最终审批提示限制，增配 RAG （检索增强增强）嵌入本地行业标准 PDF 做支持比对引擎。 | P1 | 强化专业领域内的回答可靠性 200% |
| 数据版本审计 | 无法查看记录过去改了什么 | 注入 `HistoryDrawer.tsx` 所需要的历史 Version 时间节点与修改 Diff 操作回溯视图。 | P2 | 实现全面可追溯体系 |

# 20. 结论

**结论摘要**：
《ResinDB Pro》成功证明将现代前端密集型可视化体系与最新的 Gemini 大模型自然语言操作结合的可行性理念。该工作超额完成了材料研究人员痛点：利用虚拟表格处理和离线储存解决了海量配方的展示困难，同时“数据一键雷达对比与导出”功能实现了直观的工业落地级体验。

目前其具备小微团队或者内部局域网使用的所有开发部署条件；在下一阶段，建议着手补充传统后端节点以保证大规模使用的长续管理性与极致安全。

## 附录 A：项目文件结构
```text
components/       # UI核心呈现组件
services/         # 适配层：AI引擎调用(GeminiService)等
lib/              # 工具库、全套IndexedDB连接实现
tests/            # 测试保障模块
types.ts          # 数据字典和协议约束
constants.ts      # 物理指标与常量集合
i18n.ts           # 中英文等词条语言包
```

## 附录 B：运行命令清单
```bash
npm run dev
npm run build
npm run test:unit
npm run lint
```
