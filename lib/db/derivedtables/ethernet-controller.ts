import { extractMinQPrice } from "lib/util/extract-min-quantity-price"
import type { BaseComponent } from "./component-base"
import type { DerivedTableSpec } from "./types"

export interface EthernetController extends BaseComponent {
  package: string
}

// These controllers also appear in the mixed upstream Ethernet ICs category.
const KNOWN_CONTROLLER = /^(?:W5500|CH390H|ENC28J60)(?:[-/].*)?$/i
const CONTROLLER_DESCRIPTION = /\bethernet controllers?\b/i
const OTHER_ETHERNET_PART =
  /\b(?:PoE|power over ethernet|modules?|connectors?|PHY(?:transceiver)?|transceivers?)\b/i

export const ethernetControllerTableSpec: DerivedTableSpec<EthernetController> =
  {
    tableName: "ethernet_controller",
    extraColumns: [
      { name: "package", type: "text" },
      { name: "is_basic", type: "boolean" },
      { name: "is_preferred", type: "boolean" },
    ],
    indexes: [
      { name: "idx_ethernet_controller_stock", columns: ["stock"] },
      {
        name: "idx_ethernet_controller_package_stock",
        columns: ["package", "stock"],
      },
      {
        name: "idx_ethernet_controller_is_basic_stock",
        columns: ["is_basic", "stock"],
      },
      {
        name: "idx_ethernet_controller_is_preferred_stock",
        columns: ["is_preferred", "stock"],
      },
    ],
    listCandidateComponents: (db) =>
      db
        .selectFrom("components")
        .innerJoin("categories", "components.category_id", "categories.id")
        .selectAll("components")
        .select("categories.subcategory as source_subcategory")
        .where((eb) =>
          eb.or([
            eb("categories.subcategory", "=", "Ethernet Controllers"),
            eb("components.description", "like", "%Ethernet Controller%"),
            ...["W5500", "CH390H", "ENC28J60"].map((part) =>
              eb("components.mfr", "like", `${part}%`),
            ),
          ]),
        ),
    mapToTable: (components) =>
      components.map((component) => {
        const description = String(component.description ?? "")
        const mfr = String(component.mfr ?? "")
        const subcategory = (
          component as typeof component & { source_subcategory?: string }
        ).source_subcategory
        const knownController = KNOWN_CONTROLLER.test(mfr)
        // A MAC controller can include a PHY; only reject PHY-only parts here.
        const controller =
          knownController ||
          CONTROLLER_DESCRIPTION.test(description) ||
          subcategory === "Ethernet Controllers"
        if (
          !controller ||
          /\b(?:PoE|power over ethernet|modules?|connectors?)\b/i.test(
            description,
          ) ||
          (!knownController &&
            !CONTROLLER_DESCRIPTION.test(description) &&
            OTHER_ETHERNET_PART.test(description))
        )
          return null

        let extra: { package?: string; attributes?: Record<string, string> } =
          {}
        try {
          extra = component.extra ? (JSON.parse(component.extra) ?? {}) : {}
        } catch {
          // Missing or malformed optional metadata must not hide a known controller.
        }
        return {
          lcsc: Number(component.lcsc),
          mfr,
          description,
          stock: Number(component.stock ?? 0),
          price1: extractMinQPrice(component.price),
          in_stock: Number(component.stock ?? 0) > 0,
          is_basic: Boolean(component.basic),
          is_preferred: Boolean(component.preferred),
          package: String(extra.package ?? component.package ?? ""),
          attributes: extra.attributes ?? {},
        }
      }),
  }
