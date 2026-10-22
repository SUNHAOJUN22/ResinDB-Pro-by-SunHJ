import type { Category, Language } from '@/types/index';

const builtins: Record<string, { original: string; zh: string; en: string }> = {
  "root_plastic": {
    "original": "通用塑料 (Commodity Plastics)",
    "zh": "通用塑料",
    "en": "Commodity Plastics"
  },
  "cat_pe": {
    "original": "聚乙烯 (PE)",
    "zh": "聚乙烯",
    "en": "PE"
  },
  "sub_hdpe": {
    "original": "高密度聚乙烯 (HDPE)",
    "zh": "高密度聚乙烯",
    "en": "HDPE"
  },
  "sub_hdpe_blow": {
    "original": "吹塑级 (Blow Molding)",
    "zh": "吹塑级",
    "en": "Blow Molding"
  },
  "sub_hdpe_inj": {
    "original": "注塑级 (Injection)",
    "zh": "注塑级",
    "en": "Injection"
  },
  "sub_hdpe_pipe": {
    "original": "管材级 (Pipe)",
    "zh": "管材级",
    "en": "Pipe"
  },
  "sub_hdpe_film": {
    "original": "薄膜级 (Film)",
    "zh": "薄膜级",
    "en": "Film"
  },
  "sub_hdpe_wire": {
    "original": "电线电缆级 (Wire & Cable)",
    "zh": "电线电缆级",
    "en": "Wire & Cable"
  },
  "sub_ldpe": {
    "original": "低密度聚乙烯 (LDPE)",
    "zh": "低密度聚乙烯",
    "en": "LDPE"
  },
  "sub_ldpe_film": {
    "original": "薄膜级",
    "zh": "薄膜级",
    "en": "Film grade"
  },
  "sub_ldpe_coat": {
    "original": "涂覆级 (Coating)",
    "zh": "涂覆级",
    "en": "Coating"
  },
  "sub_lldpe": {
    "original": "线性低密度聚乙烯 (LLDPE)",
    "zh": "线性低密度聚乙烯",
    "en": "LLDPE"
  },
  "sub_mpe": {
    "original": "茂金属聚乙烯 (mPE)",
    "zh": "茂金属聚乙烯",
    "en": "mPE"
  },
  "sub_uhmwpe": {
    "original": "超高分子量聚乙烯 (UHMWPE)",
    "zh": "超高分子量聚乙烯",
    "en": "UHMWPE"
  },
  "sub_eva": {
    "original": "乙烯-乙酸乙烯酯共聚物 (EVA)",
    "zh": "乙烯-乙酸乙烯酯共聚物",
    "en": "EVA"
  },
  "sub_eva_foam": {
    "original": "发泡级",
    "zh": "发泡级",
    "en": "Foam grade"
  },
  "sub_eva_adhesive": {
    "original": "胶粘剂级",
    "zh": "胶粘剂级",
    "en": "Adhesive grade"
  },
  "cat_pp": {
    "original": "聚丙烯 (PP)",
    "zh": "聚丙烯",
    "en": "PP"
  },
  "sub_pp_homo": {
    "original": "均聚聚丙烯 (Homopolymer PP)",
    "zh": "均聚聚丙烯",
    "en": "Homopolymer PP"
  },
  "sub_pp_copo": {
    "original": "抗冲共聚聚丙烯 (Impact Copolymer PP)",
    "zh": "抗冲共聚聚丙烯",
    "en": "Impact Copolymer PP"
  },
  "sub_pp_rand": {
    "original": "无规共聚聚丙烯 (Random Copolymer PP)",
    "zh": "无规共聚聚丙烯",
    "en": "Random Copolymer PP"
  },
  "sub_pp_mfr_high": {
    "original": "高流动PP (High Flow PP)",
    "zh": "高流动PP",
    "en": "High Flow PP"
  },
  "sub_pp_filler": {
    "original": "填充改性PP (Filled PP)",
    "zh": "填充改性PP",
    "en": "Filled PP"
  },
  "sub_pp_reinforced": {
    "original": "增强改性PP (Reinforced PP)",
    "zh": "增强改性PP",
    "en": "Reinforced PP"
  },
  "cat_pvc": {
    "original": "聚氯乙烯 (PVC)",
    "zh": "聚氯乙烯",
    "en": "PVC"
  },
  "sub_pvc_s": {
    "original": "悬浮级 (PVC-S)",
    "zh": "悬浮级",
    "en": "PVC-S"
  },
  "sub_pvc_e": {
    "original": "乳液级 (PVC-E)",
    "zh": "乳液级",
    "en": "PVC-E"
  },
  "sub_pvc_cpvc": {
    "original": "氯化聚氯乙烯 (CPVC)",
    "zh": "氯化聚氯乙烯",
    "en": "CPVC"
  },
  "cat_ps": {
    "original": "聚苯乙烯 (PS)",
    "zh": "聚苯乙烯",
    "en": "PS"
  },
  "sub_gpps": {
    "original": "通用级 (GPPS)",
    "zh": "通用级",
    "en": "GPPS"
  },
  "sub_hips": {
    "original": "高抗冲 (HIPS)",
    "zh": "高抗冲",
    "en": "HIPS"
  },
  "sub_eps": {
    "original": "可发性 (EPS)",
    "zh": "可发性",
    "en": "EPS"
  },
  "cat_abs": {
    "original": "ABS/SAN",
    "zh": "ABS/SAN",
    "en": "ABS/SAN"
  },
  "sub_abs_gen": {
    "original": "通用级ABS",
    "zh": "通用级ABS",
    "en": "General-purpose ABS"
  },
  "sub_abs_heat": {
    "original": "耐热级ABS",
    "zh": "耐热级ABS",
    "en": "Heat-resistant ABS"
  },
  "sub_abs_fr": {
    "original": "阻燃级ABS",
    "zh": "阻燃级ABS",
    "en": "Flame-retardant ABS"
  },
  "sub_abs_plate": {
    "original": "电镀级ABS",
    "zh": "电镀级ABS",
    "en": "Electroplating ABS"
  },
  "sub_san": {
    "original": "丙烯腈-苯乙烯 (SAN/AS)",
    "zh": "丙烯腈-苯乙烯",
    "en": "SAN/AS"
  },
  "root_eng": {
    "original": "工程塑料 (Engineering Plastics)",
    "zh": "工程塑料",
    "en": "Engineering Plastics"
  },
  "cat_pa": {
    "original": "聚酰胺 (PA/尼龙)",
    "zh": "聚酰胺",
    "en": "Polyamide (PA / nylon)"
  },
  "sub_pa6": {
    "original": "尼龙6 (PA6)",
    "zh": "尼龙6",
    "en": "PA6"
  },
  "sub_pa66": {
    "original": "尼龙66 (PA66)",
    "zh": "尼龙66",
    "en": "PA66"
  },
  "sub_pa_long": {
    "original": "长碳链尼龙 (PA11/PA12/PA610/PA612)",
    "zh": "长碳链尼龙",
    "en": "PA11/PA12/PA610/PA612"
  },
  "sub_pga": {
    "original": "半芳香族尼龙 (PPA)",
    "zh": "半芳香族尼龙",
    "en": "PPA"
  },
  "sub_pa_transparent": {
    "original": "透明尼龙",
    "zh": "透明尼龙",
    "en": "Transparent nylon"
  },
  "sub_pa_alloy": {
    "original": "尼龙合金",
    "zh": "尼龙合金",
    "en": "Nylon alloys"
  },
  "cat_pc": {
    "original": "聚碳酸酯 (PC)",
    "zh": "聚碳酸酯",
    "en": "PC"
  },
  "sub_pc_inj": {
    "original": "注塑级",
    "zh": "注塑级",
    "en": "Injection grade"
  },
  "sub_pc_ext": {
    "original": "挤出级",
    "zh": "挤出级",
    "en": "Extrusion grade"
  },
  "sub_pc_alloy": {
    "original": "PC合金",
    "zh": "PC合金",
    "en": "PC alloys"
  },
  "sub_pc_abs": {
    "original": "PC/ABS",
    "zh": "PC/ABS",
    "en": "PC/ABS"
  },
  "sub_pc_pbt": {
    "original": "PC/PBT",
    "zh": "PC/PBT",
    "en": "PC/PBT"
  },
  "sub_pc_asa": {
    "original": "PC/ASA",
    "zh": "PC/ASA",
    "en": "PC/ASA"
  },
  "cat_pom": {
    "original": "聚甲醛 (POM)",
    "zh": "聚甲醛",
    "en": "POM"
  },
  "sub_pom_homo": {
    "original": "均聚POM",
    "zh": "均聚POM",
    "en": "POM homopolymer"
  },
  "sub_pom_copo": {
    "original": "共聚POM",
    "zh": "共聚POM",
    "en": "POM copolymer"
  },
  "cat_pbt_pet": {
    "original": "聚酯 (PBT/PET)",
    "zh": "聚酯",
    "en": "PBT/PET"
  },
  "sub_pbt_gen": {
    "original": "PBT通用级",
    "zh": "PBT通用级",
    "en": "General-purpose PBT"
  },
  "sub_pbt_reinf": {
    "original": "PBT增强级",
    "zh": "PBT增强级",
    "en": "Reinforced PBT"
  },
  "sub_pet_bottle": {
    "original": "PET瓶级",
    "zh": "PET瓶级",
    "en": "Bottle-grade PET"
  },
  "sub_pet_fiber": {
    "original": "PET纤维级",
    "zh": "PET纤维级",
    "en": "Fiber-grade PET"
  },
  "cat_pmma": {
    "original": "聚甲基丙烯酸甲酯 (PMMA)",
    "zh": "聚甲基丙烯酸甲酯",
    "en": "PMMA"
  },
  "cat_ppe": {
    "original": "改性聚苯醚 (MPPO/PPE)",
    "zh": "改性聚苯醚",
    "en": "MPPO/PPE"
  },
  "root_high_perf": {
    "original": "特种/高性能聚合物",
    "zh": "特种/高性能聚合物",
    "en": "Specialty / high-performance polymers"
  },
  "cat_peek_family": {
    "original": "聚芳醚酮类 (PEEK/PEKK)",
    "zh": "聚芳醚酮类",
    "en": "PEEK/PEKK"
  },
  "cat_pps": {
    "original": "聚苯硫醚 (PPS)",
    "zh": "聚苯硫醚",
    "en": "PPS"
  },
  "cat_lcp": {
    "original": "液晶聚合物 (LCP)",
    "zh": "液晶聚合物",
    "en": "LCP"
  },
  "cat_sulfone": {
    "original": "聚砜类 (PSU/PES/PPSU)",
    "zh": "聚砜类",
    "en": "PSU/PES/PPSU"
  },
  "cat_pi_family": {
    "original": "聚酰亚胺类 (PI/PEI/PAI)",
    "zh": "聚酰亚胺类",
    "en": "PI/PEI/PAI"
  },
  "cat_fluor": {
    "original": "氟塑料 (PTFE/PVDF/FEP/ETFE)",
    "zh": "氟塑料",
    "en": "PTFE/PVDF/FEP/ETFE"
  },
  "root_tpe": {
    "original": "热塑性弹性体 (TPE)",
    "zh": "热塑性弹性体",
    "en": "TPE"
  },
  "cat_tpu": {
    "original": "热塑性聚氨酯 (TPU)",
    "zh": "热塑性聚氨酯",
    "en": "TPU"
  },
  "cat_tpes": {
    "original": "苯乙烯类弹性体 (SBS/SEBS/SIS)",
    "zh": "苯乙烯类弹性体",
    "en": "SBS/SEBS/SIS"
  },
  "cat_tpv_tpo": {
    "original": "聚烯烃类弹性体 (TPV/TPO/POE)",
    "zh": "聚烯烃类弹性体",
    "en": "TPV/TPO/POE"
  },
  "cat_tpee": {
    "original": "热塑性聚酯弹性体 (TPEE)",
    "zh": "热塑性聚酯弹性体",
    "en": "TPEE"
  },
  "cat_tpa": {
    "original": "热塑性尼龙弹性体 (TPA)",
    "zh": "热塑性尼龙弹性体",
    "en": "TPA"
  },
  "root_rubber": {
    "original": "合成橡胶 (Synthetic Rubber)",
    "zh": "合成橡胶",
    "en": "Synthetic Rubber"
  },
  "cat_epdm": {
    "original": "乙丙橡胶 (EPDM)",
    "zh": "乙丙橡胶",
    "en": "EPDM"
  },
  "cat_sbr": {
    "original": "丁苯橡胶 (SBR)",
    "zh": "丁苯橡胶",
    "en": "SBR"
  },
  "cat_br": {
    "original": "顺丁橡胶 (BR)",
    "zh": "顺丁橡胶",
    "en": "BR"
  },
  "cat_nbr": {
    "original": "丁腈橡胶 (NBR)",
    "zh": "丁腈橡胶",
    "en": "NBR"
  },
  "cat_iir": {
    "original": "丁基橡胶 (IIR)",
    "zh": "丁基橡胶",
    "en": "IIR"
  },
  "cat_cr": {
    "original": "氯丁橡胶 (CR)",
    "zh": "氯丁橡胶",
    "en": "CR"
  },
  "cat_sir": {
    "original": "硅橡胶 (SIR)",
    "zh": "硅橡胶",
    "en": "SIR"
  },
  "cat_fkm": {
    "original": "氟橡胶 (FKM)",
    "zh": "氟橡胶",
    "en": "FKM"
  },
  "root_thermoset": {
    "original": "热固性塑料 (Thermosets)",
    "zh": "热固性塑料",
    "en": "Thermosets"
  },
  "cat_epoxy": {
    "original": "环氧树脂 (Epoxy)",
    "zh": "环氧树脂",
    "en": "Epoxy"
  },
  "cat_phenolic": {
    "original": "酚醛树脂 (PF)",
    "zh": "酚醛树脂",
    "en": "PF"
  },
  "cat_pu": {
    "original": "聚氨酯 (PU)",
    "zh": "聚氨酯",
    "en": "PU"
  },
  "root_bio": {
    "original": "可再生/生物基材料",
    "zh": "可再生/生物基材料",
    "en": "Renewable / biobased materials"
  },
  "cat_biodegradable": {
    "original": "生物降解塑料 (PLA/PBAT/PHA/PCL)",
    "zh": "生物降解塑料",
    "en": "PLA/PBAT/PHA/PCL"
  },
  "cat_bio_polyolefin": {
    "original": "生物基聚烯烃 (Bio-PE/Bio-PP)",
    "zh": "生物基聚烯烃",
    "en": "Bio-PE/Bio-PP"
  },
  "cat_rplast": {
    "original": "再生塑料 (PCR/PIR)",
    "zh": "再生塑料",
    "en": "PCR/PIR"
  },
  "root_additive": {
    "original": "助剂/色母/复合料",
    "zh": "助剂/色母/复合料",
    "en": "Additives / masterbatches / compounds"
  },
  "cat_color": {
    "original": "色母/功能母粒",
    "zh": "色母/功能母粒",
    "en": "Color / functional masterbatches"
  },
  "cat_compound": {
    "original": "合金/复合改性料",
    "zh": "合金/复合改性料",
    "en": "Polymer alloys / compounds"
  },
  "cat_filler_master": {
    "original": "填充母粒",
    "zh": "填充母粒",
    "en": "Filler masterbatches"
  }
};

/** Translate built-in labels without changing user records, names or category IDs. */
export function categoryLabel(category: Category, language: Language): string {
  if (language === 'en' && category.nameEn) return category.nameEn;
  const builtin = builtins[category.id];
  return builtin && category.name === builtin.original ? builtin[language] : category.name;
}
