import type { KyselyDatabaseInstance } from "../kysely-types"

export interface DbOptimizationSpec {
  name: string
  description: string
  checkIfAdded: (db: KyselyDatabaseInstance) => Promise<boolean>
  execute: (db: KyselyDatabaseInstance) => Promise<void>
}
