import { expect, test } from "bun:test"
import { headerTableSpec } from "lib/db/derivedtables/header"

test("header table derives two rows from C492422 Pin Structure", () => {
  const [header] = headerTableSpec.mapToTable([
    {
      lcsc: 492422,
      mfr: "PZ254V-12-10P",
      description: "",
      package: "插件,P=2.54mm",
      stock: 22829,
      basic: 0,
      preferred: 0,
      price: '[{"qFrom":1,"qTo":null,"price":0.049142857}]',
      category_id: 0,
      manufacturer_id: 0,
      datasheet: "",
      flag: 0,
      joints: 10,
      last_on_stock: 0,
      last_update: 0,
      extra: JSON.stringify({
        attributes: {
          Pitch: "2.54mm",
          "Number of Pins": "10P",
          "Number of Rows": "双排",
          "Pin Structure": "2x5P",
          "Row Spacing": "2.54mm",
        },
      }),
    },
  ])

  expect({
    supplierRowAttribute: header?.attributes["Number of Rows"],
    supplierPinStructure: header?.attributes["Pin Structure"],
    numRows: header?.num_rows,
    numPins: header?.num_pins,
    numPinsPerRow: header?.num_pins_per_row,
  }).toMatchSnapshot()

  expect(header?.num_rows).toBe(2)
  expect(header?.num_pins_per_row).toBe(5)
  expect(header?.num_pins).toBe(10)
})
