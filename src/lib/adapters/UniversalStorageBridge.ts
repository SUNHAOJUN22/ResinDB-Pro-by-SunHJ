import { MaterialRecord, MaterialPhysicsSpecs } from './types';
import { Product, PropertyValue } from '@/types/index';
import { PRODUCT_CATALOG } from '@/config/constants';
import { PolymerDataValidator } from './PolymerDataValidator';
import staticLabData from '../../data/myLabUniverse.json';
import staticOpenData from '../../data/openMarketUniverse.json';

export class UniversalStorageBridge {
  private static LAB_STORAGE_KEY = 'resindb_pro_my_lab_data';
  private static OPEN_STORAGE_KEY = 'resindb_pro_open_market_data';

  /**
   * 1. 从 LocalStorage 货架获取所有实验室自测数据 (并执行铁律级专家审计清洗)
   */
  public static getLabRecords(): MaterialRecord[] {
    try {
      const data = localStorage.getItem(this.LAB_STORAGE_KEY);
      let records: MaterialRecord[];
      if (!data) {
        // 使用导入的静态离线 json 库作为种子，达到开箱即用和热插拔目的
        records = staticLabData as MaterialRecord[];
      } else {
        records = JSON.parse(data);
      }
      const cleaned = PolymerDataValidator.cleanBatch(records);
      localStorage.setItem(this.LAB_STORAGE_KEY, JSON.stringify(cleaned));
      return cleaned;
    } catch (e) {
      console.error("Failed to read lab records from storage:", e);
      return PolymerDataValidator.cleanBatch(staticLabData as MaterialRecord[]);
    }
  }

  /**
   * 2. 安全保存或覆盖单个实验室自测记录（在存储前应用严苛物性极限与熔断校验）
   */
  public static saveLabRecord(record: MaterialRecord): void {
    const validated = PolymerDataValidator.validateAndClean(record);
    if (!validated) {
      console.error("[Polymer Validator Rejected] Save operation aborted. Record is lacking minimum core physical properties.");
      throw new Error("数据合规错误：核心物理力学指标（密度、熔指、拉伸强度、弯曲模量、冲击强度）最少需声明2项且参数必须具有真实物理合法范围。");
    }
    try {
      const records = this.getLabRecords();
      const idx = records.findIndex(r => r.id === validated.id);
      if (idx >= 0) {
        records[idx] = validated;
      } else {
        records.push(validated);
      }
      localStorage.setItem(this.LAB_STORAGE_KEY, JSON.stringify(records));
    } catch (e) {
      console.error("Failed to save lab record to storage:", e);
      throw e;
    }
  }

  /**
   * 3. 删除特定的自测批次
   */
  public static deleteLabRecord(id: string): void {
    try {
      const records = this.getLabRecords();
      const updated = records.filter(r => r.id !== id);
      localStorage.setItem(this.LAB_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to delete lab record:", e);
    }
  }

  /**
   * 4. 获取所有独立开源大盘数据并进行审计校验剔除
   */
  public static getOpenMarketRecords(): MaterialRecord[] {
    try {
      const data = localStorage.getItem(this.OPEN_STORAGE_KEY);
      let records: MaterialRecord[];
      if (!data) {
        // 融汇静态 json 数据以及大盘 catalog，构建完整的大盘库
        const staticRecords = staticOpenData as MaterialRecord[];
        const catalogRecords = PRODUCT_CATALOG.map(p => this.productToRecord(p, 'open_market'));
        
        // 滤重，确保相同的 grade 不会出现冲突
        const merged = [...staticRecords];
        for (const catRec of catalogRecords) {
          if (!merged.some(r => r.grade.toLowerCase() === catRec.grade.toLowerCase())) {
            merged.push(catRec);
          }
        }
        records = merged;
      } else {
        records = JSON.parse(data);
      }
      const cleaned = PolymerDataValidator.cleanBatch(records);
      localStorage.setItem(this.OPEN_STORAGE_KEY, JSON.stringify(cleaned));
      return cleaned;
    } catch (e) {
      console.error("Failed to read open market records:", e);
      return PolymerDataValidator.cleanBatch(staticOpenData as MaterialRecord[]);
    }
  }

  /**
   * 5. 安全保存标准大盘新规格（同样进行最高专业度检验拦截）
   */
  public static saveOpenMarketRecord(record: MaterialRecord): void {
    const validated = PolymerDataValidator.validateAndClean(record);
    if (!validated) {
      console.error("[Polymer Validator Rejected] Open Market Save aborted. Minimum property-count validation failed.");
      throw new Error("数据合规错误：该牌号有效物性指标过少，或不符合ISO/ASTM规范区间。已触发自动防护熔断。");
    }
    try {
      const records = this.getOpenMarketRecords();
      const idx = records.findIndex(r => r.id === validated.id);
      if (idx >= 0) {
        records[idx] = validated;
      } else {
        records.push(validated);
      }
      localStorage.setItem(this.OPEN_STORAGE_KEY, JSON.stringify(records));
    } catch (e) {
      console.error("Failed to save open market record:", e);
      throw e;
    }
  }

  /**
   * 6. 精准搜索开源大盘基准，用于雷达图偏离拟合度诊断
   */
  public static findOpenMarketGrade(category: string, grade: string): MaterialRecord | null {
    const list = this.getOpenMarketRecords();
    const normalizedCat = category.toLowerCase().trim();
    const normalizedGrade = grade.toLowerCase().trim();

    // 优先全字匹配
    let match = list.find(r => 
      r.grade.toLowerCase() === normalizedGrade && 
      r.category.toLowerCase() === normalizedCat
    );
    if (match) return match;

    // 其次牌号匹配
    match = list.find(r => r.grade.toLowerCase() === normalizedGrade);
    if (match) return match;

    // 最后子串模糊包含
    match = list.find(r => 
      r.grade.toLowerCase().includes(normalizedGrade) || 
      normalizedGrade.includes(r.grade.toLowerCase())
    );
    return match || null;
  }

  /**
   * 📊 【数据驱动核心双流转换器 A】：将 `MaterialRecord` 直接转化为系统的 `Product` 契约，
   * 使得完全不改动表格、筛选与雷达图，即可完美消费
   */
  public static recordToProduct(record: MaterialRecord): Product {
    const now = new Date(record.timestamp || Date.now()).toISOString().split('T')[0];
    
    // 初始化属性字典
    const properties: Record<string, PropertyValue> = {};

    const spec = record.properties;
    
    if (spec.density) {
      properties['密度'] = {
        value: spec.density.value,
        unit: spec.density.unit,
        standard: spec.density.standard
      };
    }
    if (spec.mfr) {
      properties['熔体质量流动速率'] = {
        value: spec.mfr.value,
        unit: spec.mfr.unit,
        standard: spec.mfr.standard,
        temperature: spec.mfr.temp
      };
    }
    if (spec.tensileYield) {
      properties['拉伸屈服应力'] = {
        value: spec.tensileYield.value,
        unit: spec.tensileYield.unit,
        standard: spec.tensileYield.standard
      };
    }
    if (spec.flexuralModulus) {
      properties['弯曲模量'] = {
        value: spec.flexuralModulus.value,
        unit: spec.flexuralModulus.unit,
        standard: spec.flexuralModulus.standard
      };
    }
    if (spec.izodImpact) {
      properties['悬臂梁缺口冲击强度'] = {
        value: spec.izodImpact.value,
        unit: spec.izodImpact.unit,
        standard: spec.izodImpact.standard
      };
    }

    return {
      id: record.id,
      gradeName: record.grade,
      manufacturer: record.manufacturer,
      manufacturerId: record.source === 'my_lab' ? 'm-exp-lab' : 'm-open-market',
      categoryIds: record.category ? [getCategoryIdByText(record.category)] : ['root_plastic'],
      properties,
      createdAt: now,
      updatedAt: now,
      isExperimental: record.source === 'my_lab'
    };
  }

  /**
   * 📊 【数据驱动核心双流转换器 B】：将系统内部 `Product` 反向映射回标准 `MaterialRecord`
   */
  public static productToRecord(product: Product, defaultSource: 'open_market' | 'my_lab' = 'open_market'): MaterialRecord {
    const props = product.properties || {};
    
    const densityVal = props['密度'] || props['Density'];
    const mfrVal = props['熔体质量流动速率'] || props['MFR'];
    const tensileVal = props['拉伸屈服应力'] || props['Tensile'];
    const modulusVal = props['弯曲模量'] || props['Modulus'];
    const impactVal = props['悬臂梁缺口冲击强度'] || props['简支梁缺口冲击强度'] || props['Izod Impact'];

    const specs: MaterialPhysicsSpecs = {};

    if (densityVal && densityVal.value !== undefined) {
      specs.density = {
        value: Number(densityVal.value),
        unit: densityVal.unit || 'g/cm³',
        standard: densityVal.standard || 'ISO 1183'
      };
    }
    if (mfrVal && mfrVal.value !== undefined) {
      specs.mfr = {
        value: Number(mfrVal.value),
        unit: mfrVal.unit || 'g/10min',
        standard: mfrVal.standard || 'ISO 1133',
        temp: mfrVal.temperature || '190℃'
      };
    }
    if (tensileVal && tensileVal.value !== undefined) {
      specs.tensileYield = {
        value: Number(tensileVal.value),
        unit: tensileVal.unit || 'MPa',
        standard: tensileVal.standard || 'ISO 527'
      };
    }
    if (modulusVal && modulusVal.value !== undefined) {
      specs.flexuralModulus = {
        value: Number(modulusVal.value),
        unit: modulusVal.unit || 'MPa',
        standard: modulusVal.standard || 'ISO 178'
      };
    }
    if (impactVal && impactVal.value !== undefined) {
      specs.izodImpact = {
        value: Number(impactVal.value),
        unit: impactVal.unit || 'kJ/m²',
        standard: impactVal.standard || 'ISO 180'
      };
    }

    return {
      id: product.id,
      source: product.isExperimental ? 'my_lab' : defaultSource,
      batchNo: product.isExperimental ? 'BATCH-' + product.id.split('-').pop() : undefined,
      category: getCategoryNameById(product.categoryIds?.[0] || 'root_plastic'),
      grade: product.gradeName,
      manufacturer: product.manufacturer,
      properties: specs,
      timestamp: product.createdAt ? new Date(product.createdAt).getTime() : Date.now()
    };
  }
}

// 内部快速辅助函数
function getCategoryIdByText(cat: string): string {
  const lower = cat.toLowerCase();
  if (lower.includes('hdpe')) return 'sub_hdpe_inj';
  if (lower.includes('ldpe')) return 'sub_ldpe_film';
  if (lower.includes('pe') || lower.includes('乙烯')) return 'cat_pe';
  if (lower.includes('pp') || lower.includes('丙烯')) return 'cat_pp';
  if (lower.includes('abs')) return 'cat_abs';
  return 'root_plastic';
}

function getCategoryNameById(id: string): string {
  if (id.includes('hdpe')) return 'HDPE';
  if (id.includes('ldpe')) return 'LDPE';
  if (id.includes('pe')) return 'PE';
  if (id.includes('pp')) return 'PP';
  if (id.includes('abs')) return 'ABS';
  return 'Resin';
}
