import type { DerivedTableSpec } from "./types"
import { BaseComponent } from "./component-base"
import type { SelectQueryBuilder, Generated } from "kysely"
import type { Component } from "../generated/kysely"
import type { KyselyDatabaseInstance } from "../kysely-types"

import { parseAndConvertSiUnit } from "lib/util/parse-and-convert-si-unit"
import { extractMinQPrice } from "lib/util/extract-min-quantity-price"

export interface LEDWithIC extends BaseComponent {
  package?: string
  forward_voltage: number | null
  forward_current: number | null
  color?: string
  mounting_style?: string
  protocol?: string
}

export const ledWithICTableSpec: DerivedTableSpec<LEDWithIC> = {
  tableName: "led_with_ic",
  extraColumns: [
    { name: "package", type: "text" },
    { name: "forward_voltage", type: "real" },
    { name: "forward_current", type: "real" },
    { name: "color", type: "text" },
    { name: "mounting_style", type: "text" },
    { name: "protocol", type: "text" },
    { name: "is_basic", type: "boolean" },
  ],
  listCandidateComponents(db: KyselyDatabaseInstance) {
    return db
      .selectFrom("components")
      .innerJoin("categories", "components.category_id", "categories.id")
      .selectAll()
      .where("categories.subcategory", "=", "RGB LEDs(Built-In IC)")
  },
  mapToTable(components) {
    return components.map((c) => {
      try {
        const parseValue = (val: string | undefined): number | undefined => {
          if (!val) return undefined
          const result = parseAndConvertSiUnit(val)
          return result?.value || undefined
        }

        // Extract attributes from extra field
        const extraData = c.extra ? JSON.parse(c.extra) : {}
        const attrs = extraData.attributes || {}
        const specs = extraData.specifications || {}

        // Parse voltage
        const rawVoltage =
          attrs["Forward Voltage"] || attrs["Forward Voltage (VF)"]
        const forwardVoltage = rawVoltage
          ? (parseAndConvertSiUnit(rawVoltage).value as number)
          : null

        // Parse current
        const rawCurrent = attrs["Forward Current"]
        const forwardCurrent = rawCurrent
          ? (parseAndConvertSiUnit(rawCurrent).value as number)
          : null

        // Extract color - check in description and common color names
        let color = null
        const colorMatch = c.description.match(
          /(RGB|RED|GREEN|BLUE|WHITE|AMBER|UV|IR)/i,
        )
        if (colorMatch) {
          color = colorMatch[1].toUpperCase()
        } else if (attrs.Color) {
          color = attrs.Color
        } else if (specs.color) {
          color = specs.color
        }

        // Extract protocol - check common protocols in description
        let protocol = null
        const protocolMatch = c.mfr.match(
          /(WS2812B|SK6812|APA102|WS2811|SPI|I2C|TM1812|UCS1903)/i,
        )
        if (protocolMatch) {
          protocol = protocolMatch[1].toUpperCase()
        } else if (attrs.Protocol) {
          protocol = attrs.Protocol
        } else if (attrs.Interface) {
          protocol = attrs.Interface
        } else if (specs.protocol) {
          protocol = specs.protocol
        }

        return {
          lcsc: Number(c.lcsc),
          mfr: String(c.mfr || ""),
          description: String(c.description || ""),
          stock: Number(c.stock || 0),
          price1: extractMinQPrice(c.price),
          in_stock: Boolean((c.stock || 0) > 0),
          is_basic: Boolean(c.basic),
          package: String(c.package || ""),
          forward_voltage: forwardVoltage,
          forward_current: forwardCurrent,
          color: color || undefined,
          mounting_style: attrs["Mounting Style"],
          protocol: protocol || undefined,
          attributes: attrs,
        }
      } catch (e) {
        return null
      }
    })
  },
}
