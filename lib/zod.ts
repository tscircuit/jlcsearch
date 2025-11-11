import { z } from "zod"

const truthyValues = ["true", "t", "1", "yes", "y", "on"] as const
const falsyValues = ["false", "f", "0", "no", "n", "off"] as const

const normalizedTruthy = new Set<string>(
  truthyValues.map((value) => value.toLowerCase()),
)
const normalizedFalsy = new Set<string>(
  falsyValues.map((value) => value.toLowerCase()),
)

export const boolish = z
  .union([z.boolean(), z.string()])
  .transform((value, ctx) => {
    if (typeof value === "boolean") {
      return value
    }

    const normalized = value.trim().toLowerCase()

    if (normalizedTruthy.has(normalized)) {
      return true
    }

    if (normalizedFalsy.has(normalized)) {
      return false
    }

    ctx.addIssue({
      code: z.ZodIssueCode.invalid_enum_value,
      options: [...truthyValues, ...falsyValues],
      received: value,
    })

    return z.NEVER
  })
