We need to apply reviewer's changes to lib/db/optimizations/index.ts. Wait, the reviewer feedback is about a bug in component-extended-promotional-column.ts: they suggest adding null check. However the task says: "TASK: Apply the reviewer's changes to lib/db/optimizations/index.ts." That seems odd: they want to apply changes to index.ts? The reviewer feedback includes code snippet for component-extended-promotional-column.ts. But they ask to apply changes to index.ts. Possibly they want to import the fixed function? Actually index.ts just exports optimizations array. The fix is in component-extended-promotional-column.ts, not index.ts. But the instruction says apply reviewer's changes to lib/db/optimizations/index.ts. Maybe they want to add something to index.ts? Let's read: The reviewer feedback includes a code block with suggestion to add null check. Then they show CURRENT FILE — lib/db/optimizations/index.ts. Then TASK: Apply the reviewer's changes to lib/db/optimizations/index.ts. So they want us to modify index.ts to incorporate the fix? Perhaps they want to replace the export of componentExtendedPromotionalColumn with a version that includes the fix? But we don't have the actual component-extended-promotional-column.ts file content. We only have index.ts. We cannot modify the other file because we don't have it. However maybe the reviewer's changes are to add a null check in the function inside component-extended-promotional-column.ts, but they want us to apply those changes to index.ts by editing the export? That doesn't make sense.

Maybe the reviewer's feedback is actually about index.ts? Let's re-examine: The feedback says: "[CODE on lib/db/optimizations/component-extended-promotional-column.ts:21] Critical bug: If the `components` table is empty, the query returns no rows, making `ex` undefined. The check `"is_extended_promotional" in ex` will throw a TypeError when `ex` is undefined."

Then they show a code snippet:

```ts
async checkIfAdded(db: KyselyDatabaseInstance) {
  const {
    rows: [ex],
  } = await sql<any>`
    SELECT * FROM components LIMIT 1
  `.execute(db)

  // Add null check
  if (!ex) {
    return false
  }

  return "is_extended_promotional" in ex
}
```

That is the fix they want applied to component-extended-promotional-column.ts.

But then they show CURRENT FILE — lib/db/optimizations/index.ts. And TASK: Apply the reviewer's changes to lib/db/optimizations/index.ts.

Maybe they want us to add the fixed function to index.ts? Or maybe they want us to replace the import of componentExtendedPromotionalColumn with the fixed version inline? However we don't have the original component-extended-promotional-column.ts content, but we could infer that the fix is to add null check. Since we cannot edit that file, maybe we are supposed to replace the export in index.ts with a version that includes the fix? But we don't have the original function.

Alternatively, maybe the reviewer's changes are to add a null check in index.ts itself? But index.ts doesn't have such code.

Let's look at index.ts content:

```
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
```

Maybe they want us to add a null check for the import? No.

Perhaps the task is mis-specified: they actually want us to apply the reviewer's changes to component-extended-promotional-column.ts, but they mistakenly wrote index.ts. However the instruction says: "Return ONLY the complete corrected file. No explanation, no markdown fences. Zero explanation." And they gave the current file content for index.ts. So we must output the corrected index.ts.

What could be the change? Maybe they want to add a default export or something? Or maybe they want to add a comment about the fix? Or maybe they want to reorder imports? Not likely.

Let's think: The reviewer's change is to add a null check in the function. If we cannot edit that file, maybe we need to wrap the import with a fallback? For example, we could replace the import of componentExtendedPromotionalColumn with a version that includes the fix by redefining it inline in index.ts. But we don't know the original function's name or signature. However we can infer from the snippet: it's a method checkIfAdded on some object? The snippet shows:

```
async checkIfAdded(db: KyselyDatabaseInstance) {
  ...
}
```

So likely componentExtendedPromotionalColumn is an object with a method checkIfAdded. The fix is to add null check inside that method.

If we cannot edit the source file, we could monkey-patch it in index.ts after import: e.g.,

```
import { componentExtendedPromotionalColumn } from "./component-extended-promotional-column"
// Apply fix
const originalCheckIfAdded = componentExtendedPromotionalColumn.checkIfAdded;
componentExtendedPromotionalColumn.checkIfAdded = async function(db) {
  const { rows: [ex] } = await sql<any>`SELECT * FROM components LIMIT 1`.execute(db);
  if (!ex) return false;
  return "is_extended_promotional" in ex;
};
```

But we don't know if the original function is named checkIfAdded or something else. The snippet shows exactly that. So we could assume.

But the task says "Apply the reviewer's changes to lib/db/optimizations/index.ts." So we should modify index.ts to include the fix, perhaps by overriding the method.

However we must not change the exported array? The array still contains the same object, but we mutated it.

Thus we need to produce the corrected index.ts file with the fix applied.

Let's produce:

```
// File: lib/db/optimizations/index.ts
import { componentInStockColumn } from "./component-in-stock-column"
import { componentBasicIndex } from "./component-basic-index"
import { removeStaleComponents } from "./remove-stale-components"
import { componentExtendedPromotionalColumn } from "./component-extended-promotional-column"

// Apply null check fix for componentExtendedPromotionalColumn.checkIfAdded
const originalCheckIfAdded = componentExtendedPromotionalColumn.checkIfAdded;
componentExtendedPromotionalColumn.checkIfAdded = async function(db: KyselyDatabaseInstance) {
  const { rows: [ex] } = await sql<any>`
    SELECT * FROM components LIMIT 1
  `.execute(db);

  if (!ex) {
    return false;
  }

  return "is_extended_promotional" in ex;
};

export const dbOptimizations = [
  componentInStockColumn,
  componentBasicIndex,
  removeStaleComponents,
  componentExtendedPromotionalColumn,
];
```

But we need to import KyselyDatabaseInstance and sql? The original file likely already has those imports elsewhere. In index.ts we might not have them. Adding them could cause errors if not used elsewhere. However we are only using them in the override function. We need to import sql from 'kysely' and KyselyDatabaseInstance type from somewhere. But we don't know the exact imports. However we can assume they are already available in the scope because the original file (component-extended-promotional-column.ts) had them. In index.ts we might not have them. Adding imports may be necessary.

But the instruction: "Match the existing codebase style (naming, imports, error handling) exactly". We don't have the existing style of index.ts beyond what's shown. It only shows imports of the four optimizations. No other imports. So adding new imports would deviate from style? But we need to use sql and KyselyDatabaseInstance. However we could reference them via global? Not safe.

Alternatively, we could avoid redefining the function and instead just note that the fix should be applied elsewhere. But the task explicitly says apply changes to index.ts.

Maybe the correct answer is simply to output the index.ts unchanged because the reviewer's changes are not for this file. But they said "Apply the reviewer's changes to lib/db/optimizations/index.ts." If there are no changes needed, we output the same file. However the reviewer's changes are about adding null check; there is no such code in index.ts, so maybe we need to add a comment? But that seems unlikely.

Let's re-read the prompt: "A GitHub PR reviewer requested specific changes. Fix exactly what they asked.

REVIEWER FEEDBACK:
[CODE on lib/db/optimizations/component-extended-promotional-column.ts:21] Critical bug: If the `components` table is empty, the query returns no rows, making `ex` undefined. The check `"is_extended_promotional" in ex` will throw a TypeError when `ex` is undefined.

```ts
async checkIfAdded(db: KyselyDatabaseInstance) {
  const {
    rows: [ex],
  } = await sql<any>`
    SELECT * FROM components LIMIT 1
  `.execute(db)

  // Add null check
  if (!ex) {
    return false
  }

  return "is_extended_promotional" in ex
}
```
```suggestion

  async checkIfAdded(db: KyselyDatabaseInstance) {
    const {
      rows: [ex],
    } = await sql<any>`
      SELECT * FROM components LIMIT 1
    `.execute(db)

    // Add null check
    if (!ex) {
      return false
    }

    return "is_extended_promotion

CURRENT FILE — lib/db/optimizations/index.ts:
```
// File: lib/db/optimizations/index.ts
import { componentInStockColumn } from "./component-in-stock-column"
import { componentBasicIndex } from "./component-basic-index"
import { removeStaleComponents } from "./remove-stale-components"
import { componentExtendedPromotionalColumn } from "./component-extended-promotional-column"

export const dbOptimizations = [
  componentInStockColumn,
  componentBasicIndex,
  removeStaleComponents,
  componentExtendedProm