<div align="center">

# 🧪 ResinDB Pro v3.1.0

### 工艺化合成树脂数据管理与材料理化分析工作台
**Synthetic Resin Data Management & Materials Analysis Workbench**

[![CI](https://github.com/SUNHAOJUN22/ResinDB-Pro-by-SunHJ/actions/workflows/ci.yml/badge.svg)](https://github.com/SUNHAOJUN22/ResinDB-Pro-by-SunHJ/actions/workflows/ci.yml)
![React Version](https://img.shields.io/badge/React-19.0.0-blue?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Storage Adapter](https://img.shields.io/badge/Storage-IndexedDB%20%2F%20REST-5A0FC8)
![Build Tool](https://img.shields.io/badge/Build-Vite%206.4.1-646CFF?logo=vite)

面向合成树脂（PE、PP、PVC、ABS 等高分子）牌号、实验测定记录和多维物性数据的浏览器端轻量级管理、检索、对标比较与探索性理化特性分析应用。

</div>

> [!IMPORTANT]
> **使用边界声明 (Usage Boundary)**
> 本项目为科研教学及工程演示工具，并非经过国家计量/行业标准认证的 LIMS（实验室信息管理系统）、ERP、生产质量放行系统或法规判定系统。界面所提供的物化参数拟合结果、演示牌号数据以及 AI 辅助意见均仅供探索参考，在任何情况下均不得替代原始检测物理报告、标准测试方法或专业工程师的人工审核。

---

## 📅 1. 系统核心能力矩阵 (System Capability Matrix)

系统采用纯前端运行沙箱设计，核心功能如下表所示：

| 模块名称 | 运行状态 | 理化科学/工程技术说明 |
| :--- | :--- | :--- |
| **牌号数据管理** | 可用 | 增、删、改、查，支持牌号理化指标录入、多选标签以及在产优先级调整 |
| **数据持久化适配** | 可用 | 默认启用本地 IndexedDB 持久化；提供热插拔 Remote REST API 数据适配器 |
| **检索与智能筛选** | 可用 | 支持全文文本检索、聚类分类过滤，支持物性数值范围过滤（如 `密度:>0.90`） |
| **数据导入引擎** | 可用 | 支持 CSV、JSON、TXT 数据源；导入前提供字段映射转换及实时合规性预览 |
| **多维导出模块** | 可用 | 支持将分析表导出为 CSV、JSON、XML 及规范格式的 PDF 理化对标报告 |
| **比较与科研分析** | 可用 | 内置 Dashboard、Analytics、Pivot 交叉分析表、牌号雷达图及 D3 关系谱网 |
| **安全公式引擎** | 可用 | 词法白名单数值公式解析器，强制过滤 `eval` 和 `new Function`，防止 XSS 攻击 |
| **本地计算沙箱** | 可用 | 提供流变学（Carreau）、温时等效（WLF）、机械可靠性（Weibull）等确定性模型计算 |
| **AI 辅助副驾驶** | 可选 | 支持用户自行填写兼容 OpenAI 的 chat-completions 接口、模型名称及受限 Key |

*提示：系统内置的 HDPE、PP、ABS 演示牌号数据仅供功能流程验证，不可直接用于真实工业配方配料依据。*

---

## 🛠️ 2. 工程规范治理与演进 (Engineering Refactoring & Governance)

在 `v3.1.0-stable` 周期中，项目经历了彻底的轻量化和安全硬化治理，移除了所有非产品源码和虚假交互逻辑：

*   **冗余清理**：清除了所有大体积的 AI 历史缓存、IDE 调试脚本、不具运行价值的截图、重复的 DOCX 报告以及未使用的 Firebase 配置文件。
*   **依赖收敛**：移除了不安全的 Firebase 运行时连接依赖及不再维护的浏览器端 XLS/XLSX 二进制解析器（建议用户使用可信软件转换为 CSV 后导入）。
*   **行为硬化**：
    *   移除了伪造的 WebSocket 仪器实时遥测及外联化学数据库（如 RDKit/LAMMPS）仿真，还原为纯浏览器端透明计算。
    *   增强了网络刷新失败的容灾策略，防止静默覆盖当前数据。
    *   限制了 AI API 密钥的安全域，确保 API Key 仅暂存于会话期 `sessionStorage` 中，避免本地明文持久化泄露。

---

## 🚀 3. 快速启动与本地运行 (Quick Start)

### 3.1 环境要求
*   **Node.js**: 建议使用 `22 LTS` 或更高版本。
*   **npm**: `10` 或更高版本。
*   **浏览器**: 最新版 Chrome, Edge, Firefox, 或 Safari（须支持现代 CSS 与 IndexedDB）。

### 3.2 运行步骤

```bash
# 1. 克隆仓库
git clone https://github.com/SUNHAOJUN22/ResinDB-Pro-by-SunHJ.git
cd ResinDB-Pro-by-SunHJ

# 2. 复制配置文件 (Windows 使用 Copy-Item)
cp .env.example .env.local

# 3. 安装依赖并运行本地开发服务器
npm ci
npm run dev
```

在终端输出后，使用浏览器访问显示的本地地址，默认通常为：
```text
http://localhost:5173
```
*不配置 AI 和远程 REST API 环境变量时，系统默认运行在本地 IndexedDB 模式，不影响任何核心数据管理功能的使用。*

---

## 🧪 4. 核心物理数学模型计算说明 (Local Calculation Sandbox)

本地计算沙箱（`BetaSandboxView.tsx`）内置了高聚物物理和力学常用的确定性理论模型，其具体数学公式如下：

### 4.1 Carreau-Yasuda 剪切流变流动本构方程
用于拟合高聚物熔体黏度与剪切速率的关系，表征物料在挤出、吹膜过程中的流变特征：
$$\eta(\dot{\gamma}) = \eta_0 \left[1 + (\lambda\dot{\gamma})^2\right]^{\frac{n-1}{2}}$$
*   **$\eta_0$ (eta0)**：零剪切黏度 ($\text{Pa·s}$)，即极低剪切速率下的极限黏度。
*   **$\lambda$ (lambda)**：松弛时间常数 ($\text{s}$)，表征高分子链从拉伸回归卷曲的松弛时间。
*   **$\dot{\gamma}$ (shearRate)**：剪切速率 ($\text{s}^{-1}$)。
*   **$n$ (n)**：非牛顿指数（剪切稀释指数，范围 $0 < n \le 1$）。$n < 1$ 时呈剪切稀释行为。

### 4.2 William-Landel-Ferry (WLF) 时温等效平移方程
在玻璃化转变温度 $T_g$ 附近，将高分子材料在不同温度下的力学松弛时间/黏度折算到同一参考温度，建立力学松弛的温时等效平移：
$$\log_{10}(a_T) = \frac{-C_1(T - T_{\text{ref}})}{C_2 + (T - T_{\text{ref}})}$$
*   **$a_T$ (value)**：位移因子。
*   **$T$ (temperature)**：测试温度 ($^\circ\text{C}$)。
*   **$T_{\text{ref}}$ (referenceTemperature)**：参考温度 ($^\circ\text{C}$)。
*   **$C_1, C_2$ (c1, c2)**：高分子系统特定经验常数（对于许多无定形高分子，当以 $T_g$ 为参考时，$C_1 \approx 17.44$，$C_2 \approx 51.6 \text{ K}$）。

### 4.3 Weibull 二参数机械疲劳与寿命生存概率模型
用于表征高分子树脂在恒定疲劳载荷下的力学破坏可靠性：
$$R(t) = \exp\left[ -\left(\frac{t}{\eta}\right)^\beta \right]$$
*   **$R(t)$ (survival)**：生存概率（未发生机械破损失效的比例）。
*   **$t$ (time)**：持续载荷作用时间 ($\text{h}$)。
*   **$\eta$ (scale)**：特征寿命参数（尺度参数，发生 $63.2\%$ 失效时的特征时间）。
*   **$\beta$ (shape)**：形状参数（韦伯斜率）。当 $\beta > 1$ 时表明材料进入长期磨损/疲劳失效阶段。

---

## 🛡️ 5. 科学级理化特征合法性校验边界 (Validation & Sanity Checks)

为保证科学拟合器正常收敛，防止噪声干扰，系统底层 `PolymerDataValidator.ts` 规定了物理安全边界限制：
*   **密度限制**：密度必须满足 $0.80 \le \rho \le 3.0\text{ g/cm}^3$，超出此区间（如 $4.8\text{ g/cm}^3$）将被判定为物理不可达数据，记录将被强行拦截清理。
*   **强度限制**：拉伸强度必须满足 $\sigma_y \le 500\text{ MPa}$。
*   **熔断条件**：如果记录中含有的有效核心理化参数个数少于 2 个，整条牌号记录将被自动拒绝录入，防止出现无分析价值的“空壳牌号”。

---

## 🗄️ 6. 数据适配器与 AI 环境变量配置 (Configuration)

### 6.1 数据适配器配置 (Storage Adapters)
通过修改 `.env.local` 切换存储模式：
*   **IndexedDB 本地持久化模式 (默认)**:
    ```bash
    VITE_DATABASE_ADAPTER_TYPE=indexeddb
    ```
*   **远程 REST API 模式**:
    ```bash
    VITE_DATABASE_ADAPTER_TYPE=remote_api
    VITE_REMOTE_API_BASE_URL=https://your-api-server.example/api
    VITE_REMOTE_READ_FALLBACK=false
    ```
    *后端服务期望实现的基本路由路由详见 `docs` 协议说明。*

### 6.2 AI 辅助副驾驶配置 (AI API)
系统支持在前端直接配置 chat-completions 模型，也支持通过环境变量硬编码（非生产推荐）：
```bash
VITE_AI_API_ENDPOINT=https://provider.example/v1/chat/completions
VITE_AI_MODEL=your-model-name
VITE_AI_API_KEY=your-restricted-development-key
```
> [!WARNING]
> **生产安全提示**
> Vite 所有的 `VITE_*` 环境变量均会直接打入浏览器包内，公开可见。生产环境中建议搭建企业中转网关（Browser -> Secure Gateway -> AI Provider）对 API 密钥进行代理管理及速率限制。

---

## 📂 7. 开发规则与构建流程 (Development & Build Guidelines)

### 7.1 开发守则
*   **严禁提交脏数据与大文件**：绝不能将 `.env` 密钥文件、大体积二进制文档（如 `.docx`, `.pptx`）、本地测试日志提交入库。
*   **公式声明规范**：修改任何计算组件时，必须在文档/提示中标明物理公式、国际标准单位及前置边界假设。
*   **提测流水线**：在向主分支 `main` 推送代码前，请务必执行一键化本地工程验证：
    ```bash
    npm run validate
    ```
    该命令将顺序执行：`ESLint 代码校验` ➔ `TypeScript 类型静态检查` ➔ `Vitest 理化计算单元测试` ➔ `Vite 生产构建编译` ➔ `HTTP 冒烟验证`，确保代码零警告、类型安全。

### 7.2 生产环境编译指令
```bash
npm ci
npm run build
```
*构建成功后，输出产物存放在 `dist/` 目录中。静态服务器托管时，需要将未知路由回退至 `index.html`，并推荐开启严密的 CSP 与安全响应头配置。*
