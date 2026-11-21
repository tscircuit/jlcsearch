const SI_PREFIXES = [
  { value: 1e12, symbol: "T" },
  { value: 1e9, symbol: "G" },
  { value: 1e6, symbol: "M" },
  { value: 1e3, symbol: "k" },
  { value: 1, symbol: "" },
  { value: 1e-3, symbol: "m" },
  { value: 1e-6, symbol: "µ" },
  { value: 1e-9, symbol: "n" },
  { value: 1e-12, symbol: "p" },
]

export function formatSiUnit(value?: number | null): string {
  if (value == null) return ""
  if (value === 0) return "0"

  const prefixIndex = SI_PREFIXES.findIndex((p) => Math.abs(value) >= p.value)
  let index = prefixIndex === -1 ? SI_PREFIXES.length - 1 : prefixIndex
  let scaled = value / SI_PREFIXES[index].value

  // Rounding to 3 significant figures can push the scaled magnitude up to the next
  // prefix: 999_999 scales to 999.999 under "k", which toPrecision(3) renders as
  // "1.00e+3", producing "1.00e+3k" instead of "1M". Step up a prefix so the value
  // stays in [1, 1000) after rounding.
  if (Math.abs(scaled) >= 999.5 && index > 0) {
    index -= 1
    scaled = value / SI_PREFIXES[index].value
  }

  // Format number to at most 3 significant digits
  const formatted = scaled.toPrecision(3).replace(/\.0+$/, "")

  return `${formatted}${SI_PREFIXES[index].symbol}`
}
