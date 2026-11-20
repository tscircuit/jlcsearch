import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { Kysely } from "kysely"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { accelerometerTableSpec } from "lib/db/derivedtables/accelerometer"
import { gyroscopeTableSpec } from "lib/db/derivedtables/gyroscope"
import { setupDerivedTables } from "lib/db/derivedtables/setup-derived-tables"

test("accelerometer and gyroscope classify JLCPCB motion sensors and parse current attributes", async () => {
  const database = new Database(":memory:")
  const db = new Kysely<any>({
    dialect: new BunSqliteDialect({ database }),
  })

  try {
    await db.schema
      .createTable("categories")
      .addColumn("id", "integer", (col) => col.primaryKey())
      .addColumn("category", "text", (col) => col.notNull())
      .addColumn("subcategory", "text", (col) => col.notNull())
      .execute()
    await db.schema
      .createTable("components")
      .addColumn("lcsc", "integer", (col) => col.primaryKey())
      .addColumn("category_id", "integer", (col) => col.notNull())
      .addColumn("mfr", "text")
      .addColumn("description", "text")
      .addColumn("stock", "integer")
      .addColumn("price", "text")
      .addColumn("basic", "integer")
      .addColumn("preferred", "integer")
      .addColumn("package", "text")
      .addColumn("extra", "text")
      .execute()

    await db
      .insertInto("categories")
      .values([
        {
          id: 1,
          category: "Sensors",
          subcategory: "Accelerometers",
        },
        {
          id: 2,
          category: "Sensors",
          subcategory: "Attitude Sensor/Gyroscope",
        },
        {
          id: 3,
          category: "Sensors",
          subcategory: "Motion Sensors - Gyroscopes",
        },
        {
          id: 4,
          category: "Sensors",
          subcategory: "Motion Sensors - IMUs (Inertial Measurement Units)",
        },
        {
          id: 5,
          category: "Relays",
          subcategory: "Solid State Relays (MOS Output)",
        },
      ])
      .execute()

    await db
      .insertInto("components")
      .values([
        {
          lcsc: 662364,
          category_id: 2,
          mfr: "ADXL354BEZ-RL7",
          description:
            "-40℃~+125℃ 2.25V~3.6V 21uA Accelerometer X,Y,Z ±8g LCC-14(6x6) Accelerometers ROHS",
          stock: 120,
          price: "1-9:22.4",
          basic: 0,
          preferred: 0,
          package: "LCC-14(6x6)",
          extra: JSON.stringify({
            attributes: {
              "Sensor Type": "Accelerometer",
              "Acceleration Measurement Range (MAX)": "±8g",
              "Accelerometer Sensing Axis": "X,Y,Z",
              "Voltage - Supply": "2.25V~3.6V",
              "Operating Temperature": "-40℃~+125℃",
            },
          }),
        },
        {
          lcsc: 15134,
          category_id: 1,
          mfr: "LIS3DHTR",
          description:
            "-40℃~+85℃ 1.71V~3.6V 16bit 500nA Accelerometer SPI、I2C X,Y,Z ±16g LGA-16(3x3) Accelerometers ROHS",
          stock: 15000,
          price: "1-99:0.42",
          basic: 0,
          preferred: 1,
          package: "LGA-16(3x3)",
          extra: JSON.stringify({
            attributes: {
              "Sensor Type": "Accelerometer",
              "Acceleration Measurement Range (MAX)": "±16g",
              "Accelerometer Sensing Axis": "X, Y, Z",
              "Voltage - Supply": "1.71V~3.6V",
              "Operating temperature": "-40°C ~ 85°C",
              Interface: "SPI, I2C",
            },
          }),
        },
        {
          lcsc: 967633,
          category_id: 1,
          mfr: "LSM6DS3TR-C",
          description:
            "-40℃~+85℃ 1.71V~3.6V 16bit 3uA 4KB IMU (accelerometer + gyroscope) SPI、I2C X,Y,Z X,Y,Z ±16g ±2000dps LGA-14(2.5x3) Accelerometers ROHS",
          stock: 25000,
          price: "1-99:1.15",
          basic: 0,
          preferred: 1,
          package: "LGA-14(2.5x3)",
          extra: JSON.stringify({
            attributes: {
              "Sensor Type": "IMU (accelerometer + gyroscope)",
              "Acceleration Measurement Range (MAX)": "±16g",
              "Accelerometer Sensing Axis": "X,Y,Z",
              "Gyroscope Measurement Range (MAX)": "±2000dps",
              "Gyroscope Sensing Axis": "X,Y,Z",
              "Voltage - Supply": "1.71V~3.6V",
              "Operating Temperature": "-40℃~+85℃",
              Interface: "SPI, I2C",
            },
          }),
        },
        {
          lcsc: 95231,
          category_id: 3,
          mfr: "L3GD20HTR",
          description:
            "-40℃~+85℃ 2.2V~3.6V Gyroscope SPI, I2C X,Y,Z ±2000dps LGA-16(3x3) Gyroscopes ROHS",
          stock: 800,
          price: "1-99:2.85",
          basic: 0,
          preferred: 0,
          package: "LGA-16(3x3)",
          extra: JSON.stringify({
            attributes: {
              "Sensor Type": "Gyroscope",
              "Gyroscope Measurement Range (MAX)": "±2000dps",
              "Gyroscope Sensing Axis": "X,Y,Z",
              "Voltage - Supply": "2.2V~3.6V",
              "Operating Temperature": "-40℃~+85℃",
              Interface: "I2C, SPI",
            },
          }),
        },
        {
          lcsc: 300100,
          category_id: 4,
          mfr: "BNO085",
          description: "9-axis SiP IMU I2C SPI UART QFN-28 ROHS",
          stock: 350,
          price: "1-9:8.9",
          basic: 0,
          preferred: 0,
          package: "QFN-28",
          extra: JSON.stringify({
            attributes: {
              "Sensor Type": "9-Axis IMU",
              Axes: "3-Axis",
              "Operating Supply Voltage": "2.4V - 3.6V",
              "Operating Temperature": "-40℃~+85℃",
              "Communication Interface": "I2C, SPI, UART",
            },
          }),
        },
        {
          lcsc: 19188597,
          category_id: 5,
          mfr: "GAQW214EH",
          description: "DPST Solid State Relay SMD-8P",
          stock: 5000,
          price: "1-99:0.5",
          basic: 0,
          preferred: 0,
          package: "SMD-8P",
          extra: JSON.stringify({ attributes: {} }),
        },
      ])
      .execute()

    await setupDerivedTables({
      db,
      tableNames: ["accelerometer", "gyroscope"],
      logger: () => {},
    })

    const accelerometers = await db
      .selectFrom("accelerometer")
      .selectAll()
      .orderBy("lcsc", "asc")
      .execute()
    const gyroscopes = await db
      .selectFrom("gyroscope")
      .selectAll()
      .orderBy("lcsc", "asc")
      .execute()

    expect(accelerometers.map((r: any) => r.lcsc)).toEqual([
      15134, 300100, 662364, 967633,
    ])
    expect(gyroscopes.map((r: any) => r.lcsc)).toEqual([95231, 300100, 967633])

    const adxl354 = accelerometers.find((r: any) => r.lcsc === 662364)
    expect(adxl354).toMatchObject({
      mfr: "ADXL354BEZ-RL7",
      supply_voltage_min: 2.25,
      supply_voltage_max: 3.6,
      operating_temp_min: -40,
      operating_temp_max: 125,
      axes: "X,Y,Z",
      has_i2c: 0,
      has_spi: 0,
      has_uart: 0,
    })

    const lis3dh = accelerometers.find((r: any) => r.lcsc === 15134)
    expect(lis3dh).toMatchObject({
      mfr: "LIS3DHTR",
      supply_voltage_min: 1.71,
      supply_voltage_max: 3.6,
      operating_temp_min: -40,
      operating_temp_max: 85,
      axes: "X,Y,Z",
      has_i2c: 1,
      has_spi: 1,
      has_uart: 0,
    })

    const lsm6ds3Gyro = gyroscopes.find((r: any) => r.lcsc === 967633)
    expect(lsm6ds3Gyro).toMatchObject({
      mfr: "LSM6DS3TR-C",
      supply_voltage_min: 1.71,
      supply_voltage_max: 3.6,
      operating_temp_min: -40,
      operating_temp_max: 85,
      axes: "X,Y,Z",
      has_i2c: 1,
      has_spi: 1,
      has_uart: 0,
    })

    const bno085Gyro = gyroscopes.find((r: any) => r.lcsc === 300100)
    expect(bno085Gyro).toMatchObject({
      mfr: "BNO085",
      supply_voltage_min: 2.4,
      supply_voltage_max: 3.6,
      axes: "X,Y,Z",
      has_i2c: 1,
      has_spi: 1,
      has_uart: 1,
    })
  } finally {
    await db.destroy()
    database.close()
  }
})

test("accelerometer and gyroscope fall back to description and MPN when extra is missing", () => {
  const mpu6050 = {
    lcsc: 24112,
    mfr: "MPU-6050",
    description:
      "-40℃~+85℃ 16bit 1KB 2.375V~3.46V 5uA Accelerometer Gyroscope I2C X,Y,Z X,Y,Z ±16g ±2000dps QFN-24-EP(4x4) Accelerometers ROHS",
    stock: 9400,
    price: "1-99:0.95",
    basic: 0,
    preferred: 1,
    package: "QFN-24-EP(4x4)",
    extra: null,
  } as any

  const adxl356 = {
    lcsc: 662368,
    mfr: "ADXL356BEZ",
    description: "LCC-14(6x6) Accelerometers ROHS",
    stock: 0,
    price: "1-9:25.1",
    basic: 0,
    preferred: 0,
    package: "LCC-14(6x6)",
    extra: null,
    source_subcategory: "Attitude Sensor/Gyroscope",
  } as any

  const [mpuAccel, adxlAccel] = accelerometerTableSpec.mapToTable([
    mpu6050,
    adxl356,
  ])
  expect(mpuAccel).toMatchObject({
    lcsc: 24112,
    supply_voltage_min: 2.375,
    supply_voltage_max: 3.46,
    operating_temp_min: -40,
    operating_temp_max: 85,
    axes: "X,Y,Z",
    has_i2c: true,
    has_spi: false,
    has_uart: false,
  })
  expect(adxlAccel?.lcsc).toBe(662368)

  const [mpuGyro, adxlGyro] = gyroscopeTableSpec.mapToTable([mpu6050, adxl356])
  expect(mpuGyro).toMatchObject({
    lcsc: 24112,
    supply_voltage_min: 2.375,
    supply_voltage_max: 3.46,
    operating_temp_min: -40,
    operating_temp_max: 85,
    axes: "X,Y,Z",
    has_i2c: true,
  })
  expect(adxlGyro).toBeNull()
})
