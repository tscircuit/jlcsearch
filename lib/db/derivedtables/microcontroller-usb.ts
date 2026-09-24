import audit from "./microcontroller-usb-audit.json"
import next200 from "./microcontroller-usb-audit-next200.json"

// Exact manufacturer part numbers only: neighboring parts can omit USB or
// provide USB power delivery without a USB data controller. See docs audit.
const overrides = new Map(
  [...audit, ...next200].map((row) => [
    row.mfr.trim().toUpperCase(),
    row.has_usb,
  ]),
)

export const getMicrocontrollerUsbOverride = (
  mfr: string,
): boolean | undefined => overrides.get(mfr.trim().toUpperCase())
