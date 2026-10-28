// Host audit entries retain the exact-part USB_OTG peripheral evidence from
// the existing microcontroller USB audits; USB device-only entries are excluded.
import hostAudit from "./microcontroller-usb-host-audit.json"
import { getMicrocontrollerUsbOverride } from "./microcontroller-usb"

// Exact order codes verified against the manufacturer peripheral inventories.
// Do not extend these to neighboring families without checking the datasheet.
export const microcontrollerInterfaceAudit = [
  {
    mfr: "RP2040",
    has_can: false,
    has_spi: true,
    has_i2c: true,
    has_uart: true,
    has_usb_host: true,
    source: "https://www.raspberrypi.com/products/rp2040/specifications/",
  },
  {
    mfr: "STM32F103C8T6",
    has_can: true,
    has_spi: true,
    has_i2c: true,
    has_uart: true,
    has_usb_host: false,
    source: "https://www.st.com/resource/en/datasheet/stm32f103c8.pdf",
  },
  {
    mfr: "STM32F407VET6",
    has_can: true,
    has_spi: true,
    has_i2c: true,
    has_uart: true,
    has_usb_host: true,
    source:
      "https://www.st.com/en/microcontrollers-microprocessors/stm32f407ve.html",
  },
  {
    mfr: "STM32F411RET6",
    has_can: false,
    has_spi: true,
    has_i2c: true,
    has_uart: true,
    has_usb_host: true,
    source:
      "https://www.st.com/en/microcontrollers-microprocessors/stm32f411re.html",
  },
]

// Missing supplier metadata is not evidence that a peripheral is absent.
const availability = (value: unknown): boolean | null => {
  if (typeof value === "boolean") return value
  const text = String(value ?? "")
    .trim()
    .toLowerCase()
  if (/^(no|false|none|not supported|0)$/.test(text)) return false
  if (/^(yes|true|supported)$/.test(text)) return true
  if (/^\d+(?:\s*(?:x|channels?|ports?|interfaces?))?$/.test(text))
    return parseInt(text) > 0
  return null
}

export const getMicrocontrollerInterfaces = (
  mfr: string,
  attributes: Record<string, unknown>,
  description: string,
) => {
  const audited = microcontrollerInterfaceAudit.find(
    (row) => row.mfr === mfr.trim().toUpperCase(),
  )
  const attrs = Object.fromEntries(
    Object.entries(attributes).map(([key, value]) => [
      key.toLowerCase(),
      value,
    ]),
  )
  const text = `${attrs["peripheral/function"] ?? ""}; ${description}`
  const detect = (keys: string[], pattern: RegExp) => {
    const values = keys.map((key) => availability(attrs[key]))
    if (values.includes(true)) return true
    if (values.includes(false)) return false
    return pattern.test(text)
  }
  let host: boolean | null =
    audited?.has_usb_host ??
    hostAudit.find((row) => row.mfr === mfr.trim().toUpperCase())
      ?.has_usb_host ??
    null
  if (host === null) {
    if (getMicrocontrollerUsbOverride(mfr) === false) host = false
    else {
      const values = ["usb host", "usb otg"].map((key) =>
        availability(attrs[key]),
      )
      if (values.includes(true)) host = true
      else if (values.includes(false)) host = false
      else {
        // Only use USB-specific capability fields: generic USB text, PD and
        // external USB-to-UART bridges do not establish host support.
        const usb = String(
          attrs["usb"] ?? attrs["universal serial bus"] ?? "",
        ).trim()
        if (
          /^(?:USB\s*)?(?:(?:1\.1|2\.0|FS|HS|full.speed|high.speed)\s+)*(?:host|OTG|device\s*[/,]\s*host)(?:\s*[/,]\s*(?:device|OTG))?$/i.test(
            usb,
          )
        )
          host = true
        else if (/^(?:USB\s*)?(?:device|device.only)$/i.test(usb)) host = false
      }
    }
  }
  return {
    has_can:
      audited?.has_can ??
      detect(["can", "fdcan"], /\b(?:can(?:[- ]?fd)?|fdcan)\b/i),
    has_spi: audited?.has_spi ?? detect(["spi"], /\bspi\b/i),
    has_i2c: audited?.has_i2c ?? detect(["i2c", "i²c"], /\bi[2²]c\b/i),
    has_uart:
      audited?.has_uart ??
      detect(["uart/usart", "uart", "usart"], /\b(?:uart|usart)\b/i),
    has_usb_host: host,
  }
}
