
# ResinDB Pro - 石化院合成树脂产品数据库系统

**ResinDB Pro** 是一个基于现代化 Web 技术栈构建的高保真原型系统，专为石油化工行业设计。它不仅仅是一个静态的数据目录，更是一个集成了 **AI 智能分析**、**多维科研可视化** 和 **全生命周期数据管理** 的综合研学平台。

## 🚀 主要特性

*   **🧪 多维科研可视化 (Scientific Visualization):**
    *   集成 **Apache ECharts**，提供 Ashby 构效关系图、流变曲线 (Rheology)、GPC 分子量分布图、三元相图及雷达指纹图。
    *   支持对不同牌号的刚韧平衡、加工性能进行深度对标。
*   **🤖 ResinAI 专家助手 (可配置):**
    *   支持 **Google Gemini Pro** 和 **OpenAI 兼容** 模型（如 DeepSeek, Moonshot）。
    *   支持**无 Key 启动**：在没有配置 API Key 的情况下，软件主体功能完全正常使用。
    *   支持自然语言查询与图像识别（OCR/视觉分析）。
*   **📊 动态交互数据网格:**
    *   支持复杂的多级分类筛选（树状侧边栏）。
    *   支持自定义列显示、排序、多选及批量操作。
*   **🌍 深度国际化与主题:**
    *   中/英双语实时切换。
    *   系统级深色模式 (Dark Mode) 支持，适配实验室低光环境。
*   **🛡️ 完善的权限体系:**
    *   内置 Admin、Editor、Viewer 三级权限控制演示。
    *   模拟的 CRUD（增删改查）操作及批量数据处理。

---

## 🛠️ 技术栈详情

本项目采用现代化的 **React + TypeScript** 生态系统构建：

### 核心框架
*   **React 18/19:** 使用 Function Components 和 Hooks (`useState`, `useMemo`, `useContext`, `useCallback`) 构建 UI。
*   **TypeScript:** 强类型语言，确保数据结构（如 `Product`, `PropertyValue`）的严谨性。
*   **Vite:** (推荐) 极速构建工具，用于开发服务器和生产打包。

### UI 与 样式
*   **Tailwind CSS:** 原子化 CSS 框架，实现了复杂的玻璃拟态 (Glassmorphism)、渐变及响应式布局。
*   **Lucide React:** 轻量级、风格统一的 SVG 图标库。
*   **Custom Fonts:** 集成 `Outfit` (无衬线) 和 `JetBrains Mono` (等宽) 字体。

### 数据与逻辑
*   **Context API:** 使用 React Context 管理全局状态（语言 `LanguageContext`、主题 `ThemeContext`）。
*   **Google GenAI SDK:** 使用 `@google/genai` 与 Gemini 大模型进行交互。
*   **Mock Data Layer:** 内置 `constants.ts` 包含 100+ 条高保真模拟数据，涵盖 PE, PP, PVC, ABS 等多种材料。

### 可视化
*   **ECharts:** 强大的 Canvas 图表库，用于渲染高性能的科学图表。

---

## 📂 项目结构

建议的源码目录结构如下：

```text
resindb-app/
├── index.html              # 入口 HTML (包含 Tailwind 配置)
├── package.json            # 依赖管理
├── vite.config.ts          # 构建配置
├── .env                    # 环境变量 (可选，用于预置 API Key)
└── src/
    ├── main.tsx            # 应用入口 (原 index.tsx)
    ├── api.ts              # 模拟 API 请求层
    ├── constants.ts        # 静态数据与 Mock 数据
    ├── i18n.ts             # 国际化翻译字典
    ├── types.ts            # TypeScript 类型定义
    ├── components/         # UI 组件库
    │   ├── App.tsx         # 主应用组件
    │   ├── TopBar.tsx      # 顶部导航
    │   ├── DataGrid.tsx    # 数据表格
    │   ├── TreeSidebar.tsx # 分类侧边栏
    │   ├── AIAssistant.tsx # AI 助手组件
    │   ├── DataVisualizer.tsx # 可视化容器
    │   ├── ScientificChart.tsx # 图表渲染核心
    │   ├── charts/         # 具体图表配置 (Radar, Ashby, etc.)
    │   └── ... (其他 Modal 和 Drawer 组件)
    └── contexts/           # 全局上下文
        ├── LanguageContext.tsx
        └── ThemeContext.tsx
```

---

## ⚡ 快速启动指南 (支持离线/无 Key 启动)

请按照以下步骤搭建开发环境：

### 1. 环境准备
确保您的电脑已安装 **Node.js** (推荐 v18 或更高版本)。

### 2. 初始化项目
打开终端（Terminal / CMD），执行以下命令：

```bash
# 创建 Vite 项目
npm create vite@latest resindb-app -- --template react-ts

# 进入目录
cd resindb-app

# 安装依赖 (包括核心库和 UI 库)
npm install lucide-react echarts @google/genai tailwindcss postcss autoprefixer

# 初始化 Tailwind
npx tailwindcss init -p
```

### 3. 文件部署
将您下载的所有源代码文件按照上面的 **[项目结构]** 放入 `src` 文件夹中：

1.  **覆盖 HTML:** 用下载的 `index.html` 替换项目根目录的 `index.html`。
2.  **配置 Tailwind:** 修改根目录下的 `tailwind.config.js`：
    ```javascript
    /** @type {import('tailwindcss').Config} */
    export default {
      content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
      ],
      darkMode: 'class',
      theme: { extend: {} },
      plugins: [],
    }
    ```
3.  **添加入口样式:** 在 `src/index.css` 顶部添加：
    ```css
    @tailwind base;
    @tailwind components;
    @tailwind utilities;
    ```
4.  **移动源码:**
    *   将 `index.tsx` 重命名为 `main.tsx` 并放入 `src/`。
    *   将其他 `.tsx` / `.ts` 文件放入 `src` 及其子文件夹 (`components`, `contexts` 等)。

### 4. 启动应用 (无需 API Key)
本软件支持完全离线启动，数据浏览和可视化功能不需要网络或 API Key。

在终端运行：

```bash
npm run dev
```

控制台会显示访问地址（通常是 `http://localhost:5173`）。在浏览器打开该地址，即可体验 ResinDB Pro。

---

## 🧠 AI 功能配置 (可选)

软件内置了 AI 助手界面。如果您需要使用 AI 问答功能：

1.  **启动软件后配置:**
    *   点击右下角的 ✨ 悬浮按钮打开 AI 窗口。
    *   点击右上角的 **设置图标 (⚙️)**。
    *   在 "API 提供商" 中选择 **Google Gemini** 或 **OpenAI 兼容**。
    *   输入您的 API Key。该 Key 将仅保存在您的本地浏览器缓存中。

2.  **通过环境变量预置 (开发人员选项):**
    *   在项目根目录创建 `.env` 文件：
        ```env
        VITE_API_KEY=your_api_key_here
        ```
    *   修改 `vite.config.ts`：
        ```typescript
        import { defineConfig, loadEnv } from 'vite'
        import react from '@vitejs/plugin-react'

        export default defineConfig(({ mode }) => {
          const env = loadEnv(mode, process.cwd(), '');
          return {
            plugins: [react()],
            define: {
              'process.env.API_KEY': JSON.stringify(env.VITE_API_KEY),
            },
          }
        })
        ```

---

## 📖 使用说明

1.  **登录:**
    *   系统预置了多个账户。默认使用管理员账户 (`admin@cnpc.com.cn` / `123456`) 登录。
    *   可在登录页左侧点击 "Available Accounts" 快速切换角色。
2.  **离线功能:**
    *   在断网状态下，**数据浏览、搜索、筛选、图表可视化 (ECharts)** 均可正常使用（基于本地 Mock 数据）。
    *   AI 助手在断网时会提示网络错误，但在重新联网后可直接重试。
3.  **可视化:**
    *   选中列表中的多个产品。
    *   点击左侧边栏的 "饼图" 图标进入 **科研可视化** 模式。
    *   尝试切换 Radar, Ashby, GPC 等不同图表模型。

---

## 👨‍💻 开发者与版权信息

*   **系统架构与全栈开发**: **孙浩峻 (Sun Haojun)**
*   **所属单位**: **石油化工研究院 (PRI) - 合成树脂研究所**
*   **项目性质**: 数字化科研平台原型系统

**注意:** 本项目为原型演示系统，所有数据均为模拟数据（Mock Data），仅供技术展示与研学使用。
