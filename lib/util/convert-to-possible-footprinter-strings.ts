/**
 * Converts a JLCPCB package name to a possible footprinter string.
 *
 * Example JLCPCB strings:
 * - Plugin,P=2.54mm
 * - SOD-123
 * - Push-Pull,P=2.54mm
 * - Plugin,D6.3xL11mm
 */
export const convertToPossibleFootprinterStrings = (jlcPackage: string) => {
  // Plugin,P=2.54mm -> plugin_p2.54mm
  const v1 = jlcPackage
    .toLowerCase()
    .replace(/ /g, "")
    .replace(/-/g, "_")
    .replace(/=/g, "")
    .replace(/,/g, "_")

  // SOT_23 -> sot23
  const v2 = v1.replace("_", "")

  return [v1, v2]
}
