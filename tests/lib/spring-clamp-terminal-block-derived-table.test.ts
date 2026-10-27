import { expect, test } from "bun:test"
import { springClampTerminalBlockTableSpec } from "lib/db/derivedtables/spring-clamp-terminal-block"

test("spring clamp terminal block table maps searchable attributes", () => {
  const [block] = springClampTerminalBlockTableSpec.mapToTable([
    {
      lcsc: 35616,
      mfr: "WJ142R-5.08-2P",
      description: "Spring clamp terminal block",
      stock: 186,
      basic: 0,
      preferred: 0,
      price: JSON.stringify([{ qFrom: 6, qTo: 59, price: 0.1625 }]),
      package: "Push-Pull,P=5.08mm",
      extra: JSON.stringify({
        attributes: {
          "Mounting Style": "Through Hole",
          "Voltage Rating (Max)": "300V",
          "Current Rating (Max)": "10A",
          Pitch: "5.08mm",
          "Wire Gauge - mm2": "1.5",
          "Wire Gauge - AWG": "14~22",
          "Number of PINs Per Row": "2",
        },
      }),
    } as any,
  ])

  expect(block).toMatchObject({
    lcsc: 35616,
    pitch_mm: 5.08,
    num_pins: 2,
    voltage_rating: 300,
    current_rating: 10,
    wire_gauge_mm2: 1.5,
    wire_gauge_awg: "14~22",
    mounting_style: "Through Hole",
  })
})

test("uses total pins for multi-row spring-clamp connectors", () => {
  const [block] = springClampTerminalBlockTableSpec.mapToTable([
    {
      lcsc: 3309863,
      mfr: "250-712",
      price: "[]",
      extra: JSON.stringify({
        attributes: {
          "Number of Pins": "24P",
          "Number of PINs Per Row": "12",
          "Current Rating": "10A",
          "Mounting Type": "Through Hole",
        },
      }),
    } as any,
  ])
  expect(block).toMatchObject({
    num_pins: 24,
    current_rating: 10,
    mounting_style: "Through Hole",
  })
})
