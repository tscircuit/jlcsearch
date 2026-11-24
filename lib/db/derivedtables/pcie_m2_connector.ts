import type { BaseComponent } from "./component-base"
import { createDerivedTableSpec } from "./create-derived-table-spec"

export interface PcieM2Connector extends BaseComponent {
  key: string | null
  is_right_angle: boolean
}

export const pcieM2ConnectorTableSpec = createDerivedTableSpec<PcieM2Connector>(
  {
    tableName: "pcie_m2_connector",
    extraColumns: [
      { name: "key", type: "text" },
      { name: "is_right_angle", type: "boolean" },
    ],
    subcategory: "Hard Disk Connector (SAS/SATA/M.2)",
    mapComponent: (c, attrs) => {
      if (!c.extra) return null

      const interfaceForm = attrs["Interface Form"] || ""
      let key: string | null = null
      const keyMatch = interfaceForm.match(/M\.2-(\w) Key/i)
      if (keyMatch) key = keyMatch[1]

      const mounting =
        attrs["Mounting Type"] || attrs["Mounting Style"] || c.description
      const isRightAngle = /horizontal/i.test(mounting)

      return {
        key,
        is_right_angle: isRightAngle,
      }
    },
  },
)
