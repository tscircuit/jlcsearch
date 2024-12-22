export const parseIntOrNull = (
  value: string | number | null
): number | null => {
  if (value === null) return null
  const parsed = Number(value)
  return Number.isNaN(parsed) ? null : parsed
}
