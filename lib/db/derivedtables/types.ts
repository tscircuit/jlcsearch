import type { SelectQueryBuilder } from "kysely"
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
    price1: number | null
    in_stock: boolean
    is_basic_part: boolean
  },
> {
  tableName: string
  extraColumns: Array<{
    name: keyof Resource
    type: string
  }>
  listCandidateComponents: (
    db: KyselyDatabaseInstance,
  ) => SelectQueryBuilder<any, any, any>
  mapToTable: (components: UnwrapGenerated<Component>[]) => (Resource | null)[]
}
