import { extractMinQPrice } from "lib/util/extract-min-quantity-price";
import { parseAndConvertSiUnit } from "lib/util/parse-and-convert-si-unit";
import type { BaseComponent } from "./component-base";
import type { DerivedTableSpec } from "./types";

export interface BarrelJack extends BaseComponent {
  package: string;
  connector_type: string;
  mounting_style: string | null;
  orientation: string | null;
  inside_diameter_mm: number | null;
  outside_diameter_mm: number | null;
  current_rating_a: number | null;
  voltage_rating_v: number | null;
  num_pins: number | null;
  operating_temp_min: number | null;
  operating_temp_max: number | null;
}

const DC_POWER_SUBCATEGORIES = [
  "AC/DC Power Connectors",
  "DC Power Connector",
  "DC Power Connectors",
] as const;

const readAttributes = (extraJson: string | null): Record<string, string> => {
  if (!extraJson) return {};
  try {
    const attributes = JSON.parse(extraJson)?.attributes;
    return attributes && typeof attributes === "object" ? attributes : {};
  } catch {
    return {};
  }
};

const readText = (value: string | undefined): string | null => {
  const normalized = value?.trim();
  return normalized && normalized !== "-" ? normalized : null;
};

const parseUnit = (value: string | null): number | null => {
  if (!value) return null;
  try {
    const parsed = parseAndConvertSiUnit(value).value;
    return typeof parsed === "number" && Number.isFinite(parsed)
      ? parsed
      : null;
  } catch {
    return null;
  }
};

const parseCount = (value: string | undefined): number | null => {
  const match = value?.match(/\d+/);
  if (!match) return null;
  const parsed = Number.parseInt(match[0], 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const firstUnitMatch = (value: string, unit: "A" | "V"): number | null => {
  const match = value.match(
    unit === "A"
      ? /\b\d+(?:\.\d+)?\s*(?:mA|A)\b/i
      : /\b\d+(?:\.\d+)?\s*(?:mV|V)\b/i,
  );
  return parseUnit(match?.[0] ?? null);
};

const parseTemperatureRange = (
  value: string | null,
): { min: number | null; max: number | null } => {
  const match = value?.match(
    /(-?\d+(?:\.\d+)?)\s*(?:℃|°C)?\s*(?:~|to)\s*\+?(-?\d+(?:\.\d+)?)\s*(?:℃|°C)?/i,
  );
  return match
    ? { min: Number(match[1]), max: Number(match[2]) }
    : { min: null, max: null };
};

const inferDiameters = (
  attributes: Record<string, string>,
  description: string,
): { inside: number | null; outside: number | null } => {
  let inside = parseUnit(readText(attributes["Inside Contact Diameter"]));
  let outside = parseUnit(readText(attributes["Outside Contact Diameter"]));

  if (inside === null || outside === null) {
    const values = Array.from(
      description.matchAll(/\b(\d+(?:\.\d+)?)\s*mm\b/gi),
      (match) => Number(match[1]),
    ).filter((value) => Number.isFinite(value) && value > 0 && value < 20);

    if (values.length >= 2) {
      inside ??= Math.min(...values);
      outside ??= Math.max(...values);
    }
  }

  return { inside, outside };
};

const inferMountingStyle = (
  attributes: Record<string, string>,
  packageName: string,
  description: string,
): string | null => {
  const text = [attributes["Mounting Style"], packageName, description]
    .filter(Boolean)
    .join(" ");

  if (/panel[ -]?mount/i.test(text)) return "Panel Mount";
  if (/\bSMD\b|\bSMT\b|surface[ -]?mount/i.test(text)) {
    return "Surface Mount";
  }
  if (/through[ -]?hole|\bplugin\b|push-pull|插件/i.test(text)) {
    return "Through Hole";
  }
  return readText(attributes["Mounting Style"]);
};

const inferOrientation = (text: string): string | null => {
  if (/right[ -]?angle|bend insert/i.test(text)) return "Right Angle";
  if (/vertical|straight insert/i.test(text)) return "Vertical";
  return null;
};

const isBarrelJack = (
  mfr: string,
  description: string,
  connectorType: string | null,
  joints: number,
): boolean => {
  const text = [mfr, description, connectorType].filter(Boolean).join(" ");
  if (/\b(?:power\s+)?plug\b|\bcable\b/i.test(text)) return false;
  if (/\bDC\s*Power\s*(?:Jack|Receptacle)\b/i.test(text)) return true;

  return /^DC[\s_-]?\d/i.test(mfr) && joints >= 3;
};

export const barrelJackTableSpec: DerivedTableSpec<BarrelJack> = {
  tableName: "barrel_jack",
  extraColumns: [
    { name: "package", type: "text" },
    { name: "connector_type", type: "text" },
    { name: "mounting_style", type: "text" },
    { name: "orientation", type: "text" },
    { name: "inside_diameter_mm", type: "real" },
    { name: "outside_diameter_mm", type: "real" },
    { name: "current_rating_a", type: "real" },
    { name: "voltage_rating_v", type: "real" },
    { name: "num_pins", type: "integer" },
    { name: "operating_temp_min", type: "real" },
    { name: "operating_temp_max", type: "real" },
    { name: "is_basic", type: "boolean" },
    { name: "is_preferred", type: "boolean" },
  ],
  indexes: [
    { name: "idx_barrel_jack_stock", columns: ["stock"] },
    { name: "idx_barrel_jack_package_stock", columns: ["package", "stock"] },
    {
      name: "idx_barrel_jack_mounting_style_stock",
      columns: ["mounting_style", "stock"],
    },
    {
      name: "idx_barrel_jack_orientation_stock",
      columns: ["orientation", "stock"],
    },
    {
      name: "idx_barrel_jack_inside_diameter_stock",
      columns: ["inside_diameter_mm", "stock"],
    },
    {
      name: "idx_barrel_jack_outside_diameter_stock",
      columns: ["outside_diameter_mm", "stock"],
    },
    {
      name: "idx_barrel_jack_current_rating_stock",
      columns: ["current_rating_a", "stock"],
    },
    {
      name: "idx_barrel_jack_voltage_rating_stock",
      columns: ["voltage_rating_v", "stock"],
    },
    {
      name: "idx_barrel_jack_num_pins_stock",
      columns: ["num_pins", "stock"],
    },
    {
      name: "idx_barrel_jack_is_basic_stock",
      columns: ["is_basic", "stock"],
    },
    {
      name: "idx_barrel_jack_is_preferred_stock",
      columns: ["is_preferred", "stock"],
    },
  ],
  listCandidateComponents: (db) =>
    db
      .selectFrom("components")
      .innerJoin("categories", "components.category_id", "categories.id")
      .selectAll("components")
      .where("categories.subcategory", "in", [...DC_POWER_SUBCATEGORIES]),
  mapToTable: (components) =>
    components.map((component): BarrelJack | null => {
      const attributes = readAttributes(component.extra);
      const mfr = String(component.mfr || "");
      const description = String(component.description || "");
      const packageName = String(component.package || "");
      const connectorType = readText(attributes["Connector Type"]);

      if (!isBarrelJack(mfr, description, connectorType, component.joints)) {
        return null;
      }

      const diameters = inferDiameters(attributes, description);
      const temperature = parseTemperatureRange(
        readText(attributes["Operating Temperature Range"]) || description,
      );
      const searchableText = [
        attributes["Mounting Style"],
        packageName,
        description,
      ]
        .filter(Boolean)
        .join(" ");

      return {
        lcsc: Number(component.lcsc),
        mfr,
        description,
        package: packageName,
        stock: Number(component.stock || 0),
        price1: extractMinQPrice(component.price),
        in_stock: Number(component.stock || 0) > 0,
        is_basic: Boolean(component.basic),
        is_preferred: Boolean(component.preferred),
        connector_type: connectorType || "DC Power Jack",
        mounting_style: inferMountingStyle(
          attributes,
          packageName,
          description,
        ),
        orientation: inferOrientation(searchableText),
        inside_diameter_mm: diameters.inside,
        outside_diameter_mm: diameters.outside,
        current_rating_a:
          parseUnit(readText(attributes["Current Rating (Max)"])) ??
          firstUnitMatch(description, "A"),
        voltage_rating_v:
          parseUnit(readText(attributes["Voltage Rating (Max)"])) ??
          firstUnitMatch(description, "V"),
        num_pins:
          parseCount(
            attributes["Number of Pins"] || attributes["Number of Contacts"],
          ) ||
          component.joints ||
          null,
        operating_temp_min: temperature.min,
        operating_temp_max: temperature.max,
        attributes,
      };
    }),
};
