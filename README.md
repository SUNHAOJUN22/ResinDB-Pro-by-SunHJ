# 🧪 ResinDB Pro v3.0 — 工业级合成树脂科研分析与数据治理系统 (PRI-Synthetic Resin)

[![React Version](https://img.shields.io/badge/React-19.0.0-blue?style=flat-square&logo=react)](https://react.dev/)
[![Vite Version](https://img.shields.io/badge/Vite-6.4.1-646CFF?style=flat-square&logo=vite)](https://vite.dev/)
[![Tailwind Version](https://img.shields.io/badge/Tailwind-v4.0.0-06B6D4?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)
[![D3 Version](https://img.shields.io/badge/D3.js-v7.9.0-F9A03F?style=flat-square&logo=d3)](https://d3js.org/)
[![License](https://img.shields.io/badge/License-PRI%20Commercial%20Demonstrator-red?style=flat-square)](https://www.cnpc.com.cn/pri/)

**ResinDB Pro** 是一款专为**合成树脂科研与高分子材料学专家**打造的下一代在线科研数据治理与智能计算系统。该系统深度聚焦于 PE（聚乙烯）、PP（聚丙烯）、PVC（聚氯乙烯）以及高端共聚物的生命周期管理，不仅提供千万级数据的工业级展示，同时在前端内置物理化学动力学的高吞吐计算引擎与 **Google Gemini AI 模型**，旨在将复杂的工业大图谱、极速流变数学拟合、分子构型拓扑一站式融合。

系统深度贯彻 **“60fps 渲染性能、暗调解压视觉 (Cosmic Slate UI)、双线程运算解耦、极高逻辑迁移度 (Adapter Pattern)”** 的工业软件准则。

---

## 🌟 核心技术与功能特征 (Core Technical Features)

### 1. ⚛️ 前端多线程高并发科学计算矩阵 (Web Worker Grid)
使用高达 24 个独立的 Web Worker 进行并行任务计算，将重度的高分子材料流体方程计算完全剥离主线程。确保在操作高吞吐 UI 时的丝滑不卡顿：
*   **Carreau-Yasuda 流变模型拟合**：求解零剪切粘度与松弛时间常数。
*   **WLF (William-Landel-Ferry)**：主曲线时温等效平移原理计算。
*   **Weibull 失效分布**：材料极限疲单轴寿命计算。
*   **Prony 级数时域解构**：针对高频动态热力学模型 (DMA) 生成多阶粘弹性离散力学常数。
*   **大数据聚类与统计 (K-Means, Bayes)**：实时材料推荐、特征在线回归异常熔指聚类测定。

### 2. 🧠 Google Gemini AI 原生赋能多模态副驾驶 (AI Copilot)
完全在服务端与前端交接层面集成 `@google/genai` 模块，提供专门领域的配方审阅与科研问答辅助。
*   **物化配方草图提取**：自动读取用户给出的描述，提取并对齐底层 100+ 合成树脂相关的特性参数。
*   **工艺异常诊断**：基于所选的数据库流式监测，预警可能的流变异常或质量波动。
*   **数据到文档 (Data to Action)**：自动生成科研周报、配方优化思路，输出格式化的 Markdown 和指标系。

### 3. 🎨 极致工业暗色视觉与高并发网格 UI
*   **Cosmic Charcoal 主题色阶**：系统界面以幽暗低反射率的 `slate-950/900` 为主底色，最大限度降低科研人员长时盯屏的不适。核心工艺节点采用极光蓝和生化绿的渐变强化标识。
*   **复杂自适应网格设计**：运用 `TanStack Virtual` 与精确到 1px 细调的紧凑表格展现模式（Compact View），支持大量科学数据参数同屏展示不需要滚屏溢出。
*   **微交互系统**：通过 `Framer Motion` 全面控制动画帧：无论是 Modal 窗口弹出、折叠菜单、还是 D3 图谱拖拽的物理弹簧表现，全部做到无缝的渐入渐出体验。

### 4. 🕸️ 拓扑追踪与科学图表引擎 (D3.js & Echarts)
*   **大体量级联依赖图 (Dependency Map)**：采用定制开发的 D3 v7 引力模拟算法，提供 `Layered` (上下游层次结构) 和 `Force` (自由引力) 双轨布局。对单体、聚合反应器、产成品之间的化学流向图实现一键追踪和粒子高亮连线。
*   **科研级矢量分析大屏 (Echarts & Recharts)**：雷达对比图，多维时序图，和双因子相关性散点图矩阵等，用于进行各种牌号树脂的 Ashby 图谱探索与刚韧平衡筛选。

---

## 🏗️ 架构设计与技术栈 (Architecture & Tech Stack)

系统遵循**“UI展现层”**、**“数据隔离层 (Hooks/Services)”**与**“并发科学计算底层 (Workers)”**的完全物理分层，以实现长远的高可维护性。

*   **前端核心**：React 19, Vite 6, TypeScript 5.8
*   **样式方案**：Tailwind CSS v4 (使用 `@tailwindcss/vite`), clsx, tailwind-merge
*   **动效与交互**：Framer Motion 12, Lucide React (图标)
*   **图表与可视化**：D3.js v7, Echarts 5.5, Recharts 2
*   **数据存储方案 (分离式适配器)**：
    *   **离线/沙箱**：IndexedDB (`idb` 包) 用于全量模拟数据的客户端永久高速存取。
    *   **实时同步/云端**：Firebase v12 高性能 NoSQL 分布式服务 (`firestore`) 和严格的 `.rules` 规则权限阻断。
*   **文档转化与导出**：jsPDF, docx, html2canvas, xlsx, papaparse
*   **静态与运行时质量检验**：ESLint 9, Vitest 4, JSDom 配合极大规模泛测试。

---

## 📁 目录蓝图及代码组织 (Directory Blueprint)

系统目录以**按业务特性分离 (Feature-Sliced Design)** 为原则展开：

```text
/
├── .env.example               # 系统环境变量参考（包括 Gemini API KEY 等）
├── package.json               # npm 依赖项与高度集成的命令行工具链
├── vite.config.ts             # Vite 构建配置文件（配置服务器 3000 端口及静态切片打包策略）
├── firestore.rules            # 生产环境 Firebase 的 Firestore 数据库权限安全校验策略
├── tests/                     # 测试中心（Unit, Integration, E2E, Science Calculation Tests）
└── src/
    ├── main.tsx               # 应用程序 React 根节点入口文件
    ├── index.css              # 全局 Tailwind v4 指令和根变量声明
    ├── types/                 # 核心系统的全局 TypeScript 类型/接口定义 (.ts files)
    ├── constants.ts           # 固化的材料数据库存元数据、模拟配置宏
    ├── locales/               # 或 i18n.ts (全系统汉英双语词典映射配置)
    │
    ├── components/            # 【UI/视图核心组件区】
    │   ├── ui/                # 高度解耦的基础组件库 (Btn, Card, Modal, Toast)
    │   ├── layout/            # 主从布局组件体系 (Sidebar, TopNav)
    │   ├── views/             # 全屏视图级组件 (Dashboard, DataGrid 表格主视图)
    │   └── features/          # 具体功能集合 (如 Ai 对话副驾、材料科学分析工具面)
    │
    ├── hooks/                 # 【自定义状态器区】包含组件复用及复杂的副作用管理器
    ├── services/              # 【接口隔离层区】(API, Firebase, IndexedDB 核心接驳适配类)
    ├── utils/                 # 【工程效能辅助】时间转化、数据验证、防抖节流函数
    └── workers/               # 【科研算术核心】(多达 20+ 个物理和算法模型的 Web Worker 隔离线程)
```

---

## ⚙️ 部署与操作运行指南 (Deployment & Usage Guide)

项目采用 Vite 作为底座，天生支持高纯净的前后端分离开发范式，部署流程分为：本地开发调试、云端构建以及生产环境多云接入。

### 🌱 一、 本地沙箱敏捷启动 (Local Development Run)

1.  **环境要求**：Node.js >= 20.0，建议使用 `npm` 或者 `pnpm`。
2.  **获取依赖并安装**：
    ```bash
    # 在项目根目录下执行安装
    npm install
    ```
3.  **准备环境秘钥**：
    *   复制 `.env.example` 为 `.env` 文件。
    *   如果需要使用 AI 辅助特性，请在 `.env` 中填写 `VITE_GEMINI_API_KEY=你的谷歌Gemini鉴权串`。（注：由于此版本可能升级为服务端中转，若是跑前端 SSR 或 Node 层，参看 `.env` 内是否有前缀无 `VITE_` 的 Key 要求）。
4.  **启动极其强悍的本地构建检查关卡 (可选，但是推荐)**：
    ```bash
    npm run validate   # 会并行验证代码质量(ESLint), 强类型匹配度(tsc) 和执行基础单测(Vitest)
    ```
5.  **瞬时启动 Vite 极速热更新沙箱**：
    ```bash
    npm run dev        # 会在 http://0.0.0.0:3000 上暴露应用并在局域网内提供共享。
    ```

### 📦 二、 生产化构建切片打包 (Production Build)

当需要将系统投产给客户内网或发布在 Nginx、Apache、Vercel 上时，执行生产静态编译：

```bash
npm run build
```

**编译动作包括：**
*   强类型的 TS 代码被编译为兼容当前浏览器的产物。
*   `vite.config.ts` 中的切割策略 (`rollupOptions.manualChunks`) 会自动将体积庞大、加载缓慢的三方科学依赖（如 `echarts`, `d3`, `jspdf` 等）无损分片切割至独立的 bundle 中，从而支持在网络中懒加载（Lazy load）分流，大幅提升首次白屏时间表现。
*   所有生产级的精简静态态内容会全部释放在工程下属新生成的 `/dist/` 目录中。你需要做的只是将 `/dist` 部署到你的 Web 服务器即可！

### 🌩️ 三、 云端分布式托管部署 (Cloud Integration: Firebase Hosting)

系统内置对接高可用云组件 Firebase 的完整预设方案，方便企业全球 CDN 部署：

1.  **本地预装全局 Firebase 套件**:
    ```bash
    npm install -g firebase-tools
    ```
2.  **认证并选择指定的 GCP 云端项目**:
    ```bash
    firebase login
    firebase use <你的云端_project_id>
    ```
3.  **配置阻断级数据安防策略** (仅适用于结合了 Firestore 的需求使用)：
    ```bash
    # 这会把工作区内的 `firestore.rules` 提至云端，实现读写控制安全锁
    firebase deploy --only firestore:rules
    ```
4.  **将系统静态产物 `/dist/` 发布到全球边缘网络托管**:
    ```bash
    # 建立构建 (确保当前代码是最新的)
    npm run build
    
    # 发布
    firebase deploy --only hosting
    ```
    完成发布后，系统会返回分配给你分配一个全球 CDN 高可用外网加密域名，随时随地享受高质量科研算理服务。

---

## 🧪 极高密质量管控（代码检测系统）

系统集成工业级的防灾和代码健壮性自动化管道，内置多项命令保障研发：
*   **格式检查与纠正**: `npm run lint` 验证所有 JSX/TSX 编码规范以及过时的 Hook 使用方式。
*   **自动化测试群 (Vitest Engine)**:
    *   综合测试运行：`npm run test`
    *   UI与状态流单测：`npm run test:unit`
    *   集成交互链路测试：`npm run test:integration`
    *   **材料算法与科学计算特化审查**：`npm run test:science` 保障所有的 `web workers` 并发数学计算没有精度溢出和偏差！
    *   压力随机极限测试：`npm run test:fuzz`
    *   获取完整覆盖率大图：`npm run test:coverage` (导出极高的行、类、分支和边界全覆盖度率)

---

> _"In God we trust, all others must bring data." — W. Edwards Deming_  
> **ResinDB Pro** by SUN HJ - A paradigm shift in synthetic materials research.
