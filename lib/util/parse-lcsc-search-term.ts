export const parseLcscSearchTerm = (searchTerm: string): number | null => {
  const trimmedSearchTerm = searchTerm.trim()
  const match = /^c?(\d+)$/i.exec(trimmedSearchTerm)

  if (!match) return null

  const lcscNumber = Number.parseInt(match[1], 10)
  return Number.isNaN(lcscNumber) ? null : lcscNumber
}
