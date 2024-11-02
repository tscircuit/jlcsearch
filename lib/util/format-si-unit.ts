const SI_PREFIXES = [
  { value: 1e12, symbol: 'T' },
  { value: 1e9, symbol: 'G' },
  { value: 1e6, symbol: 'M' },
  { value: 1e3, symbol: 'k' },
  { value: 1, symbol: '' },
  { value: 1e-3, symbol: 'm' },
  { value: 1e-6, symbol: 'µ' },
  { value: 1e-9, symbol: 'n' },
  { value: 1e-12, symbol: 'p' }
]

export function formatSiUnit(value: number): string {
  if (value === 0) return '0'
  
  const prefix = SI_PREFIXES.find(p => Math.abs(value) >= p.value) || SI_PREFIXES[SI_PREFIXES.length - 1]
  const scaled = value / prefix.value
  
  // Format number to at most 3 significant digits
  const formatted = scaled.toPrecision(3).replace(/\.?0+$/, '')
  
  return `${formatted}${prefix.symbol}`
}
