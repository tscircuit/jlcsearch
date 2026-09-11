import { Database } from "bun:sqlite"
import { describe, expect, test } from "bun:test"
import { Kysely, sql } from "kysely"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { searchIndex } from "../../cf-proxy/src/search"
import { queryComponentCatalog } from "../../cf-proxy/src/components"
import { getD1Handler } from "../../cf-proxy/src/d1-routes"
import { renderD1TablePage } from "../../cf-proxy/src/render"

describe("searchIndex and componentCatalog with is_extended_promotional", () => {
  test("searchIndex filters by is_extended_promotional and returns the column", async () => {
    const database = new Database(":memory:")
    const db = new Kysely<any>({
      dialect: new BunSqliteDialect({ database }),
    })

    try {
      await sql`
        CREATE TABLE search_index (
          lcsc INTEGER PRIMARY KEY,
          mfr TEXT,
          package TEXT,
          description TEXT,
          stock INTEGER,
          price TEXT,
          price1 REAL,
          basic INTEGER,
          preferred INTEGER,
          is_extended_promotional INTEGER,
          category TEXT,
          subcategory TEXT,
          search_text TEXT
        )
      `.execute(db)

      await sql`
        INSERT INTO search_index (
          lcsc, mfr, package, description, stock, price, price1, basic, preferred, is_extended_promotional, category, subcategory, search_text
        ) VALUES
          (1001, 'MFR-BASE', '0805', 'Base Resistor', 500, '1:0.01', 0.01, 1, 0, 0, 'Resistors', 'Chip Resistor', 'mfr-base 0805 base resistor'),
          (1002, 'MFR-EXT', '0805', 'Extended Resistor', 300, '1:0.02', 0.02, 0, 0, 0, 'Resistors', 'Chip Resistor', 'mfr-ext 0805 extended resistor'),
          (1003, 'MFR-PROMO', '0805', 'Promo Resistor', 400, '1:0.015', 0.015, 0, 0, 1, 'Resistors', 'Chip Resistor', 'mfr-promo 0805 promo resistor')
      `.execute(db)

      // Test without filter: returns all 3
      const allRows = await searchIndex(db as any, {})
      expect(allRows.length).toBe(3)

      // Test with is_extended_promotional: "true"
      const promoRowsTrue = await searchIndex(db as any, { is_extended_promotional: "true" })
      expect(promoRowsTrue.length).toBe(1)
      expect(promoRowsTrue[0].lcsc).toBe(1003)
      expect(promoRowsTrue[0].is_extended_promotional).toBe(1)

      // Test with is_extended_promotional: "1"
      const promoRowsOne = await searchIndex(db as any, { is_extended_promotional: "1" })
      expect(promoRowsOne.length).toBe(1)
      expect(promoRowsOne[0].lcsc).toBe(1003)

      // Test queryComponentCatalog
      const catalogResult = await queryComponentCatalog(db as any, { is_extended_promotional: "true" })
      expect(catalogResult.length).toBe(1)
      expect(catalogResult[0].lcsc).toBe(1003)
      expect(catalogResult[0].is_extended_promotional).toBe(1)
    } finally {
      await db.destroy()
    }
  })

  test("d1-routes filters lcd_drivers and tft_display_drivers by is_extended_promotional", async () => {
    const database = new Database(":memory:")
    database.exec(`
      CREATE TABLE component_catalog (
        lcsc INTEGER PRIMARY KEY,
        mfr TEXT,
        package TEXT,
        description TEXT,
        stock INTEGER,
        price TEXT,
        basic INTEGER,
        preferred INTEGER,
        is_extended_promotional INTEGER,
        subcategory TEXT,
        extra TEXT
      );

      INSERT INTO component_catalog (
        lcsc, mfr, package, description, stock, price, basic, preferred, is_extended_promotional, subcategory, extra
      ) VALUES
        (2001, 'LCD-REG', 'QFP', 'LCD driver regular', 100, '1:1.0', 0, 0, 0, 'LCD Drivers', '{"attributes":{"Display Configurations":"32x4 bit"}}'),
        (2002, 'LCD-PROMO', 'QFP', 'LCD driver promo', 200, '1:1.0', 0, 0, 1, 'LCD Drivers', '{"attributes":{"Display Configurations":"32x4 bit"}}'),
        (3001, 'SSD1963QL9-REG', 'LQFP-128', 'TFT driver regular', 150, '1:1.0', 0, 0, 0, 'LED Drivers', '{"attributes":{"Display Configurations":"864x480"}}'),
        (3002, 'SSD1963QL9-PROMO', 'LQFP-128', 'TFT driver promo', 250, '1:1.0', 0, 0, 1, 'LED Drivers', '{"attributes":{"Display Configurations":"864x480"}}');
    `)

    const db = new Kysely<any>({
      dialect: new BunSqliteDialect({ database }),
    })

    try {
      const lcdHandler = getD1Handler("/lcd_drivers/list")
      expect(lcdHandler).not.toBeNull()

      const lcdResult = await lcdHandler!(db as any, { is_extended_promotional: "true" })
      const lcdList = lcdResult.data.lcd_drivers as any[]
      expect(lcdList).toHaveLength(1)
      expect(lcdList[0].lcsc).toBe(2002)
      expect(lcdList[0].is_extended_promotional).toBe(true)

      const tftHandler = getD1Handler("/tft_display_drivers/list")
      expect(tftHandler).not.toBeNull()

      const tftResult = await tftHandler!(db as any, { is_extended_promotional: "true" })
      const tftList = tftResult.data.tft_display_drivers as any[]
      expect(tftList).toHaveLength(1)
      expect(tftList[0].lcsc).toBe(3002)
      expect(tftList[0].is_extended_promotional).toBe(true)
    } finally {
      await db.destroy()
    }
  })

  test("renderD1TablePage includes extended promotional checkbox and labels", () => {
    const html = renderD1TablePage(
      "/components/list",
      {
        components: [
          {
            lcsc: 1003,
            mfr: "MFR-PROMO",
            stock: 400,
            is_extended_promotional: 1,
          },
        ],
      },
      { is_extended_promotional: "true" },
    )

    expect(html).toContain('name="is_extended_promotional"')
    expect(html).toContain("Extended Promotional")
    expect(html).toContain('checked')
  })
})
