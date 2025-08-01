/**
 * This file was generated by kysely-codegen.
 * Please do not edit it manually.
 */

import type { ColumnType } from "kysely";

export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;

export interface Accelerometer {
  attributes: string | null;
  axes: string | null;
  description: string | null;
  has_i2c: number | null;
  has_spi: number | null;
  has_uart: number | null;
  in_stock: number | null;
  lcsc: Generated<number | null>;
  mfr: string | null;
  operating_temp_max: number | null;
  operating_temp_min: number | null;
  package: string | null;
  price1: number | null;
  stock: number | null;
  supply_voltage_max: number | null;
  supply_voltage_min: number | null;
}

export interface Adc {
  attributes: string | null;
  description: string | null;
  has_i2c: number | null;
  has_parallel_interface: number | null;
  has_serial_interface: number | null;
  has_spi: number | null;
  has_uart: number | null;
  in_stock: number | null;
  is_differential: number | null;
  lcsc: Generated<number | null>;
  mfr: string | null;
  num_channels: number | null;
  operating_temp_max: number | null;
  operating_temp_min: number | null;
  package: string | null;
  price1: number | null;
  resolution_bits: number | null;
  sampling_rate_hz: number | null;
  stock: number | null;
  supply_voltage_max: number | null;
  supply_voltage_min: number | null;
}

export interface AnalogMultiplexer {
  attributes: string | null;
  channel_type: string | null;
  description: string | null;
  has_enable: number | null;
  has_i2c: number | null;
  has_parallel_interface: number | null;
  has_spi: number | null;
  in_stock: number | null;
  lcsc: Generated<number | null>;
  leakage_current_na: number | null;
  mfr: string | null;
  num_bits: number | null;
  num_channels: number | null;
  on_resistance_ohms: number | null;
  operating_temp_max: number | null;
  operating_temp_min: number | null;
  package: string | null;
  price1: number | null;
  stock: number | null;
  supply_voltage_max: number | null;
  supply_voltage_min: number | null;
}

export interface BjtTransistor {
  attributes: string | null;
  collector_current: number | null;
  collector_emitter_voltage: number | null;
  current_gain: number | null;
  description: string | null;
  in_stock: number | null;
  lcsc: Generated<number | null>;
  mfr: string | null;
  package: string | null;
  power_dissipation: number | null;
  price1: number | null;
  stock: number | null;
  temperature_range: string | null;
  transition_frequency: number | null;
}

export interface BoostConverter {
  attributes: string | null;
  description: string | null;
  in_stock: number | null;
  input_voltage_max: number | null;
  input_voltage_min: number | null;
  is_synchronous: number | null;
  lcsc: Generated<number | null>;
  mfr: string | null;
  number_of_outputs: number | null;
  output_current_max: number | null;
  output_voltage_max: number | null;
  output_voltage_min: number | null;
  package: string | null;
  price1: number | null;
  stock: number | null;
  switching_frequency: number | null;
  topology: string | null;
}

export interface BuckBoostConverter {
  attributes: string | null;
  description: string | null;
  in_stock: number | null;
  input_voltage_max: number | null;
  input_voltage_min: number | null;
  is_synchronous: number | null;
  lcsc: Generated<number | null>;
  mfr: string | null;
  number_of_outputs: number | null;
  output_current_max: number | null;
  output_voltage_max: number | null;
  output_voltage_min: number | null;
  package: string | null;
  price1: number | null;
  stock: number | null;
  switching_frequency: number | null;
  topology: string | null;
}

export interface Capacitor {
  attributes: string | null;
  capacitance_farads: number | null;
  capacitor_type: string | null;
  description: string | null;
  esr_ohms: number | null;
  in_stock: number | null;
  is_polarized: number | null;
  is_surface_mount: number | null;
  lcsc: Generated<number | null>;
  lifetime_hours: number | null;
  mfr: string | null;
  package: string | null;
  price1: number | null;
  ripple_current_amps: number | null;
  stock: number | null;
  temperature_coefficient: string | null;
  tolerance_fraction: number | null;
  voltage_rating: number | null;
}

export interface Category {
  category: string;
  id: Generated<number>;
  subcategory: string;
}

export interface Component {
  basic: number;
  category_id: number;
  datasheet: string;
  description: string;
  extra: string | null;
  flag: Generated<number>;
  joints: number;
  last_on_stock: Generated<number>;
  last_update: number;
  lcsc: Generated<number>;
  manufacturer_id: number;
  mfr: string;
  package: string;
  preferred: Generated<number>;
  price: string;
  stock: number;
}

export interface ComponentsFt {
  description: string | null;
  lcsc: string | null;
  mfr: string | null;
  mfr_chars: string | null;
}

export interface ComponentsFtsConfig {
  k: string;
  v: string | null;
}

export interface ComponentsFtsContent {
  c0: string | null;
  c1: string | null;
  c2: string | null;
  c3: string | null;
  id: Generated<number | null>;
}

export interface ComponentsFtsDatum {
  block: Buffer | null;
  id: Generated<number | null>;
}

export interface ComponentsFtsDocsize {
  id: Generated<number | null>;
  sz: Buffer | null;
}

export interface ComponentsFtsIdx {
  pgno: string | null;
  segid: string;
  term: string;
}

export interface Dac {
  attributes: string | null;
  description: string | null;
  has_i2c: number | null;
  has_parallel_interface: number | null;
  has_spi: number | null;
  in_stock: number | null;
  lcsc: Generated<number | null>;
  mfr: string | null;
  nonlinearity_lsb: number | null;
  num_channels: number | null;
  operating_temp_max: number | null;
  operating_temp_min: number | null;
  output_type: string | null;
  package: string | null;
  price1: number | null;
  resolution_bits: number | null;
  settling_time_us: number | null;
  stock: number | null;
  supply_voltage_max: number | null;
  supply_voltage_min: number | null;
}

export interface Diode {
  attributes: string | null;
  configuration: string | null;
  description: string | null;
  diode_type: string | null;
  forward_current: number | null;
  forward_voltage: number | null;
  in_stock: number | null;
  is_schottky: number | null;
  is_tvs: number | null;
  is_zener: number | null;
  lcsc: Generated<number | null>;
  mfr: string | null;
  operating_temp_max: number | null;
  operating_temp_min: number | null;
  package: string | null;
  power_dissipation_watts: number | null;
  price1: number | null;
  recovery_time_ns: number | null;
  reverse_leakage_current: number | null;
  reverse_voltage: number | null;
  stock: number | null;
}

export interface Fuse {
  attributes: string | null;
  current_rating: number | null;
  description: string | null;
  in_stock: number | null;
  is_glass_encased: number | null;
  is_resettable: number | null;
  is_surface_mount: number | null;
  lcsc: Generated<number | null>;
  mfr: string | null;
  package: string | null;
  price1: number | null;
  response_time: string | null;
  stock: number | null;
  voltage_rating: number | null;
}

export interface GasSensor {
  attributes: string | null;
  description: string | null;
  in_stock: number | null;
  lcsc: Generated<number | null>;
  measures_air_quality: number | null;
  measures_carbon_monoxide: number | null;
  measures_co2: number | null;
  measures_explosive_gases: number | null;
  measures_formaldehyde: number | null;
  measures_hydrogen: number | null;
  measures_methane: number | null;
  measures_nitrogen_oxides: number | null;
  measures_oxygen: number | null;
  measures_sulfur_hexafluoride: number | null;
  measures_volatile_organic_compounds: number | null;
  mfr: string | null;
  package: string | null;
  price1: number | null;
  sensor_type: string | null;
  stock: number | null;
}

export interface Gyroscope {
  attributes: string | null;
  axes: string | null;
  description: string | null;
  has_i2c: number | null;
  has_spi: number | null;
  has_uart: number | null;
  in_stock: number | null;
  lcsc: Generated<number | null>;
  mfr: string | null;
  operating_temp_max: number | null;
  operating_temp_min: number | null;
  package: string | null;
  price1: number | null;
  stock: number | null;
  supply_voltage_max: number | null;
  supply_voltage_min: number | null;
}

export interface Header {
  attributes: string | null;
  contact_material: string | null;
  contact_plating: string | null;
  current_rating_amp: number | null;
  description: string | null;
  gender: string | null;
  in_stock: number | null;
  insulation_height_mm: number | null;
  is_right_angle: number | null;
  is_shrouded: number | null;
  lcsc: Generated<number | null>;
  mfr: string | null;
  mounting_style: string | null;
  num_pins: number | null;
  num_pins_per_row: number | null;
  num_rows: number | null;
  operating_temperature_max: number | null;
  operating_temperature_min: number | null;
  package: string | null;
  pin_length_mm: number | null;
  pitch_mm: number | null;
  price1: number | null;
  row_spacing_mm: number | null;
  stock: number | null;
  voltage_rating_volt: number | null;
}

export interface IoExpander {
  attributes: string | null;
  clock_frequency_hz: number | null;
  description: string | null;
  has_i2c: number | null;
  has_interrupt: number | null;
  has_smbus: number | null;
  has_spi: number | null;
  in_stock: number | null;
  lcsc: Generated<number | null>;
  mfr: string | null;
  num_gpios: number | null;
  operating_temp_max: number | null;
  operating_temp_min: number | null;
  output_type: string | null;
  package: string | null;
  price1: number | null;
  sink_current_ma: number | null;
  source_current_ma: number | null;
  stock: number | null;
  supply_voltage_max: number | null;
  supply_voltage_min: number | null;
}

export interface LcdDisplay {
  attributes: string | null;
  description: string | null;
  display_size: string | null;
  display_type: string | null;
  in_stock: number | null;
  lcsc: Generated<number | null>;
  mfr: string | null;
  package: string | null;
  price1: number | null;
  resolution: string | null;
  stock: number | null;
}

export interface Led {
  attributes: string | null;
  color: string | null;
  description: string | null;
  forward_current: number | null;
  forward_voltage: number | null;
  in_stock: number | null;
  is_rgb: number | null;
  lcsc: Generated<number | null>;
  lens_color: string | null;
  luminous_intensity_mcd: number | null;
  mfr: string | null;
  mounting_style: string | null;
  operating_temp_max: number | null;
  operating_temp_min: number | null;
  package: string | null;
  power_dissipation_mw: number | null;
  price1: number | null;
  stock: number | null;
  viewing_angle_deg: number | null;
  wavelength_nm: number | null;
}

export interface LedDotMatrixDisplay {
  attributes: string | null;
  color: string | null;
  description: string | null;
  in_stock: number | null;
  lcsc: Generated<number | null>;
  matrix_size: string | null;
  mfr: string | null;
  package: string | null;
  price1: number | null;
  stock: number | null;
}

export interface LedDriver {
  attributes: string | null;
  channel_count: number | null;
  description: string | null;
  dimming_method: string | null;
  efficiency_percent: number | null;
  in_stock: number | null;
  lcsc: Generated<number | null>;
  mfr: string | null;
  mounting_style: string | null;
  operating_temp_max: number | null;
  operating_temp_min: number | null;
  output_current_max: number | null;
  package: string | null;
  price1: number | null;
  protection_features: string | null;
  stock: number | null;
  supply_voltage_max: number | null;
  supply_voltage_min: number | null;
}

export interface LedSegmentDisplay {
  attributes: string | null;
  color: string | null;
  description: string | null;
  in_stock: number | null;
  lcsc: Generated<number | null>;
  mfr: string | null;
  package: string | null;
  positions: string | null;
  price1: number | null;
  size: string | null;
  stock: number | null;
  type: string | null;
}

export interface LedWithIc {
  attributes: string | null;
  color: string | null;
  description: string | null;
  forward_current: number | null;
  forward_voltage: number | null;
  in_stock: number | null;
  lcsc: Generated<number | null>;
  mfr: string | null;
  mounting_style: string | null;
  package: string | null;
  price1: number | null;
  protocol: string | null;
  stock: number | null;
}

export interface Manufacturer {
  id: Generated<number>;
  name: string;
}

export interface Microcontroller {
  adc_resolution_bits: number | null;
  attributes: string | null;
  cpu_core: string | null;
  cpu_speed_hz: number | null;
  dac_resolution_bits: number | null;
  description: string | null;
  eeprom_size_bytes: number | null;
  flash_size_bytes: number | null;
  gpio_count: number | null;
  has_adc: number | null;
  has_can: number | null;
  has_comparator: number | null;
  has_dac: number | null;
  has_dma: number | null;
  has_i2c: number | null;
  has_pwm: number | null;
  has_rtc: number | null;
  has_spi: number | null;
  has_uart: number | null;
  has_usb: number | null;
  has_watchdog: number | null;
  in_stock: number | null;
  lcsc: Generated<number | null>;
  mfr: string | null;
  operating_temp_max: number | null;
  operating_temp_min: number | null;
  package: string | null;
  price1: number | null;
  ram_size_bytes: number | null;
  stock: number | null;
  supply_voltage_max: number | null;
  supply_voltage_min: number | null;
}

export interface Mosfet {
  attributes: string | null;
  continuous_drain_current: number | null;
  description: string | null;
  drain_source_voltage: number | null;
  gate_threshold_voltage: number | null;
  in_stock: number | null;
  lcsc: Generated<number | null>;
  mfr: string | null;
  mounting_style: string | null;
  operating_temp_max: number | null;
  operating_temp_min: number | null;
  package: string | null;
  power_dissipation: number | null;
  price1: number | null;
  stock: number | null;
}

export interface OledDisplay {
  attributes: string | null;
  description: string | null;
  display_width: string | null;
  in_stock: number | null;
  lcsc: Generated<number | null>;
  mfr: string | null;
  package: string | null;
  pixel_resolution: string | null;
  price1: number | null;
  protocol: string | null;
  stock: number | null;
}

export interface PcieM2Connector {
  attributes: string | null;
  description: string | null;
  in_stock: number | null;
  is_right_angle: number | null;
  key: string | null;
  lcsc: Generated<number | null>;
  mfr: string | null;
  price1: number | null;
  stock: number | null;
}

export interface Potentiometer {
  attributes: string | null;
  description: string | null;
  in_stock: number | null;
  is_surface_mount: number | null;
  lcsc: Generated<number | null>;
  max_resistance: number | null;
  mfr: string | null;
  package: string | null;
  pin_variant: string | null;
  price1: number | null;
  stock: number | null;
}

export interface Relay {
  attributes: string | null;
  coil_resistance: number | null;
  coil_voltage: number | null;
  contact_form: string | null;
  description: string | null;
  in_stock: number | null;
  lcsc: Generated<number | null>;
  max_switching_current: number | null;
  max_switching_voltage: number | null;
  mfr: string | null;
  package: string | null;
  pin_number: number | null;
  price1: number | null;
  relay_type: string | null;
  stock: number | null;
}

export interface Resistor {
  attributes: string | null;
  description: string | null;
  in_stock: number | null;
  is_multi_resistor_chip: number | null;
  is_potentiometer: number | null;
  is_surface_mount: number | null;
  lcsc: Generated<number | null>;
  max_overload_voltage: number | null;
  mfr: string | null;
  number_of_pins: number | null;
  number_of_resistors: number | null;
  package: string | null;
  power_watts: number | null;
  price1: number | null;
  resistance: number | null;
  stock: number | null;
  tolerance_fraction: number | null;
}

export interface Switch {
  attributes: string | null;
  circuit: string | null;
  current_rating_a: number | null;
  description: string | null;
  in_stock: number | null;
  is_latching: number | null;
  lcsc: Generated<number | null>;
  length_mm: number | null;
  mfr: string | null;
  mounting_style: string | null;
  operating_temp_max: number | null;
  operating_temp_min: number | null;
  package: string | null;
  pin_count: number | null;
  price1: number | null;
  stock: number | null;
  switch_height_mm: number | null;
  switch_type: string | null;
  voltage_rating_v: number | null;
  width_mm: number | null;
}

export interface UsbCConnector {
  attributes: string | null;
  current_rating_a: number | null;
  description: string | null;
  gender: string | null;
  in_stock: number | null;
  lcsc: Generated<number | null>;
  mfr: string | null;
  mounting_style: string | null;
  number_of_contacts: number | null;
  number_of_ports: number | null;
  operating_temp_max: number | null;
  operating_temp_min: number | null;
  package: string | null;
  price1: number | null;
  stock: number | null;
}

export interface VComponent {
  basic: number | null;
  category: string | null;
  category_id: number | null;
  datasheet: string | null;
  description: string | null;
  extra: string | null;
  joints: number | null;
  last_on_stock: number | null;
  lcsc: number | null;
  manufacturer: string | null;
  mfr: string | null;
  package: string | null;
  preferred: number | null;
  price: string | null;
  stock: number | null;
  subcategory: string | null;
}

export interface VoltageRegulator {
  attributes: string | null;
  description: string | null;
  dropout_voltage: number | null;
  in_stock: number | null;
  input_voltage_max: number | null;
  input_voltage_min: number | null;
  is_low_dropout: number | null;
  is_positive: number | null;
  lcsc: Generated<number | null>;
  mfr: string | null;
  operating_temp_max: number | null;
  operating_temp_min: number | null;
  output_current_max: number | null;
  output_noise_uvrms: number | null;
  output_type: string | null;
  output_voltage_max: number | null;
  output_voltage_min: number | null;
  package: string | null;
  power_supply_rejection_db: number | null;
  price1: number | null;
  quiescent_current: number | null;
  stock: number | null;
  topology: string | null;
}

export interface WifiModule {
  antenna_type: string | null;
  attributes: string | null;
  core_processor: string | null;
  description: string | null;
  frequency_ghz: number | null;
  has_adc: number | null;
  has_gpio: number | null;
  has_i2c: number | null;
  has_pwm: number | null;
  has_spi: number | null;
  has_uart: number | null;
  in_stock: number | null;
  lcsc: Generated<number | null>;
  mfr: string | null;
  operating_temp_max: number | null;
  operating_temp_min: number | null;
  operating_voltage: number | null;
  output_power_dbm: number | null;
  package: string | null;
  price1: number | null;
  rx_current_ma: number | null;
  sensitivity_dbm: number | null;
  stock: number | null;
  tx_current_ma: number | null;
}

export interface DB {
  accelerometer: Accelerometer;
  adc: Adc;
  analog_multiplexer: AnalogMultiplexer;
  bjt_transistor: BjtTransistor;
  boost_converter: BoostConverter;
  buck_boost_converter: BuckBoostConverter;
  capacitor: Capacitor;
  categories: Category;
  components: Component;
  components_fts: ComponentsFt;
  components_fts_config: ComponentsFtsConfig;
  components_fts_content: ComponentsFtsContent;
  components_fts_data: ComponentsFtsDatum;
  components_fts_docsize: ComponentsFtsDocsize;
  components_fts_idx: ComponentsFtsIdx;
  dac: Dac;
  diode: Diode;
  fuse: Fuse;
  gas_sensor: GasSensor;
  gyroscope: Gyroscope;
  header: Header;
  io_expander: IoExpander;
  lcd_display: LcdDisplay;
  led: Led;
  led_dot_matrix_display: LedDotMatrixDisplay;
  led_driver: LedDriver;
  led_segment_display: LedSegmentDisplay;
  led_with_ic: LedWithIc;
  manufacturers: Manufacturer;
  microcontroller: Microcontroller;
  mosfet: Mosfet;
  oled_display: OledDisplay;
  pcie_m2_connector: PcieM2Connector;
  potentiometer: Potentiometer;
  relay: Relay;
  resistor: Resistor;
  switch: Switch;
  usb_c_connector: UsbCConnector;
  v_components: VComponent;
  voltage_regulator: VoltageRegulator;
  wifi_module: WifiModule;
}
