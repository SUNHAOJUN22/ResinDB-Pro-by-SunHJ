import { MaterialRecord, MaterialPhysicsSpecs } from './types';
import { Product, PropertyValue } from '@/types/index';
import {
  LAB_RECORDS,
  OPEN_MARKET_RECORDS,
  PRODUCT_CATALOG,
  categoryIdFromText,
  categoryNameFromId,
} from '@/data/resinData';
import { PolymerDataValidator } from './PolymerDataValidator';

function normalizedRecordKey(record: Pick<MaterialRecord, 'grade' | 'manufacturer'>): string {
  return `${record.grade.trim().toLowerCase()}::${record.manufacturer.trim().toLowerCase()}`;
}

function toFiniteNumber(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export class UniversalStorageBridge {
  private static readonly LAB_STORAGE_KEY = 'resindb_pro_my_lab_data';
  private static readonly OPEN_STORAGE_KEY = 'resindb_pro_open_market_data';

  public static getLabRecords(): MaterialRecord[] {
    try {
      const data = localStorage.getItem(this.LAB_STORAGE_KEY);
      const records: MaterialRecord[] = data ? JSON.parse(data) : LAB_RECORDS;
      const cleaned = PolymerDataValidator.cleanBatch(records);
      localStorage.setItem(this.LAB_STORAGE_KEY, JSON.stringify(cleaned));
      return cleaned;
    } catch (error) {
      console.error('Failed to read lab records from storage:', error);
      return PolymerDataValidator.cleanBatch(LAB_RECORDS);
    }
  }

  public static saveLabRecord(record: MaterialRecord): void {
    const validated = PolymerDataValidator.validateAndClean(record);
    if (!validated) {
      console.error('[Polymer Validator Rejected] Save operation aborted. Record is lacking minimum core physical properties.');
      throw new Error('validationErrorMinProps');
    }
    try {
      const records = this.getLabRecords();
      const index = records.findIndex((candidate) => candidate.id === validated.id);
      if (index >= 0) records[index] = validated;
      else records.push(validated);
      localStorage.setItem(this.LAB_STORAGE_KEY, JSON.stringify(records));
    } catch (error) {
      console.error('Failed to save lab record to storage:', error);
      throw error;
    }
  }

  public static deleteLabRecord(id: string): void {
    try {
      const records = this.getLabRecords();
      localStorage.setItem(
        this.LAB_STORAGE_KEY,
        JSON.stringify(records.filter((record) => record.id !== id)),
      );
    } catch (error) {
      console.error('Failed to delete lab record:', error);
    }
  }

  public static getOpenMarketRecords(): MaterialRecord[] {
    try {
      const data = localStorage.getItem(this.OPEN_STORAGE_KEY);
      let records: MaterialRecord[];
      if (data) {
        records = JSON.parse(data);
      } else {
        const merged: MaterialRecord[] = [];
        const seen = new Set<string>();
        for (const sourceRecord of OPEN_MARKET_RECORDS) {
          const key = normalizedRecordKey(sourceRecord);
          if (!seen.has(key)) {
            merged.push(sourceRecord);
            seen.add(key);
          }
        }
        for (const catalogRecord of PRODUCT_CATALOG.map((product) =>
          this.productToRecord(product, 'open_market'),
        )) {
          const key = normalizedRecordKey(catalogRecord);
          if (!seen.has(key)) {
            merged.push(catalogRecord);
            seen.add(key);
          }
        }
        records = merged;
      }
      const cleaned = PolymerDataValidator.cleanBatch(records);
      localStorage.setItem(this.OPEN_STORAGE_KEY, JSON.stringify(cleaned));
      return cleaned;
    } catch (error) {
      console.error('Failed to read open market records:', error);
      return PolymerDataValidator.cleanBatch(OPEN_MARKET_RECORDS);
    }
  }

  public static saveOpenMarketRecord(record: MaterialRecord): void {
    const validated = PolymerDataValidator.validateAndClean(record);
    if (!validated) {
      console.error('[Polymer Validator Rejected] Open Market Save aborted. Minimum property-count validation failed.');
      throw new Error('validationErrorMeltdown');
    }
    try {
      const records = this.getOpenMarketRecords();
      const key = normalizedRecordKey(validated);
      const index = records.findIndex((candidate) =>
        candidate.id === validated.id || normalizedRecordKey(candidate) === key,
      );
      if (index >= 0) records[index] = validated;
      else records.push(validated);
      localStorage.setItem(this.OPEN_STORAGE_KEY, JSON.stringify(records));
    } catch (error) {
      console.error('Failed to save open market record to storage:', error);
      throw error;
    }
  }

  public static findOpenMarketGrade(category: string, grade: string): MaterialRecord | null {
    const normalizedGrade = grade.toLowerCase().trim();
    if (!normalizedGrade) return null;

    const list = this.getOpenMarketRecords();
    const normalizedCategory = category.toLowerCase().trim();
    if (normalizedCategory) {
      const exactCategoryMatch = list.find(
        (record) =>
          record.grade.toLowerCase() === normalizedGrade &&
          record.category.toLowerCase() === normalizedCategory,
      );
      if (exactCategoryMatch) return exactCategoryMatch;
    }

    const exactGradeMatch = list.find((record) => record.grade.toLowerCase() === normalizedGrade);
    if (exactGradeMatch) return exactGradeMatch;

    return list.find((record) => {
      const candidate = record.grade.toLowerCase();
      return candidate.includes(normalizedGrade) || normalizedGrade.includes(candidate);
    }) ?? null;
  }

  public static recordToProduct(record: MaterialRecord): Product {
    const timestamp = Number.isFinite(record.timestamp) ? record.timestamp : Date.now();
    const date = new Date(timestamp).toISOString().split('T')[0];
    const properties: Record<string, PropertyValue> = {};
    const specs = record.properties;

    if (specs.density) {
      properties['密度'] = {
        value: specs.density.value,
        unit: specs.density.unit,
        standard: specs.density.standard,
      };
    }
    if (specs.mfr) {
      properties['熔体质量流动速率'] = {
        value: specs.mfr.value,
        unit: specs.mfr.unit,
        standard: specs.mfr.standard,
        temperature: specs.mfr.temp,
        load: specs.mfr.load,
      };
    }
    if (specs.tensileYield) {
      properties['拉伸屈服应力'] = {
        value: specs.tensileYield.value,
        unit: specs.tensileYield.unit,
        standard: specs.tensileYield.standard,
      };
    }
    if (specs.flexuralModulus) {
      properties['弯曲模量'] = {
        value: specs.flexuralModulus.value,
        unit: specs.flexuralModulus.unit,
        standard: specs.flexuralModulus.standard,
      };
    }
    if (specs.izodImpact) {
      properties['悬臂梁缺口冲击强度'] = {
        value: specs.izodImpact.value,
        unit: specs.izodImpact.unit,
        standard: specs.izodImpact.standard,
      };
    }

    return {
      id: record.id,
      gradeName: record.grade,
      manufacturer: record.manufacturer,
      manufacturerId: record.source === 'my_lab' ? 'm-exp-lab' : 'm-open-market',
      categoryIds: [categoryIdFromText(record.category)],
      properties,
      createdAt: date,
      updatedAt: date,
      isExperimental: record.source === 'my_lab',
    };
  }

  public static productToRecord(
    product: Product,
    defaultSource: 'open_market' | 'my_lab' = 'open_market',
  ): MaterialRecord {
    const props = product.properties ?? {};
    const density = props['密度'] || props.Density;
    const mfr = props['熔体质量流动速率'] || props.MFR;
    const tensile = props['拉伸屈服应力'] || props.Tensile;
    const modulus = props['弯曲模量'] || props.Modulus;
    const impact =
      props['悬臂梁缺口冲击强度'] ||
      props['简支梁缺口冲击强度'] ||
      props['Izod Impact'];

    const category = categoryNameFromId(product.categoryIds?.[0] || 'root_plastic');
    const defaultMfrTemperature = category.startsWith('PP') ? '230℃' : '190℃';
    const specs: MaterialPhysicsSpecs = {};

    const densityValue = toFiniteNumber(density?.value);
    if (densityValue !== null) {
      specs.density = {
        value: densityValue,
        unit: density?.unit || 'g/cm³',
        standard: density?.standard || 'ISO 1183',
      };
    }

    const mfrValue = toFiniteNumber(mfr?.value);
    if (mfrValue !== null) {
      specs.mfr = {
        value: mfrValue,
        unit: mfr?.unit || 'g/10min',
        standard: mfr?.standard || 'ISO 1133',
        temp: String(mfr?.temperature ?? mfr?.temp ?? defaultMfrTemperature),
        load: mfr?.load || '2.16kg',
      };
    }

    const tensileValue = toFiniteNumber(tensile?.value);
    if (tensileValue !== null) {
      specs.tensileYield = {
        value: tensileValue,
        unit: tensile?.unit || 'MPa',
        standard: tensile?.standard || 'ISO 527',
      };
    }

    const modulusValue = toFiniteNumber(modulus?.value);
    if (modulusValue !== null) {
      specs.flexuralModulus = {
        value: modulusValue,
        unit: modulus?.unit || 'MPa',
        standard: modulus?.standard || 'ISO 178',
      };
    }

    const impactValue = toFiniteNumber(impact?.value);
    if (impactValue !== null) {
      specs.izodImpact = {
        value: impactValue,
        unit: impact?.unit || 'kJ/m²',
        standard: impact?.standard || 'ISO 180',
      };
    }

    const createdTimestamp = product.createdAt ? Date.parse(product.createdAt) : Number.NaN;
    return {
      id: product.id,
      source: product.isExperimental ? 'my_lab' : defaultSource,
      batchNo: product.isExperimental ? `BATCH-${product.id.split('-').pop()}` : undefined,
      category,
      grade: product.gradeName,
      manufacturer: product.manufacturer,
      properties: specs,
      timestamp: Number.isFinite(createdTimestamp) ? createdTimestamp : Date.now(),
    };
  }
}
