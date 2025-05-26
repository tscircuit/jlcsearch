import type { DerivedTableSpec } from "./types"
import type { KyselyDatabaseInstance } from "../kysely-types"
import { BaseComponent } from "./component-base"
import { extractMinQPrice } from "lib/util/extract-min-quantity-price"

export interface BatteryConnector extends BaseComponent {
  package?: string
  battery_type?: string
  number_of_contacts?: number
  operating_temperature?: string
}

export const batteryConnectorTableSpec: DerivedTableSpec<BatteryConnector> = {
  tableName: "battery_connector",
  extraColumns: [
    { name: "package", type: "text" },
    { name: "battery_type", type: "text" },
    { name: "number_of_contacts", type: "integer" },
    { name: "operating_temperature", type: "text" },
  ],
  listCandidateComponents(db: KyselyDatabaseInstance) {
    return db
      .selectFrom("components")
      .innerJoin("categories", "components.category_id", "categories.id")
      .selectAll()
      .where((eb) =>
        eb("description", "like", "%Battery%Connector%")
          .or(eb("description", "like", "%Battery%Contact%"))
          .or(eb("description", "like", "%Battery%Holder%")),
      )
  },
  mapToTable(components) {
    return components
      .map((c) => {
        try {
          const extraData = c.extra ? JSON.parse(c.extra) : {}
          const attrs = extraData.attributes || {}

          // Extract number of contacts from joints or description
          let number_of_contacts = c.joints ? Number(c.joints) : undefined
          if (!number_of_contacts) {
            const contactsMatch = c.description.match(
              /(\d+)[\s-]*(?:pin|contact|pole)/i,
            )
            if (contactsMatch) {
              number_of_contacts = parseInt(contactsMatch[1], 10)
            }
          }

          // Extract battery type from description or attributes
          let battery_type = attrs["Type of Battery"] || undefined
          if (!battery_type) {
            if (c.description.match(/lithium|li[-\s]?ion|li[-\s]?po/i))
              battery_type = "Lithium"
            else if (c.description.match(/ni[-\s]?mh|nickel/i))
              battery_type = "NiMH"
            else if (c.description.match(/ni[-\s]?cd|nickel.*cadmium/i))
              battery_type = "NiCd"
            else if (c.description.match(/alkaline/i)) battery_type = "Alkaline"
          }

          // Get operating temperature if available
          const operating_temperature =
            attrs["Operating Temperature"] || undefined

          return {
            lcsc: Number(c.lcsc),
            mfr: String(c.mfr || ""),
            description: String(c.description || ""),
            stock: Number(c.stock || 0),
            price1: extractMinQPrice(c.price),
            in_stock: Boolean((c.stock || 0) > 0),
            package: String(c.package || ""),
            battery_type,
            number_of_contacts,
            operating_temperature,
            attributes: attrs,
          }
        } catch (e) {
          console.error(`Error processing component ${c.lcsc}:`, e)
          return null
        }
      })
      .filter(Boolean)
  },
}
