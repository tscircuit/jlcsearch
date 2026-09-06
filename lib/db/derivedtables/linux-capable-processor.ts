import { extractMinQPrice } from "lib/util/extract-min-quantity-price"
import type { BaseComponent } from "./component-base"
import type { DerivedTableSpec } from "./types"

export interface LinuxCapableProcessor extends BaseComponent {
  package: string
  manufacturer: string
  chip_family: string
  architecture: string
  cpu_core: string
}

interface LinuxProcessorFamilyRule {
  manufacturerPattern: RegExp
  mfrPattern: RegExp
  candidatePatterns: string[]
  chipFamily: string
  architecture: "ARM32" | "ARM64" | "RISC-V64"
  cpuCore: string
}

const manufacturers = {
  allwinner: /(?:\ballwinner\b|全志)/i,
  rockchip: /(?:\brockchip\b|瑞芯微)/i,
  st: /\b(?:st\s*micro(?:electronics)?|stmicroelectronics)\b/i,
  nxp: /\b(?:nxp|freescale)\b/i,
  ti: /(?:\b(?:ti|texas instruments)\b|德州仪器)/i,
  microchip: /\b(?:microchip|atmel)\b/i,
  canaan: /\b(?:canaan|kendryte)\b/i,
  sophgo: /\b(?:sophgo|cvitek)\b/i,
} as const

const family = (
  manufacturer: keyof typeof manufacturers,
  prefix: string,
  cpuCore: string,
  architecture: LinuxProcessorFamilyRule["architecture"],
  mfrPattern = new RegExp(
    `^${prefix}(?:[A-Z][A-Z0-9]*)?(?:[-+][A-Z0-9]+)*$`,
    "i",
  ),
): LinuxProcessorFamilyRule => ({
  manufacturerPattern: manufacturers[manufacturer],
  mfrPattern,
  candidatePatterns: [`${prefix}%`],
  chipFamily: `${
    {
      allwinner: "Allwinner",
      rockchip: "Rockchip",
      st: "ST",
      nxp: "NXP",
      ti: "TI",
      microchip: "Microchip",
      canaan: "Canaan",
      sophgo: "SOPHGO",
    }[manufacturer]
  } ${prefix}`,
  architecture,
  cpuCore,
})

/**
 * Curated processors with an MMU and documented Linux support. Neither an ARM
 * or RISC-V label nor "Linux" in a description is sufficient. Match the chip
 * MPN and its silicon manufacturer; reject modules and discrete collisions.
 * Sources and the coverage policy: docs/generated/linux_capable_processors.md.
 * cpuCore identifies the application CPU, not auxiliary real-time cores.
 */
export const LINUX_PROCESSOR_FAMILY_RULES: readonly LinuxProcessorFamilyRule[] =
  [
    ...["F1C100S", "F1C200S"].map((part) =>
      family(
        "allwinner",
        part,
        "ARM926EJ-S",
        "ARM32",
        new RegExp(`^${part}$`, "i"),
      ),
    ),
    ...["A10", "A13"].map((part) =>
      family(
        "allwinner",
        part,
        "Cortex-A8",
        "ARM32",
        new RegExp(`^${part}$`, "i"),
      ),
    ),
    ...["A20", "A33", "H3", "V3S"].map((part) =>
      family(
        "allwinner",
        part,
        "Cortex-A7",
        "ARM32",
        new RegExp(`^${part}$`, "i"),
      ),
    ),
    family(
      "allwinner",
      "T113",
      "Cortex-A7",
      "ARM32",
      /^T113(?:-(?:S[34]|I))?$/i,
    ),
    ...["A64", "H5", "H6", "H616", "H618", "A133", "T507"].map((part) =>
      family(
        "allwinner",
        part,
        "Cortex-A53",
        "ARM64",
        new RegExp(`^${part}$`, "i"),
      ),
    ),
    family(
      "allwinner",
      "T527",
      "Cortex-A55",
      "ARM64",
      /^T527(?:M[A-Z0-9]*)?$/i,
    ),
    family("allwinner", "D1", "XuanTie C906", "RISC-V64", /^D1(?:S|-H)?$/i),
    family(
      "allwinner",
      "F133",
      "XuanTie C906",
      "RISC-V64",
      /^F133(?:-[AB])?$/i,
    ),
    family("rockchip", "RK3036", "Cortex-A7", "ARM32"),
    ...["RK3066", "RK3188"].map((part) =>
      family("rockchip", part, "Cortex-A9", "ARM32"),
    ),
    family("rockchip", "RK3288", "Cortex-A17", "ARM32"),
    ...["RK3308", "RK3328", "RK3368"].map((part) =>
      family("rockchip", part, "Cortex-A53", "ARM64"),
    ),
    family("rockchip", "RK3399", "Cortex-A72 + Cortex-A53", "ARM64"),
    family("rockchip", "RK3506", "Cortex-A7", "ARM32"),
    ...["RK3562", "RK3566", "RK3568"].map((part) =>
      family("rockchip", part, "Cortex-A55", "ARM64"),
    ),
    family("rockchip", "RK3576", "Cortex-A72 + Cortex-A53", "ARM64"),
    family("rockchip", "RK3588", "Cortex-A76 + Cortex-A55", "ARM64"),
    ...["RV1103", "RV1106", "RV1109"].map((part) =>
      family("rockchip", part, "Cortex-A7", "ARM32"),
    ),
    // RV1126B is a newer Cortex-A53 design; check it before the original RV1126.
    family("rockchip", "RV1126B", "Cortex-A53", "ARM64"),
    family("rockchip", "RV1126", "Cortex-A7", "ARM32", /^RV1126$/i),
    {
      ...family("st", "STM32MP1", "Cortex-A7", "ARM32"),
      mfrPattern: /^STM32MP1(?:3[135]|5[137])[A-Z][A-Z0-9]*$/i,
    },
    {
      ...family("st", "STM32MP2", "Cortex-A35", "ARM64"),
      mfrPattern: /^STM32MP2(?:[13][135]|5[1357])[A-Z][A-Z0-9]*$/i,
    },
    {
      ...family("nxp", "i.MX 6UltraLite/ULL", "Cortex-A7", "ARM32"),
      mfrPattern: /^M(?:C)?IMX6[GY][A-Z0-9]+$/i,
      candidatePatterns: ["MCIMX6%", "MIMX6%"],
    },
    {
      ...family("nxp", "i.MX 6", "Cortex-A9", "ARM32"),
      mfrPattern: /^M(?:C)?IMX6[DLQSU][A-Z0-9]+$/i,
      candidatePatterns: ["MCIMX6%", "MIMX6%"],
    },
    {
      ...family("nxp", "i.MX 7", "Cortex-A7", "ARM32"),
      mfrPattern: /^M(?:C)?IMX7[DSU][A-Z0-9]+$/i,
      candidatePatterns: ["MCIMX7%", "MIMX7%"],
    },
    ...[
      ["MIMX8MM", "i.MX 8M Mini"],
      ["MIMX8MN", "i.MX 8M Nano"],
      ["MIMX8MQ", "i.MX 8M Quad"],
      ["MIMX8ML", "i.MX 8M Plus"],
    ].map(
      ([prefix, name]): LinuxProcessorFamilyRule => ({
        ...family(
          "nxp",
          prefix!,
          "Cortex-A53",
          "ARM64",
          new RegExp(`^${prefix}[0-9][A-Z0-9]+$`, "i"),
        ),
        chipFamily: `NXP ${name}`,
      }),
    ),
    ...[
      ["MIMX91", "i.MX 91"],
      ["MIMX93", "i.MX 93"],
      ["MIMX95", "i.MX 95"],
    ].map(
      ([prefix, name]): LinuxProcessorFamilyRule => ({
        ...family(
          "nxp",
          prefix!,
          "Cortex-A55",
          "ARM64",
          new RegExp(`^${prefix}[0-9][A-Z0-9]+$`, "i"),
        ),
        chipFamily: `NXP ${name}`,
      }),
    ),
    ...[
      ["AM335", "Cortex-A8", "ARM32"],
      ["AM437", "Cortex-A9", "ARM32"],
      ["AM57", "Cortex-A15", "ARM32"],
      ["AM62", "Cortex-A53", "ARM64"],
      ["AM64", "Cortex-A53", "ARM64"],
      ["AM65", "Cortex-A53", "ARM64"],
    ].map(
      ([prefix, core, architecture]): LinuxProcessorFamilyRule => ({
        ...family("ti", prefix!, core!, architecture as "ARM32" | "ARM64"),
        // AM62A/AM62P are A53 designs too. Do not admit Cortex-R AM24/AM26 MCUs.
        mfrPattern: new RegExp(
          `^${prefix}${prefix === "AM62" ? "(?:[0-9]|[AP][0-9])" : "[0-9]"}[A-Z0-9]*(?:-Q1)?$`,
          "i",
        ),
        chipFamily: `TI Sitara ${prefix}x`,
      }),
    ),
    {
      ...family("microchip", "SAM9", "ARM926EJ-S", "ARM32"),
      mfrPattern:
        /^(?:AT91|AT)?SAM9(?:260|261|263|G10|G15|G20|G25|G35|G45|G46|M10|M11|N12|CN11|CN12|X25|X35|X60|X70|X72|X75)[A-Z0-9]*(?:[-/][A-Z0-9]+)*$/i,
      candidatePatterns: ["AT91SAM9%", "ATSAM9%", "SAM9%"],
    },
    {
      ...family("microchip", "SAMA5", "Cortex-A5", "ARM32"),
      mfrPattern: /^(?:AT)?SAMA5D[234][0-9][A-Z0-9]*(?:-[A-Z0-9]+)*$/i,
      candidatePatterns: ["ATSAMA5%", "SAMA5%"],
    },
    family("canaan", "K230", "XuanTie C908", "RISC-V64", /^K230D?$/i),
    family("sophgo", "CV1800B", "XuanTie C906", "RISC-V64", /^CV1800B$/i),
    family("sophgo", "SG2002", "XuanTie C906", "RISC-V64", /^SG2002$/i),
  ]

const readObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

const readExtra = (value: string | null): Record<string, unknown> => {
  try {
    return readObject(JSON.parse(value ?? "{}"))
  } catch {
    return {}
  }
}

const readManufacturer = (extra: Record<string, unknown>): string | null => {
  const values = [
    extra.manufacturer,
    readObject(extra.manufacturer).name,
    extra.manufacturer_name,
    extra.brand,
  ]
  return (
    values
      .find(
        (value): value is string =>
          typeof value === "string" && Boolean(value.trim()),
      )
      ?.trim() ?? null
  )
}

const candidatePatterns = [
  ...new Set(
    LINUX_PROCESSOR_FAMILY_RULES.flatMap((rule) => rule.candidatePatterns),
  ),
]

export const linuxCapableProcessorTableSpec: DerivedTableSpec<LinuxCapableProcessor> =
  {
    tableName: "linux_capable_processor",
    extraColumns: [
      { name: "package", type: "text" },
      { name: "manufacturer", type: "text" },
      { name: "chip_family", type: "text" },
      { name: "architecture", type: "text" },
      { name: "cpu_core", type: "text" },
      { name: "is_basic", type: "boolean" },
      { name: "is_preferred", type: "boolean" },
    ],
    indexes: [
      { name: "idx_linux_capable_processor_stock", columns: ["stock"] },
      {
        name: "idx_linux_capable_processor_package_stock",
        columns: ["package", "stock"],
      },
      {
        name: "idx_linux_capable_processor_manufacturer_stock",
        columns: ["manufacturer", "stock"],
      },
      {
        name: "idx_linux_capable_processor_family_stock",
        columns: ["chip_family", "stock"],
      },
      {
        name: "idx_linux_capable_processor_architecture_stock",
        columns: ["architecture", "stock"],
      },
      {
        name: "idx_linux_capable_processor_cpu_core_stock",
        columns: ["cpu_core", "stock"],
      },
      {
        name: "idx_linux_capable_processor_is_basic_stock",
        columns: ["is_basic", "stock"],
      },
      {
        name: "idx_linux_capable_processor_is_preferred_stock",
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
          eb.or(
            candidatePatterns.map((pattern) =>
              eb("components.mfr", "like", pattern),
            ),
          ),
        ),
    mapToTable: (components) =>
      components.map((component): LinuxCapableProcessor | null => {
        const extra = readExtra(component.extra)
        const manufacturer = readManufacturer(extra)
        if (!manufacturer) return null
        const mfr = String(component.mfr ?? "").trim()
        const rule = LINUX_PROCESSOR_FAMILY_RULES.find(
          (rule) =>
            rule.mfrPattern.test(mfr) &&
            rule.manufacturerPattern.test(manufacturer),
        )
        if (!rule) return null

        const packageName = String(component.package ?? "").trim()
        const description = String(component.description ?? "")
        const source = component as typeof component & {
          source_category?: string
          source_subcategory?: string
        }
        const classification = [
          description,
          source.source_category,
          source.source_subcategory,
        ]
          .filter(Boolean)
          .join(" ")
        if (
          /^(?:SOD|SOT|DO-|SM[ABCD]|TO-|MODULE)/i.test(packageName) ||
          /\b(?:diodes?|transistors?|development boards?|evaluation (?:boards?|kits?)|system[- ]on[- ]modules?|compute modules?)\b/i.test(
            classification,
          ) ||
          /(?:^|[-_])(?:SOM|EK|EVK|EVB|EVM|DK)(?:[-_]|[0-9]|$)/i.test(mfr)
        )
          return null
        if (
          !/\b(?:microcontrollers?|processors?|mpu|soc|system[- ]on[- ]chip)\b/i.test(
            classification,
          ) &&
          !/^(?:[A-Z]*BGA|[A-Z]*QFN|[A-Z]*QFP|[A-Z]*CSP|LGA)(?:[-_(]|[0-9]|$)/i.test(
            packageName,
          )
        )
          return null

        return {
          lcsc: Number(component.lcsc),
          mfr,
          description,
          stock: Number(component.stock ?? 0),
          price1: extractMinQPrice(component.price),
          in_stock: Number(component.stock ?? 0) > 0,
          is_basic: Boolean(component.basic),
          is_preferred: Boolean(component.preferred),
          package: packageName,
          manufacturer,
          chip_family: rule.chipFamily,
          architecture: rule.architecture,
          cpu_core: rule.cpuCore,
          attributes: Object.fromEntries(
            Object.entries(readObject(extra.attributes)).map(([key, value]) => [
              key,
              String(value),
            ]),
          ),
        }
      }),
  }
