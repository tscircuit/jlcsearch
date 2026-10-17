import type { SelectQueryBuilder } from "kysely"
import type { Component, Generated } from "../generated/kysely"
import type { KyselyDatabaseInstance } from "../kysely-types"
import type { BaseComponent } from "./component-base"

type UnwrapGenerated<T> = {
  [K in keyof T]: T[K] extends Generated<infer U> ? U : T[K]
}

export interface DerivedTableSpec<Resource extends BaseComponent> {
  tableName: string
  extraColumns: Array<{
    name: keyof Resource
    type: string
  }>
  indexes?: Array<{
    name: string
    columns: Array<keyof Resource>
  }>
  listCandidateComponents: (
    db: KyselyDatabaseInstance,
  ) => SelectQueryBuilder<any, any, any>
  mapToTable: (components: UnwrapGenerated<Component>[]) => (Resource | null)[]
}
