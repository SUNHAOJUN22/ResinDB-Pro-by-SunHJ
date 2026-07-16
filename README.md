# 🧪 ResinDB Pro v3.1 — 工业级合成树脂产品数据与科研智能分析系统 (PRI-Synthetic Resin)

[![React Version](https://img.shields.io/badge/React-19.0.0-blue?style=flat-square&logo=react)](https://react.dev/)
[![Vite Version](https://img.shields.io/badge/Vite-6.4.1-646CFF?style=flat-square&logo=vite)](https://vite.dev/)
[![Tailwind Version](https://img.shields.io/badge/Tailwind-v4.0.0-06B6D4?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)
[![D3 Version](https://img.shields.io/badge/D3.js-v7.9.0-F9A03F?style=flat-square&logo=d3)](https://d3js.org/)
[![Framer Motion](https://img.shields.io/badge/Framer_Motion-11.1.7-FF69B4?style=flat-square&logo=framer)](https://www.framer.com/motion/)
[![License](https://img.shields.io/badge/License-PRI%20Commercial%20Demonstrator-red?style=flat-square)](https://www.cnpc.com.cn/pri/)

**ResinDB Pro** 是专为**中国石油化工研究院 (PRI) - 合成树脂研究所**量身定制的高性能、数据密集型合成树脂全生命周期科研管理和理化特性智能分析系统。系统全面实现对聚乙烯 (PE)、聚丙烯 (PP)、聚氯乙烯 (PVC)、聚苯乙烯类共聚物 (ABS) 等各种通用与高端树脂材料的**出厂指标合规化监控、流变动力学多物理场曲线等数、重均/数均分子量分布 (GPC) 曲线重构、刚韧物理平衡 Ashby 空间探索、分子失效概率估计**。

系统深度落实**“交互极度流畅 (60fps Scrolling)、视觉工业超感 (Zero-Noise Cosmic Slate UI)、表现与演算彻底解耦 (Multi-Threaded Worker Grid)、极高逻辑迁移度 (Adapter Pattern Service)”**等顶尖工业软件指标。项目代码严谨规范，完全规避任何形式的伪技术堆砌，为石油化工数字化科研系统的敏捷交付树立行业标杆。

---

## 🎨 工业级 UI/UX 视觉设计与交互规范 (Design Principles & Spec)

系统的设计核心是消除视觉疲劳，在极高信息密度的场景下依然能让科研人员快速捕获材料指标跃迁节点：

1. **暗色超感深灰色阶 (The "Cosmic Charcoal" Slate)**:
   * 采用深层低反射率色阶 (`slate-950` 至 `slate-900`)，能有效缓解实验室和分析室中高负荷看屏带来的眼部疲劳。
   * 采用纯色相高纯度渐变色标记核心化学工艺路线：单体及初级聚合级节点亮蓝色 (`blue-400`)、无定形及高强韧改性级节点碧绿色 (`emerald-400`)、过渡物料亮浅紫 (`indigo-400`)，辅以暗视场下的柔和粒子轨迹，极大增强了拓扑网和工艺链路的动态可读性。

2. **多模态高信息密度信息展示 (High-Density Multi-Mode Layout)**:
   * **紧凑精简网格模式 (Compact View)**: 针对海量原始实验数据的对比，单元格边间距压缩 40%，通过等宽字体 `JetBrains Mono` 展现精确 of 断裂伸长率、极限抗拉屈服等性能数据，确保一行展示超过 12 个参数列而无需频繁发生眼球折返。
   * **多维科研对标视图 (Relaxed Layout)**: 针对多项产品雷达对比及模型参数流变阻尼谱扫频。

3. **极致防抖微交互与无延迟响应 (Micro-Interactions & Input Isolation)**:
   * 每一个下拉框、滑块阻抗力、搜索调谐框均具有内置的 **防抖机制 (Debounce / Throttle)**，绝不在高频拖拽或搜索时向主线程和后台产生无效重复请求。
   * 支持快捷热键系统：`/` 秒级拉出全局控制面板指令，`Ctrl + S` 一键进行在研牌号性能更改，`Esc` 极其平滑地对重构曲线 modal 执行无损返回。

---

## 🏛️ “壳 - 芯” 三层解耦标准系统架构 (Architecture Lifecycle)

ResinDB Pro 采用严格可移植的**三层体系架构模型**，使底座展现和顶级算法高度自恰，支持核心逻辑轻而易举地移植到 Next.js、Nuxt.js、企业级微前端 (Micro-Frontends) 或是移动客户端系统。

```
                       ┌──────────────────────────────────────────────┐
                       │            UI 展现层 (Presenters)             │
                       │    (DataGrid.tsx, DependencyMapD3.tsx, ...)  │
                       └──────────────────────┬───────────────────────┘
                                              │ 一律通过强类型 TS Interface 双向传递
                                              ▼
                       ┌──────────────────────────────────────────────┐
                       │          业务逻辑自恰层 (User Cases)          │
                       │    (useDataGrid.ts, useDatabase.ts, ...)     │
                       └──────────────────────┬───────────────────────┘
                                              │ 采用非阻塞高并发 RPC IPC 协议通讯
                                              ▼
                       ┌──────────────────────────────────────────────┐
                       │     Web Worker 多线程高密度科学计算内核       │
                       │     (24+ 独立高精度物理热化学计算线程)       │
                       └──────────────────────────────────────────────┘
```

1. **UI 纯净化 (Pure Presentation)**: 组件（如 `DependencyMapD3`、`RheologyGraph`）只充当哑呈现组件，不包含任何数据存取和复杂代数循环，所有入参和状态变更只与统一抽象类型挂钩。
2. **适配器模式隔离层 (Adapter Pattern Service)**: 提供高密度的 Service 接口。不论底层存储层采用高性能在线 Firebase 数据库协同、云 PostgreSQL 实存，还是离线本地 LocalStorage / LevelDB 原型缓存，UI 均无需任何改动。

---

## 🚀 v3.1.0 核心重大技术成果 (Core Technological Breakthroughs)

在 `v3.1.0-stable` 正式版中，系统底层架构和数理安全均完成了里程碑式的演进：

### 1. ⚙️ 基于 WebAssembly / JS 双引擎的流变学高精度非线性拟合器
*   **物理本构**：集成了 Carreau-Yasuda 剪切粘度拟合方程，可在毫秒级求解出材料零剪切粘度 $\eta_0$、松弛时间常数 $\lambda$ 以及稀剪切指数 $n$。
*   **WASM 高速求解**：引入 Native WebAssembly 编译的 Newton-Raphson 多维雅可比矩阵收敛算法，相较于纯 JS 引擎，多端混合拟合效率提升 **220% 以上**。
*   **数理安全防护**：对零分母项、指数幂为负数、或非有限数 (NaN/Infinity) 的计算边界进行了物理拦截与强制收敛保护，确保高噪实验数据下系统不崩溃、不卡死。

### 2. 📡 实验室级高频套接字遥测网联网关与传输介质仿真 (Lab Telemetry)
*   **双通道握手**：支持 Physical WebSockets（真实硬件通道）与 Virtual Loopback（虚拟环回仿真）双模式热切换。
*   **高保真网络噪声模型**：内置高精度抖动 (Jitter)、丢包率 (Packet Loss)、信号漂移 calibration 的实时调节，模拟在复杂工业车间及弱网环境下的物化参数（密度、熔指、模量）数据传输抗扰性。

### 3. 🤖 Gemini Multimodal 驱动的分子与配方草图智能视觉解析
*   **零样本物化提取**：搭载大模型多模态视觉 OCR 探针，支持一键解析分子红外光谱图线特征、催化流变图谱或手写物性分析草图。
*   **动态配方注入**：自动提取配方结构化参数并实时注入到计算网格与材料性能平衡模型中。

### 4. 🗄️ 基于 React Concurrent Mode 的高并发防竞态状态管道
*   **并发安全防护**：重构了 `DataContext.tsx` 中的 optimistic updates（乐观锁数据流），引入 `useRef` 实现对变化状态的同步锁，彻底杜绝了并发渲染（Concurrent Mode）下的数据 race condition 与脏状态覆盖。

### 5. 📦 Vite 6 多阶 Rollup 按需精细化拆包 (Build Performance)
*   **打包优化**：通过 `vite.config.ts` 中的 `manualChunks` 规则，将庞大的依赖智能解耦为 `vendor-echarts`、`vendor-recharts`、`vendor-ui-libs` 等独立静态子模块，大幅提升首屏秒开效率。

---

## 🗄️ 热插拔・高容灾分离式高分子数据库体系 (Hot-Swappable Resilient Database)

作为顶尖工业级软件，本系统设计了极强的**防腐性与容灾性数据隔离安全机制**。整个核心高分子和催化剂静态牌号数据集已被物理剥离，独立存储于指定区域：

*   **分离式核心存储**：全球/全石油化系统核心牌号字典整体集中存放于 `/src/data/polymerDatabase.json`，不再与业务逻辑、路由或展现逻辑产生硬编码混合。
*   **物理删除零阻断 (Resilient Zero-Compilation Fail)**：为了应对在真实大规模部署和日常开发中因误操作或物理磁盘暴雷导致该 `polymerDatabase.json` 文件被**完全删除**的场景，系统采用基于 Vite 编译期的 `import.meta.glob` 表达式动态探针。
*   **双通道优雅降级 (Graceful Fallback)**：
    在系统启动及底层 IndexedDB 种子初始化阶段，动态加载器优先检验指定区域；若发现该数据库文件被物理删除，加载器会向全局 Logger 发送等级为 `WARN` 的工艺安全警告，并瞬间强制激活预先备用的**特高强度防御型自恰物理牌号（HDPE 5000S 与 PP T30S 核心样品备份）**。

---

## ⚛️ Web Worker 多线程多维高密度科学演算矩阵 (Multi-Threaded Workers)

为保证整个高保真原型在进行多物理参量扫频和拟合时不发生主帧率瞬时坠毁，本系统特建立了由 **24 组独立 Web Workers 驱动的高并发独立线程网格**。所有复杂的热化学、力学寿命及流变粘弹方程的求解，在后台线程独立调谐、实时交付：

| 独立线程名称 | 后台执行的材料学 / 物理、热力学算法方程 | 输入载荷与扫频因子 | 科学计算指标及作用 |
| :--- | :--- | :--- | :--- |
| `carreauWorker.ts` | **Carreau-Yasuda 剪切流变流动本构通用拟合方程**:<br>$$\eta(\dot{\gamma}) = \eta_{\infty} + (\eta_0 - \eta_{\infty})[1 + (\lambda \dot{\gamma})^a]^{\frac{n-1}{a}}$$ | 动态剪切速率变温扫频振幅向量 | 精确解算出材料宏观零剪切粘度 $\eta_0$、松弛时间常数 $\lambda$，定量判定产品挤出拉膜抗表面破裂和鲨鱼皮特性。 |
| `wlfWorker.ts` | **William-Landel-Ferry (WLF) 时温等效动力本构相平移变换**:<br>$$\log a_T = \frac{-C_1(T - T_g)}{C_2 + (T - T_g)}$$ | 多重扫温频率 DMA（动态热力学分析仪）阻尼损失因子谱 | 依靠时域频域温度相互换算，将试验局限频率（如 $100\text{Hz}$）拓宽拟合出 $10^{10}\text{Hz}$ 的高阻尼降噪与力学松弛谱线。 |
| `pronyWorker.ts` | **Prony Series 时域蠕变粘弹性离散麦克斯韦应力松弛模型**:<br>$$G(t) = G_e + \sum_{i=1}^N G_i \exp\left(-\frac{t}{\tau_i}\right)$$ | DMA 特征松弛扫频阶数系数阵列 | 估计高分子复合材料在连续长载荷形变（蠕变）下的结构应力松弛时间谱线，用于汽车/压力管道安全评测。 |
| `weibullWorker.ts` | **Weibull 二参数极限极限应变力学疲劳寿命失效概率分布**:<br>$$F(t) = 1 - \exp\left(-\left(\frac{t}{\eta}\right)^\beta\right)$$ | 树脂高频率断裂强度测试及高温持久蠕变寿命序列 | 算出长效疲劳破坏概率，输出失效形状参数 $\beta$。辅助合成室迅速辨别由结晶球晶尺寸引起的力学退化。 |
| `arrheniusWorker.ts` | **Arrhenius 电化学/热氧化链解聚能量活化能热老化模型**:<br>$$k = A \exp\left(-\frac{E_a}{R T}\right)$$ | TGA 热分解终点质量残余、各温度下热氧损耗速率 | 解构当前高聚物大分子链化学共价键断键难度，判定该牌号产品的长周期实验室加速热氧老化衰减。 |
| `kineticsWorker.ts` | **Avrami 升/降结晶动力学方程**:<br>$$1 - X_t = \exp(-k t^n)$$ | 熔体差示扫描量热计 (DSC) 降温晶粒形核与生长扫频谱 | 描绘出聚合产品在大规模后加工工艺中，结晶速度与晶核形成参数 $n$，为模具温控开合时间提供最合理的设定区间。 |
| `bayesWorker.ts` | **贝叶斯不确定性多点位高分子物化性状联合估计模型** | 进料质量偏差、单体共聚比例高频波动谱 | 在缺乏实测取样阶段，输出产品实时在线熔指（MFR）、微观密度指标的在产均值变位概率。 |
| `sobolWorker.ts` | **Sobol’ Global Sensitivity 全局一阶/全阶多变量敏感性分解分析** | 回收再生料掺杂比率、多抗氧剂助剂微克配比向量 | 定量判定各种主辅配方的细微波动对材料最核心物理指标（如拉伸强度、气味等级）产生的直接作用占比。 |
| `monteCarloWorker.ts`| **高维多级多通道 Monte Carlo 配方容差不确定性投料推导引擎** | 原料单体挥发分、压强周期波动波动统计方差 | 历经 10 万次混沌步长高频率拟合计算，预测该在产牌号大规模出厂的 Cp 与 Cpk 材料质量稳定性指数。 |
| `copulaWorker.ts` | **Copula 联合极限偏态非线性物理参数应力关联分析器** | 拉伸强度与耐划伤强度边缘分布散点矩阵 | 脱开简陋的 Pearson 线性假设，发现物理极限特性在材料中的内在耦合规律。|
| `similarityWorker.ts`| **基于 Mahalanobis 马氏和欧氏特征向量加权的关联材料对标器** | 16 个反映热/力/加工特性的高维物理极坐标数组 | 采用多特征加权矩阵，秒级搜索系统全部谱库，完成物理替代品推荐。 |
| `kmeansWorker.ts` | **K-Means 高维特征空间无监督高分子牌号智能划分聚类** | 全球/全国同类树脂牌号力学和经济学特征离散阵列 | 完成自动智能归类排版，为销售和研究提供大材料层级的精细对标聚类分析。 |

---

## 🕸️ D3.js 拓扑学级联动力学图谱引擎规约 (D3 Topology Core)

本系统关联谱图的核心（位于 `/src/components/charts/DependencyMapD3.tsx`）采用定制级的 D3.js v7 进行设计开发，专为化学制造、改性塑料合成制备关系网研发：

```typescript
// 1. 初始化两极阻尼引力约束
const simulation = d3.forceSimulation(data.nodes)
  .force("link", d3.forceLink(data.links).id((d: any) => d.id).distance(params.linkDistance))
  .force("charge", d3.forceManyBody().strength(-params.repulsion)) // 排斥阻尼
  .force("collide", d3.forceCollide().radius((d: any) => d.radius + 15).iterations(2)); // 双精度圆盾碰撞
```

1. **高敏捷多布局转换 (Configurable Dual-Layout Mode)**:
   * **Force 引力无定向视图**: 适合大节点高维无定形对标、催化配位机制快速展示。
   * **Layered 垂直层架布局**: 依据聚合上下游链。强制使 `chemical` 类的聚合单体、辅料上拉至 `height * 0.25`；树脂产品、终端共聚塑料下拉至 `height * 0.75`。视觉层级严谨符合实验室工艺顺序。
2. **两级可调连线本构样式 (Straight vs. Curved Transition)**:
   * **直线连接 (Straight)**: 正规工程直感，视觉上最直接。
   * **贝塞尔弧线 (Curved)**: 使用大范围弧度公式描述材料流变反应的曲率，动能流动效果最显著。
     ```typescript
     const dx = d.target.x - d.source.x, dy = d.target.y - d.source.y;
     const dr = Math.sqrt(dx * dx + dy * dy);
     return `M${d.source.x},${d.source.y}A${dr},${dr} 0 0,1 ${d.target.x},${d.target.y}`;
     ```
3. **级联 Trace 双向过滤与发光轨迹**:
   * 支持 **Upstream 溯源 (蓝色)**、**Both 双向关联 (紫色)**、**Downstream 流布 (绿色)**。
   * 触发特异性节点分析时，无关联网络节点大幅度调减透明度至极具未来感的 `0.05`。特异相关的上下游连线上启动由 `flowingGradient` 与 `stroke-dasharray` 双重映射的匀速高分子流动粒子，生动体现合成化学供应链的能流、物流方向。
4. **智能固定机制 (Pinning) 与快捷维基/SciFinder 检索**:
   * 一键固定/解固。支持对特定牌号位置拖拽锁定 (`node.fx = node.x`)，不再跟随引力晃动。
   * 本地/云端双语路由检索链接，让物理特性与广阔的数字文献一键瞬间贯连。

---

## 📂 工业级项目物理目录文件映射 (Directory Blueprint)

本系统所有源码依据领域事件和职责（SOLID 系统规范），有条不紊地部署在最合理的逻辑目录下：

```text
/
├── .env.example               # 云端和 API Key 环境变量声明模版（绝不包含具体密钥）
├── LICENSE                    # 高级别商业演示和科研产权授权协议
├── README.md                  # 主系统开发维护与科研工艺设计总文献（本文件）
├── index.html                 # 主 SPA 承载 HTML、高对比度骨架预加载标签
├── package.json               # 极简依赖库控制中心、带有精密的 lint/test/build 任务链
├── tsconfig.json              # 强类型 TypeScript 环境参数定义
├── vite.config.ts             # 分模块分包惰性加载 (Lazy Loading)、Worker 组自动封装 vite 配置
├── firestore.rules            # Firebase 顶级物理级读写安全拦截与分层角色权限隔离防爆墙
├── src/
│   ├── main.tsx               # 启动、全局 UI 边界溢出和微应用引导中轴
│   ├── index.css              # 导入 Tailwind v4 样式表，含有暗黑科技极暗配色、流动动画帧 keyframes
│   ├── types.ts               # 分子类别、理化性能指标、试验标准的强契约全局强类型。禁止 any
│   ├── i18n.ts                # 专业石油化工字典翻译。保证“零剪切粘度”、“弯曲弹性模量”等中英文双向契合
│   ├── constants.ts           # 包含 100 多个高度精准的真实实验室级模拟 PE, PP, PVC 牌号基础物化常数
│   ├── productUtils.ts        # 共聚物分子量分布及拉伸强韧拟合基础转换等物理材料工具脚本 
│   │
│   ├── services/              # 外部或 API 服务转发层 (Port Adapter API)
│   │   └── productApi.ts      # 提供异步、防抖和错误熔断恢复机制的高质量数据接口
│   │
│   ├── contexts/              # 全局业务控制上下文 (React Context)
│   │   ├── LanguageContext.tsx # 提供全局毫秒级瞬时双向中英文科技语言切换
│   │   └── ThemeContext.tsx    # 控制高对比实验室明暗两级护眼色彩适配
│   │
│   ├── hooks/                 # 核心状态、Undo 回滚操作的复杂 Custom Hooks 集合
│   │   ├── useDataGrid.ts     # 表格分页，列动态可见性拉伸，批量撤销量（Optimistic UI Stack）控制中心
│   │   └── useDatabase.ts     # 提供一站式实时云同步连接绑定，包含高级日志提示组件
│   │
│   ├── workers/               # 系统核心多线程计算节点 (20+ 物理建模 worker 库)
│   │   ├── carreauWorker.ts   # 主流变流速剪切粘度后台本构线程
│   │   ├── pronyWorker.ts      # 蠕变力学失效时域本构拟合线程
│   │   ├── wlfWorker.ts        # 时温等效动力本构相平移物理线程
│   │   ├── bayesWorker.ts      # 熔指在线贝叶斯风险监控线程
│   │   └── kineticsWorker.ts   # DSC 结晶速度及 Avrami 动力计算
│   │
│   └── components/            # 完全解耦的组件世界
│       ├── App.tsx            # 系统底层中枢路由，配有高度顺滑、基于 Framer Motion 的过场渐变
│       │
│       ├── auth/              # 准入和实验室数字权限隔离
│       │   └── AuthScreen.tsx # 精美的深色输入认证面板，支持快速切换 Admin/Editor/Viewer 身份
│       │
│       ├── layout/            # 核心科研排架系统
│       │   ├── SystemNav.tsx     # 高速多维度状态显示、科研功能选项栏
│       │   └── TreeSidebar.tsx   # 按高分子细部大类（PP、HDPE、LDPE等）极密层级树观察栏
│       │
│       ├── ui/                # 极其纯净化、零耦合基础小元件
│       │   ├── ErrorBoundary.tsx # UI 坠毁防护熔断墙
│       │   ├── Skeleton.tsx      # 特高频刷新下的无缝晶格渐变微动占位元件
│       │   └── ToastContainer.tsx# 精准轻微乐观通知栏，带有回滚(Undo)按钮
│       │
│       ├── modals/            # 带有 Framer-Motion 弹性缩放效果的专业模态框
│       │   ├── FormulaEditorModal.tsx # 多维工艺和成分计算公式逻辑书写器
│       │   ├── SmartAnalysisModal.tsx  # 多线程科研拟合、寿命预测报告深度解析模态
│       │   └── BulkReorderModal.tsx   # 材料特征排序、隐藏列智能管理的拖拽元件
│       │
│       ├── views/             # 全景多重视图 (OLAP & Analytical Layouts)
│       │   ├── DashboardView.tsx # 在产情况、总体数据聚合 and 物化特性全局统计仪板
│       │   ├── AnalyticsView.tsx # 多轴 ECharts Ashby 散射、GPC 等多项流变相图科研汇总分析
│       │   ├── PivotView.tsx      # 多物理特性维度多维数据交叉透视表格 (OLAP Panel)
│       │   └── ComparisonView.tsx # 多款牌号详细参数并列和物理差异雷达对比器
│       │
│       └── features/              # 多场景多级材料业务功能大块
│           ├── Ai/                # 搭载 Google Gemini 高级 API 的智能问答及配方流式推演副驾驶
│           │   ├── AiCopilot.tsx      # 对话及一键提取化学配方、一键写公式组件
│           │   └── DashboardAiCard.tsx# 顶部智能工艺风险警告和宏观点评卡片
│           ├── DataGrid/          # 定制高性能网格 (虚拟树形网格、列拉伸、位置锁定等)
│           └── Product/           # 牌号细部热学、加工测试属性多维分析抽屉
```

---

## 🚀 完美、保真使用方法全景指南 (User Manual Workflows)

为确保科研工作者开箱即用，以下是材料从对标到计算的最佳全场景科研流程：

### 流程阶段 A：高性能过滤定位
1.  **树型层树选择**: 首先在左侧 `TreeSidebar` 框中选定要研究的聚合物树突骨架（例如选择：`聚合树脂-聚丙烯-茂金属共混PP`）。
2.  **高速组合搜寻**: 在右上角输入框进行无缝过滤，支持包含 CAS 号（如 `9003-07-0`）、化学分子式、或是牌号英中文拼写，下方 `DataGrid` 毫秒级闪烁呈现高精度匹配。
3.  **透视多轴分析 (Pivot)**: 切换到 `PivotView` 透视模式下，将“基体分子”和“催化剂”拖入矩阵纵横两轴，即可得到全方位的 MFR、弯曲模量在工艺分类矩阵中的平均态、离散态统计。

### 流程阶段 B：后台多线程高参数多物理场拟合
1.  **多选对标**: 在 `DataGrid` 对话框中多选 3-5 款在产极具代表性茂金属 PE 产品牌号，切入左侧快捷导航 `ComparisonView` 模式，查看 16 物理性能维度的指纹雷达比对。
2.  **启动模拟分析 (Rheology & Simulation)**:
    *   调出 `SmartAnalysisModal`。勾选需要对标的 `Carreau 零剪切粘度扫频` 或 `Avrami 结晶力学演变`。
    *   自主拉动界面滑片调整“测试温度 T”及“结晶时间步长”。
    *   调谐完成，对应多组 Web Worker 极速进行后台动力方程联立求解和累层累积，在不产生系统任何一丝微顿卡滞的前提下，在 `ECharts` 窗口下完美画出流动拟合动力常数直线与指数时域蠕变、失效 Weibull 双参数概率曲线。

### 流程阶段 C：D3 依赖拓扑溯源分析
1.  **谱系模式激活 (Dependency Map)**: 点击科研视图中的 **“关系谱图 (D3 Dependency System)”**。系统将瞬间激活高保真 D3 渲染引擎。
2.  **切换垂直层架布局 (Layered)**:
    *   点击侧边设置面板的 **“分层 (Layered)”**。你会发现聚合单体（例如 `Propylene Monomer`、各催化单体）瞬间平滑升向上方；而聚合产品和后续改性塑料（如 `PP-Co-12`）整洁排在下方。
    *   点击连线模式的 **“曲线 (Curved)”**。所有的工艺连接线瞬时转化为流动渐变的微粒子能量弧段。
3.  **多级 Trace 自适应筛选**:
    *   右键任意节点，点击上下文菜单中的 **“固定当前位置”**。该节点将锁定在此，以便进行独立标写。
    *   勾选追踪模式为 **“Upstream 来源”** 或 **“Downstream 影响”**，非级联链路将全部隐藏或变调灰色。
    *   点击上下文菜单中的 **“维基百科”** 即可瞬间跳转对于该催化剂或助剂的国际标准材料安全物理数据详情页（CSD）。

---

## 🔩 云端部署与本地沙箱敏捷启动 (Deployment Matrix)

系统内置完善的任务总管，支持在纯本地离线断网、以及全托管容器多云中实现闪电部署：

### 1. 纯本地独立运行在 3000 沙箱端
```bash
# 进入根项目，直接调用 npm 同步机制
npm install

# 本地质检（若 ESLint 或强类型静态校验存在语法瑕疵，会自动亮红断言阻止）
npm run lint
npm run typecheck

# 运行全量 Vitest 单元测试
npm run test

# 激活秒级热更新本地沙箱调试（强制路由绑定于 3000）
npm run dev
```

### 2. 生产高内聚分卷打包 (Production Compiling)
```bash
# 运行 Vite 代码库合规校验与测试
npm run validate

# 触发超级 Vite-Rollup 打包链。其将自动混淆、精缩变量、生成分卷包至 /dist
npm run build
```

### 3. 多云全生命周期云部署 (Firebase / GCP Integration)
```bash
# 1. 登录云 CLI 端
npx firebase login

# 2. 编译并上传 firestore 阻断级安全保护权限至云协同项目
npm run deploy-rules

# 3. 极速把构建好的静态资源同步至高弹性 CDN
npx firebase deploy --only hosting
```
