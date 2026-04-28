// File: lib/db/optimizations/index.ts
import { componentInStockColumn } from "./component-in-stock-column"
import { componentBasicIndex } from "./component-basic-index"
import { removeStaleComponents } from "./remove-stale-components"
import { componentExtendedPromotionalColumn } from "./component-extended-promotional-column"

export const dbOptimizations = [
  componentInStockColumn,
  componentBasicIndex,
  removeStaleComponents,
  componentExtendedPromotionalColumn,
]