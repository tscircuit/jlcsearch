import type { StockSyncTarget } from "./live-stock-policy"

// Only tables published by sync-db.sh are eligible. A regression test keeps
// this allowlist aligned with that manifest; staging/backup tables stay out.
export const PUBLISHED_STOCK_CLEANUP_TABLES = new Set(
  `
  component_catalog search_index
  accelerometer adc analog_multiplexer barrel_jack battery_holder bjt_transistor
  ble_chip ble_module boost_converter buck_boost_converter buzzer capacitor dac
  diode dram ethernet_controller psram dimm_connector fpc_connector fpga fuse
  gas_sensor gyroscope header hdmi_port io_expander jst_connector lcd_display ldo
  led led_dot_matrix_display led_driver led_segment_display led_with_ic
  linux_capable_processor microcontroller micro_usb_connector mosfet npu_chip
  oled_display pcie_m2_connector photo_diode optical_sensor potentiometer relay
  stepper_motor_driver resistor resistor_array sodimm_connector
  spring_clamp_terminal_block switch usb_c_connector voltage_regulator
  wifi_module wire_to_board_connector
`
    .trim()
    .split(/\s+/),
)

export const stockCleanupCandidatesSql = (table: string, after: number) => {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table))
    throw new Error("Invalid stock cleanup table")
  if (!Number.isSafeInteger(after) || after < 0)
    throw new Error("Invalid stock cleanup cursor")
  return `SELECT lcsc, stock FROM "${table}" WHERE lcsc > ${after}
    ORDER BY lcsc LIMIT 1000`
}

export async function indexedStockCleanupTargets(
  execute: (sql: string) => Promise<any[]>,
  targets: StockSyncTarget[],
) {
  const eligible: StockSyncTarget[] = []
  for (const target of targets) {
    if (!PUBLISHED_STOCK_CLEANUP_TABLES.has(target.name)) continue
    // EXPLAIN prepares the real candidate query without reading catalog rows.
    // Checking the plan covers rowid primary keys, explicit indexes, partial
    // indexes and collation/order mismatches without table-valued PRAGMAs.
    const plan = await execute(
      `EXPLAIN QUERY PLAN ${stockCleanupCandidatesSql(target.name, 0)};`,
    )
    if (!plan.length || plan.some((row) => typeof row.detail !== "string"))
      throw new Error(`Invalid cleanup query plan for ${target.name}`)
    if (
      plan.some((row) =>
        /\bSEARCH\b.*\bUSING\b.*\((?:lcsc|rowid)>\?\)/i.test(row.detail),
      ) &&
      !plan.some((row) => /\bSCAN\b|USE TEMP B-TREE/i.test(row.detail))
    ) {
      eligible.push(target)
    } else {
      console.warn(
        `Skipping stock cleanup for ${target.name}: no indexed LCSC pagination`,
      )
    }
  }
  return eligible
}
