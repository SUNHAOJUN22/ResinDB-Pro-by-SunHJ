import { MaterialRecord, MaterialPhysicsSpecs } from './types';
import { isPlaceholderValue } from '@/utils/productUtils';

/**
 * 🔬 PolymerDataValidator (国际塑料及高分子聚合物物性数据硬核校验与生成专家)
 * 
 * 遵循国际专业数据库（如 Campus Plastics, MatWeb, UL Prospector）标准对进入系统的物数据实施铁律级审计。
 * 1. 物理/力学参数与国际标准 (ISO/ASTM) 强约束校验（密度、熔指、拉伸强度、弯曲模量、冲击强度）。
 * 2. 强类型多维空值丢弃机制：剔除 "unknown", "n/a", "-", "0", "null" 等无效槽位。
 * 3. 熔断线判定 (Hard Melt-down Line)：如果有效指标少于 2 项，自动熔断、忽略或删除该条虚假/残缺记录。
 */
export class PolymerDataValidator {

  /**
   * 执行铁律级专家审计与数据重构
   * @param record 待审计的 `MaterialRecord`
   * @returns 深度清洗并校验完备的 `MaterialRecord`，若未能通过熔断条件则返回 `null`
   */
  public static validateAndClean(record: MaterialRecord): MaterialRecord | null {
    if (!record) return null;

    // 深度克隆，防止修改原始引用
    let cleanedRecord: MaterialRecord;
    try {
      cleanedRecord = JSON.parse(JSON.stringify(record));
    } catch (error) {
      console.warn(`[Polymer Validator Catch] Failed to clone record. Ignored.`, error);
      return null;
    }

    // 默认或补齐基本字段
    if (!cleanedRecord.properties) {
      cleanedRecord.properties = {};
    }

    const props = cleanedRecord.properties;
    const initialKeys = Object.keys(props) as (keyof MaterialPhysicsSpecs)[];

    for (const key of initialKeys) {
      const prop = props[key];
      if (!prop) {
        delete props[key];
        continue;
      }

      if (isPlaceholderValue(prop.value)) {
        delete props[key];
        continue;
      }

      // 转换 value 为数字
      const numVal = Number(prop.value);
      prop.value = numVal;

      // 2. 国际标准与指标边界铁律强校验
      switch (key) {
        case 'density': {
          // 必须符合 ISO 1183 或 ASTM D792，单位为 g/cm³
          prop.unit = 'g/cm³';
          if (!prop.standard) {
            prop.standard = 'ISO 1183';
          }
          
          // 绝对不能大于 3 或小于 0.8
          if (numVal < 0.8 || numVal > 3.0) {
            console.warn(`[Polymer Validator Alert] Grade ${cleanedRecord.grade} density is ${numVal} g/cm³, which exceeds international physical limits (0.8 - 3.0). Removed.`);
            delete props.density;
          } else {
            // 对常见大类的无玻纤增强常规牌号提供校验与告警修正
            const categoryUpper = cleanedRecord.category?.toUpperCase() || '';
            const gradeUpper = cleanedRecord.grade?.toUpperCase() || '';
            const descUpper = (cleanedRecord.description || '').toUpperCase();
            
            // 判定是否属于玻纤增强 (GF / Glass Fiber / 增强 / 玻纤)
            const isFiberReinforced = 
              gradeUpper.includes('GF') || 
              gradeUpper.includes('FIBER') || 
              gradeUpper.includes('玻纤') || 
              gradeUpper.includes('增强') ||
              descUpper.includes('GF') || 
              descUpper.includes('GLASS') ||
              descUpper.includes('玻纤') || 
              descUpper.includes('增强');

            if (!isFiberReinforced) {
              if (categoryUpper.includes('PE') || categoryUpper.includes('HDPE') || categoryUpper.includes('LDPE')) {
                // PE 应该在 0.91 – 0.97
                if (numVal < 0.89 || numVal > 0.98) {
                  console.info(`[Polymer Validator Info] Regular PE unmodified grade ${cleanedRecord.grade} density drift at ${numVal} g/cm³. Retained, device verification recommended.`);
                }
              } else if (categoryUpper.includes('PP')) {
                // PP 应该在 0.89 – 0.92
                if (numVal < 0.88 || numVal > 0.93) {
                  console.info(`[Polymer Validator Info] Regular PP grade ${cleanedRecord.grade} density drift at ${numVal} g/cm³.`);
                }
              } else if (categoryUpper.includes('ABS')) {
                // ABS 应该在 1.03 – 1.06
                if (numVal < 1.01 || numVal > 1.10) {
                  console.info(`[Polymer Validator Info] ABS grade ${cleanedRecord.grade} density at ${numVal} g/cm³.`);
                }
              }
            }
          }
          break;
        }

        case 'mfr': {
          // 必须符合 ISO 1133 或 ASTM D1238，单位为 g/10min
          prop.unit = 'g/10min';
          if (!prop.standard) {
            prop.standard = 'ISO 1133';
          }
          
          // 必须级联声明【测试温度】与【测试负荷】
          const mfrSpec = prop as { value: number; unit: string; standard?: string; temp?: string; load?: string };
          const categoryUpper = cleanedRecord.category?.toUpperCase() || '';
          
          if (!mfrSpec.temp || mfrSpec.temp === '') {
            // 根据高聚物大类自动进行级联标称推荐补齐，保证无测试条件的数据完备性
            if (categoryUpper.includes('HDPE') || categoryUpper.includes('PE') || categoryUpper.includes('LDPE')) {
              mfrSpec.temp = '190℃';
            } else if (categoryUpper.includes('PP')) {
              mfrSpec.temp = '230℃';
            } else if (categoryUpper.includes('ABS')) {
              mfrSpec.temp = '220℃';
            } else {
              mfrSpec.temp = '190℃'; // 默认底线
            }
          }
          
          if (!mfrSpec.load || mfrSpec.load === '') {
            if (categoryUpper.includes('ABS')) {
              mfrSpec.load = '10.0kg';
            } else {
              mfrSpec.load = '2.16kg'; // 常见熔指负荷
            }
          }
          break;
        }

        case 'tensileYield': {
          // 必须符合 ISO 527 或 ASTM D638，单位为 MPa
          prop.unit = 'MPa';
          if (!prop.standard) {
            prop.standard = 'ISO 527';
          }
          if (numVal < 0 || numVal > 500) {
            console.warn(`[Polymer Validator Alert] Tensile yield strength value ${numVal} MPa out of typical polymer limits, removed.`);
            delete props.tensileYield;
          }
          break;
        }

        case 'flexuralModulus': {
          // 必须符合 ISO 178 或 ASTM D790，单位为 MPa
          prop.unit = 'MPa';
          if (!prop.standard) {
            prop.standard = 'ISO 178';
          }
          if (numVal < 0 || numVal > 50000) {
            console.warn(`[Polymer Validator Alert] Flexural modulus ${numVal} MPa out of typical physical range for organic plastics, removed.`);
            delete props.flexuralModulus;
          }
          break;
        }

        case 'izodImpact': {
          // 必须符合 ISO 179/180，单位统一为 kJ/m² 或 J/m
          prop.unit = 'kJ/m²';
          if (!prop.standard) {
            prop.standard = 'ISO 180';
          }
          if (numVal < 0 || numVal > 150) {
            console.warn(`[Polymer Validator Alert] Izod impact strength ${numVal} kJ/m² is out of typical range, removed.`);
            delete props.izodImpact;
          }
          break;
        }
      }
    }

    // 3. 【硬性熔断线】：校验通过的有效核心物理力学指标必须少于 2 项时，直接抛弃
    const keysNow = Object.keys(props);
    const validCount = keysNow.filter(k => ['density', 'mfr', 'tensileYield', 'flexuralModulus', 'izodImpact'].includes(k)).length;

    if (validCount < 2) {
      console.error(`🔴 [Polymer Validator BLOCKED] Grade ${cleanedRecord.grade} has fewer than 2 valid core properties (current: ${validCount}). Meltdown line triggered; this incomplete record was automatically rejected.`);
      return null;
    }

    return cleanedRecord;
  }

  /**
   * 批量清洗过滤
   * @param records 
   */
  public static cleanBatch(records: MaterialRecord[]): MaterialRecord[] {
    if (!records) return [];
    return records
      .map(r => this.validateAndClean(r))
      .filter((r): r is MaterialRecord => r !== null);
  }
}

// v3.1.0-sync
