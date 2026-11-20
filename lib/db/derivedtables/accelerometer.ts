import {
  isAccelerometerComponent,
  MOTION_SENSOR_SUBCATEGORIES,
  mapMotionSensorFields,
  type MotionSensorComponent,
  readMotionSensorAttributes,
} from "./motion-sensor-utils"
import type { DerivedTableSpec } from "./types"

export interface Accelerometer extends MotionSensorComponent {}

export const accelerometerTableSpec: DerivedTableSpec<Accelerometer> = {
  tableName: "accelerometer",
  extraColumns: [
    { name: "package", type: "text" },
    { name: "supply_voltage_min", type: "real" },
    { name: "supply_voltage_max", type: "real" },
    { name: "operating_temp_min", type: "real" },
    { name: "operating_temp_max", type: "real" },
    { name: "axes", type: "text" },
    { name: "has_i2c", type: "boolean" },
    { name: "has_spi", type: "boolean" },
    { name: "has_uart", type: "boolean" },
    { name: "is_basic", type: "boolean" },
    { name: "is_preferred", type: "boolean" },
  ],
  listCandidateComponents: (db) =>
    db
      .selectFrom("components")
      .innerJoin("categories", "components.category_id", "categories.id")
      .selectAll("components")
      .select(["categories.subcategory as source_subcategory"])
      .where("categories.subcategory", "in", [...MOTION_SENSOR_SUBCATEGORIES]),
  mapToTable: (components) =>
    components.map((component): Accelerometer | null => {
      const attrs = readMotionSensorAttributes(component.extra)
      if (!isAccelerometerComponent(component, attrs)) return null
      return mapMotionSensorFields(component, attrs, "accelerometer")
    }),
}
