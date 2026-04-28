import { componentExtendedPromotionalColumn } from "lib/db/optimizations/component-extended-promotional-column"
import { componentInStockColumn } from "lib/db/optimizations/component-in-stock-column"
import { componentBasicIndex } from "lib/db/optimizations/component-basic-index"
import { removeStaleComponents } from "lib/db/optimizations/remove-stale-components"
import { db } from "lib/db/db"
import { json } from "itty-router"

export const GET = async () => {
  const components = await db
    .selectFrom("components")
    .selectAll()
    .orderBy("id", "asc")
    .execute()

  return json({ components })
}