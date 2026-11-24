/**
 * Database types for D1 queries.
 * These are copied from lib/db/generated/kysely.ts
 */

import type { ColumnType } from "kysely"

export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>

export interface BaseComponentRow {
  attributes: string | null
  description: string | null
  in_stock: number | null
  is_basic: number | null
  is_preferred: number | null
  lcsc: Generated<number | null>
  mfr: string | null
  price1: number | null
  stock: number | null
}

export interface Accelerometer extends BaseComponentRow {
  axes: string | null
  has_i2c: number | null
  has_spi: number | null
  has_uart: number | null
  operating_temp_max: number | null
  operating_temp_min: number | null
  package: string | null
  supply_voltage_max: number | null
  supply_voltage_min: number | null
}

export interface Adc extends BaseComponentRow {
  has_i2c: number | null
  has_parallel_interface: number | null
  has_serial_interface: number | null
  has_spi: number | null
  has_uart: number | null
  is_differential: number | null
  num_channels: number | null
  operating_temp_max: number | null
  operating_temp_min: number | null
  package: string | null
  resolution_bits: number | null
  sampling_rate_hz: number | null
  supply_voltage_max: number | null
  supply_voltage_min: number | null
}

export interface AnalogMultiplexer extends BaseComponentRow {
  channel_type: string | null
  has_enable: number | null
  has_i2c: number | null
  has_parallel_interface: number | null
  has_spi: number | null
  leakage_current_na: number | null
  num_bits: number | null
  num_channels: number | null
  on_resistance_ohms: number | null
  operating_temp_max: number | null
  operating_temp_min: number | null
  package: string | null
  supply_voltage_max: number | null
  supply_voltage_min: number | null
}

export interface BarrelJack extends BaseComponentRow {
  connector_type: string | null
  current_rating_a: number | null
  inside_diameter_mm: number | null
  mounting_style: string | null
  num_pins: number | null
  operating_temp_max: number | null
  operating_temp_min: number | null
  orientation: string | null
  outside_diameter_mm: number | null
  package: string | null
  voltage_rating_v: number | null
}

export interface BatteryHolder extends BaseComponentRow {
  battery_type: string | null
  connector_type: string | null
  operating_temp_max: number | null
  operating_temp_min: number | null
  package: string | null
}

export interface BleChip extends BaseComponentRow {
  bluetooth_version: string | null
  core_processor: string | null
  data_rate_mbps: number | null
  frequency_ghz: number | null
  has_i2c: number | null
  has_spi: number | null
  has_uart: number | null
  has_usb: number | null
  operating_voltage_max: number | null
  operating_voltage_min: number | null
  package: string | null
}

export interface BleModule extends BaseComponentRow {
  antenna_type: string | null
  bluetooth_version: string | null
  core_processor: string | null
  data_rate_mbps: number | null
  frequency_ghz: number | null
  has_i2c: number | null
  has_spi: number | null
  has_uart: number | null
  has_usb: number | null
  operating_voltage_max: number | null
  operating_voltage_min: number | null
  package: string | null
}

export interface BjtTransistor extends BaseComponentRow {
  collector_current: number | null
  collector_emitter_voltage: number | null
  current_gain: number | null
  package: string | null
  power_dissipation: number | null
  temperature_range: string | null
  transition_frequency: number | null
}

export interface BoostConverter extends BaseComponentRow {
  input_voltage_max: number | null
  input_voltage_min: number | null
  is_synchronous: number | null
  number_of_outputs: number | null
  output_current_max: number | null
  output_voltage_max: number | null
  output_voltage_min: number | null
  package: string | null
  switching_frequency: number | null
  topology: string | null
}

export interface BuckBoostConverter extends BaseComponentRow {
  input_voltage_max: number | null
  input_voltage_min: number | null
  is_synchronous: number | null
  number_of_outputs: number | null
  output_current_max: number | null
  output_voltage_max: number | null
  output_voltage_min: number | null
  package: string | null
  switching_frequency: number | null
  topology: string | null
}

export interface ComponentCatalog {
  basic: number | null
  category: string | null
  description: string | null
  extra: string | null
  lcsc: Generated<number | null>
  mfr: string | null
  package: string | null
  preferred: number | null
  price: string | null
  stock: number | null
  subcategory: string | null
}

export interface Capacitor extends BaseComponentRow {
  capacitance_farads: number | null
  capacitor_type: string | null
  esr_ohms: number | null
  is_polarized: number | null
  is_surface_mount: number | null
  lifetime_hours: number | null
  package: string | null
  ripple_current_amps: number | null
  temperature_coefficient: string | null
  tolerance_fraction: number | null
  voltage_rating: number | null
}

export interface Dac extends BaseComponentRow {
  has_i2c: number | null
  has_parallel_interface: number | null
  has_spi: number | null
  nonlinearity_lsb: number | null
  num_channels: number | null
  operating_temp_max: number | null
  operating_temp_min: number | null
  output_type: string | null
  package: string | null
  resolution_bits: number | null
  settling_time_us: number | null
  supply_voltage_max: number | null
  supply_voltage_min: number | null
}

export interface Dram extends BaseComponentRow {
  clock_frequency_mhz: number | null
  memory_size_mbit: number | null
  memory_type: string | null
  operating_temp_max: number | null
  operating_temp_min: number | null
  package: string | null
  supply_voltage_max: number | null
  supply_voltage_min: number | null
}

export interface Psram extends BaseComponentRow {
  clock_frequency_mhz: number | null
  memory_size_mbit: number | null
  interface_type: string | null
  operating_temp_max: number | null
  operating_temp_min: number | null
  package: string | null
  supply_voltage_max: number | null
  supply_voltage_min: number | null
}

export interface Diode extends BaseComponentRow {
  configuration: string | null
  diode_type: string | null
  forward_current: number | null
  forward_voltage: number | null
  is_schottky: number | null
  is_tvs: number | null
  is_zener: number | null
  operating_temp_max: number | null
  operating_temp_min: number | null
  package: string | null
  power_dissipation_watts: number | null
  recovery_time_ns: number | null
  reverse_leakage_current: number | null
  reverse_voltage: number | null
}

export interface DimmConnector extends BaseComponentRow {
  ddr_standard: string | null
  height_above_board_mm: number | null
  is_right_angle: number | null
  mounting_type: string | null
  num_pins: number | null
  operating_temp_max: number | null
  operating_temp_min: number | null
  package: string | null
  pitch_mm: number | null
}

export interface FpcConnector extends BaseComponentRow {
  contact_type: string | null
  locking_feature: string | null
  number_of_contacts: number | null
  pitch_mm: number | null
}

export interface Fpga extends BaseComponentRow {
  embedded_ram_bits: number | null
  logic_array_blocks: number | null
  logic_elements: number | null
  logic_gates: number | null
  max_delay_ns: number | null
  operating_temp_max: number | null
  operating_temp_min: number | null
  package: string | null
  supply_voltage_max: number | null
  supply_voltage_min: number | null
  type: string | null
}

export interface Fuse extends BaseComponentRow {
  current_rating: number | null
  is_glass_encased: number | null
  is_resettable: number | null
  is_surface_mount: number | null
  package: string | null
  response_time: string | null
  voltage_rating: number | null
}

export interface GasSensor extends BaseComponentRow {
  measures_air_quality: number | null
  measures_carbon_monoxide: number | null
  measures_co2: number | null
  measures_explosive_gases: number | null
  measures_formaldehyde: number | null
  measures_hydrogen: number | null
  measures_methane: number | null
  measures_nitrogen_oxides: number | null
  measures_oxygen: number | null
  measures_sulfur_hexafluoride: number | null
  measures_volatile_organic_compounds: number | null
  package: string | null
  sensor_type: string | null
}

export interface Gyroscope extends BaseComponentRow {
  axes: string | null
  has_i2c: number | null
  has_spi: number | null
  has_uart: number | null
  operating_temp_max: number | null
  operating_temp_min: number | null
  package: string | null
  supply_voltage_max: number | null
  supply_voltage_min: number | null
}

export interface Header extends BaseComponentRow {
  contact_material: string | null
  contact_plating: string | null
  current_rating_amp: number | null
  gender: string | null
  insulation_height_mm: number | null
  is_right_angle: number | null
  is_shrouded: number | null
  mounting_style: string | null
  num_pins: number | null
  num_pins_per_row: number | null
  num_rows: number | null
  operating_temperature_max: number | null
  operating_temperature_min: number | null
  package: string | null
  pin_length_mm: number | null
  pitch_mm: number | null
  row_spacing_mm: number | null
  voltage_rating_volt: number | null
}

export interface HdmiPort extends BaseComponentRow {
  current_rating_a: number | null
  gender: string | null
  mounting_style: string | null
  number_of_pins: number | null
  number_of_rows: number | null
  operating_temp_max: number | null
  operating_temp_min: number | null
  orientation: string | null
  package: string | null
}

export interface IoExpander extends BaseComponentRow {
  clock_frequency_hz: number | null
  has_i2c: number | null
  has_interrupt: number | null
  has_smbus: number | null
  has_spi: number | null
  num_gpios: number | null
  operating_temp_max: number | null
  operating_temp_min: number | null
  output_type: string | null
  package: string | null
  sink_current_ma: number | null
  source_current_ma: number | null
  supply_voltage_max: number | null
  supply_voltage_min: number | null
}

export interface JstConnector extends BaseComponentRow {
  num_pins: number | null
  num_rows: number | null
  package: string | null
  pitch_mm: number | null
  reference_series: string | null
}

export interface LcdDisplay extends BaseComponentRow {
  display_size: string | null
  display_type: string | null
  package: string | null
  resolution: string | null
}

export interface Ldo extends BaseComponentRow {
  dropout_voltage: number | null
  input_voltage_max: number | null
  input_voltage_min: number | null
  is_positive: number | null
  operating_temp_max: number | null
  operating_temp_min: number | null
  output_current_max: number | null
  output_noise_uvrms: number | null
  output_type: string | null
  output_voltage_max: number | null
  output_voltage_min: number | null
  package: string | null
  power_supply_rejection_db: number | null
  quiescent_current: number | null
  topology: string | null
}

export interface Led extends BaseComponentRow {
  color: string | null
  forward_current: number | null
  forward_voltage: number | null
  is_rgb: number | null
  lens_color: string | null
  luminous_intensity_mcd: number | null
  mounting_style: string | null
  operating_temp_max: number | null
  operating_temp_min: number | null
  package: string | null
  power_dissipation_mw: number | null
  viewing_angle_deg: number | null
  wavelength_nm: number | null
}

export interface LedDotMatrixDisplay extends BaseComponentRow {
  color: string | null
  matrix_size: string | null
  package: string | null
}

export interface LedDriver extends BaseComponentRow {
  channel_count: number | null
  dimming_method: string | null
  efficiency_percent: number | null
  mounting_style: string | null
  operating_temp_max: number | null
  operating_temp_min: number | null
  output_current_max: number | null
  package: string | null
  protection_features: string | null
  supply_voltage_max: number | null
  supply_voltage_min: number | null
}

export interface LedSegmentDisplay extends BaseComponentRow {
  color: string | null
  package: string | null
  positions: string | null
  size: string | null
  type: string | null
}

export interface LedWithIc extends BaseComponentRow {
  color: string | null
  forward_current: number | null
  forward_voltage: number | null
  mounting_style: string | null
  package: string | null
  protocol: string | null
}

export interface MicroUsbConnector extends BaseComponentRow {
  connector_type: string | null
  current_rating_a: number | null
  gender: string | null
  mounting_style: string | null
  number_of_contacts: number | null
  number_of_ports: number | null
  operating_temp_max: number | null
  operating_temp_min: number | null
  package: string | null
  usb_standard: string | null
}

export interface Microcontroller extends BaseComponentRow {
  adc_resolution_bits: number | null
  cpu_core: string | null
  cpu_speed_hz: number | null
  dac_resolution_bits: number | null
  eeprom_size_bytes: number | null
  flash_size_bytes: number | null
  gpio_count: number | null
  has_adc: number | null
  has_can: number | null
  has_comparator: number | null
  has_dac: number | null
  has_dma: number | null
  has_i2c: number | null
  has_pwm: number | null
  has_rtc: number | null
  has_spi: number | null
  has_uart: number | null
  has_usb: number | null
  has_usb_host: number | null
  has_watchdog: number | null
  operating_temp_max: number | null
  operating_temp_min: number | null
  package: string | null
  ram_size_bytes: number | null
  supply_voltage_max: number | null
  supply_voltage_min: number | null
}

export interface Mosfet extends BaseComponentRow {
  continuous_drain_current: number | null
  drain_source_voltage: number | null
  gate_threshold_voltage: number | null
  mounting_style: string | null
  operating_temp_max: number | null
  operating_temp_min: number | null
  package: string | null
  power_dissipation: number | null
}

export interface LinuxCapableProcessor extends BaseComponentRow {
  architecture: string | null
  chip_family: string | null
  cpu_core: string | null
  cpu_speed_hz: number | null
  cpu_core_count: number | null
  sram_size_bytes: number | null
  integrated_dram_size_bytes: number | null
  manufacturer: string | null
  package: string | null
}

export interface NpuChip extends BaseComponentRow {
  chip_family: string | null
  manufacturer: string | null
  npu_name: string | null
  npu_performance_tops: number | null
  package: string | null
}

export interface OledDisplay extends BaseComponentRow {
  display_width: string | null
  package: string | null
  pixel_resolution: string | null
  protocol: string | null
}

export interface PcieM2Connector extends BaseComponentRow {
  is_right_angle: number | null
  key: string | null
}

export interface PhotoDiode extends BaseComponentRow {
  dark_current_a: number | null
  operating_temp_max: number | null
  operating_temp_min: number | null
  package: string | null
  peak_wavelength_nm: number | null
  reception_angle_deg: number | null
  reverse_voltage: number | null
  spectral_range_max_nm: number | null
  spectral_range_min_nm: number | null
}

export interface Potentiometer extends BaseComponentRow {
  is_surface_mount: number | null
  max_resistance: number | null
  package: string | null
  pin_variant: string | null
}

export interface Buzzer extends BaseComponentRow {
  package: string | null
}

export interface StepperMotorDriver extends BaseComponentRow {
  package: string | null
}

export interface Relay extends BaseComponentRow {
  coil_resistance: number | null
  coil_voltage: number | null
  contact_form: string | null
  max_switching_current: number | null
  max_switching_voltage: number | null
  package: string | null
  pin_number: number | null
  relay_type: string | null
}

export interface SearchIndex {
  attributes: string | null
  basic: number | null
  category: string | null
  description: string | null
  lcsc: Generated<number | null>
  mfr: string | null
  manufacturer_name: string | null
  mpn: string | null
  package: string | null
  preferred: number | null
  price: string | null
  price1: number | null
  search_text: string | null
  stock: number | null
  subcategory: string | null
  title: string | null
}

export interface Resistor extends BaseComponentRow {
  is_multi_resistor_chip: number | null
  is_potentiometer: number | null
  is_surface_mount: number | null
  max_overload_voltage: number | null
  number_of_pins: number | null
  number_of_resistors: number | null
  package: string | null
  power_watts: number | null
  resistance: number | null
  tolerance_fraction: number | null
}

export interface ResistorArray extends BaseComponentRow {
  is_surface_mount: number | null
  number_of_pins: number | null
  number_of_resistors: number | null
  package: string | null
  power_watts: number | null
  resistance: number | null
  temperature_coefficient_ppm: number | null
  tolerance_fraction: number | null
  topology: string | null
}

export interface Switch extends BaseComponentRow {
  circuit: string | null
  current_rating_a: number | null
  is_latching: number | null
  length_mm: number | null
  mounting_style: string | null
  operating_temp_max: number | null
  operating_temp_min: number | null
  package: string | null
  pin_count: number | null
  switch_height_mm: number | null
  switch_type: string | null
  voltage_rating_v: number | null
  width_mm: number | null
}

export interface SodimmConnector extends BaseComponentRow {
  ddr_standard: string | null
  height_above_board_mm: number | null
  is_right_angle: number | null
  mounting_type: string | null
  num_pins: number | null
  operating_temp_max: number | null
  operating_temp_min: number | null
  package: string | null
  pitch_mm: number | null
}

export interface SpringClampTerminalBlock extends BaseComponentRow {
  current_rating: number | null
  mounting_style: string | null
  num_pins: number | null
  package: string | null
  pitch_mm: number | null
  voltage_rating: number | null
  wire_gauge_awg: string | null
  wire_gauge_mm2: number | null
}

export interface UsbCConnector extends BaseComponentRow {
  current_rating_a: number | null
  gender: string | null
  mounting_style: string | null
  number_of_contacts: number | null
  number_of_ports: number | null
  operating_temp_max: number | null
  operating_temp_min: number | null
  package: string | null
}

export interface VoltageRegulator extends BaseComponentRow {
  dropout_voltage: number | null
  input_voltage_max: number | null
  input_voltage_min: number | null
  is_low_dropout: number | null
  is_positive: number | null
  operating_temp_max: number | null
  operating_temp_min: number | null
  output_current_max: number | null
  output_noise_uvrms: number | null
  output_type: string | null
  output_voltage_max: number | null
  output_voltage_min: number | null
  package: string | null
  power_supply_rejection_db: number | null
  quiescent_current: number | null
  topology: string | null
}

export interface WifiModule extends BaseComponentRow {
  antenna_type: string | null
  core_processor: string | null
  frequency_ghz: number | null
  has_adc: number | null
  has_gpio: number | null
  has_i2c: number | null
  has_pwm: number | null
  has_spi: number | null
  has_uart: number | null
  operating_temp_max: number | null
  operating_temp_min: number | null
  operating_voltage: number | null
  output_power_dbm: number | null
  package: string | null
  rx_current_ma: number | null
  sensitivity_dbm: number | null
  tx_current_ma: number | null
}

export interface WireToBoardConnector extends BaseComponentRow {
  gender: string | null
  is_smd: number | null
  mounting_style: string | null
  num_pins: number | null
  num_pins_per_row: number | null
  num_rows: number | null
  package: string | null
  pitch_mm: number | null
  reference_series: string | null
}

export interface FootprinterStrings {
  copper_iou: number | null
  footprinter_string: string | null
  lcsc: number
  updated_at: Generated<string>
}

export interface EthernetController extends BaseComponentRow {
  package: string | null
}

export interface OpticalSensor extends BaseComponentRow {
  package: string | null
  sensor_type: string | null
}

export interface DB {
  accelerometer: Accelerometer
  adc: Adc
  analog_multiplexer: AnalogMultiplexer
  barrel_jack: BarrelJack
  battery_holder: BatteryHolder
  ble_chip: BleChip
  ble_module: BleModule
  bjt_transistor: BjtTransistor
  boost_converter: BoostConverter
  buck_boost_converter: BuckBoostConverter
  capacitor: Capacitor
  component_catalog: ComponentCatalog
  dac: Dac
  psram: Psram
  dram: Dram
  ethernet_controller: EthernetController
  diode: Diode
  dimm_connector: DimmConnector
  fpc_connector: FpcConnector
  fpga: Fpga
  footprinter_strings: FootprinterStrings
  fuse: Fuse
  gas_sensor: GasSensor
  gyroscope: Gyroscope
  header: Header
  hdmi_port: HdmiPort
  io_expander: IoExpander
  jst_connector: JstConnector
  lcd_display: LcdDisplay
  ldo: Ldo
  led: Led
  led_dot_matrix_display: LedDotMatrixDisplay
  led_driver: LedDriver
  led_segment_display: LedSegmentDisplay
  led_with_ic: LedWithIc
  microcontroller: Microcontroller
  micro_usb_connector: MicroUsbConnector
  mosfet: Mosfet
  npu_chip: NpuChip
  linux_capable_processor: LinuxCapableProcessor
  oled_display: OledDisplay
  pcie_m2_connector: PcieM2Connector
  photo_diode: PhotoDiode
  optical_sensor: OpticalSensor
  potentiometer: Potentiometer
  buzzer: Buzzer
  stepper_motor_driver: StepperMotorDriver
  relay: Relay
  resistor: Resistor
  resistor_array: ResistorArray
  search_index: SearchIndex
  sodimm_connector: SodimmConnector
  spring_clamp_terminal_block: SpringClampTerminalBlock
  switch: Switch
  usb_c_connector: UsbCConnector
  voltage_regulator: VoltageRegulator
  wifi_module: WifiModule
  wire_to_board_connector: WireToBoardConnector
}
