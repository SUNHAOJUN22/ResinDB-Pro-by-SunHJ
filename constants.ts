
import { Category, Product, Manufacturer, Reference, PropertyValue } from './types';

export const PROPERTY_GROUPS: Record<string, string[]> = {
  'General': ['密度', '熔体质量流动速率', '成型收缩率', '吸水率', '典型应用', '生产厂家', '牌号', '聚合工艺', '催化剂类型', 'Density', 'MFR', 'Shrinkage', 'Polymerization Process', 'Catalyst Type'],
  'Mechanical': [
    '拉伸屈服应力', '拉伸断裂应力', '拉伸模量', '断裂伸长率', 
    '弯曲模量', '弯曲强度', 
    '悬臂梁缺口冲击强度', '简支梁缺口冲击强度', '落镖冲击强度',
    '100%定伸应力', '拉伸强度', '压缩永久变形',
    '洛氏硬度', '邵氏硬度', '球压硬度', '摩擦系数', '耐磨性'
  ],
  'Thermal': [
    '热变形温度', '维卡软化温度', '熔点', '玻璃化转变温度', 
    '线膨胀系数', '导热系数', '脆化温度', '氧化诱导时间(OIT)',
    '最高连续使用温度', '热稳定性'
  ],
  'Electrical': [
    '体积电阻率', '表面电阻率', '介电强度', '介电常数', '介质损耗角正切', '耐电弧性', '漏电起痕指数(CTI)'
  ],
  'Optical': ['透光率', '雾度', '光泽度', '黄色指数', '折射率'],
  'Flammability': ['阻燃等级', '灼热丝发火温度(GWIT)', '极限氧指数(LOI)', '发烟量'],
  'Chemical/Environmental': [
    '乙烯含量', '丁二烯含量', '丙烯腈含量', '结合苯乙烯', '门尼粘度', 
    '灰分', '挥发分', '水分含量', '残余单体',
    '碳足迹', '再生料比例', '生物基含量'
  ],
  'Processing': ['建议烘料温度', '建议烘料时间', '注塑压力', '熔体温度', '模具温度', '保压压力', '冷却时间']
};

export const MANUFACTURERS: Manufacturer[] = [
  { id: 'm-33', name: 'Sinopec Yanshan (燕山石化)', website: 'www.sinopec.com', country: 'China', description: '中国最大的合成橡胶及树脂生产基地之一。' },
  { id: 'm-32', name: 'Sinopec Yangzi (扬子石化)', website: 'www.sinopec.com', country: 'China', description: '国内领先的特种聚烯烃研发中心。' },
  { id: 'm-30', name: 'Sinopec Shanghai (上海石化)', website: 'spc.com.cn', country: 'China', description: '综合性石油化工企业，主要生产乙烯及其衍生物。' },
  { id: 'm-cnpc-1', name: 'PetroChina Daqing (大庆石化)', website: 'petrochina.com.cn', country: 'China', description: '中国石油旗下的重要化工基地。' },
  { id: 'm-cnpc-3', name: 'PetroChina Dushanzi (独山子石化)', website: 'petrochina.com.cn', country: 'China' },
  { id: 'm-basell', name: 'LyondellBasell', website: 'lyondellbasell.com', country: 'Netherlands' },
  { id: 'm-sabic', name: 'SABIC', website: 'sabic.com', country: 'Saudi Arabia' },
  { id: 'm-exxon', name: 'ExxonMobil Chemical', website: 'exxonmobilchemical.com', country: 'USA' },
  { id: 'm-dow', name: 'Dow', website: 'dow.com', country: 'USA' },
  { id: 'm-basf', name: 'BASF', website: 'basf.com', country: 'Germany' },
  { id: 'm-covestro', name: 'Covestro', website: 'covestro.com', country: 'Germany' },
  { id: 'm-lg', name: 'LG Chem', website: 'lgchem.com', country: 'South Korea' },
  { id: 'm-chimei', name: 'Chi Mei (奇美)', website: 'chimeicorp.com', country: 'Taiwan, China' },
  { id: 'm-arlanxeo', name: 'Arlanxeo', website: 'arlanxeo.com', country: 'Netherlands' },
  { id: 'm-invista', name: 'INVISTA', website: 'invista.com', country: 'USA' },
  { id: 'm-solvay', name: 'Solvay', website: 'solvay.com', country: 'Belgium' },
  { id: 'm-arkema', name: 'Arkema', website: 'arkema.com', country: 'France' },
  { id: 'm-evonik', name: 'Evonik', website: 'evonik.com', country: 'Germany' },
  { id: 'm-toray', name: 'Toray', website: 'toray.com', country: 'Japan' },
  { id: 'm-mitsui', name: 'Mitsui Chemicals', website: 'mitsuichemicals.com', country: 'Japan' },
  { id: 'm-asahi', name: 'Asahi Kasei', website: 'asahi-kasei.com', country: 'Japan' },
  { id: 'm-lanxess', name: 'LANXESS', website: 'lanxess.com', country: 'Germany' },
  { id: 'm-celanese', name: 'Celanese', website: 'celanese.com', country: 'USA' },
  { id: 'm-borealis', name: 'Borealis', website: 'borealisgroup.com', country: 'Austria' },
  { id: 'm-borealis-borouge', name: 'Borouge', website: 'borouge.com', country: 'UAE' },
  { id: 'm-kumho', name: 'Kumho Polychem (锦湖)', website: 'kkpc.com', country: 'South Korea' },
  { id: 'm-wanhua', name: 'Wanhua Chemical (万华化学)', website: 'whchem.com', country: 'China' }
];

export const REFERENCES: Reference[] = [
  { id: 'ref-iso-1133', name: 'ISO 1133: Determination of the melt mass-flow rate (MFR)', author: 'ISO', year: '2011' },
  { id: 'ref-iso-1183', name: 'ISO 1183: Methods for determining the density of non-cellular plastics', author: 'ISO', year: '2019' },
  { id: 'ref-iso-527', name: 'ISO 527: Determination of tensile properties', author: 'ISO', year: '2012' },
  { id: 'ref-iso-178', name: 'ISO 178: Determination of flexural properties', author: 'ISO', year: '2019' },
  { id: 'ref-iso-179', name: 'ISO 179: Determination of Charpy impact properties', author: 'ISO', year: '2010' },
  { id: 'ref-iso-180', name: 'ISO 180: Determination of Izod impact strength', author: 'ISO', year: '2019' },
  { id: 'ref-iso-75', name: 'ISO 75: Determination of temperature of deflection under load', author: 'ISO', year: '2013' },
  { id: 'ref-iso-306', name: 'ISO 306: Thermoplastic materials — Vicat softening temperature', author: 'ISO', year: '2013' },
  { id: 'ref-astm-d1238', name: 'ASTM D1238: Melt Flow Rates of Thermoplastics', author: 'ASTM', year: '2023' },
  { id: 'ref-astm-d792', name: 'ASTM D792: Specific Gravity and Density of Plastics', author: 'ASTM', year: '2020' }
];

export const CATEGORY_TREE: Category[] = [
  {
    id: 'root_plastic',
    name: '通用塑料 (Commodity Plastics)',
    children: [
      { id: 'cat_pe', name: '聚乙烯 (PE)', children: [
          { id: 'sub_hdpe', name: '高密度聚乙烯 (HDPE)', children: [
            { id: 'sub_hdpe_blow', name: '吹塑级 (Blow Molding)' },
            { id: 'sub_hdpe_inj', name: '注塑级 (Injection)' },
            { id: 'sub_hdpe_pipe', name: '管材级 (Pipe)' },
            { id: 'sub_hdpe_film', name: '薄膜级 (Film)' },
            { id: 'sub_hdpe_wire', name: '电线电缆级 (Wire & Cable)' }
          ]},
          { id: 'sub_ldpe', name: '低密度聚乙烯 (LDPE)', children: [
            { id: 'sub_ldpe_film', name: '薄膜级' },
            { id: 'sub_ldpe_coat', name: '涂覆级 (Coating)' }
          ]},
          { id: 'sub_lldpe', name: '线性低密度聚乙烯 (LLDPE)' },
          { id: 'sub_mpe', name: '茂金属聚乙烯 (mPE)' },
          { id: 'sub_uhmwpe', name: '超高分子量聚乙烯 (UHMWPE)' },
          { id: 'sub_eva', name: '乙烯-乙酸乙烯酯共聚物 (EVA)', children: [
            { id: 'sub_eva_foam', name: '发泡级' },
            { id: 'sub_eva_adhesive', name: '胶粘剂级' }
          ]}
      ]},
      { id: 'cat_pp', name: '聚丙烯 (PP)', children: [
          { id: 'sub_pp_homo', name: '均聚聚丙烯 (Homopolymer PP)' },
          { id: 'sub_pp_copo', name: '抗冲共聚聚丙烯 (Impact Copolymer PP)' },
          { id: 'sub_pp_rand', name: '无规共聚聚丙烯 (Random Copolymer PP)' },
          { id: 'sub_pp_mfr_high', name: '高流动PP (High Flow PP)' },
          { id: 'sub_pp_filler', name: '填充改性PP (Filled PP)' },
          { id: 'sub_pp_reinforced', name: '增强改性PP (Reinforced PP)' }
      ]},
      { id: 'cat_pvc', name: '聚氯乙烯 (PVC)', children: [
          { id: 'sub_pvc_s', name: '悬浮级 (PVC-S)' },
          { id: 'sub_pvc_e', name: '乳液级 (PVC-E)' },
          { id: 'sub_pvc_cpvc', name: '氯化聚氯乙烯 (CPVC)' }
      ]},
      { id: 'cat_ps', name: '聚苯乙烯 (PS)', children: [
          { id: 'sub_gpps', name: '通用级 (GPPS)' },
          { id: 'sub_hips', name: '高抗冲 (HIPS)' },
          { id: 'sub_eps', name: '可发性 (EPS)' }
      ]},
      { id: 'cat_abs', name: 'ABS/SAN', children: [
          { id: 'sub_abs_gen', name: '通用级ABS' },
          { id: 'sub_abs_heat', name: '耐热级ABS' },
          { id: 'sub_abs_fr', name: '阻燃级ABS' },
          { id: 'sub_abs_plate', name: '电镀级ABS' },
          { id: 'sub_san', name: '丙烯腈-苯乙烯 (SAN/AS)' }
      ]}
    ]
  },
  {
    id: 'root_eng',
    name: '工程塑料 (Engineering Plastics)',
    children: [
      { id: 'cat_pa', name: '聚酰胺 (PA/尼龙)', children: [
          { id: 'sub_pa6', name: '尼龙6 (PA6)' },
          { id: 'sub_pa66', name: '尼龙66 (PA66)' },
          { id: 'sub_pa_long', name: '长碳链尼龙 (PA11/PA12/PA610/PA612)' },
          { id: 'sub_pga', name: '半芳香族尼龙 (PPA)' },
          { id: 'sub_pa_transparent', name: '透明尼龙' },
          { id: 'sub_pa_alloy', name: '尼龙合金' }
      ]},
      { id: 'cat_pc', name: '聚碳酸酯 (PC)', children: [
          { id: 'sub_pc_inj', name: '注塑级' },
          { id: 'sub_pc_ext', name: '挤出级' },
          { id: 'sub_pc_alloy', name: 'PC合金', children: [
            { id: 'sub_pc_abs', name: 'PC/ABS' },
            { id: 'sub_pc_pbt', name: 'PC/PBT' },
            { id: 'sub_pc_asa', name: 'PC/ASA' }
          ]}
      ]},
      { id: 'cat_pom', name: '聚甲醛 (POM)', children: [
        { id: 'sub_pom_homo', name: '均聚POM' },
        { id: 'sub_pom_copo', name: '共聚POM' }
      ]},
      { id: 'cat_pbt_pet', name: '聚酯 (PBT/PET)', children: [
        { id: 'sub_pbt_gen', name: 'PBT通用级' },
        { id: 'sub_pbt_reinf', name: 'PBT增强级' },
        { id: 'sub_pet_bottle', name: 'PET瓶级' },
        { id: 'sub_pet_fiber', name: 'PET纤维级' }
      ]},
      { id: 'cat_pmma', name: '聚甲基丙烯酸甲酯 (PMMA)' },
      { id: 'cat_ppe', name: '改性聚苯醚 (MPPO/PPE)' }
    ]
  },
  {
    id: 'root_high_perf',
    name: '特种/高性能聚合物',
    children: [
      { id: 'cat_peek_family', name: '聚芳醚酮类 (PEEK/PEKK)' },
      { id: 'cat_pps', name: '聚苯硫醚 (PPS)' },
      { id: 'cat_lcp', name: '液晶聚合物 (LCP)' },
      { id: 'cat_sulfone', name: '聚砜类 (PSU/PES/PPSU)' },
      { id: 'cat_pi_family', name: '聚酰亚胺类 (PI/PEI/PAI)' },
      { id: 'cat_fluor', name: '氟塑料 (PTFE/PVDF/FEP/ETFE)' }
    ]
  },
  {
    id: 'root_tpe',
    name: '热塑性弹性体 (TPE)',
    children: [
      { id: 'cat_tpu', name: '热塑性聚氨酯 (TPU)' },
      { id: 'cat_tpes', name: '苯乙烯类弹性体 (SBS/SEBS/SIS)' },
      { id: 'cat_tpv_tpo', name: '聚烯烃类弹性体 (TPV/TPO/POE)' },
      { id: 'cat_tpee', name: '热塑性聚酯弹性体 (TPEE)' },
      { id: 'cat_tpa', name: '热塑性尼龙弹性体 (TPA)' }
    ]
  },
  {
    id: 'root_rubber',
    name: '合成橡胶 (Synthetic Rubber)',
    children: [
        { id: 'cat_epdm', name: '乙丙橡胶 (EPDM)' },
        { id: 'cat_sbr', name: '丁苯橡胶 (SBR)' },
        { id: 'cat_br', name: '顺丁橡胶 (BR)' },
        { id: 'cat_nbr', name: '丁腈橡胶 (NBR)' },
        { id: 'cat_iir', name: '丁基橡胶 (IIR)' },
        { id: 'cat_cr', name: '氯丁橡胶 (CR)' },
        { id: 'cat_sir', name: '硅橡胶 (SIR)' },
        { id: 'cat_fkm', name: '氟橡胶 (FKM)' }
    ]
  },
  {
    id: 'root_thermoset',
    name: '热固性塑料 (Thermosets)',
    children: [
      { id: 'cat_epoxy', name: '环氧树脂 (Epoxy)' },
      { id: 'cat_phenolic', name: '酚醛树脂 (PF)' },
      { id: 'cat_pu', name: '聚氨酯 (PU)' }
    ]
  },
  {
    id: 'root_bio',
    name: '可再生/生物基材料',
    children: [
      { id: 'cat_biodegradable', name: '生物降解塑料 (PLA/PBAT/PHA/PCL)' },
      { id: 'cat_bio_polyolefin', name: '生物基聚烯烃 (Bio-PE/Bio-PP)' },
      { id: 'cat_rplast', name: '再生塑料 (PCR/PIR)' }
    ]
  },
  {
    id: 'root_additive',
    name: '助剂/色母/复合料',
    children: [
      { id: 'cat_color', name: '色母/功能母粒' },
      { id: 'cat_compound', name: '合金/复合改性料' },
      { id: 'cat_filler_master', name: '填充母粒' }
    ]
  }
];

const createProduct = (index: number, grade: string, manId: string, manName: string, catIds: string[], props: Record<string, PropertyValue>): Product => ({
    id: `prod-${String(index).padStart(3, '0')}`,
    gradeName: grade,
    manufacturerId: manId,
    manufacturer: manName,
    categoryIds: catIds,
    createdAt: new Date(2024, 3, 17).toISOString().split('T')[0],
    updatedAt: new Date(2024, 3, 17).toISOString().split('T')[0],
    properties: props
});

export const DEFAULT_VISIBLE_COLUMNS = ['聚合工艺', '催化剂类型', '密度', '熔体质量流动速率', '拉伸屈服应力', '弯曲模量', '断裂伸长率', '典型应用'];

const enrichProperties = (products: Product[]): Product[] => {
  return products.map(p => {
    const catIds = p.categoryIds.join(',');
    const isRubber = catIds.includes('root_rubber');
    const isTPE = catIds.includes('root_tpe');
    const isPE = catIds.includes('cat_pe');
    const isPP = catIds.includes('cat_pp');
    const isPA = catIds.includes('cat_pa');
    const isPC = catIds.includes('cat_pc');
    const isABS = catIds.includes('cat_abs');
    const isHighPerf = catIds.includes('root_high_perf');
    
    // Transparent logic
    const isTransparent = p.gradeName.toLowerCase().includes('pc') || 
                          p.gradeName.toLowerCase().includes('pmma') || 
                          p.gradeName.toLowerCase().includes('ps') || 
                          p.gradeName.toLowerCase().includes('pla') || 
                          p.gradeName.toLowerCase().includes('transparent');
    
    const isReinforced = p.gradeName.includes('GF') || p.gradeName.includes('MD') || p.gradeName.includes('CF') || p.gradeName.includes('增强');
    
    // 1. Core Property: Density
    let density = 1.1;
    if (isPE) density = 0.94;
    else if (isPP) density = 0.90;
    else if (isPA) density = 1.14;
    else if (isPC) density = 1.20;
    else if (isABS) density = 1.05;
    else if (isRubber || isTPE) density = 0.88 + Math.random() * 0.15;
    else if (isHighPerf) density = 1.3 + Math.random() * 0.4;
    
    if (isReinforced) density += 0.25;
    p.properties['密度'] = p.properties['密度'] || { value: density, unit: 'g/cm³', standard: 'ISO 1183' };
    
    // 2. Material-Specific focus
    if (isPE || isPP) {
        const processes = ['气相法 (Gas Phase)', '淤浆法 (Slurry)', '本体法 (Bulk)'];
        const process = processes[Math.floor(Math.random() * processes.length)];
        const isMetallocene = p.gradeName.toLowerCase().includes('mpe');
        const catalyst = isMetallocene ? '茂金属催化剂 (Metallocene)' : 'Z-N催化剂 (Ziegler-Natta)';
        
        p.properties['聚合工艺'] = p.properties['聚合工艺'] || { value: process };
        p.properties['催化剂类型'] = p.properties['催化剂类型'] || { value: catalyst };
    }

    if (isRubber) {
        // Rubber focuses on Mooney Viscosity and Hardness
        p.properties['门尼粘度'] = p.properties['门尼粘度'] || { value: 30 + (Math.random() * 60), unit: 'MU', temperature: 'ML(1+4) 100°C', standard: 'ISO 289' };
        p.properties['邵氏硬度'] = p.properties['邵氏硬度'] || { value: 30 + (Math.random() * 50), unit: 'Shore A', standard: 'ISO 7619' };
        // Delete MFR if it exists (rubbers don't use MFR)
        delete p.properties['熔体质量流动速率'];
    } else if (isTPE) {
        // TPE focuses on Hardness and Stress
        p.properties['邵氏硬度'] = p.properties['邵氏硬度'] || { value: 50 + (Math.random() * 45), unit: 'Shore A/D', standard: 'ISO 7619' };
        p.properties['100%定伸应力'] = p.properties['100%定伸应力'] || { value: 2 + (Math.random() * 8), unit: 'MPa', standard: 'ISO 37' };
    } else {
        // Thermoplastics focus on MFR, Tensile, Flexural
        let mfrVal = 2.0;
        if (p.gradeName.includes('Inj') || p.gradeName.includes('注塑') || p.gradeName.includes('757') || p.gradeName.includes('5000S')) mfrVal = 5 + Math.random() * 25;
        else if (p.gradeName.includes('Film') || p.gradeName.includes('2426H')) mfrVal = 1.5 + Math.random() * 2;
        else if (p.gradeName.includes('Pipe') || p.gradeName.includes('管')) mfrVal = 0.1 + Math.random() * 0.5;
        
        p.properties['熔体质量流动速率'] = p.properties['熔体质量流动速率'] || { 
          value: mfrVal, 
          unit: 'g/10min', 
          temperature: isPP ? '230°C/2.16kg' : '190°C/2.16kg', 
          standard: 'ISO 1133' 
        };

        if (isReinforced) {
            p.properties['弯曲模量'] = p.properties['弯曲模量'] || { value: 5000 + Math.random() * 10000, unit: 'MPa', standard: 'ISO 178' };
            p.properties['拉伸断裂应力'] = p.properties['拉伸断裂应力'] || { value: 90 + Math.random() * 100, unit: 'MPa', standard: 'ISO 527' };
            p.properties['悬臂梁缺口冲击强度'] = p.properties['悬臂梁缺口冲击强度'] || { value: 8 + Math.random() * 15, unit: 'kJ/m²', standard: 'ISO 180' };
        } else {
            p.properties['拉伸屈服应力'] = p.properties['拉伸屈服应力'] || { value: (isHighPerf ? 100 : (isABS || isPC || isPA ? 45 : (isPE ? 25 : 30))) + Math.random() * 20, unit: 'MPa', standard: 'ISO 527' };
            p.properties['断裂伸长率'] = p.properties['断裂伸长率'] || { value: (isABS || isPA ? 20 : (isPE ? 500 : 50)) + Math.random() * 400, unit: '%', standard: 'ISO 527' };
            p.properties['弯曲模量'] = p.properties['弯曲模量'] || { value: (isPE ? 800 : (isPP ? 1200 : 2200)) + Math.random() * 800, unit: 'MPa', standard: 'ISO 178' };
            p.properties['简支梁缺口冲击强度'] = p.properties['简支梁缺口冲击强度'] || { value: 4 + Math.random() * 40, unit: 'kJ/m²', standard: 'ISO 179' };
        }

        if (isPC || isHighPerf || isReinforced || isPA || isPP) {
            const hdt = isHighPerf ? 180 + Math.random() * 100 : (isReinforced ? 150 : (isPC ? 120 : (isPP ? 95 : 65))) + Math.random() * 20;
            p.properties['热变形温度'] = p.properties['热变形温度'] || { value: hdt, unit: '°C', standard: 'ISO 75' };
        }
        
        if (isPE || isPP || isABS) {
            p.properties['维卡软化温度'] = p.properties['维卡软化温度'] || { value: (isPE ? 120 : (isPP ? 150 : 100)) + Math.random() * 10, unit: '°C', standard: 'ISO 306' };
        }
        
        if (isPE) {
            p.properties['熔点'] = p.properties['熔点'] || { value: 125 + Math.random() * 10, unit: '°C', standard: 'DSC' };
        } else if (isPP) {
            p.properties['熔点'] = p.properties['熔点'] || { value: 160 + Math.random() * 10, unit: '°C', standard: 'DSC' };
        }
        
        p.properties['成型收缩率'] = p.properties['成型收缩率'] || { value: (isPE || isPP ? 1.5 : (isPA ? 1.2 : 0.5)) + Math.random() * 0.5, unit: '%', standard: 'ISO 294-4' };
        p.properties['吸水率'] = p.properties['吸水率'] || { value: (isPA ? 1.5 : 0.1) + Math.random() * 0.2, unit: '%', standard: 'ISO 62' };
    }

    if (isTransparent) {
        p.properties['透光率'] = p.properties['透光率'] || { value: 88 + Math.random() * 5, unit: '%', standard: 'ISO 13468' };
        p.properties['雾度'] = p.properties['雾度'] || { value: 0.5 + Math.random() * 1.5, unit: '%', standard: 'ASTM D1003' };
    }

    // Final clean-up: rounding
    Object.keys(p.properties).forEach(k => {
        const prop = p.properties[k];
        if (typeof prop?.value === 'number') {
            prop.value = Number(prop.value.toFixed(2));
        }
    });

    return p;
  });
};

const generateCatalog = (): Product[] => {
  const products: Product[] = [];
  const add = (id: number, g: string, mId: string, mName: string, cats: string[], props: Record<string, PropertyValue> = {}) => {
    products.push(createProduct(id, g, mId, mName, cats, props));
  };

  let count = 1;

  // 1. PE Family (50 items) - Real Grades
  const peMans = [
    { id: 'm-33', name: 'Sinopec Yanshan' },
    { id: 'm-30', name: 'Sinopec Shanghai' },
    { id: 'm-32', name: 'Sinopec Yangzi' },
    { id: 'm-cnpc-1', name: 'PetroChina Daqing' }
  ];
  for (let i = 1; i <= 20; i++) add(count++, `HDPE 5000S-Type${i}`, peMans[i % 4].id, peMans[i % 4].name, ['root_plastic', 'cat_pe', 'sub_hdpe', 'sub_hdpe_inj'], { '典型应用': { value: 'General Injection' } });
  for (let i = 1; i <= 15; i++) add(count++, `LDPE 2426H-Batch${i}`, peMans[i % 4].id, peMans[i % 4].name, ['root_plastic', 'cat_pe', 'sub_ldpe', 'sub_ldpe_film'], { '典型应用': { value: 'Packaging Film' } });
  for (let i = 1; i <= 15; i++) add(count++, `LLDPE 7042-G${i}`, peMans[i % 4].id, peMans[i % 4].name, ['root_plastic', 'cat_pe', 'sub_lldpe'], { '典型应用': { value: 'Stretch Film' } });

  // 2. PP Family (65 items)
  for (let i = 1; i <= 30; i++) add(count++, `PP T30S-V${i}`, 'm-33', 'Sinopec Yanshan', ['root_plastic', 'cat_pp', 'sub_pp_homo'], { '典型应用': { value: 'Woven Bags' } });
  for (let i = 1; i <= 20; i++) add(count++, `PP K8303-Grade${i}`, 'm-30', 'Sinopec Shanghai', ['root_plastic', 'cat_pp', 'sub_pp_copo'], { '典型应用': { value: 'Auto Parts' } });
  for (let i = 1; i <= 15; i++) add(count++, `PP R200P-Batch${i}`, 'm-32', 'Sinopec Yangzi', ['root_plastic', 'cat_pp', 'sub_pp_rand'], { '典型应用': { value: 'PPR Pipes' } });
  for (let i = 1; i <= 10; i++) add(count++, `PP reinforced GF30-P${i}`, 'm-basf', 'BASF', ['root_plastic', 'cat_pp', 'sub_pp_reinforced'], { '典型应用': { value: 'Structural Parts' } });

  // 3. Styrenics & PVC (45 items)
  for (let i = 1; i <= 25; i++) add(count++, `ABS 757-Grade${i}`, 'm-chimei', 'Chi Mei', ['root_plastic', 'cat_abs', 'sub_abs_gen'], { '典型应用': { value: 'Enclosures' } });
  for (let i = 1; i <= 10; i++) add(count++, `GPPS 525-N${i}`, 'm-chimei', 'Chi Mei', ['root_plastic', 'cat_ps', 'sub_gpps']);
  for (let i = 1; i <= 10; i++) add(count++, `PVC S-1000-B${i}`, 'm-30', 'Sinopec Shanghai', ['root_plastic', 'cat_pvc', 'sub_pvc_s']);

  // 4. Engineering Plastics (100 items)
  const engMans = [
    { id: 'm-basf', name: 'BASF' },
    { id: 'm-covestro', name: 'Covestro' },
    { id: 'm-celanese', name: 'Celanese' },
    { id: 'm-sabic', name: 'SABIC' },
    { id: 'm-wanhua', name: 'Wanhua Chemical' }
  ];
  for (let i = 1; i <= 30; i++) add(count++, `PA66 Ultramid A3K-v${i}`, engMans[i % 5].id, engMans[i % 5].name, ['root_eng', 'cat_pa', 'sub_pa66']);
  for (let i = 1; i <= 30; i++) add(count++, `PA6 Ultramid B3S-p${i}`, engMans[i % 5].id, engMans[i % 5].name, ['root_eng', 'cat_pa', 'sub_pa6']);
  for (let i = 1; i <= 20; i++) add(count++, `PC Makrolon 2405-Type${i}`, 'm-covestro', 'Covestro', ['root_eng', 'cat_pc', 'sub_pc_inj']);
  for (let i = 1; i <= 10; i++) add(count++, `POM Celcon M90-${i}`, 'm-celanese', 'Celanese', ['root_eng', 'cat_pom', 'sub_pom_copo']);
  for (let i = 1; i <= 10; i++) add(count++, `PBT Valox 315-${i}`, 'm-sabic', 'SABIC', ['root_eng', 'cat_pbt_pet', 'sub_pbt_gen']);

  // 5. High Performance (20 items)
  for (let i = 1; i <= 10; i++) add(count++, `PEEK Victrex 450G-L${i}`, 'm-basell', 'LyondellBasell', ['root_high_perf', 'cat_peek_family']);
  for (let i = 1; i <= 10; i++) add(count++, `PPS Ryton R-4-P${i}`, 'm-solvay', 'Solvay', ['root_high_perf', 'cat_pps']);

  // 6. Elastomers & Rubber (20 items)
  for (let i = 1; i <= 10; i++) add(count++, `TPU Elastollan 1185A-v${i}`, 'm-basf', 'BASF', ['root_tpe', 'cat_tpu']);
  for (let i = 1; i <= 10; i++) add(count++, `EPDM KEP-270-Batch${i}`, 'm-kumho', 'Kumho Polychem', ['root_rubber', 'cat_epdm']);

  return enrichProperties(products);
};

export const PRODUCT_CATALOG: Product[] = generateCatalog();
