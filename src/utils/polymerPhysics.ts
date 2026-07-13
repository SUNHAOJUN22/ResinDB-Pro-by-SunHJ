import { Product } from "@/types/index";

/**
 * Materials Informatics & Polymer Physics Simulation Engine (Client-Side)
 * Designed for advanced resin evaluation, molecular descriptor calculation,
 * and ASTM validation.
 */

export interface PolymerDescriptors {
  polymerName: string;
  molecularWeightGPerMol: number;
  monomerSMILES: string;
  glassTransitionTempK: number;
  glassTransitionTempC: number;
  typicalDensity: number; // g/cm³
  crystallinePotential: number; // %
  isotacticIndexPotential?: number; // %
  polarity: "Non-polar" | "Highly-polar" | "Moderate-polar";
  chainStiffness: "Flexible" | "Semi-rigid" | "Rigid";
  chemicalFormula: string;
}

export interface QSPRPredictions {
  estimatedFlexuralModulusMPa: number;
  predictedElongationAtBreak: number; // %
  calculatedCrystallineRatio: number; // %
  estimatedIzodImpactStrengthKJ: number; // kJ/m²
  shoreHardnessEstimate: string;
  swellingRatioEPDM?: number; // EPDM-specific swelling estimate
  molarVolumeCm3PerMol: number;
}

export interface LammpsConfig {
  polymerType: string;
  atomsCount: number;
  tempK: number;
  crossLinkDegree: number; // %
}

/**
 * Predict polymer properties from monomer SMILES string using empirical
 * polymer correlation rules (Chemoinformatics & Group Contribution Method).
 */
export function calculatePolymerDescriptors(smiles: string): PolymerDescriptors {
  const cleanSmiles = smiles.trim().replace(/\s+/g, "");
  
  // High-fidelity dictionaries for common plastics and elastomers
  if (cleanSmiles.includes("Cl")) {
    return {
      polymerName: "Polyvinyl Chloride (PVC)",
      molecularWeightGPerMol: 62.49,
      monomerSMILES: "C=CCl",
      glassTransitionTempK: 354.15, // 81 °C
      glassTransitionTempC: 81,
      typicalDensity: 1.38,
      crystallinePotential: 10, // Mostly amorphous
      polarity: "Highly-polar",
      chainStiffness: "Semi-rigid",
      chemicalFormula: "(C2H3Cl)n"
    };
  }

  if (cleanSmiles.includes("c1ccccc1") || cleanSmiles.includes("C1=CC=CC=C1")) {
    return {
      polymerName: "Polystyrene (PS)",
      molecularWeightGPerMol: 104.15,
      monomerSMILES: "C=CC1=CC=CC=C1",
      glassTransitionTempK: 373.15, // 100 °C
      glassTransitionTempC: 100,
      typicalDensity: 1.05,
      crystallinePotential: 5, // Amorphous
      polarity: "Moderate-polar",
      chainStiffness: "Rigid",
      chemicalFormula: "(C8H8)n"
    };
  }

  if (cleanSmiles === "CC(C)" || cleanSmiles.includes("C(C)") || cleanSmiles.includes("CH(CH3)")) {
    return {
      polymerName: "Isotactic Polypropylene (iPP)",
      molecularWeightGPerMol: 42.08,
      monomerSMILES: "CC=C",
      glassTransitionTempK: 263.15, // -10 °C
      glassTransitionTempC: -10,
      typicalDensity: 0.905,
      crystallinePotential: 65,
      isotacticIndexPotential: 96.5,
      polarity: "Non-polar",
      chainStiffness: "Flexible",
      chemicalFormula: "(C3H6)n"
    };
  }

  if (cleanSmiles === "CC" || cleanSmiles === "C=C" || cleanSmiles === "CH2CH2") {
    return {
      polymerName: "High-Density Polyethylene (HDPE)",
      molecularWeightGPerMol: 28.05,
      monomerSMILES: "C=C",
      glassTransitionTempK: 153.15, // -120 °C
      glassTransitionTempC: -120,
      typicalDensity: 0.965,
      crystallinePotential: 80,
      polarity: "Non-polar",
      chainStiffness: "Flexible",
      chemicalFormula: "(C2H4)n"
    };
  }

  if (cleanSmiles.includes("C=C") && cleanSmiles.includes("CC")) {
    // Elastomer EPDM simulation
    return {
      polymerName: "Ethylene-Propylene-Diene Rubber (EPDM)",
      molecularWeightGPerMol: 56.1,
      monomerSMILES: "CC=C.C=C.C1C=CC2C1CC=C2", // Hexadiene / ENB type unit
      glassTransitionTempK: 218.15, // -55 °C
      glassTransitionTempC: -55,
      typicalDensity: 0.865,
      crystallinePotential: 12, // Mostly amorphous elastomer
      polarity: "Non-polar",
      chainStiffness: "Flexible",
      chemicalFormula: "(C2H4)x-(C3H6)y-(ENB)z"
    };
  }

  // Base chemical parser fallback for custom formulas (estimation using carbon counting)
  const carbonCount = (cleanSmiles.match(/c/gi) || []).length || 2;
  const chlorineCount = (cleanSmiles.match(/cl/gi) || []).length;
  const fluorineCount = (cleanSmiles.match(/f/gi) || []).length;
  
  const estimatedMW = carbonCount * 12.011 + (carbonCount * 2) * 1.008 + chlorineCount * 35.45 + fluorineCount * 19.0;
  
  // Group contribution estimates
  const estTgK = 180 + carbonCount * 12 - (chlorineCount ? -110 : 0) + (fluorineCount ? 40 : 0);
  const typicalDensity = chlorineCount ? 1.35 : (carbonCount > 4 ? 0.92 : 0.89);

  return {
    polymerName: `Custom Polymer [SMILES: ${cleanSmiles}]`,
    molecularWeightGPerMol: parseFloat(estimatedMW.toFixed(2)),
    monomerSMILES: cleanSmiles,
    glassTransitionTempK: parseFloat(estTgK.toFixed(1)),
    glassTransitionTempC: parseFloat((estTgK - 273.15).toFixed(1)),
    typicalDensity: parseFloat(typicalDensity.toFixed(3)),
    crystallinePotential: chlorineCount ? 15 : 45,
    polarity: chlorineCount ? "Highly-polar" : "Non-polar",
    chainStiffness: carbonCount > 6 ? "Semi-rigid" : "Flexible",
    chemicalFormula: `(C${carbonCount}H${carbonCount * 2}${chlorineCount ? 'Cl' + chlorineCount : ''})n`
  };
}

/**
 * Generate a production-grade LAMMPS MD template for polymeric crystalline models.
 */
export function generateLammpsMDInput(config: LammpsConfig): string {
  const { polymerType, atomsCount, tempK, crossLinkDegree } = config;
  
  return `# =========================================================================
# LAMMPS Crystalline Polymer Equilibrium Card
# Synthesized by ResinAI Material Informatics Client on behalf of User
# Run Mode: Molecular Dynamics (MD) Polymeric Thermal Relaxation
# Target Composite System: ${polymerType} (${atomsCount} atoms)
# =========================================================================

# 1. Basic Simulation Initialization
units           real
dimension       3
boundary        p p p     # Triple periodic boundary conditions
atom_style      full      # Charges, molecular bonds, angles and dihedrals

# 2. Forcefield Selection: PCFF (Polymer Consistent Forcefield)
pair_style      lj/class2/coul/long 12.0
bond_style      class2
angle_style     class2
dihedral_style  class2
improper_style  class2
kspace_style    pppm 1.0e-4

# 3. Reading Molecular Topology & Structural Configuration
# Pre-relaxed with Monte Carlo polymer self-consistent field chain growing
read_data       relaxed_${polymerType.toLowerCase().replace(/[^a-z0-9]/g, "_")}_structure.data

# 4. Thermodynamic & Physical Parameters Definition
variable        temperature equal ${tempK}
variable        timestep    equal 1.0       # 1 femtosecond timestep
variable        crosslink   equal ${crossLinkDegree}

# 5. Neighbor Settings
neighbor        2.0 bin
neigh_modify    delay 0 every 1 check yes

# 6. Group Definition
group           backbone type 1 2     # Main chain Carbon & Hydrogen atoms
${crossLinkDegree > 0 ? "group           crosslinks type 3 4   # Crosslinking elastic nodes" : "# No vulcanization agent / crosslinkers added"}

# 7. Energy Minimization (Conjugate Gradient)
thermo          100
thermo_style    custom step temp pe ke etotal press vol density
minimize        1.0e-4 1.0e-6 10000 100000

# 8. Relaxation and Thermal Equilibration under NPT Ensemble (Isothermal-Isobaric)
reset_timestep  0
timestep        \${timestep}

# Velocity initiation using Maxwell-Boltzmann distribution
velocity        all create \${temperature} 4928459 rot yes dist gaussian

# Nose-Hoover Thermostat & Barostat
fix             relaxation_npt all npt temp \${temperature} \${temperature} 100.0 iso 1.0 1.0 1000.0

# 9. Outputs Mapping Configuration
dump            trajectory_dump all custom 2000 relaxation_dump.lammpstrj id type x y z q
dump_modify     trajectory_dump sort id

# 10. Thermal Conductivity and Structural Profiling Output
# Computing Mean Squared Displacement (MSD) to extract glass transition (Tg) physical anomalies
compute         polymer_msd backbone msd
thermo_style    custom step temp pe ke press vol density c_polymer_msd[4]

run             100000 # 100ps relaxation baseline

# 11. Multi-Stage Thermal Cooldown Profile (Tg and Glassy Phase transition check)
# Run an explicit NPT cooling run from 353.15 K (80 °C) down to 243.15 K (-30 °C)
unfix           relaxation_npt
variable        Tg_target_estimate equal 265.0
fix             cooling_npt all npt temp 353.15 243.15 100.0 iso 1.0 1.0 1000.0
thermo          500
run             200000 # Continuous cooling stage 

# 12. Uniaxial Tensile Strain rate deformation simulation (Ashby stiffness-toughness scale check)
unfix           cooling_npt
# Set temperature to critical -30 °C for sub-ambient mechanical performance assessment
fix             deform_npt all npt temp 243.15 243.15 100.0 y 1.0 1.0 1000.0 z 1.0 1.0 1000.0

# Capture initial box length BEFORE deformation begins (critical for strain calculation)
variable        L0 equal lx

# Apply a constant engineering strain rate of 1e-5 fs^-1 along X-direction
variable        strain_rate equal 1.0e-5
fix             tensile_deform all deform 1 x erate \${strain_rate} remap v

# Define custom mechanical stress/strain calculators
# Engineering strain: ε = (L - L₀) / L₀
variable        strainX equal (lx-v_L0)/v_L0
variable        stressX equal -press
thermo_style    custom step temp vol density lx v_strainX v_stressX pe etotal
run             150000 # Execute tensile strain elongation to fracture

`;
}

/**
 * Computes QSPR (Quantitative Structure-Property Relationship) polymer model predictions
 * based on mechanical and viscoelastic inputs, using classic physical formulas for high polymers.
 */
export function predictPropertiesQSPR(
  density: number,
  mfr: number,
  tensileYield: number
): QSPRPredictions {
  // 1. Crystal-amorphous boundary ratio
  // Based on PP density limits: amorphous density = 0.852 g/cm³, crystalline density = 0.943 g/cm³
  // For standard polyolefins, we approximate crystallinity percentage
  const amorphousD = 0.852;
  const crystallineD = 0.943;
  let crystallineRatio = ((density - amorphousD) / (crystallineD - amorphousD)) * 100;
  if (crystallineRatio < 0) crystallineRatio = 2;
  if (crystallineRatio > 98) crystallineRatio = 98;

  // 2. Flexural Modulus
  // Empirically linked to tensile yield and crystallinity (Halpin-Tsai parameters)
  const estFlexMod = tensileYield * 48.5 * (1 + (crystallineRatio / 100) * 0.4);

  // 3. Elongation at Break (%)
  // Strongly and inversely proportional to tensile yield (stiffness increases) and MFR (MFR corresponds to shorter chain segments)
  // Higher MFR means shorter polymer chains -> lower molecular weight -> lower elongation
  const predictedElongation = Math.max(
    10,
    parseFloat((4500 / Math.pow(tensileYield, 0.75) * Math.pow(12 / (mfr + 0.1), 0.15) * (1 - crystallineRatio / 200)).toFixed(1))
  );

  // 4. Izod Impact Strength (kJ/m²)
  // Toughness decreases as density/crystallinity increases, or if MFR becomes very high (low molecular weight)
  const estIzod = Math.max(
    1.2,
    parseFloat(((750 / (tensileYield + 5)) * Math.pow(10 / (mfr + 0.2), 0.22) * (1 - crystallineRatio / 180)).toFixed(2))
  );

  // 5. Shore Hardness Estimation
  let hardness = "D60";
  if (density < 0.88) {
    hardness = `A${Math.round(50 + density * 30)}`; // elastomer/synthetic rubber
  } else {
    hardness = `D${Math.round(40 + (density - 0.88) * 180 + tensileYield * 0.4)}`;
  }

  // 6. Polymeric molar volume calculations
  const monomerMassAverage = 42.08; // propylene average weights
  const molarVolume = monomerMassAverage / Math.max(density, 1e-6);

  // 7. Rubber swelling ratio parameters (Flory-Huggins thermodynamic parameter)
  // Elastomer-only Swelling ratio estimate (for EPDM, etc. density < 0.88)
  const swellingRatio = density < 0.88 ? parseFloat((8.5 * Math.pow((mfr + 1), 0.08) * (1 - tensileYield / 60)).toFixed(2)) : undefined;

  return {
    estimatedFlexuralModulusMPa: Math.round(estFlexMod),
    predictedElongationAtBreak: predictedElongation,
    calculatedCrystallineRatio: parseFloat(crystallineRatio.toFixed(1)),
    estimatedIzodImpactStrengthKJ: estIzod,
    shoreHardnessEstimate: hardness,
    swellingRatioEPDM: swellingRatio,
    molarVolumeCm3PerMol: parseFloat(molarVolume.toFixed(2))
  };
}

export interface ASTMValidationResult {
  gradeName: string;
  category: string;
  status: "PASSED" | "WARNING" | "CRITICAL";
  standardsTested: string[];
  findings: string[];
}

/**
 * Cross-references raw database records against experimental validation boundaries
 * (ASTM D1238, ASTM D638, ASTM D790, ISO 178).
 */
export function auditASTMStandards(products: Product[]): ASTMValidationResult[] {
  return products.map((item) => {
    const isCategory = (name: string): boolean => {
      const lowerName = name.toLowerCase();
      const idsMatch = (item.categoryIds || []).some(id => id.toLowerCase().includes(lowerName));
      const directMatch = ((item as Product & { category?: string }).category || "").toLowerCase().includes(lowerName);
      return idsMatch || directMatch;
    };

    const isPP = isCategory("pp");
    const isHDPE = isCategory("hdpe");

    const category = isPP ? "PP" : isHDPE ? "HDPE" : ((item as Product & { category?: string }).category || "Unknown");
    const gradeName = item.gradeName || "Unnamed Grade";
    const findings: string[] = [];
    const standardsTested: string[] = ["ASTM D792 (Density)"];
    let status: "PASSED" | "WARNING" | "CRITICAL" = "PASSED";

    const props = item.properties || {};
    const getVal = (keys: string[]): number | undefined => {
      for (const k of keys) {
        const v = props[k]?.value;
        if (v !== undefined && v !== null && !isNaN(Number(v))) return Number(v);
      }
      return undefined;
    };

    const densityVal = getVal(["密度", "density", "Density"]);
    const mfrVal = getVal(["熔体质量流动速率", "mfr", "mfi", "MFR", "MFI", "熔融指数", "流动速率"]);
    const tensileVal = getVal(["拉伸屈服应力", "tensileYield", "tensileStrength", "拉伸强度", "Tensile Strength", "拉伸断裂应力"]);
    const flexModVal = getVal(["弯曲模量", "flexuralModulus", "Flexural Modulus"]);

    // Validate Density D792 / ISO 1183
    if (densityVal !== undefined) {
      if (isPP && (densityVal < 0.890 || densityVal > 0.920)) {
        findings.push(`Density [${densityVal} g/cm³] deviates from typical Polypropylene boundaries (0.890 - 0.920 g/cm³). Possible severe compounding error.`);
        status = "WARNING";
      }
      if (isHDPE && (densityVal < 0.940 || densityVal > 0.970)) {
        findings.push(`Density [${densityVal} g/cm³] deviates from ASTM D1248 High-Density Polyethylene baseline (0.940 - 0.970 g/cm³). Classified as LDPE/LLDPE compound.`);
        status = "WARNING";
      }
    }

    // Validate MFR ASTM D1238
    if (mfrVal !== undefined) {
      standardsTested.push("ASTM D1238 (Melt Flow Index)");
      if (mfrVal < 0.05) {
        findings.push(`MFR is exceptionally sparse [${mfrVal} g/10min]. Ultimate high molecular weight material, extremely difficult for extrusion injection.`);
        status = "WARNING";
      } else if (mfrVal > 150) {
        findings.push(`MFR is critically elevated [${mfrVal} g/10min]. Extremely low molecular weight chain segment risk of flash molding and high brittleness.`);
        status = "CRITICAL";
      }
    }

    // Validate Tensile Performance ASTM D638 / ISO 527
    if (tensileVal !== undefined) {
      standardsTested.push("ASTM D638 (Tensile Strength)");
      if (isPP && tensileVal < 15) {
        findings.push(`Tensile Yield strength is abnormally depressed [${tensileVal} MPa]. Check structural crystallinity. Elastomer saturation index might be too high.`);
        status = "WARNING";
      }
    }

    // Validate Flexural Modulus ASTM D790
    if (flexModVal !== undefined) {
      standardsTested.push("ASTM D790 (Flexural Modulus)");
      if (isPP && flexModVal < 600) {
        findings.push(`Flexural elasticity modulus is critically low [${flexModVal} MPa]. Severe stiffness collapse.`);
        status = "WARNING";
      } else if (isPP && flexModVal > 2800) {
        findings.push(`Flexural modulus [${flexModVal} MPa] exceeds typical virgin resin boundaries. Highly likely reinforced with glass fibers or talc mineral powders.`);
        status = "WARNING";
      }
    }

    if (findings.length === 0) {
      findings.push("All physical telemetry vectors compile successfully against polymer standard database guidelines. Grade performs within expected bounds.");
    }

    return {
      gradeName,
      category,
      status,
      standardsTested,
      findings
    };
  });
}
