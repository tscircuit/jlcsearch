import type { DerivedTableSpec } from "./types"
import { voltageRegulatorTableSpec } from "./voltage_regulator"
import type { VoltageRegulator } from "./voltage_regulator"

export interface Ldo extends Omit<VoltageRegulator, "is_low_dropout"> {}

export const ldoTableSpec: DerivedTableSpec<Ldo> = {
  tableName: "ldo",
  extraColumns: voltageRegulatorTableSpec.extraColumns.filter(
    (col): col is { name: keyof Ldo; type: string } =>
      col.name !== "is_low_dropout",
  ),
  listCandidateComponents: (db) =>
    voltageRegulatorTableSpec.listCandidateComponents(db),
  mapToTable: (components) =>
    voltageRegulatorTableSpec.mapToTable(components as any).map((c) => {
      if (!c || !c.is_low_dropout) return null
      const { is_low_dropout, ...rest } = c
      return rest
    }),
}
