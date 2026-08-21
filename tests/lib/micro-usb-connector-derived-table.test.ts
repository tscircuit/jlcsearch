import { expect, test } from "bun:test";
import { microUsbConnectorTableSpec } from "lib/db/derivedtables/micro-usb-connector";

const makeComponent = (overrides: Record<string, unknown> = {}) =>
  ({
    lcsc: 132563,
    mfr: "10118194-0001LF",
    description: "Micro USB Type-B receptacle",
    stock: 23_802,
    basic: 0,
    preferred: 1,
    price: JSON.stringify([{ qFrom: 1, qTo: null, price: 0.199 }]),
    package: "MICRO-USB-SMD_10118194-0001LF",
    extra: JSON.stringify({
      attributes: {
        "Connector Type": "Micro USB Type-B",
        "USB Standard": "USB 2.0",
        "Mounting Style": "Surface Mount, Right Angle",
        "Current Rating": "1.8A",
        "Number of Ports": "1",
        "Number of Contacts": "5",
        Gender: "Female",
        "Operating Temperature Range": "-30℃~+80℃",
      },
    }),
    ...overrides,
  }) as any;

test("maps Micro USB connector attributes", () => {
  const [connector] = microUsbConnectorTableSpec.mapToTable([makeComponent()]);

  expect(connector).toMatchObject({
    lcsc: 132563,
    mfr: "10118194-0001LF",
    connector_type: "Micro USB Type-B",
    usb_standard: "USB 2.0",
    mounting_style: "Surface Mount, Right Angle",
    current_rating_a: 1.8,
    number_of_ports: 1,
    number_of_contacts: 5,
    gender: "Female",
    operating_temp_min: -30,
    operating_temp_max: 80,
    is_preferred: true,
    price1: 0.199,
  });
});

test("recognizes Micro USB package names when attributes are incomplete", () => {
  const [connector] = microUsbConnectorTableSpec.mapToTable([
    makeComponent({
      description: "",
      package: "MICRO-USB-SMD_U254-051T-4BH83-F1S",
      extra: null,
    }),
  ]);

  expect(connector).toMatchObject({
    connector_type: "Micro USB",
    package: "MICRO-USB-SMD_U254-051T-4BH83-F1S",
  });
});

test("excludes USB-C and Mini USB connectors", () => {
  const components = [
    makeComponent({
      mfr: "TYPE-C-31-M-12",
      description: "USB Type-C receptacle",
      package: "USB-C-SMD",
      extra: null,
    }),
    makeComponent({
      mfr: "UJ2-MBH-1-SMT",
      description: "Mini USB Type-B receptacle",
      package: "MINI-USB-SMD",
      extra: null,
    }),
  ];

  expect(microUsbConnectorTableSpec.mapToTable(components)).toEqual([
    null,
    null,
  ]);
});
