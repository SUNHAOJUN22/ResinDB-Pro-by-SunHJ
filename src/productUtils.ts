import { Product, ColumnConfig } from '@/types';
import { DEFAULT_VISIBLE_COLUMNS } from '@/constants';

export const getDynamicColumns = (products: Product[]): ColumnConfig[] => {
  const propertyKeys = new Set<string>();
  products.forEach(p => { Object.keys(p.properties).forEach(k => propertyKeys.add(k)); });
  const dynamicCols: ColumnConfig[] = Array.from(propertyKeys).map(key => ({
    key, label: key, visible: DEFAULT_VISIBLE_COLUMNS.includes(key), isSystem: false
  })).sort((a, b) => {
      const aIsLikelyImportant = DEFAULT_VISIBLE_COLUMNS.includes(a.key);
      const bIsLikelyImportant = DEFAULT_VISIBLE_COLUMNS.includes(b.key);
      if (aIsLikelyImportant && !bIsLikelyImportant) return -1;
      if (!aIsLikelyImportant && bIsLikelyImportant) return 1;
      return a.label.localeCompare(b.label);
  });
  return [
    { key: 'gradeName', label: 'gradeName', visible: true, isSystem: true },
    { key: 'manufacturer', label: 'manufacturer', visible: true, isSystem: true },
    ...dynamicCols
  ];
};

/**
 * Calculates a multi-dimensional "Material Data Quality Score" (0-100).
 * This replaces the simple completeness check with a more scientific evaluation.
 */
export const calculateCompleteness = (product: Product): number => {
    if (!product) return 0;
    
    let score = 0;
    const props = product.properties || {};
    const propKeys = Object.keys(props);

    // 1. Core Identification (Max 25 pts)
    if (product.gradeName && product.gradeName.length > 2) score += 10;
    if (product.manufacturer && product.manufacturer !== 'Unknown') score += 10;
    if (props['典型应用']?.value || props['Typical Application']?.value) score += 5;

    // 2. Fundamental Properties (Max 45 pts)
    const cids = product.categoryIds || [];
    const isRubber = cids.some(id => id.includes('rubber') || id.includes('epdm'));
    const isTPE = cids.some(id => id.includes('tpe') || id.includes('tpu'));
    
    if (props['密度']?.value || props['Density']?.value) score += 10;

    if (isRubber || isTPE) {
        // High priority for elastomers
        if (props['门尼粘度']?.value || props['Mooney Viscosity']?.value) score += 15;
        else if (isTPE && (props['邵氏硬度']?.value || props['Hardness']?.value)) score += 15;
        
        if (props['邵氏硬度']?.value || props['Hardness']?.value) score += 10;
        if (props['拉伸强度']?.value || props['Tensile Strength']?.value) score += 10;
        if (props['断裂伸长率']?.value || props['Elongation']?.value) score += 10;
    } else {
        // High priority for standard plastics
        if (props['熔体质量流动速率']?.value || props['MFR']?.value || props['MFI']?.value) score += 15;
        if (props['拉伸屈服应力']?.value || props['Tensile Stress']?.value || props['拉伸强度']?.value) score += 10;
        if (props['弯曲模量']?.value || props['Flexural Modulus']?.value) score += 10;
        if (props['缺口冲击强度']?.value || props['Impact Strength']?.value) score += 10;
    }

    // 3. Technical Depth (Max 20 pts)
    let standardCount = 0;
    propKeys.forEach(k => {
        if (props[k]?.standard && props[k].standard.length > 2) standardCount++;
    });
    score += Math.min(10, standardCount * 2);
    if (props['热变形温度']?.value || props['维卡软化温度']?.value || props['HDT']?.value) score += 5;
    if (props['阻燃等级']?.value || props['Flammability']?.value) score += 5;

    // 4. Data Richness (Max 10 pts)
    if (propKeys.length > 5) score += 3;
    if (propKeys.length > 10) score += 4;
    if (propKeys.length > 20) score += 3;

    return Math.min(100, Math.round(score));
};

// Global Interning Caches for extreme text indexing performance
const __lcCache = new Map<string, string>();
export function getLower(str: string | undefined | null): string {
  if (str === undefined || str === null) return '';
  let lc = __lcCache.get(str);
  if (lc === undefined) {
    if (__lcCache.size > 2000) __lcCache.clear(); // Basic eviction
    lc = String(str).toLowerCase();
    __lcCache.set(str, lc);
  }
  return lc;
}

/**
 * Determines if a lower value is considered "better" for a given property key.
 */
export const isLowBest = (key: string): boolean => {
    const k = getLower(key);
    // Properties where lower is generally better
    return (
        k.includes('density') || k.includes('密度') || 
        k.includes('mfr') || k.includes('flow') || k.includes('流动') ||
        k.includes('shrinkage') || k.includes('收缩') ||
        k.includes('haze') || k.includes('雾度') ||
        k.includes('absorption') || k.includes('吸水') ||
        k.includes('yellow') || k.includes('黄色') ||
        k.includes('ash') || k.includes('灰分') ||
        k.includes('volatile') || k.includes('挥发') ||
        k.includes('coefficient') || k.includes('系数') ||
        k.includes('loss') || k.includes('损耗') ||
        k.includes('warpage') || k.includes('翘曲') ||
        k.includes('compression set') || k.includes('压缩永久变形')
    );
};

/**
 * Standard radar chart keys for material comparison.
 * Redefined to 6 high-impact dimensions for scientific benchmarking.
 */
export const RADAR_KEYS = [
    '流动性',   // Flowability (MFR/Mooney)
    '硬度刚性', // Hardness/Rigidity (Flex Modulus/Hardness)
    '耐热性',   // Heat Resistance (HDT/Vicat)
    '拉伸性能', // Tensile (Strength/Yield)
    '冲击强度', // Impact (Izod/Charpy)
    '综合数据'  // Data Quality (Completeness score)
];

/**
 * Maps a product to 6 standard Performance Fingerprint dimensions.
 * Scientific normalization logic based on material category.
 */
export const getPerformanceFingerprint = (product: Product): number[] => {
    const props = product.properties || {};
    const cids = product.categoryIds || [];
    const isRubber = cids.some(id => id.includes('rubber') || id.includes('epdm'));
    const isTPE = cids.some(id => id.includes('tpe') || id.includes('tpu'));

    const getVal = (keys: string[]) => {
        for (const k of keys) {
            const v = props[k]?.value;
            if (v !== undefined && v !== null && !isNaN(Number(v))) return Number(v);
        }
        return 0;
    };

    // 1. Flowability (MFR for plastics, Mooney for rubber)
    const flow = isRubber 
        ? getVal(['门尼粘度', 'Mooney Viscosity', 'ML 1+4', '门尼', 'Mooney', 'ML1+4'])
        : getVal(['熔体质量流动速率', 'MFR', 'MFI', 'Melt Flow Index', 'Melt Flow Rate', '流动速率', '流动性', '熔指']);

    // 2. Hardness/Rigidity
    const rigidity = isRubber || isTPE
        ? getVal(['邵氏硬度', 'Hardness', 'Shore A', 'Shore D', '硬度', 'Hardness (Shore A)', '邵氏A'])
        : getVal(['弯曲模量', 'Flexural Modulus', '弯曲弹性模量', '刚性模量', 'Flex Modulus', '弯曲模量(23°C)']);

    // 3. Heat Resistance
    const heat = getVal(['热变形温度', 'HDT', '维卡软化温度', 'Vicat', '熔点', 'Melting Point', '脆化温度', 'Heat Deflection Temperature', 'HDT (0.45 MPa)']);

    // 4. Tensile Performance
    const tensile = getVal(['拉伸屈服应力', 'Tensile Stress', '拉伸强度', 'Tensile Strength', '断裂拉伸应力', '屈服强度', 'Tensile Yield Stress', '拉伸断裂强度']);

    // 5. Impact Strength
    const impact = getVal(['悬臂梁缺口冲击强度', 'Izod Impact', '简支梁缺口冲击强度', 'Charpy Impact', '冲击强度', '落锤冲击', 'Notched Izod', 'Izod', '无缺口冲击强度']);

    // 6. Overall Data Quality
    const quality = calculateCompleteness(product);

    return [flow, rigidity, heat, tensile, impact, quality];
};

/**
 * Default maximum values for radar chart axes.
 * Log-friendly suggested bounds.
 */
export const RADAR_DEFAULT_MAX: Record<string, number> = {
    '流动性': 100,
    '硬度刚性': 5000,
    '耐热性': 300,
    '拉伸性能': 150,
    '冲击强度': 120,
    '综合数据': 100
};
