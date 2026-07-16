<div align="center">

# ResinDB Pro

### 合成树脂数据管理与材料信息学分析工作台

**Synthetic Resin Data Management & Materials-Informatics Workbench**

[![CI](https://github.com/SUNHAOJUN22/ResinDB-Pro-by-SunHJ/actions/workflows/ci.yml/badge.svg)](https://github.com/SUNHAOJUN22/ResinDB-Pro-by-SunHJ/actions/workflows/ci.yml)
![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)
![Storage](https://img.shields.io/badge/Default%20Storage-IndexedDB-5A0FC8)
![Branch](https://img.shields.io/badge/Active%20Branch-main-181717?logo=github)

面向聚乙烯、聚丙烯、工程塑料及实验室树脂数据的浏览器端管理与分析系统。项目提供牌号数据库、批量导入导出、属性检索、材料对比、科学图表、Web Worker 计算、安全公式以及可选的用户自定义 AI API 接入。

> **项目边界**：ResinDB Pro 是研究、数据治理和工程演示工具，不是经过认证的 LIMS、ERP、质量放行系统或法规判定系统。所有材料结论、预测结果和标准符合性判断必须由原始数据、测试方法与实验结果复核。

</div>

---

## 目录

- [一、当前版本做什么](#一当前版本做什么)
- [二、界面实机截图](#二界面实机截图)
- [三、快速启动](#三快速启动)
- [四、完整实机操作演示](#四完整实机操作演示)
- [五、AI API 自定义接入](#五ai-api-自定义接入)
- [六、数据存储与远程后端](#六数据存储与远程后端)
- [七、安全公式引擎](#七安全公式引擎)
- [八、科学分析模块](#八科学分析模块)
- [九、工程架构](#九工程架构)
- [十、测试与质量门禁](#十测试与质量门禁)
- [十一、生产部署](#十一生产部署)
- [十二、安全与已知限制](#十二安全与已知限制)
- [十三、分支与开发规则](#十三分支与开发规则)

---

# 一、当前版本做什么

| 能力 | 状态 | 实际说明 |
|---|---:|---|
| 树脂牌号数据库 | 已实现 | 管理牌号、制造商、分类、标签和多维物性字段 |
| IndexedDB 本地持久化 | 默认启用 | 无服务器、无账号、无 API Key 也可直接运行 |
| 搜索和高级筛选 | 已实现 | 支持文本、分类、完整度和数值条件过滤 |
| 批量编辑与标签 | 已实现 | 支持选中记录后的批量属性与标签操作 |
| CSV / XLSX / JSON 导入导出 | 已实现 | 使用前应确认字段名称、测试单位与标准条件 |
| Dashboard / Comparison / Pivot | 已实现 | 用于数据概览、牌号对比和交叉统计 |
| 科学图表与 Worker 计算 | 已实现 | 包含流变、动力学、寿命、聚类、统计过程等模块 |
| 用户公式 | 已实现 | 使用白名单解析器，不执行任意 JavaScript |
| AI API | 可选 | 不绑定供应商或默认模型，由用户自行填写配置 |
| 远程 REST API | 前端适配器已实现 | 本仓库不包含服务器端数据库实现 |
| 登录与角色 | 演示模式 | 内置角色选择不是正式身份认证 |
| 质量认证与法规结论 | 未提供 | 不自动签发 ASTM、ISO、企业标准或合格证书 |

系统在没有 AI、没有远程数据库和没有云服务的情况下仍可完成核心数据管理与分析流程。

---

# 二、界面实机截图

## 2.1 数据仪表盘

![ResinDB Pro dashboard](./docs/images/dashboard_demo.png)

仪表盘用于查看产品数量、属性概况、分类分布、数据质量和快捷分析入口。

## 2.2 材料分析工作区

![ResinDB Pro analytics](./docs/images/analytics_demo.png)

分析工作区用于属性分布、相关性、材料空间、趋势与多牌号比较。

## 2.3 科学计算沙箱

![ResinDB Pro sandbox](./docs/images/sandbox_demo.png)

沙箱用于交互式输入参数，并通过独立 Web Worker 执行计算，避免长计算阻塞主界面。

---

# 三、快速启动

## 3.1 环境要求

推荐环境：

- Node.js `22 LTS`；
- npm `10+`；
- Chrome、Edge 或 Firefox 当前稳定版本；
- Windows 10/11、macOS 或主流 Linux；
- 建议至少 8 GB 内存用于大表格与多图表操作。

检查版本：

```bash
node --version
npm --version
```

## 3.2 获取项目

```bash
git clone https://github.com/SUNHAOJUN22/ResinDB-Pro-by-SunHJ.git
cd ResinDB-Pro-by-SunHJ
```

本仓库只维护 `main` 作为有效开发与发布分支：

```bash
git checkout main
git pull origin main
```

## 3.3 安装依赖

```bash
npm ci
```

使用 `npm ci` 而不是随意执行 `npm install`，可以确保本机安装结果与仓库锁文件一致。

## 3.4 创建本地环境文件

macOS / Linux：

```bash
cp .env.example .env.local
```

Windows PowerShell：

```powershell
Copy-Item .env.example .env.local
```

默认配置即可启动，AI API 相关字段可以保持空白。

## 3.5 启动开发服务器

```bash
npm run dev
```

浏览器访问：

```text
http://localhost:3000
```

---

# 四、完整实机操作演示

以下流程对应当前实际界面和运行逻辑。

## 4.1 第一次进入系统

1. 启动 `npm run dev`；
2. 浏览器打开 `http://localhost:3000`；
3. 进入角色选择页；
4. 选择 `admin`、`editor` 或 `viewer` 演示账号；
5. 等待 Dashboard 和本地数据初始化。

这些角色仅用于前端功能演示，不验证密码、Token 或真实用户身份。生产环境必须接入服务端认证与授权。

## 4.2 浏览和检索产品

进入 Dashboard 后：

1. 在顶部搜索框输入牌号，例如 `PP`、`PE` 或制造商名称；
2. 在左侧分类树选择材料大类；
3. 通过列管理隐藏不需要的属性；
4. 拖动或调整列宽；
5. 点击产品记录打开详细信息；
6. 刷新浏览器，确认 IndexedDB 中的数据仍然存在。

### 数值条件检索

搜索框支持属性条件表达式：

```text
Density:>0.94
MFR:0.5-2
Tensile Strength:>=30
```

说明：

- 属性名必须与数据库列名或当前语言标签匹配；
- 范围写法为 `最小值-最大值`；
- 多个普通关键词采用同时匹配逻辑；
- 单位不会自动换算，比较前必须确认数据单位一致。

## 4.3 新增和编辑产品

1. 点击新增产品按钮；
2. 输入牌号、制造商、分类与基础属性；
3. 保存后记录会写入当前数据适配器；
4. 打开产品详情继续编辑扩展属性；
5. 确认 `updatedAt`、单位和测试标准信息是否正确。

本地 IndexedDB 模式下，数据只保存在当前浏览器配置文件中。

## 4.4 批量操作

1. 在数据表格中勾选多条记录；
2. 打开批量编辑工具栏；
3. 选择批量属性更新、标签追加、标签覆盖或删除；
4. 提交前核对选中数量；
5. 操作后查看 Toast 提示和历史快照。

远程模式下，写入失败会明确报错，不会静默改写本地数据库。

## 4.5 数据导入

支持 CSV、XLSX 和 JSON 等数据来源。建议导入前完成：

- 字段名标准化；
- 数值和文本类型检查；
- 单位统一；
- 测试温度和标准补充；
- 空值、重复值和异常值检查；
- 预留一份原始文件备份。

典型操作：

1. 点击导入；
2. 选择本地文件；
3. 检查预览与字段映射；
4. 确认导入；
5. 使用搜索或分类检查新记录；
6. 运行数据质量审计。

## 4.6 数据导出

1. 使用搜索和筛选得到目标数据集；
2. 点击导出；
3. 选择 CSV、XLSX、JSON 或其他可用格式；
4. 打开导出文件核对记录数量；
5. 对关键数据保留筛选条件、导出时间和版本信息。

## 4.7 材料对比

1. 选择两条或多条树脂牌号；
2. 打开 Comparison 视图；
3. 选择密度、MFR、拉伸、弯曲、冲击等指标；
4. 检查缺失值和单位差异；
5. 将图表作为候选材料筛选依据，而不是最终认证结论。

## 4.8 Analytics 操作

1. 切换到 Analytics；
2. 选择 X、Y 属性或目标分析模块；
3. 设置分类或制造商分组；
4. 查看散点、分布、相关性或材料空间；
5. 记录样本量和缺失值比例；
6. 对异常点返回产品详情核查原始数据。

## 4.9 Sandbox 操作

1. 进入 Sandbox；
2. 选择流变、动力学、寿命或统计模型；
3. 输入参数与单位；
4. 启动计算；
5. 查看图形和数值输出；
6. 将参数、假设和模型版本记录到实验笔记。

科学计算模块主要用于探索、教学和研究前处理。正式科研结果应使用独立数据集和权威软件复算。

---

# 五、AI API 自定义接入

## 5.1 设计原则

ResinDB Pro 当前：

- 不内置 AI 供应商；
- 不安装供应商专用 SDK；
- 不预设任何模型名称；
- 不要求安装额外 AI CLI；
- AI 功能关闭时不影响数据库和分析模块；
- 使用 OpenAI-compatible `chat/completions` 请求结构。

用户需要自行提供：

1. 完整 API Endpoint；
2. 供应商要求的 Model Identifier；
3. 可选 API Key。

## 5.2 在界面直接填写

1. 进入 Dashboard；
2. 找到 **AI API Insights** 卡片；
3. 点击齿轮按钮或 **API Settings**；
4. 填入完整接口地址；
5. 填入模型标识符；
6. 填入 API Key；
7. 点击 **Test**；
8. 测试成功后点击 **Save**；
9. 返回卡片点击刷新生成分析。

示例 Endpoint 形式：

```text
https://provider.example/v1/chat/completions
```

项目不对具体供应商、域名和模型名称做默认选择。

## 5.3 通过环境变量填写

`.env.local`：

```bash
VITE_AI_API_ENDPOINT=https://provider.example/v1/chat/completions
VITE_AI_MODEL=your-model-id
VITE_AI_API_KEY=your-restricted-development-key
```

启动或修改环境变量后需重新运行：

```bash
npm run dev
```

## 5.4 API 兼容要求

服务端应接受类似请求：

```json
{
  "model": "your-model-id",
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." }
  ],
  "temperature": 0.3
}
```

优先支持以下响应结构：

```json
{
  "choices": [
    {
      "message": {
        "content": "response text"
      }
    }
  ]
}
```

客户端同时兼容常见的 `output_text`、`text` 和 `response` 文本字段。

## 5.5 密钥安全

界面保存的配置位于浏览器 `localStorage`。这适合本机开发和受控演示，不适合存放高权限生产密钥。

生产推荐链路：

```text
Browser
  ↓ authenticated request
Company API Gateway / Backend
  ↓ server-side secret
Selected AI Provider
```

不要把无限制密钥提交到 Git、写入公开环境文件或直接发布到前端生产包。

---

# 六、数据存储与远程后端

## 6.1 默认 IndexedDB 模式

`.env.local`：

```bash
VITE_DATABASE_ADAPTER_TYPE=indexeddb
```

特点：

- 无需后端；
- 数据保存在当前浏览器；
- 适合个人研究、演示和离线使用；
- 清理浏览器数据会删除本地数据库；
- 不具备跨设备同步和集中权限控制。

## 6.2 远程 REST API 模式

```bash
VITE_DATABASE_ADAPTER_TYPE=remote_api
VITE_REMOTE_API_BASE_URL=https://your-server.example/api
VITE_REMOTE_READ_FALLBACK=false
```

前端期望的主要接口包括：

```text
GET    /products
POST   /products
PUT    /products/:id
PATCH  /products/batch-update
POST   /products/batch-create
POST   /products/batch-delete
POST   /products/export
POST   /products/restore-snapshot
```

远程写入失败时，系统不会把数据改写到 IndexedDB 并伪装成成功，因为这种行为会造成服务器与浏览器数据分叉。

## 6.3 生产后端最低要求

- 身份认证；
- 服务端角色授权；
- 输入 Schema 校验；
- 单位和字段字典；
- 数据库事务；
- 操作审计日志；
- 备份与恢复；
- API 限流；
- HTTPS；
- 密钥和连接字符串托管。

---

# 七、安全公式引擎

公式引擎不使用 `eval` 或 `new Function` 执行用户输入，而是通过词法分析、递归下降解析和受控执行计算数值结果。

## 7.1 支持语法

属性引用：

```text
Props['Density']
Props['MFR']
```

算术：

```text
+  -  *  /  %  ^
```

函数：

```text
abs sqrt pow log log10 exp sin cos tan min max
```

常量：

```text
PI
```

## 7.2 示例

```text
Props['Density'] * 1000
sqrt(pow(Props['Tensile Strength'], 2) + abs(Props['Impact Strength']))
max(Props['MFR'], 0.01) / Props['Density']
```

## 7.3 循环依赖

以下公式会被拒绝：

```text
A = Props['B'] + 1
B = Props['A'] + 1
```

## 7.4 边界

公式解析器降低了任意脚本执行风险，但不能替代：

- 业务数据权限；
- 服务端验证；
- 单位系统；
- 数值误差分析；
- 科学模型验证。

---

# 八、科学分析模块

项目包含或预留的分析方向包括：

- Carreau-Yasuda 流变模型；
- WLF 时温等效；
- Prony 粘弹性级数；
- Weibull 寿命分布；
- Arrhenius 热降解；
- 结晶动力学；
- KDE 核密度估计；
- SPC 统计过程控制；
- K-Means 聚类；
- Mahalanobis 距离；
- 多目标 Pareto 分析；
- 响应面和预测分析；
- 相关性、相似性和材料空间可视化。

使用任何模型前必须确认：

- 参数定义；
- 单位；
- 数据来源；
- 适用温度和应变范围；
- 样本量；
- 边界条件；
- 与权威实现的对照结果。

---

# 九、工程架构

```text
index.html
└── src/index.tsx
    └── src/components/App.tsx
        ├── components/
        │   ├── views/          页面与分析视图
        │   ├── features/       DataGrid、AI、Analytics、Navigation
        │   ├── charts/         D3、ECharts、Recharts 图表
        │   ├── layout/         顶栏、侧栏、移动导航
        │   └── modals/         导入、编辑、配置和审计弹窗
        ├── contexts/           Auth、Data、UI、Theme、Toast、Modal
        ├── hooks/              数据管理、快捷键、导出和 Worker Hooks
        ├── lib/
        │   ├── adapters/       IndexedDB 与 Remote REST Adapter
        │   ├── formulaParser.ts
        │   └── 数学、过滤、验证工具
        ├── services/
        │   └── aiService.ts    用户自定义通用 AI API 客户端
        └── workers/            后台科学计算
```

核心数据流：

```text
User Action
   ↓
React Component
   ↓
Context / Hook
   ↓
Typed Adapter or Worker
   ↓
State Update / Rollback / Toast / History
```

工程原则：

1. 数据源必须明确；
2. 写入失败必须可见；
3. 本地库与远程库不能静默混写；
4. 用户公式不能执行任意脚本；
5. AI 输出必须区分事实、计算和假设；
6. 所有提交必须通过自动化质量门禁。

---

# 十、测试与质量门禁

## 10.1 单独运行

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run smoke
```

## 10.2 完整验证

```bash
npm run validate
```

执行链路：

```text
ESLint
  → TypeScript typecheck
  → Vitest
  → Vite production build
  → production HTTP smoke test
```

## 10.3 烟雾测试做什么

`npm run smoke` 会：

1. 使用已经生成的 `dist/`；
2. 启动 `vite preview`；
3. 请求真实 HTTP 地址；
4. 检查返回状态；
5. 检查 React 根节点；
6. 结束预览进程。

## 10.4 GitHub Actions

`main` 的每次 Push 都会执行 CI。CI 未通过的提交不应作为发布版本部署。

---

# 十一、生产部署

## 11.1 构建

```bash
npm ci
npm run validate
```

生产文件输出到：

```text
dist/
```

## 11.2 Nginx 示例

```nginx
server {
    listen 80;
    server_name resindb.example.com;

    root /var/www/resindb/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8080/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 11.3 上线检查清单

- [ ] `npm ci` 成功；
- [ ] `npm run validate` 成功；
- [ ] 不存在 `.env`、密钥或连接字符串提交；
- [ ] 正式身份认证已接入；
- [ ] 服务端授权已启用；
- [ ] 数据库备份已验证；
- [ ] HTTPS 已启用；
- [ ] API 限流已启用；
- [ ] AI 请求经过服务端网关；
- [ ] 日志不包含敏感数据；
- [ ] 导入字段和单位字典已固化；
- [ ] 科学模型已完成独立验证。

---

# 十二、安全与已知限制

## 12.1 安全

详细策略参见 [`SECURITY.md`](./SECURITY.md)。

禁止提交：

- `.env`；
- API Key；
- 数据库密码；
- 私钥；
- 云服务凭据；
- 内部实验或客户敏感数据。

## 12.2 已知限制

- 当前登录页是演示角色选择；
- 默认数据库是浏览器 IndexedDB；
- 仓库不包含正式远程后端；
- AI API 配置保存在浏览器时不适合高权限密钥；
- 图表和科学模型不自动完成实验验证；
- 数据单位不会在所有模块中自动换算；
- 浏览器存储容量由设备和浏览器策略决定；
- 大规模数据集仍需后端分页、索引和服务端分析。

---

# 十三、分支与开发规则

本仓库采用单主分支管理：

```text
main
```

规则：

1. `main` 是唯一长期维护分支；
2. 不保留功能分支、机器人分支或历史临时分支；
3. 所有修改最终直接同步到 `main`；
4. 提交后必须检查 GitHub Actions；
5. 文档描述必须与实际代码和测试一致；
6. 不使用无法验证的性能、认证或“工业级零缺陷”表述。

---

<div align="center">

**ResinDB Pro — make resin data searchable, auditable and experimentally verifiable.**

</div>
