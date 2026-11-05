import { matchesProcessorSpec } from "./linux-processor-specs"

export interface ProcessorMemoryRule {
  family: string
  parts: string[]
  sram_size_bytes: number | null
  integrated_dram_size_bytes: number | null
}

const memory = (
  family: string,
  parts: string[],
  sramKiB: number | null,
  dramMiB: number | null,
): ProcessorMemoryRule => ({
  family,
  parts,
  sram_size_bytes: sramKiB === null ? null : sramKiB * 1024,
  integrated_dram_size_bytes: dramMiB === null ? null : dramMiB * 1024 ** 2,
})

/** Audited capacities only; never read the ambiguous catalog "RAM Size" field.
 * null = unverified; 0 DRAM = verified external DRAM design.
 * SRAM excludes caches and is not a promise of Linux-usable memory.
 * Part-specific evidence and SRAM bank definitions: docs/linux-processor-memory.md.
 * These rules run only after the manufacturer-aware processor classifier.
 */
export const LINUX_PROCESSOR_MEMORY_RULES: readonly ProcessorMemoryRule[] = [
  memory("Allwinner F1C100S", ["F1C100S"], null, 32),
  memory("Allwinner F1C200S", ["F1C200S"], null, 64),
  memory("Allwinner V3S", ["V3S"], null, 64),
  memory("Allwinner F133", ["F133-A", "F133-B"], null, 64),
  memory("Allwinner D1", ["D1S"], null, 64),
  memory("Allwinner T113", ["T113-S3"], null, 128),
  memory("Allwinner H3", ["H3"], null, 0),
  memory("Rockchip RV1103", ["RV1103G1"], null, 64),
  memory("Rockchip RV1106", ["RV1106G2"], null, 128),
  memory("Rockchip RV1106", ["RV1106G3"], null, 256),
  memory("Rockchip RK3506", ["RK3506G1"], null, 64),
  memory("Rockchip RK3506", ["RK3506G2"], null, 128),
  memory("Rockchip RK3506", ["RK3506B", "RK3506J"], null, 0),
  memory("ST STM32MP1", ["STM32MP13[135]*"], 168, 0),
  memory("ST STM32MP1", ["STM32MP15[137]*"], 708, 0),
  memory("NXP i.MX 6UltraLite/ULL", ["MCIMX6Y*", "MIMX6Y*"], 128, 0),
  memory("NXP i.MX 8M Mini", ["MIMX8MM[1-6]*"], 288, 0),
  memory("NXP i.MX 8M Nano", ["MIMX8MN[1-6]*"], 544, 0),
  memory("TI Sitara AM335x", ["AM335[1246789]*"], null, 0),
  memory("TI Sitara AM437x", ["AM437[26789]*"], null, 0),
  memory("TI Sitara AM62x", ["AM62[35][124][AB]*"], null, 0),
  memory("TI Sitara AM64x", ["AM64[124][12][AB]*"], null, 0),
  memory("Microchip SAMA5", ["ATSAMA5D3[13456]*", "SAMA5D3[13456]*"], 128, 0),
  // SAMA5D2 can package DRAM; do not infer its absence from the family.
  memory("Microchip SAMA5", ["ATSAMA5D2[3678]*", "SAMA5D2[3678]*"], 128, null),
  memory("Microchip SAM9", ["SAM9X60D5M-*", "SAM9X60D5MT-*"], 68, 64),
  memory("Microchip SAM9", ["SAM9X60D1G-*", "SAM9X60D1GT-*"], 68, 128),
  memory("Canaan K230", ["K230D"], 4096, 128),
  memory("Canaan K230", ["K230"], 4096, 0),
]

export const getLinuxProcessorMemory = (family: string, mfr: string) => {
  const match = LINUX_PROCESSOR_MEMORY_RULES.find((rule) =>
    matchesProcessorSpec(rule, family, mfr),
  )
  return {
    sram_size_bytes: match?.sram_size_bytes ?? null,
    integrated_dram_size_bytes: match?.integrated_dram_size_bytes ?? null,
  }
}
