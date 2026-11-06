import { gzipSync } from "node:zlib"

export interface StandaloneComponent {
  lcsc: number
  mfr: string
  package: string
  description: string
  stock: number | null
  price: number | null
  is_basic?: boolean
  is_preferred?: boolean
  category?: string
  subcategory?: string
}

/** Versioned interchange format consumed by the CLI's baked asset server. */
export function encodeCatalog(
  components: StandaloneComponent[],
  generatedAt = new Date().toISOString(),
) {
  if (!Number.isFinite(Date.parse(generatedAt)))
    throw new Error("Invalid catalog timestamp")
  const byId = new Map<number, StandaloneComponent>()
  for (const component of components) {
    if (
      !Number.isSafeInteger(component.lcsc) ||
      component.lcsc <= 0 ||
      typeof component.mfr !== "string" ||
      !component.mfr.trim() ||
      typeof component.package !== "string" ||
      typeof component.description !== "string" ||
      !(
        component.stock === null ||
        (Number.isFinite(component.stock) && component.stock >= 0)
      ) ||
      !(
        component.price === null ||
        (Number.isFinite(component.price) && component.price >= 0)
      )
    )
      throw new Error("Invalid JLCPCB search component")
    // Pick fields explicitly: omit raw EasyEDA, images and large attribute blobs.
    byId.set(component.lcsc, {
      lcsc: component.lcsc,
      mfr: component.mfr,
      package: component.package,
      description: component.description,
      stock: component.stock,
      price: component.price,
      ...(typeof component.is_basic === "boolean"
        ? { is_basic: component.is_basic }
        : {}),
      ...(typeof component.is_preferred === "boolean"
        ? { is_preferred: component.is_preferred }
        : {}),
      ...(typeof component.category === "string"
        ? { category: component.category }
        : {}),
      ...(typeof component.subcategory === "string"
        ? { subcategory: component.subcategory }
        : {}),
    })
  }
  if (!byId.size) throw new Error("Refusing to create an empty JLCPCB catalog")
  return gzipSync(
    JSON.stringify({
      schema_version: 1,
      source: "jlcpcb",
      coverage: "subset",
      generated_at: generatedAt,
      components: [...byId.values()].sort((a, b) => a.lcsc - b.lcsc),
    }),
    { level: 9 },
  )
}
