export const TFT_DISPLAY_DRIVER_SUBCATEGORIES = [
  "LCD Drivers",
  "LED Drivers",
] as const;

export const TFT_DISPLAY_DRIVER_FAMILIES = [
  {
    value: "controller",
    label: "Display Controller",
    patterns: [
      "SSD1963%",
      "SSD1289%",
      "LT768%",
      "RA887%",
      "ILI9%",
      "HX83%",
      "S1D13%",
      "ST77%",
      "NT355%",
      "RM68%",
      "GC9%",
    ],
  },
  {
    value: "bias_power",
    label: "Bias / Power",
    patterns: [
      "TPS651%",
      "AW375%",
      "MAX171%",
      "MAX174%",
      "MAX879%",
      "RT48%",
      "NT503%",
    ],
  },
  {
    value: "gamma_buffer",
    label: "Gamma Buffer",
    patterns: ["BUF168%", "AS15%"],
  },
  {
    value: "backlight",
    label: "Backlight Driver",
    patterns: ["AP3041%", "AP5727%", "LP886%", "BD947%", "MAX20078%", "AL335%"],
  },
] as const;

export const getTftDisplayDriverFamily = (mfr: string | null) => {
  const normalizedMfr = mfr?.toUpperCase() ?? "";
  return TFT_DISPLAY_DRIVER_FAMILIES.find((family) =>
    family.patterns.some((pattern) =>
      normalizedMfr.startsWith(pattern.slice(0, -1).toUpperCase()),
    ),
  );
};

export const getTftDisplayDriverPatterns = (
  driverType: string | undefined,
): string[] => {
  const selectedFamily = TFT_DISPLAY_DRIVER_FAMILIES.find(
    (family) => family.value === driverType,
  );
  return selectedFamily
    ? [...selectedFamily.patterns]
    : TFT_DISPLAY_DRIVER_FAMILIES.flatMap((family) => [...family.patterns]);
};
