interface DisplayDriverResolutionSource {
  mfr?: string | null
  description?: string | null
  extra?: string | null
}

interface Resolution {
  width: number
  height: number
}

const DISPLAY_CONFIGURATION_KEYS = [
  "Display Configurations(bit)",
  "Display Configurations",
  "Display Configuration",
  "Max Resolution",
  "Resolution",
] as const

// These catalog rows do not include resolution attributes. The values come
// from the datasheets linked by their database records.
const TFT_CONTROLLER_MAX_RESOLUTIONS = [
  { pattern: /^SSD1963/i, resolution: "864x480" },
  { pattern: /^LT7680/i, resolution: "1280x1024" },
  { pattern: /^LT7681/i, resolution: "640x480" },
  { pattern: /^LT7683/i, resolution: "1024x768" },
  { pattern: /^LT7686/i, resolution: "1280x1024" },
  { pattern: /^LT7689/i, resolution: "1280x1024" },
] as const

const parseExtraAttributes = (
  extra: string | null | undefined,
): Record<string, unknown> => {
  if (!extra) return {}

  try {
    const parsed = JSON.parse(extra)
    return parsed?.attributes && typeof parsed.attributes === "object"
      ? parsed.attributes
      : {}
  } catch {
    return {}
  }
}

const extractResolutions = (value: unknown): Resolution[] => {
  if (typeof value !== "string") return []

  const resolutions: Resolution[] = []
  for (const match of value.matchAll(/(\d{1,4})\s*[x×*]\s*(\d{1,4})/gi)) {
    const width = Number(match[1])
    const height = Number(match[2])
    if (width > 0 && height > 0) {
      resolutions.push({ width, height })
    }
  }
  return resolutions
}

const getLargestResolution = (
  resolutions: Resolution[],
): Resolution | undefined =>
  [...resolutions].sort(
    (a, b) =>
      b.width * b.height - a.width * a.height ||
      b.width - a.width ||
      b.height - a.height,
  )[0]

const formatResolution = (resolution: Resolution): string =>
  `${resolution.width}x${resolution.height}`

export const getDisplayDriverMaxResolution = ({
  mfr,
  description,
  extra,
}: DisplayDriverResolutionSource): string => {
  const attributes = parseExtraAttributes(extra)
  const attributeResolutions = DISPLAY_CONFIGURATION_KEYS.flatMap((key) =>
    extractResolutions(attributes[key]),
  )
  const largestAttributeResolution = getLargestResolution(attributeResolutions)
  if (largestAttributeResolution) {
    return formatResolution(largestAttributeResolution)
  }

  // Descriptions can also contain package dimensions (for example 14x14), so
  // only accept dimensions explicitly identified as a bit configuration.
  const descriptionResolutions = Array.from(
    description?.matchAll(/(\d{1,4})\s*[x×*]\s*(\d{1,4})\s*bit/gi) ?? [],
    (match) => ({
      width: Number(match[1]),
      height: Number(match[2]),
    }),
  )
  const largestDescriptionResolution = getLargestResolution(
    descriptionResolutions,
  )
  if (largestDescriptionResolution) {
    return formatResolution(largestDescriptionResolution)
  }

  return (
    TFT_CONTROLLER_MAX_RESOLUTIONS.find(({ pattern }) =>
      pattern.test(mfr ?? ""),
    )?.resolution ?? ""
  )
}

const normalizeMfr = (mfr: string | null | undefined): string =>
  (mfr ?? "").toUpperCase().replaceAll(/[^A-Z0-9]/g, "")

export const createDisplayDriverMaxResolutionResolver = (
  rows: DisplayDriverResolutionSource[],
): ((row: DisplayDriverResolutionSource) => string) => {
  const resolvedSources = rows
    .map((row) => ({
      normalizedMfr: normalizeMfr(row.mfr),
      resolution: getDisplayDriverMaxResolution(row),
    }))
    .filter(
      ({ normalizedMfr, resolution }) =>
        normalizedMfr.length >= 6 && resolution,
    )

  return (row) => {
    const directResolution = getDisplayDriverMaxResolution(row)
    if (directResolution) return directResolution

    const normalizedMfr = normalizeMfr(row.mfr)
    if (normalizedMfr.length < 6) return ""

    // Duplicate catalog entries frequently omit attributes on one package but
    // retain them on another. Reuse a model-family value only when every
    // related row agrees, avoiding guesses across families with mixed maxima.
    const relatedResolutions = new Set(
      resolvedSources
        .filter(
          (source) =>
            source.normalizedMfr.startsWith(normalizedMfr) ||
            normalizedMfr.startsWith(source.normalizedMfr),
        )
        .map((source) => source.resolution),
    )

    return relatedResolutions.size === 1
      ? (relatedResolutions.values().next().value ?? "")
      : ""
  }
}

export const getDisplayDriverMaxResolutionOptions = (
  rows: DisplayDriverResolutionSource[],
): string[] =>
  Array.from(
    new Set(rows.map(getDisplayDriverMaxResolution).filter(Boolean)),
  ).sort((a, b) => {
    const [aWidth, aHeight] = a.split("x").map(Number)
    const [bWidth, bHeight] = b.split("x").map(Number)
    return (
      aWidth * aHeight - bWidth * bHeight ||
      aWidth - bWidth ||
      aHeight - bHeight
    )
  })
