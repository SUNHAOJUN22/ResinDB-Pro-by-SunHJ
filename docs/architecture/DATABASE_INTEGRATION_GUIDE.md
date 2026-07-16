# ResinDB Pro 数据库集成与全栈架构白皮书
## (MongoDB, MySQL, Cloud SQL & Firebase Integration Manual)

本指南面向工业级高性能塑料物性数据库的开发与极速部署，演示如何将客户端轻量的本地存储（IndexedDB / LocalStorage）无感、热插拔升级至后端物理数据库（如 **MongoDB** 或 **MySQL / Cloud SQL**），实现高度隔离、安全持久化、以及极速检索。

---

## 🗺️ 架构设计图景 (The Big Picture)

ResinDB Pro 遵循**接口适配器模式（Adapter Pattern）**。前端的所有业务组件（如物性大盘、科学对比看板 `ComparisonView`、偏离度分析 `AnalyticsView`）仅对抽象接口 `IProductAdapter` 依赖。

```
       ┌────────────────────────────────────────────────────────┐
       │                前端 UI 业务交互组件集群                  │
       │     (DashboardView, ComparisonView, AnalyticsView)     │
       └──────────────────────────┬─────────────────────────────┘
                                  │
                                  ▼
                     ┌─────────────────────────┐
                     │ IProductAdapter (Interface) │
                     └────────────┬────────────┘
                                  │
         ┌────────────────────────┴────────────────────────┐
         ▼                                                 ▼
┌─────────────────────────┐                       ┌─────────────────────────┐
│ IndexedDBProductAdapter │                       │ RemoteAPIProductAdapter │
│   (本地浏览器端离线沙箱)     │                       │ (全栈远端 REST API 主动适配群)│
└─────────────────────────┘                       └────────────┬────────────┘
                                                               │
                                                               │ (HTTP / JSON / HTTPS)
                                                               ▼
                                                  ┌─────────────────────────┐
                                                  │   Node.js Express APP   │
                                                  │ (云端 Server 端路由解析网关) │
                                                  └────────────┬────────────┘
                                                               │
                                  ┌────────────────────────────┴────────────────────────────┐
                                  ▼                                                         ▼
                     ┌────────────┴────────────┐                               ┌────────────┴────────────┐
                     │     MongoDB / NoSQL     │                               │      MySQL / SQL        │
                     │  (使用 Mongoose / Document) │                               │  (使用 Prisma / Relational)│
                     └─────────────────────────┘                               └─────────────────────────┘
```

这种设计的最大优势是：**未来更换底层任何物理数据库，前端不用改动任何一行 UI 代码。** 只需要在环境变量中配置 `VITE_DATABASE_ADAPTER_TYPE=remote_api` 即可一秒全通。

---

## 🗄️ 方案一：集成 MongoDB (Mongoose 驱动级)

MongoDB 极其适合存储高纬度、不规则属性字典的物性数据，因为聚合物属性（如：熔融指数、冲击强度等，具有测定标准、测试温度等多维元数据字段）以 BSON/JSON Document 格式最为直观简捷。

### 1. 依赖安装 (Express 端)
```bash
npm install mongoose dotenv cors express
npm install --save-dev @types/express @types/node
```

### 2. 定义数据库 Schema 与 Model (`src/models/Product.ts`)
```typescript
import mongoose, { Schema, Document } from 'mongoose';

export interface IPropertyValue {
  value: number;
  unit: string;
  standard?: string;
  temperature?: string;
  load?: string;
}

export interface IProductDocument extends Document {
  id: string; // 牌号标识符 / 实验样品UUID
  gradeName: string;
  manufacturer: string;
  manufacturerId: string;
  categoryIds: string[];
  properties: Record<string, IPropertyValue>;
  createdAt: string;
  updatedAt: string;
  isExperimental: boolean;
}

const PropertyValueSchema = new Schema({
  value: { type: Number, required: true },
  unit: { type: String, required: true },
  standard: String,
  temperature: String,
  load: String
}, { _id: false });

const ProductSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  gradeName: { type: String, required: true, index: true },
  manufacturer: { type: String, required: true },
  manufacturerId: String,
  categoryIds: [{ type: String }],
  properties: {
    type: Map,
    of: PropertyValueSchema
  },
  isExperimental: { type: Boolean, default: false, index: true }
}, { timestamps: true });

export const ProductModel = mongoose.model<IProductDocument>('Product', ProductSchema);
```

### 3. 服务端 Express 控制器实现 API 路由 (`server/routes/products.ts`)
```typescript
import { Router, Request, Response } from 'express';
import { ProductModel } from '../models/Product';

const router = Router();

// 1. 搜索路由 (Search) - 支持模糊搜索、大类筛选
router.get('/', async (req: Request, res: Response) => {
  try {
    const { q, categoryId } = req.query;
    const filter: any = {};
    
    if (categoryId) {
      filter.categoryIds = categoryId;
    }
    if (q) {
      filter.$or = [
        { gradeName: { $regex: q as string, $options: 'i' } },
        { manufacturer: { $regex: q as string, $options: 'i' } }
      ];
    }
    
    const products = await ProductModel.find(filter).sort({ createdAt: -1 });
    res.json(products);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. 创建或自测实验样本录入 (Create)
router.post('/', async (req: Request, res: Response) => {
  try {
    const productData = req.body;
    if (!productData.id) {
      productData.id = `p-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    }
    const newProduct = new ProductModel(productData);
    await newProduct.save();
    res.status(201).json(newProduct);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 3. 多牌号联合批量变更 (Batch Update)
router.patch('/batch-update', async (req: Request, res: Response) => {
  try {
    const { ids, updates } = req.body;
    await ProductModel.updateMany(
      { id: { $in: ids } },
      { $set: updates }
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. 清理、注销某些批次自测试样 (Batch Delete)
router.post('/batch-delete', async (req: Request, res: Response) => {
  try {
    const { ids } = req.body;
    await ProductModel.deleteMany({ id: { $in: ids } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
```

---

## 🐬 方案二：集成 MySQL (Prisma ORM 高强类型级)

MySQL / PostgreSQL 对关联报表关系设计良好，配合 **Prisma** 声明式 Schema，可以达到 100% 现代的、全静态编译的 TS 类型防护体系。

### 1. 依赖安装 (Express + Prisma 树状)
```bash
npm install @prisma/client
npm install --save-dev prisma
```

### 2. 定义具有高度迁移力的 Prisma Schema (`prisma/schema.prisma`)
```prisma
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model Product {
  id             String   @id @default(uuid())
  gradeName      String   @index
  manufacturer   String
  manufacturerId String?
  categoryIds    String   // 逗号分隔数组 "sub_hdpe_inj,cat_pe"
  isExperimental Boolean  @default(false) @index
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  
  // JSON 大字段保存多维物性指标，完美兼顾关系列和非结构动态属性 (MySQL 5.7+ 完美支持)
  properties     Json     
}
```

### 3. 表格生成与迁移 (Migration)
```bash
npx prisma db push
```

### 4. 服务端 Prisma 接口极速调和控制器
```typescript
import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

// 获取与模糊检索
router.get('/', async (req: Request, res: Response) => {
  try {
    const { q, categoryId } = req.query;
    const whereClause: any = {};
    
    if (categoryId) {
      whereClause.categoryIds = { contains: categoryId as string };
    }
    if (q) {
      whereClause.OR = [
        { gradeName: { contains: q as string } },
        { manufacturer: { contains: q as string } }
      ];
    }
    
    const results = await prisma.product.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' }
    });
    
    // 转为前端需要的标准格式，解析 categoryIds
    const parsed = results.map(r => ({
      ...r,
      categoryIds: r.categoryIds.split(',').filter(Boolean),
      properties: typeof r.properties === 'string' ? JSON.parse(r.properties) : r.properties
    }));
    
    res.json(parsed);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
```

---

## ⚡ 极速起死回生：大盘数据种子静默导入 (Dynamic Seeding)

当服务器刚连上 MongoDB 或 MySQL 时，数据库为空。我们可设立一套自动 Seeding 系统。在服务器冷启动时，直接抽取项目里你配置的离线静态大盘 `src/data/openMarketUniverse.json` 和实验室大盘 `src/data/myLabUniverse.json` 进行全自动注入：

```typescript
import { ProductModel } from '../models/Product';
import staticOpenData from '../../src/data/openMarketUniverse.json';
import staticLabData from '../../src/data/myLabUniverse.json';
import { UniversalStorageBridge } from '../../src/lib/adapters/UniversalStorageBridge';

export async function seedDatabaseIfEmpty() {
  const count = await ProductModel.countDocuments();
  if (count === 0) {
    console.log("💾 探测到全新的物理数据库。正在利用热插拔 JSON 数据库种子进行安全初始化...");
    
    // 将静态 Records 翻译为 standard Product
    const openProducts = staticOpenData.map(r => UniversalStorageBridge.recordToProduct(r as any));
    const labProducts = staticLabData.map(r => UniversalStorageBridge.recordToProduct(r as any));
    
    const allProducts = [...openProducts, ...labProducts];
    await ProductModel.insertMany(allProducts);
    console.log(`🚀 成功初始化注入 ${allProducts.length} 条顶尖工程树脂数据！`);
  }
}
```

---

## 🏁 如何现在一键测试此方案？

1. 本项目已经创建了完美的 **`RemoteAPIProductAdapter`**，并且在 `index.ts` 接入了自动门限开关。
2. 打开项目根目录的 `.env.example`（我们已经为你全套创建好），然后将本地的 `.env` 中修改：
   ```env
   # 即可在不修改哪怕一个 React 组件文件的状态下，无缝切换数据库连接模式！
   VITE_DATABASE_ADAPTER_TYPE=remote_api
   ```
3. 任何时刻如果后端 API 不存在或发生断连，`RemoteAPIProductAdapter` 均会自动触发 **Defensive Graceful Fallback (防御性优雅回退)**，回退至纯客户端级 IndexedDB 处理，确保无论在任何高压环境下演示，您的界面总是有完美数据可用！依然是丝滑流畅、防腐防老化的最高工业标准。

---
⚡ *Crafted by Principal Database Solutions Architect.*

