import { sql } from "kysely"
import { extractMinQPrice } from "lib/util/extract-min-quantity-price"
import type { BaseComponent } from "./component-base"
import type { DerivedTableSpec } from "./types"

export interface NpuChip extends BaseComponent {
  package: string
  manufacturer: string
  chip_family: string
  npu_name: string
  npu_performance_tops: number | null
}

interface NpuFamilyRule {
  manufacturerPattern: RegExp
  mfrPattern: RegExp
  chipFamily: string
  npuName: string
  performanceTops?: number
  requiresProcessorEvidence?: boolean
}

const MANUFACTURER_PATTERNS = {
  rockchip: /\brockchip\b/i,
  allwinner: /\ballwinner\b/i,
  nxp: /\bnxp\b/i,
  ti: /(?:\b(?:ti|texas instruments)\b|德州仪器)/i,
  st: /\b(?:st\s*micro(?:electronics)?|stmicroelectronics)\b/i,
  jlcAssembly: /\bjlcpcb assembly\b/i,
  himax: /\bhimax\b/i,
  amlogic: /\bamlogic\b/i,
  canaan: /\b(?:canaan|kendryte)\b/i,
  sophgo: /\b(?:sophgo|cvitek)\b/i,
  renesas: /\brenesas\b/i,
  adi: /\b(?:analog devices|adi|maxim(?: integrated)?)\b/i,
  axera: /\baxera\b/i,
  sigmastar: /\bsigmastar\b/i,
} as const

/**
 * Known NPU-bearing chip families. Each rule is gated by both the MPN and the
 * catalog manufacturer so short part names such as K210 and SG2002 cannot
 * classify unrelated diodes or transistors.
 */
export const NPU_FAMILY_RULES: readonly NpuFamilyRule[] = [
  {
    manufacturerPattern: MANUFACTURER_PATTERNS.rockchip,
    mfrPattern: /^RK1808/i,
    chipFamily: "Rockchip RK1808",
    npuName: "Rockchip NPU",
  },
  {
    manufacturerPattern: MANUFACTURER_PATTERNS.rockchip,
    mfrPattern: /^RK3399PRO/i,
    chipFamily: "Rockchip RK3399Pro",
    npuName: "Rockchip NPU",
  },
  ...["RK3562", "RK3566", "RK3568", "RK3576", "RK3588"].map(
    (family): NpuFamilyRule => ({
      manufacturerPattern: MANUFACTURER_PATTERNS.rockchip,
      mfrPattern: new RegExp(`^${family}`, "i"),
      chipFamily: `Rockchip ${family}`,
      npuName: "Rockchip NPU",
    }),
  ),
  ...["RV1103", "RV1106", "RV1109", "RV1126"].map(
    (family): NpuFamilyRule => ({
      manufacturerPattern: MANUFACTURER_PATTERNS.rockchip,
      mfrPattern: new RegExp(`^${family}`, "i"),
      chipFamily: `Rockchip ${family}`,
      npuName: "Rockchip NPU",
    }),
  ),
  ...["V831", "V833", "V851SE", "V851S", "V853S", "V853"].map(
    (family): NpuFamilyRule => ({
      manufacturerPattern: MANUFACTURER_PATTERNS.allwinner,
      mfrPattern: new RegExp(`^${family}`, "i"),
      chipFamily: `Allwinner ${family}`,
      npuName: "NPU",
    }),
  ),
  ...["R329-N3", "R329-N4"].map(
    (family): NpuFamilyRule => ({
      manufacturerPattern: MANUFACTURER_PATTERNS.allwinner,
      mfrPattern: new RegExp(`^${family}`, "i"),
      chipFamily: `Allwinner ${family}`,
      npuName: "Zhouyi Z1 AIPU",
      performanceTops: 0.25,
    }),
  ),
  {
    manufacturerPattern: MANUFACTURER_PATTERNS.allwinner,
    mfrPattern: /^T527M/i,
    chipFamily: "Allwinner T527",
    npuName: "NPU",
    performanceTops: 2,
  },
  {
    manufacturerPattern: MANUFACTURER_PATTERNS.nxp,
    mfrPattern: /^MIMX8ML/i,
    chipFamily: "NXP i.MX 8M Plus",
    npuName: "NPU",
  },
  {
    manufacturerPattern: MANUFACTURER_PATTERNS.nxp,
    mfrPattern: /^MIMX9352/i,
    chipFamily: "NXP i.MX 93",
    npuName: "Arm Ethos-U65",
    performanceTops: 0.5,
  },
  ...[
    "MCXN247",
    "MCXN526",
    "MCXN527",
    "MCXN536",
    "MCXN537",
    "MCXN546",
    "MCXN547",
    "MCXN946",
    "MCXN947",
  ].map(
    (family): NpuFamilyRule => ({
      manufacturerPattern: MANUFACTURER_PATTERNS.nxp,
      mfrPattern: new RegExp(`^${family}`, "i"),
      chipFamily: `NXP ${family}`,
      npuName: "eIQ Neutron",
    }),
  ),
  {
    manufacturerPattern: MANUFACTURER_PATTERNS.st,
    mfrPattern: /^STM32N657/i,
    chipFamily: "ST STM32N657",
    npuName: "Neural-ART",
  },
  {
    manufacturerPattern: MANUFACTURER_PATTERNS.st,
    mfrPattern: /^STM32MP257/i,
    chipFamily: "ST STM32MP257",
    npuName: "VeriSilicon NPU",
  },
  {
    manufacturerPattern: MANUFACTURER_PATTERNS.st,
    mfrPattern: /^STM32MP255[ACDF]A(?:I|J|K|L)3T?$/i,
    chipFamily: "ST STM32MP255",
    npuName: "VeriSilicon NPU",
  },
  {
    // JLCPCB can list consigned STM32MP255 parts under its assembly label
    // instead of the silicon manufacturer.
    manufacturerPattern: MANUFACTURER_PATTERNS.jlcAssembly,
    mfrPattern: /^STM32MP255[ACDF]A(?:I|J|K|L)3T?$/i,
    chipFamily: "ST STM32MP255",
    npuName: "VeriSilicon NPU",
  },
  {
    manufacturerPattern: MANUFACTURER_PATTERNS.himax,
    mfrPattern: /^HX6538/i,
    chipFamily: "Himax HX6538",
    npuName: "Ethos-U55",
  },
  {
    manufacturerPattern: MANUFACTURER_PATTERNS.amlogic,
    mfrPattern: /^A311D2/i,
    chipFamily: "Amlogic A311D2",
    npuName: "NPU",
  },
  {
    manufacturerPattern: MANUFACTURER_PATTERNS.amlogic,
    mfrPattern: /^A311D/i,
    chipFamily: "Amlogic A311D",
    npuName: "NPU",
  },
  {
    manufacturerPattern: MANUFACTURER_PATTERNS.amlogic,
    mfrPattern: /^C308X/i,
    chipFamily: "Amlogic C308X",
    npuName: "NPU",
  },
  {
    manufacturerPattern: MANUFACTURER_PATTERNS.canaan,
    mfrPattern: /^K210/i,
    chipFamily: "Canaan K210",
    npuName: "KPU",
    requiresProcessorEvidence: true,
  },
  {
    manufacturerPattern: MANUFACTURER_PATTERNS.canaan,
    mfrPattern: /^K230D/i,
    chipFamily: "Canaan K230D",
    npuName: "KPU",
  },
  {
    manufacturerPattern: MANUFACTURER_PATTERNS.canaan,
    mfrPattern: /^K230/i,
    chipFamily: "Canaan K230",
    npuName: "KPU",
  },
  {
    manufacturerPattern: MANUFACTURER_PATTERNS.sophgo,
    mfrPattern: /^CV1800B/i,
    chipFamily: "SOPHGO CV1800B",
    npuName: "TPU",
  },
  {
    manufacturerPattern: MANUFACTURER_PATTERNS.sophgo,
    mfrPattern: /^CV180ZB/i,
    chipFamily: "SOPHGO CV180ZB",
    npuName: "TPU",
  },
  {
    manufacturerPattern: MANUFACTURER_PATTERNS.sophgo,
    mfrPattern: /^CV181/i,
    chipFamily: "SOPHGO CV181x",
    npuName: "TPU",
  },
  {
    manufacturerPattern: MANUFACTURER_PATTERNS.sophgo,
    mfrPattern: /^CV182/i,
    chipFamily: "SOPHGO CV182x",
    npuName: "TPU",
  },
  ...["CV1835", "CV1838"].map(
    (family): NpuFamilyRule => ({
      manufacturerPattern: MANUFACTURER_PATTERNS.sophgo,
      mfrPattern: new RegExp(`^${family}`, "i"),
      chipFamily: `SOPHGO ${family}`,
      npuName: "TPU",
    }),
  ),
  {
    manufacturerPattern: MANUFACTURER_PATTERNS.sophgo,
    mfrPattern: /^SG2002/i,
    chipFamily: "SOPHGO SG2002",
    npuName: "TPU",
    requiresProcessorEvidence: true,
  },
  {
    manufacturerPattern: MANUFACTURER_PATTERNS.renesas,
    mfrPattern: /^R9A07G054/i,
    chipFamily: "Renesas RZ/V2L",
    npuName: "DRP-AI",
    performanceTops: 0.5,
  },
  ...["MAX78000", "MAX78002"].map(
    (family): NpuFamilyRule => ({
      manufacturerPattern: MANUFACTURER_PATTERNS.adi,
      mfrPattern: new RegExp(`^${family}`, "i"),
      chipFamily: `ADI ${family}`,
      npuName: "CNN accelerator",
    }),
  ),
  ...["AX620A", "AX630A", "AX630C"].map(
    (family): NpuFamilyRule => ({
      manufacturerPattern: MANUFACTURER_PATTERNS.axera,
      mfrPattern: new RegExp(`^${family}`, "i"),
      chipFamily: `Axera ${family}`,
      npuName: "AXNeutron",
    }),
  ),
  {
    manufacturerPattern: MANUFACTURER_PATTERNS.sigmastar,
    mfrPattern: /^SSC338Q/i,
    chipFamily: "SigmaStar SSC338Q",
    npuName: "DLA",
  },
  {
    manufacturerPattern: MANUFACTURER_PATTERNS.ti,
    mfrPattern: /^TDA4VM/i,
    chipFamily: "TI TDA4VM",
    npuName: "C7x NPU (MMA)",
    performanceTops: 8,
  },
  {
    manufacturerPattern: MANUFACTURER_PATTERNS.ti,
    mfrPattern: /^TDA4AH/i,
    chipFamily: "TI TDA4AH",
    npuName: "C7x NPU (MMAv2)",
    performanceTops: 32,
  },
  ...["TDA4VEN", "TDA4AEN"].map(
    (family): NpuFamilyRule => ({
      manufacturerPattern: MANUFACTURER_PATTERNS.ti,
      mfrPattern: new RegExp(`^${family}`, "i"),
      chipFamily: `TI ${family}`,
      npuName: "C7x NPU (MMA)",
      performanceTops: 4,
    }),
  ),
  {
    manufacturerPattern: MANUFACTURER_PATTERNS.ti,
    mfrPattern: /^AM62A7/i,
    chipFamily: "TI AM62A7",
    npuName: "C7x NPU (MMA)",
    performanceTops: 2,
  },
  {
    manufacturerPattern: MANUFACTURER_PATTERNS.ti,
    mfrPattern: /^AM62A3/i,
    chipFamily: "TI AM62A3",
    npuName: "C7x NPU (MMA)",
    performanceTops: 1,
  },
  {
    manufacturerPattern: MANUFACTURER_PATTERNS.ti,
    mfrPattern: /^AM69A/i,
    chipFamily: "TI AM69A",
    npuName: "C7x NPU (MMAv2)",
    performanceTops: 32,
  },
]

const FAMILY_MFR_CANDIDATE_PATTERNS = [
  "RK1808%",
  "RK3399PRO%",
  "RK3562%",
  "RK3566%",
  "RK3568%",
  "RK3576%",
  "RK3588%",
  "RV1103%",
  "RV1106%",
  "RV1109%",
  "RV1126%",
  "V831%",
  "V833%",
  "V851S%",
  "V853%",
  "R329-N3%",
  "R329-N4%",
  "T527M%",
  "MIMX8ML%",
  "MIMX9352%",
  "MCXN247%",
  "MCXN526%",
  "MCXN527%",
  "MCXN536%",
  "MCXN537%",
  "MCXN546%",
  "MCXN547%",
  "MCXN946%",
  "MCXN947%",
  "STM32N657%",
  "STM32MP257%",
  "STM32MP255%",
  "HX6538%",
  "A311D%",
  "C308X%",
  "K210%",
  "K230%",
  "CV1800B%",
  "CV180ZB%",
  "CV181%",
  "CV182%",
  "CV1835%",
  "CV1838%",
  "SG2002%",
  "R9A07G054%",
  "MAX78000%",
  "MAX78002%",
  "AX620A%",
  "AX630A%",
  "AX630C%",
  "SSC338Q%",
  "TDA4VM%",
  "TDA4AH%",
  "TDA4VEN%",
  "TDA4AEN%",
  "AM62A7%",
  "AM62A3%",
  "AM69A%",
] as const

const SEMANTIC_CANDIDATE_TERMS = [
  "npu",
  "neural processing unit",
  "neural accelerator",
  "neural network accelerator",
  "neural network hardware accelerator",
  "kpu",
  "tpu",
  "drp ai",
  "aipu",
  "cnn accelerator",
  "dla",
  "ethos u55",
  "ethos u65",
  "neural art",
  "eiq neutron",
  "axneutron",
  "rknn",
] as const

const SEMANTIC_ALIAS_RULES = [
  { pattern: /\bneural processing unit\b/i, name: "NPU" },
  {
    pattern: /\bneural network hardware accelerator\b/i,
    name: "Neural accelerator",
  },
  {
    pattern: /\bneural network accelerator\b/i,
    name: "Neural accelerator",
  },
  { pattern: /\bneural accelerator\b/i, name: "Neural accelerator" },
  { pattern: /\bneural[- ]art\b/i, name: "Neural-ART" },
  { pattern: /\beiq\s+neutron\b/i, name: "eIQ Neutron" },
  { pattern: /\bethos[- ]u55\b/i, name: "Ethos-U55" },
  { pattern: /\bethos[- ]u65\b/i, name: "Arm Ethos-U65" },
  { pattern: /\bcnn\s+accelerator\b/i, name: "CNN accelerator" },
  { pattern: /\bdrp[- ]ai\b/i, name: "DRP-AI" },
  { pattern: /\baxneutron\b/i, name: "AXNeutron" },
  { pattern: /\baipu\b/i, name: "AIPU" },
  { pattern: /\brknn\b/i, name: "RKNN" },
  { pattern: /\bkpu\b/i, name: "KPU" },
  { pattern: /\btpu\b/i, name: "TPU" },
  { pattern: /\bdla\b/i, name: "DLA" },
  { pattern: /\bnpu\b/i, name: "NPU" },
] as const

const EXCLUDED_MFR_PATTERNS = [
  /^RK3399(?!PRO)/i,
  /^STM32N655/i,
  /^ESP32-S3/i,
  /^R9A07G044/i,
] as const

const readExtra = (extra: string | null): Record<string, unknown> => {
  if (!extra) return {}
  try {
    const parsed = JSON.parse(extra)
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

const readAttributes = (
  extra: Record<string, unknown>,
): Record<string, unknown> => {
  const attributes = extra.attributes
  return attributes && typeof attributes === "object"
    ? (attributes as Record<string, unknown>)
    : {}
}

const readManufacturer = (extra: Record<string, unknown>): string | null => {
  const manufacturer = extra.manufacturer
  if (typeof manufacturer === "string" && manufacturer.trim()) {
    return manufacturer.trim()
  }
  if (manufacturer && typeof manufacturer === "object") {
    const name = (manufacturer as Record<string, unknown>).name
    if (typeof name === "string" && name.trim()) return name.trim()
  }

  const fallback = extra.manufacturer_name ?? extra.brand
  return typeof fallback === "string" && fallback.trim()
    ? fallback.trim()
    : null
}

const findSemanticAlias = (text: string): string | null => {
  if (/\bnetwork processing unit\b/i.test(text)) return null
  return (
    SEMANTIC_ALIAS_RULES.find((rule) => rule.pattern.test(text))?.name ?? null
  )
}

const hasProcessorEvidence = (component: {
  description: string
  package: string
  source_category?: string | null
  source_subcategory?: string | null
}): boolean => {
  const classificationText = [
    component.description,
    component.source_category,
    component.source_subcategory,
  ]
    .filter(Boolean)
    .join(" ")

  return (
    /\b(?:microcontrollers?|processors?|mpu|soc|system[- ]on[- ]chip)\b/i.test(
      classificationText,
    ) ||
    /(?:^|[-_])(?:BGA|FBGA|FCBGA|LFBGA|VFBGA|CTBGA|WLCSP|CSP|QFN|LGA)(?:[-_(]|\d|$)/i.test(
      component.package,
    )
  )
}

const parseNpuPerformanceTops = (
  attributes: Record<string, unknown>,
  description: string,
): number | null => {
  const explicitSources = Object.entries(attributes)
    .filter(
      ([key, value]) =>
        /(?:npu|neural|ai|kpu|tpu|drp|aipu|cnn|dla|ethos|neural.?art|eiq|axneutron|rknn|accelerator|performance|comput(?:e|ing)|tops|gops)/i.test(
          key,
        ) || /\b(?:tops|gops)\b/i.test(String(value)),
    )
    .map(([, value]) => String(value))

  if (/\b(?:tops|gops)\b/i.test(description)) {
    explicitSources.push(description)
  }

  const values: number[] = []
  for (const source of explicitSources) {
    for (const match of source.matchAll(
      /(\d[\d,]*(?:\.\d+)?)\s*(TOPS|GOPS)\b/gi,
    )) {
      const amount = Number(match[1]?.replaceAll(",", ""))
      if (!Number.isFinite(amount)) continue
      values.push(match[2]?.toUpperCase() === "GOPS" ? amount / 1000 : amount)
    }
  }

  return values.length > 0 ? Math.max(...values) : null
}

const normalizedSemanticSource = sql<string>`lower(
  ' ' ||
  replace(replace(replace(replace(replace(replace(replace(replace(replace(
    coalesce(components.description, '') || ' ' || coalesce(components.extra, ''),
    '-', ' '), '/', ' '), '(', ' '), ')', ' '), '"', ' '), ':', ' '),
    ',', ' '), ';', ' '), '_', ' ')
  || ' '
)`

export const npuChipTableSpec: DerivedTableSpec<NpuChip> = {
  tableName: "npu_chip",
  extraColumns: [
    { name: "package", type: "text" },
    { name: "manufacturer", type: "text" },
    { name: "chip_family", type: "text" },
    { name: "npu_name", type: "text" },
    { name: "npu_performance_tops", type: "real" },
    { name: "is_basic", type: "boolean" },
    { name: "is_preferred", type: "boolean" },
  ],
  indexes: [
    { name: "idx_npu_chip_stock", columns: ["stock"] },
    {
      name: "idx_npu_chip_package_stock",
      columns: ["package", "stock"],
    },
    {
      name: "idx_npu_chip_manufacturer_stock",
      columns: ["manufacturer", "stock"],
    },
    {
      name: "idx_npu_chip_family_stock",
      columns: ["chip_family", "stock"],
    },
    {
      name: "idx_npu_chip_npu_name_stock",
      columns: ["npu_name", "stock"],
    },
    {
      name: "idx_npu_chip_performance_stock",
      columns: ["npu_performance_tops", "stock"],
    },
    {
      name: "idx_npu_chip_is_basic_stock",
      columns: ["is_basic", "stock"],
    },
    {
      name: "idx_npu_chip_is_preferred_stock",
      columns: ["is_preferred", "stock"],
    },
  ],
  listCandidateComponents: (db) =>
    db
      .selectFrom("components")
      .innerJoin("categories", "components.category_id", "categories.id")
      .selectAll("components")
      .select([
        "categories.category as source_category",
        "categories.subcategory as source_subcategory",
      ])
      .where((eb) =>
        eb.or([
          ...FAMILY_MFR_CANDIDATE_PATTERNS.map((pattern) =>
            eb("components.mfr", "like", pattern),
          ),
          ...SEMANTIC_CANDIDATE_TERMS.map(
            (term) =>
              sql<boolean>`${normalizedSemanticSource} LIKE ${`% ${term} %`}`,
          ),
        ]),
      ),
  mapToTable: (components) =>
    components.map((component): NpuChip | null => {
      const extra = readExtra(component.extra)
      const attributes = readAttributes(extra)
      const manufacturer = readManufacturer(extra)
      if (!manufacturer) return null

      const mfr = String(component.mfr ?? "").trim()
      if (!mfr || EXCLUDED_MFR_PATTERNS.some((pattern) => pattern.test(mfr))) {
        return null
      }

      const packageName = String(component.package ?? "").trim()
      if (
        /^K210/i.test(mfr) &&
        /^(?:SOD|SOT|DO-|SM[ABCD]|TO-)(?:-|\b)/i.test(packageName)
      ) {
        return null
      }
      if (/^SG2002/i.test(mfr) && /^SOT-?23\b/i.test(packageName)) return null

      const sourceComponent = component as typeof component & {
        source_category?: string | null
        source_subcategory?: string | null
      }
      const processorEvidence = hasProcessorEvidence({
        description: String(component.description ?? ""),
        package: packageName,
        source_category: sourceComponent.source_category,
        source_subcategory: sourceComponent.source_subcategory,
      })

      const mfrRules = NPU_FAMILY_RULES.filter((rule) =>
        rule.mfrPattern.test(mfr),
      )
      const familyRule = mfrRules.find((rule) =>
        rule.manufacturerPattern.test(manufacturer),
      )

      // A known family prefix paired with the wrong manufacturer is a catalog
      // collision, not a semantic-evidence fallback candidate.
      if (mfrRules.length > 0 && !familyRule) return null
      if (familyRule?.requiresProcessorEvidence && !processorEvidence) {
        return null
      }

      const attributeText = Object.entries(attributes)
        .flatMap(([key, value]) => [key, String(value)])
        .join(" ")
      const semanticText = `${component.description ?? ""} ${attributeText}`
      const semanticAlias = findSemanticAlias(semanticText)

      if (!familyRule) {
        if (!semanticAlias || !processorEvidence) {
          return null
        }
      }

      return {
        lcsc: Number(component.lcsc),
        mfr,
        description: String(component.description ?? ""),
        stock: Number(component.stock ?? 0),
        price1: extractMinQPrice(component.price),
        in_stock: Number(component.stock ?? 0) > 0,
        is_basic: Boolean(component.basic),
        is_preferred: Boolean(component.preferred),
        package: packageName,
        manufacturer,
        chip_family: familyRule?.chipFamily ?? mfr,
        npu_name: familyRule?.npuName ?? semanticAlias!,
        npu_performance_tops:
          parseNpuPerformanceTops(
            attributes,
            String(component.description ?? ""),
          ) ??
          familyRule?.performanceTops ??
          null,
        attributes: Object.fromEntries(
          Object.entries(attributes).map(([key, value]) => [
            key,
            String(value),
          ]),
        ),
      }
    }),
}
