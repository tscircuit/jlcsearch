/** Parse a single positive catalog frequency, never a range or description.
 * Bare numbers are accepted only for query input, where the unit is Hz.
 */
export const parseFrequencyHz = (
  value: unknown,
  allowBareHz = false,
): number | null => {
  if (typeof value !== "string") return null
  const match = value.trim().match(/^(\d+(?:\.\d+)?|\.\d+)\s*(Hz|kHz|MHz)?$/i)
  if (!match || (!match[2] && !allowBareHz)) return null
  const unit = match[2]?.toLowerCase()
  const multiplier = unit === "mhz" ? 1e6 : unit === "khz" ? 1e3 : 1
  const hz = Number(match[1]) * multiplier
  return Number.isFinite(hz) && hz > 0 && hz <= Number.MAX_SAFE_INTEGER
    ? hz
    : null
}
