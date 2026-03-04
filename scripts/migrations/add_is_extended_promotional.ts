import Database from 'better-sqlite3';

// Migration: add is_extended_promotional column and backfill based on preferred=1 AND basic=0
const db = new Database('./db.sqlite3');

// List of derived tables to update
const tables = [
  'resistor', 'capacitor', 'microcontroller', 'ldo', 'led', 'diode',
  'mosfet', 'switch', 'header', 'accelerometer', 'adc',
  'analog_multiplexer', 'battery_holder', 'bjt_transistor', 'boost_converter',
  'buck_boost_converter', 'dac', 'fpc_connector', 'fpga', 'fuse',
  'gas_sensor', 'gyroscope', 'io_expander', 'jst_connector', 'lcd_display',
  'led_dot_matrix_display', 'led_driver', 'led_segment_display', 'led_with_ic',
  'oled_display', 'pcie_m2_connector', 'potentiometer', 'relay',
  'resistor_array', 'usb_c_connector', 'voltage_regulator', 'wifi_module',
  'wire_to_board_connector'
];

tables.forEach(table => {
  try {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN is_extended_promotional INTEGER DEFAULT 0`).run();
    db.prepare(
      `UPDATE ${table} SET is_extended_promotional = CASE WHEN is_preferred = 1 AND is_basic = 0 THEN 1 ELSE 0 END`
    ).run();
    console.log(`Migrated ${table}`);
  } catch (e: any) {
    if (!/duplicate column name/.test(e.message)) {
      console.error(`Error migrating ${table}:`, e.message);
    }
  }
});

db.close();
