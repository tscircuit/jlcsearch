import { z } from "zod"
import { publicProcedure } from "../../lib/trpc"
import { db } from "../../lib/db"

export const getComponent = publicProcedure
  .input(
    z.object({
      lcsc: z.number().int(),
    }),
  )
  .query(async ({ input }) => {
    const component = await db
      .selectFrom("components")
      .selectAll()
      .where("lcsc", "=", input.lcsc)
      .executeTakeFirst()

    if (!component) {
      throw new Error(`Component with LCSC ${input.lcsc} not found`)
    }

    return {
      component: {
        ...component,
        basic: component.basic === 1,
        preferred: component.preferred === 1,
        is_extended_promotional: component.is_extended_promotional === 1,
      },
    }
  })
