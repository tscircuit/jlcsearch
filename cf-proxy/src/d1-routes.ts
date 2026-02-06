import type { Kysely } from "kysely"
import type { DB } from "./db/types"
import {
  queryTable,
  ROUTE_TO_TABLE,
  TABLE_CONFIGS,
  TABLE_RESPONSE_KEY,
  type QueryParams,
} from "./handlers"

export interface D1QueryResult {
  data: Record<string, unknown[]>
  tableName: string
}

/**
 * Gets a D1 handler for the given pathname if one exists
 */
export function getD1Handler(
  pathname: string,
): ((db: Kysely<DB>, params: QueryParams) => Promise<D1QueryResult>) | null {
  const tableName = ROUTE_TO_TABLE[pathname]
  if (!tableName) {
    return null
  }

  const config = TABLE_CONFIGS[tableName]
  if (!config) {
    // Table exists but no config - use empty filters
    return async (db, params) => {
      const results = await queryTable(db, tableName, params, { filters: {} })
      const responseKey = TABLE_RESPONSE_KEY[tableName] || tableName + "s"
      return {
        data: { [responseKey]: results },
        tableName,
      }
    }
  }

  return async (db, params) => {
    const results = await queryTable(db, tableName, params, config)
    const responseKey = TABLE_RESPONSE_KEY[tableName] || tableName + "s"
    return {
      data: { [responseKey]: results },
      tableName,
    }
  }
}

/**
 * List of all supported D1 routes
 */
export const D1_ROUTES = Object.keys(ROUTE_TO_TABLE)
