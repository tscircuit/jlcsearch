export type SearchTokenGroup = string[]

export const tokenizeSearchTerm = (term: string): string[] =>
  term.toLowerCase().match(/[a-z0-9]+/g) ?? []

const barrelJackWords = new Set([
  "jack",
  "jacks",
  "connector",
  "connectors",
  "socket",
  "sockets",
  "receptacle",
  "receptacles",
  "plug",
  "plugs",
])

const isVoltageToken = (token: string): boolean =>
  /^\d+(?:\.\d+)?v(?:olts?)?$/.test(token)

const uniqueGroups = (groups: SearchTokenGroup[]): SearchTokenGroup[] => {
  const seen = new Set<string>()
  const result: SearchTokenGroup[] = []

  for (const group of groups) {
    const uniqueTokens = Array.from(new Set(group)).filter(Boolean)
    if (uniqueTokens.length === 0) continue

    const key = uniqueTokens.join("\0")
    if (seen.has(key)) continue

    seen.add(key)
    result.push(uniqueTokens)
  }

  return result
}

export const buildSearchTokenGroups = (term: string): SearchTokenGroup[] => {
  const tokens = tokenizeSearchTerm(term)
  const hasBarrelJack =
    tokens.includes("barrel") &&
    tokens.some((token) => barrelJackWords.has(token))

  if (!hasBarrelJack) {
    return tokens.map((token) => [token])
  }

  const remainingTokens = tokens.filter(
    (token) =>
      token !== "barrel" &&
      !barrelJackWords.has(token) &&
      !isVoltageToken(token),
  )

  return uniqueGroups([
    ...remainingTokens.map((token) => [token]),
    ["dc"],
    ["power"],
    ["receptacle"],
  ])
}
