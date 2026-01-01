import { withWinterSpec } from "lib/with-winter-spec"
import { z } from "zod"

export default withWinterSpec({
  auth: "none",
  methods: ["HEAD", "GET", "POST"],
  jsonResponse: z.any(),
} as const)(async (req, ctx) => {
  if (req.method === "HEAD") {
    return new Response(null, { status: 200 })
  }

  return ctx.react(
    <div>
      <div className="flex flex-wrap gap-4 *:text-lg *:border *:rounded *:p-2 *:border-gray-300 *:w-32 *:text-sm *:text-center">
        <a href="/categories/list">Categories</a>
        <a href="/footprint_index/list">Footprint Index</a>
        <a href="/resistors/list">Resistors</a>
        <a href="/resistor_arrays/list">Resistor Arrays</a>
        <a href="/capacitors/list">Capacitors</a>
        <a href="/potentiometers/list">Potentiometers</a>
        <a href="/headers/list">Headers</a>
        <a href="/usb_c_connectors/list">USB-C Connectors</a>
        <a href="/pcie_m2_connectors/list">PCIe M.2 Connectors</a>
        <a href="/fpc_connectors/list">FPC Connectors</a>
        <a href="/jst_connectors/list">JST Connectors</a>
        <a href="/wire_to_board_connectors/list">Wire to Board Connectors</a>
        <a href="/battery_holders/list">Battery Holders</a>
        <a href="/leds/list">LEDs</a>
        <a href="/adcs/list">ADCs</a>
        <a href="/analog_multiplexers/list">Analog Muxes</a>
        <a href="/analog_switches/list">Analog Switches</a>
        <a href="/io_expanders/list">I/O Expanders</a>
        <a href="/gyroscopes/list">Gyroscopes</a>
        <a href="/accelerometers/list">Accelerometers</a>
        <a href="/gas_sensors/list">Gas Sensors</a>
        <a href="/reflective_optical_interrupters/list">
          Reflective Optical Interrupters
        </a>
        <a href="/diodes/list">Diodes</a>
        <a href="/dacs/list">DACs</a>
        <a href="/wifi_modules/list">WiFi Modules</a>
        <a href="/microcontrollers/list">Microcontrollers</a>
        <a href="/arm_processors/list">ARM Processors</a>
        <a href="/risc_v_processors/list">RISC-V Processors</a>
        <a href="/fpgas/list">FPGAs &amp; CPLDs</a>
        <a href="/voltage_regulators/list">Voltage Regulators</a>
        <a href="/ldos/list">LDO Regulators</a>
        <a href="/boost_converters/list">Boost DC-DC Converters</a>
        <a href="/buck_boost_converters/list">Buck-Boost DC-DC Converters</a>
        <a href="/led_drivers/list">LED Drivers</a>
        <a href="/mosfets/list">Mosfets</a>
        <a href="/led_with_ic/list">LED with ICs</a>
        <a href="/led_dot_matrix_display/list">
          LED Dot Matrix Displays Modules
        </a>
        <a href="/oled_display/list"> OLED Displays Modules</a>
        <a href="/led_segment_display/list">LED Segment Display Modules</a>
        <a href="/lcd_display/list">LCD Display Modules</a>
        <a href="/switches/list">Switches</a>
        <a href="/relays/list">Relays</a>
        <a href="/fuses/list">Fuses</a>
        <a href="/bjt_transistors/list">BJT Transistors</a>
      </div>
    </div>,
  )
})
