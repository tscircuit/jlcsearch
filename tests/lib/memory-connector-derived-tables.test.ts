import { expect, test } from "bun:test";
import {
  dimmConnectorTableSpec,
  sodimmConnectorTableSpec,
} from "lib/db/derivedtables/memory-connector";

const makeComponent = (overrides: Record<string, unknown> = {}) =>
  ({
    lcsc: 2922442,
    mfr: "90413-15011-21",
    description:
      "-40℃~+85℃ 20.3mm 288P DDR5 DIMM SMD,P=0.85mm Memory Connector (DDR)",
    stock: 237,
    basic: 0,
    preferred: 1,
    price: JSON.stringify([{ qFrom: 1, qTo: null, price: 2.948 }]),
    package: "SMD,P=0.85mm",
    extra: JSON.stringify({
      attributes: {
        "DDR Type": "DIMM",
        "Number of Pins": "288P",
        "Height Above Board": "20.3mm",
        "DDR SDRAM Standard": "DDR5",
        "Mounting Type": "Surface Mount",
        "Operating Temperature": "-40℃~+85℃",
      },
    }),
    ...overrides,
  }) as any;

test("DIMM table maps memory connector attributes", () => {
  const [dimm] = dimmConnectorTableSpec.mapToTable([makeComponent()]);

  expect(dimm).toMatchObject({
    lcsc: 2922442,
    mfr: "90413-15011-21",
    package: "SMD,P=0.85mm",
    ddr_standard: "DDR5",
    num_pins: 288,
    pitch_mm: 0.85,
    height_above_board_mm: 20.3,
    mounting_type: "Surface Mount",
    operating_temp_min: -40,
    operating_temp_max: 85,
    is_right_angle: false,
    is_preferred: true,
    price1: 2.948,
  });
});

test("SO-DIMM table maps right-angle connectors without leaking into DIMMs", () => {
  const component = makeComponent({
    lcsc: 962123,
    mfr: "ADDR0111-P005A",
    description:
      "260P 9.2mm DDR4 SO-DIMM Surface Mount SMD,P=0.5mm,卧贴 Memory Connector (DDR)",
    package: "SMD,P=0.5mm,Surface Mount，Right Angle",
    extra: JSON.stringify({
      attributes: {
        "DDR Type": "SO-DIMM",
        "Number of Pins": "260P",
        "Height Above Board": "9.2mm",
        "Mounting Type": "Surface Mount",
        "DDR SDRAM Standard": "DDR4",
      },
    }),
  });

  const [dimm] = dimmConnectorTableSpec.mapToTable([component]);
  const [sodimm] = sodimmConnectorTableSpec.mapToTable([component]);

  expect(dimm).toBeNull();
  expect(sodimm).toMatchObject({
    lcsc: 962123,
    ddr_standard: "DDR4",
    num_pins: 260,
    pitch_mm: 0.5,
    height_above_board_mm: 9.2,
    is_right_angle: true,
  });
});

test("DIMM table recognizes older full-size clamping-plate connectors", () => {
  const component = makeComponent({
    description:
      "0℃~+85℃ 240P Clamping plate DDR3 SMD,P=1mm Memory Connector (DDR)",
    package: "SMD,P=1mm",
    extra: JSON.stringify({
      attributes: {
        "Number of Pins": "240P",
        "DDR SDRAM Standard": "DDR3",
      },
    }),
  });

  const [dimm] = dimmConnectorTableSpec.mapToTable([component]);
  const [sodimm] = sodimmConnectorTableSpec.mapToTable([component]);

  expect(dimm).toMatchObject({
    ddr_standard: "DDR3",
    num_pins: 240,
    pitch_mm: 1,
  });
  expect(sodimm).toBeNull();
});

test("SO-DIMM table falls back to description and package metadata", () => {
  const [sodimm] = sodimmConnectorTableSpec.mapToTable([
    makeComponent({
      description:
        "-25℃~+85℃ 14mm 200P DDR2 SO-DIMM SMD,P=0.6mm Memory Connector (DDR)",
      package: "SMD,P=0.6mm",
      extra: null,
    }),
  ]);

  expect(sodimm).toMatchObject({
    ddr_standard: "DDR2",
    num_pins: 200,
    pitch_mm: 0.6,
    height_above_board_mm: 14,
    operating_temp_min: -25,
    operating_temp_max: 85,
  });
});
