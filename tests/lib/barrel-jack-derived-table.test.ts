import { expect, test } from "bun:test";
import { barrelJackTableSpec } from "lib/db/derivedtables/barrel-jack";

const makeComponent = (overrides: Record<string, unknown> = {}) =>
  ({
    lcsc: 16214,
    mfr: "DC-005 2.0",
    description:
      "-25℃~+85℃ 12V 1A 2mm 6.4mm DC Power Jack Right Angle Plugin DC Power Connectors",
    stock: 27_206,
    joints: 3,
    basic: 0,
    preferred: 1,
    price: JSON.stringify([{ qFrom: 1, qTo: null, price: 0.0487 }]),
    package: "Plugin",
    extra: JSON.stringify({
      attributes: {
        "Mounting Style": "Shrouded",
        "Voltage Rating (Max)": "12V",
        "Current Rating (Max)": "1A",
        "Operating Temperature Range": "-25℃~+85℃",
        "Connector Type": "DC Power Receptacle",
        "Outside Contact Diameter": "6.4mm",
        "Inside Contact Diameter": "2mm",
      },
    }),
    ...overrides,
  }) as any;

test("maps DC barrel jack dimensions and electrical ratings", () => {
  const [jack] = barrelJackTableSpec.mapToTable([makeComponent()]);

  expect(jack).toMatchObject({
    lcsc: 16214,
    mfr: "DC-005 2.0",
    connector_type: "DC Power Receptacle",
    mounting_style: "Through Hole",
    orientation: "Right Angle",
    inside_diameter_mm: 2,
    outside_diameter_mm: 6.4,
    current_rating_a: 1,
    voltage_rating_v: 12,
    num_pins: 3,
    operating_temp_min: -25,
    operating_temp_max: 85,
    is_preferred: true,
    price1: 0.0487,
  });
});

test("falls back to catalog descriptions when attributes are incomplete", () => {
  const [jack] = barrelJackTableSpec.mapToTable([
    makeComponent({
      lcsc: 7498153,
      mfr: "XDJK-0051-025",
      description:
        "-40℃~+85℃ 2.1mm 3A 500V 6.3mm DC Power Jack Right Angle Plugin",
      extra: null,
    }),
  ]);

  expect(jack).toMatchObject({
    inside_diameter_mm: 2.1,
    outside_diameter_mm: 6.3,
    current_rating_a: 3,
    voltage_rating_v: 500,
    mounting_style: "Through Hole",
    orientation: "Right Angle",
    operating_temp_min: -40,
    operating_temp_max: 85,
  });
});

test("excludes DC plugs and unrelated audio jacks", () => {
  const components = [
    makeComponent({
      mfr: "DC-PLUG-21",
      description: "DC Power Plug 2.1mm",
      joints: 2,
      extra: null,
    }),
    makeComponent({
      mfr: "PJ-327C",
      description: "3.5mm Headphone Jack",
      joints: 4,
      extra: null,
    }),
  ];

  expect(barrelJackTableSpec.mapToTable(components)).toEqual([null, null]);
});
