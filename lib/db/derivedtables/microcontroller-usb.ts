import audit from "./microcontroller-usb-audit.json"

// Exact manufacturer part numbers only: neighboring parts can omit USB or
// provide USB power delivery without a USB data controller. See docs audit.
const overrides = new Map(audit.map((row) => [row.mfr, row.has_usb]))

export const getMicrocontrollerUsbOverride = (
  mfr: string,
): boolean | undefined => overrides.get(mfr.trim().toUpperCase())
