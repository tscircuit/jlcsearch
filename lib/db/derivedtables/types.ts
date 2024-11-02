import type { Component, Generated } from "../generated/kysely"
import type { KyselyDatabaseInstance } from "../kysely-types"

type UnwrapGenerated<T> = {
  [K in keyof T]: T[K] extends Generated<infer U> ? U : T[K]
}

export interface DerivedTableSpec<
  Resource extends {
    lcsc: number
    mfr: string
    description: string
    stock: number
    in_stock: boolean
  },
> {
  tableName: string
  extraColumns: Array<{
    name: keyof Resource
    type: string
  }>
  listCandidateComponents: (db: KyselyDatabaseInstance) => Promise<any[]>
  mapToTable: (components: UnwrapGenerated<Component>[]) => (Resource | null)[]
}
