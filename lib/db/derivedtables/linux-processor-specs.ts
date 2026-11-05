/** Application CPU specifications, after the Linux processor classifier has matched.
 * GLOB patterns are shared with the generated D1 backfill. Evidence and semantics:
 * docs/generated/linux_capable_processors.md. Unknown variants stay null.
 */
export interface ProcessorSpecRule {
  family: string
  parts: string[]
  cores: number
  speedHz?: number
}

const rule = (
  family: string,
  parts: string[],
  cores: number,
  speedHz?: number,
): ProcessorSpecRule => ({ family, parts, cores, speedHz })

export const LINUX_PROCESSOR_SPEC_RULES: readonly ProcessorSpecRule[] = [
  rule("Allwinner V3S", ["V3S"], 1, 1.2e9),
  rule("Rockchip RK3568", ["RK3568", "RK3568B2"], 4, 2e9),
  ...[
    ["F1C100S", 1],
    ["F1C200S", 1],
    ["A10", 1],
    ["A13", 1],
    ["A20", 2],
    ["A33", 4],
    ["H3", 4],
    ["V3S", 1],
    ["A64", 4],
    ["H5", 4],
    ["H6", 4],
    ["H616", 4],
    ["H618", 4],
    ["A133", 4],
    ["T507", 4],
    ["T527", 8],
    ["T113", 2],
    ["D1", 1],
    ["F133", 1],
  ].map(([part, cores]) => rule(`Allwinner ${part}`, ["*"], Number(cores))),
  ...[
    ["RK3036", 2],
    ["RK3066", 2],
    ["RK3188", 4],
    ["RK3288", 4],
    ["RK3308", 4],
    ["RK3328", 4],
    ["RK3368", 8],
    ["RK3399", 6],
    ["RK3506", 3],
    ["RK3562", 4],
    ["RK3566", 4],
    ["RK3568", 4],
    ["RK3576", 8],
    ["RK3588", 8],
    ["RV1109", 2],
    ["RV1126", 4],
    ["RV1126B", 4],
  ].map(([part, cores]) => rule(`Rockchip ${part}`, ["*"], Number(cores))),
  rule("Rockchip RV1103", ["*"], 1, 1.2e9),
  rule("Rockchip RV1106", ["*"], 1, 1.2e9),
  rule("ST STM32MP1", ["STM32MP13*", "STM32MP151*"], 1),
  rule("ST STM32MP1", ["STM32MP153*", "STM32MP157*"], 2),
  rule("ST STM32MP2", ["STM32MP21*", "STM32MP231*", "STM32MP251*"], 1),
  rule("ST STM32MP2", ["STM32MP23[35]*", "STM32MP25[357]*"], 2),
  rule("NXP i.MX 6UltraLite/ULL", ["*"], 1),
  rule("NXP i.MX 6", ["M?IMX6Q*", "MIMX6Q*"], 4),
  rule("NXP i.MX 6", ["M?IMX6D*", "MIMX6D*", "M?IMX6U*", "MIMX6U*"], 2),
  rule("NXP i.MX 6", ["M?IMX6S*", "MIMX6S*", "M?IMX6L*", "MIMX6L*"], 1),
  rule("NXP i.MX 7", ["M?IMX7D*", "MIMX7D*"], 2),
  rule("NXP i.MX 7", ["M?IMX7S*", "MIMX7S*"], 1),
  rule("NXP i.MX 8M Mini", ["MIMX8MM[56]*"], 4),
  rule("NXP i.MX 8M Mini", ["MIMX8MM[34]*"], 2),
  rule("NXP i.MX 8M Mini", ["MIMX8MM[12]*"], 1),
  rule("NXP i.MX 8M Nano", ["MIMX8MN[56]*"], 4),
  rule("NXP i.MX 8M Nano", ["MIMX8MN[34]*"], 2),
  rule("NXP i.MX 8M Nano", ["MIMX8MN[12]*"], 1),
  rule("NXP i.MX 8M Quad", ["MIMX8MQ[56]*"], 4),
  rule("NXP i.MX 8M Quad", ["MIMX8MQ3*"], 2),
  rule("NXP i.MX 8M Plus", ["MIMX8ML[468]*"], 4),
  rule("NXP i.MX 8M Plus", ["MIMX8ML2*"], 2),
  rule("NXP i.MX 91", ["*"], 1),
  rule("TI Sitara AM335x", ["*"], 1),
  rule("TI Sitara AM437x", ["*"], 1),
  rule("TI Sitara AM57x", ["AM570*", "AM571*"], 1),
  rule("TI Sitara AM57x", ["AM572*", "AM574*"], 2),
  ...[1, 2, 4].map((cores) =>
    rule("TI Sitara AM62x", [`AM62[35]${cores}*`], cores),
  ),
  ...[1, 2].map((cores) =>
    rule("TI Sitara AM64x", [`AM64[124]${cores}*`], cores),
  ),
  rule("Microchip SAM9", ["*"], 1),
  rule("Microchip SAMA5", ["*"], 1),
  // Both C908 CPUs are application-class cores, even when an SDK assigns one to RTOS.
  rule("Canaan K230", ["K230", "K230D"], 2, 1.6e9),
]

export const matchesProcessorSpec = (
  rule: Pick<ProcessorSpecRule, "family" | "parts">,
  family: string,
  mfr: string,
) =>
  rule.family === family &&
  rule.parts.some((pattern) =>
    new RegExp(`^${pattern.replaceAll("*", ".*").replaceAll("?", ".")}$`).test(
      mfr.trim().toUpperCase(),
    ),
  )

export const parseProcessorSpeed = (value: unknown): number | null => {
  if (typeof value !== "string") return null
  const speeds = value
    .toLowerCase()
    .replace(/[ \t\r\n]/g, "")
    .split(/[;,、]/)
    .map((token) => {
      const match = /^(\d+(?:\.\d+)?)([gmk]?)hz$/.exec(token)
      if (!match) return 0
      return (
        Number(match[1]) * ({ g: 1e9, m: 1e6, k: 1e3, "": 1 }[match[2]!] ?? 0)
      )
    })
    .filter((speed) => speed > 0 && speed <= 10e9)
  return speeds.length ? Math.max(...speeds) : null
}

export const getLinuxProcessorSpecs = (
  family: string,
  mfr: string,
  attributes: Record<string, unknown>,
) => {
  const spec = LINUX_PROCESSOR_SPEC_RULES.find((rule) =>
    matchesProcessorSpec(rule, family, mfr),
  )
  // The catalog's RK3506 24 MHz value describes the oscillator, not the CPU.
  const catalogSpeed = parseProcessorSpeed(attributes["CPU Maximum Speed"])
  const speed =
    family === "Rockchip RK3506" && catalogSpeed === 24e6 ? null : catalogSpeed
  return {
    cpu_core_count: spec?.cores ?? null,
    cpu_speed_hz: speed ?? spec?.speedHz ?? null,
  }
}
