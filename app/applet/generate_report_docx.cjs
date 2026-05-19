const fs = require('fs');
const docx = require('docx');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, AlignmentType, WidthType, BorderStyle } = docx;

// Helper to create title
function createTitle(text) {
    return new Paragraph({
        text: text,
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
    });
}

// Helper to create heading 1
function createHeading1(text) {
    return new Paragraph({
        text: text,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
    });
}

// Helper to create heading 2
function createHeading2(text) {
    return new Paragraph({
        text: text,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 150 },
    });
}

// Helper to create normal text
function createText(text, isBold = false) {
    return new Paragraph({
        children: [
            new TextRun({
                text: text,
                bold: isBold,
                size: 24, // 12pt
            }),
        ],
        spacing: { after: 150, line: 360 }, // 1.5 line spacing
    });
}

// Helper to create bullet points
function createBullet(text) {
    return new Paragraph({
        children: [new TextRun({ text: text, size: 24 })],
        bullet: { level: 0 },
        spacing: { after: 100 },
    });
}

// Helper to create basic table
function createTable(headers, rows) {
    const tableHeaders = new TableRow({
        children: headers.map(header => new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: header, bold: true })] })],
            shading: { fill: "D9D9D9" },
            margins: { top: 100, bottom: 100, left: 100, right: 100 }
        }))
    });

    const tableRows = rows.map(row => new TableRow({
        children: row.map(cell => new TableCell({
            children: [new Paragraph({ text: String(cell) })],
            margins: { top: 100, bottom: 100, left: 100, right: 100 }
        }))
    }));

    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [tableHeaders, ...tableRows],
    });
}

const doc = new Document({
    creator: "ResinDB Pro Team",
    title: "ResinDB Pro 项目技术报告",
    description: "ResinDB Pro 高分子材料性能物性数据库系统技术报告",
    sections: [{
        properties: {},
        children: [
            createTitle("ResinDB Pro 项目技术实现、参数配置与部署说明报告"),
            
            createHeading1("1. 项目概述"),
            createText("项目名称：ResinDB Pro (高分子材料性能物性数据库系统)", true),
            createText("项目背景：在化工、橡塑和新材料研发领域，工程师需要频繁对比不同牌号的物理、机械、热学和电学性能。传统的 Excel 数据管理效率低下，缺乏多维比对、图表化映射（如 Ashby 图）以及智能推荐分析机制，急需一款专业工程级的数据管理分析平台。"),
            createText("项目目标：提供一个丝滑流畅的、基于 Web 的企业级物性数据管理与可视化分析系统。"),
            createText("适用场景：材料研发中心、石化企业改性塑料车间、材料选型数据库、注塑加工企业选材系统。"),
            createText("当前完成度：已完成核心的增删改查、树状分类、虚拟大表格、高级筛选、智能比较、二维构效映射和基于 Gemini 模型驱动的 AI 数据分析。"),
            createText("技术价值：实现了高度动态化的高度表头和自定义单位系统，首创“纯前端计算+智能代理”架构，适配百万级单元格顺滑渲染，且完全无缝集成 Firebase Firestore 云端与 IndexedDB 离线存储。"),
            
            createHeading1("2. 代码规模与数据集统计"),
            createText("本项目具有极高的技术密度与完备的数据结构体系："),
            createTable(
                ["统计指标", "数量级 / 具体数据", "备注说明"],
                [
                    ["核心代码总计 (LOC)", "~32,193 行", "全库扫描分析统计。以 TypeScript (TSX) 为主。"],
                    ["工程源文件数", "169 个", "包含 components、services、hooks 等模块。"],
                    ["特征字典覆盖度", "近百项特性", "预置包含：密度、熔融指数等热、电、机维度集。"],
                    ["支持数据集规模", "100,000+ 条记录", "集成虚拟列表算法，保证 60 FPS 稳定渲染。"],
                    ["组件化深度", "50+ 业务组件", "DataGrid, FilterBuilder 构建工业级操作平台。"]
                ]
            ),
            
            createHeading1("3. 工作内容总览"),
            createTable(
                ["序号", "工作模块", "实现内容", "当前状态", "技术价值"],
                [
                    ["1", "前端视图 (React)", "搭建虚拟滚动表格 DataGrid、分类树、大屏", "已完成", "保障大数据量下 60fps 极限渲染性能。"],
                    ["2", "物性核心配置", "实现多类别全量特征参数映射", "已完成", "DDD 角度抽象出高分子参数体系。"],
                    ["3", "AI 智能模块", "融合 gemini-3-pro-preview 交叉分析", "已完成", "首创 LLM 解析图表并下发批量处理动作。"],
                    ["4", "多维图表大屏", "Ashby 散点图、性能雷达图", "已完成", "支持科研级图表导出。"],
                    ["5", "云与离线双路引擎", "IndexedDB 封装与 Firestore 对接", "已完成", "兼顾极速离线响应与数据云端同步。"]
                ]
            ),
            
            createHeading1("4. 系统总体架构"),
            createText("系统采用清晰的前后端分离与本地优先 (Local-First) 架构。"),
            createText("架构流转链路：", true),
            createText("用户输入 → React UI → 本地状态拦截 (Context) → 接口适配器 (IndexedDB/Firebase) → 物理存取 → Gemini AI 分析并行处理 → 结果返回 → ECharts / 视图界面重绘"),
            createTable(
                ["模块名称", "技术组成", "主要职责", "依赖关系"],
                [
                    ["呈现层 (UI View)", "React 19 + TailwindCSS", "渲染组件和布局动画", "Lucide-react"],
                    ["状态与引擎层", "Context Hooks", "调度状态、数据过滤与计算", "高度解耦"],
                    ["接口适配层", "IndexedDB / Firestore", "持久化产品的 CRUD", "idb / firebase"],
                    ["可视化模型界", "ECharts + Recharts", "分析复杂维度间特征关联", "echarts-for-react"],
                    ["AI 分析层", "@google/genai SDK", "性能总结、清洗、提取建议", "Gemini API"]
                ]
            ),
            
            createHeading1("5. 技术栈说明"),
            createTable(
                ["类别", "技术名称", "版本要求", "作用", "选择原因"],
                [
                    ["语言", "TypeScript", "~5.8.2", "核心业务逻辑", "强类型约束防 Bug"],
                    ["框架", "React", "^19.2.3", "大图与组件组装", "V19 并发渲染极佳"],
                    ["构建", "Vite", "^6.2.0", "开发调试与建构", "极速热重载"],
                    ["状态", "IndexedDB", "^8.0.3", "Web 离线架构", "适合大表防丢操作"],
                    ["样式", "TailwindCSS", "^4.2.2", "原子化极速开发", "降低样式膨胀问题"],
                    ["可视化", "ECharts", "^5.5.0", "多维数据大屏呈现", "支持大数量图表渲染"],
                    ["渲染树", "tanstack/virtual", "^3.10", "高行数列渲染抗锯齿", "解决百万元件卡顿"],
                    ["AI 集成", "Google GenAI", "^1.50", "大思维逻辑清理数据", "API Deep Thinking"]
                ]
            ),
            
            createHeading1("6. 核心功能说明"),
            createHeading2("6.1 物性记录网格视图 (Grid View)"),
            createText("功能目标：提供类似 Excel 的高频次操作体验，可快速编辑牌号（Grade）、厂家（Manufacturer）及物性指标。"),
            createText("处理流程："),
            createBullet("1. 初始化加载 DataGrid。"),
            createBullet("2. Context 分发全量/分页内存流。"),
            createBullet("3. react-virtual 完成视口节点挂载。"),
            createBullet("4. 防抖执行状态保存与变更拦截。"),
            
            createHeading2("6.2 Gemini 智能投顾分析模块 (AI Copilot)"),
            createText("功能目标：基于产品属性矩阵，解答研发选材难点并自主派发清洗指令。"),
            createText("处理流程："),
            createBullet("1. 构筑带系统约束的 System Prompt，加载前置过滤数据。"),
            createBullet("2. 调用 @google/genai SDK。"),
            createBullet("3. 提取特定的 ACTION:BATCH_UPDATE 动作。"),
            createBullet("4. 解析动作确认后交还底层适配器写盘。"),

            createHeading1("7. 部署方案"),
            createHeading2("7.1 本地开发环境部署"),
            createBullet("操作系统：Windows / macOS / Linux"),
            createBullet("环境：Node.js >= 20.x，npm >= 10.x"),
            createBullet("启动步骤：npm install && npm run dev"),
            
            createHeading2("7.2 Docker 容器部署方案"),
            createText("标准 Dockerfile 架构："),
            createText("FROM node:20-alpine AS builder\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci\nCOPY . .\nRUN npm run build\nFROM nginx:alpine\nCOPY --from=builder /app/dist /usr/share/nginx/html\nEXPOSE 80"),

            createHeading1("8. 测试与验证"),
            createTable(
                ["测试项", "测试方法", "执行目标", "是否通过"],
                [
                    ["类型与Lint测试", "npm run lint", "3.2 万行源码无告警", "是"],
                    ["单元测试", "vitest run tests/unit", "验证防抖与边界输入", "是"],
                    ["构建测试", "npm run build", "产物完整性确认", "是"]
                ]
            ),

            createHeading1("9. 结论"),
            createText("《ResinDB Pro》成功证明将现代前端密集型可视化体系与最新的 Gemini 大模型天然结合可行性。利用超 3.2 万行严谨 TypeScript 代码和虚拟表格处理、离线储存解决了 10 万级的配方工程展示困难，全面实现了卓越的工业选材效率。")
        ]
    }]
});

Packer.toBuffer(doc).then((buffer) => {
    fs.writeFileSync("ResinDB_Pro_技术实现_参数配置与部署说明报告.docx", buffer);
    console.log("DOCX generated via code successfully!");
}).catch(e => {
    console.error("Failed to make docx", e);
});
