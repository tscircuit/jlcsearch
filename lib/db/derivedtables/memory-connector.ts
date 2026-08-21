import { extractMinQPrice } from "lib/util/extract-min-quantity-price";
import type { BaseComponent } from "./component-base";
import type { DerivedTableSpec } from "./types";

type MemoryConnectorFormFactor = "dimm" | "sodimm";

export interface MemoryConnector extends BaseComponent {
  package: string;
  ddr_standard: string | null;
  num_pins: number | null;
  pitch_mm: number | null;
  height_above_board_mm: number | null;
  mounting_type: string | null;
  operating_temp_min: number | null;
  operating_temp_max: number | null;
  is_right_angle: boolean;
}

const readAttributes = (extraJson: string | null): Record<string, string> => {
  if (!extraJson) return {};

  try {
    const attributes = JSON.parse(extraJson)?.attributes;
    if (!attributes || typeof attributes !== "object") return {};
    return attributes;
  } catch {
    return {};
  }
};

const readText = (value: string | undefined): string | null => {
  const normalized = value?.trim();
  return normalized && normalized !== "-" ? normalized : null;
};

const parseFirstNumber = (value: string | undefined): number | null => {
  const match = value?.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;

  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
};

const parsePitch = (
  attributes: Record<string, string>,
  searchableText: string,
): number | null => {
  const attributePitch = parseFirstNumber(
    attributes.Pitch || attributes["Contact Pitch"],
  );
  if (attributePitch !== null) return attributePitch;

  return parseFirstNumber(
    searchableText.match(/\bP\s*=\s*(\d+(?:\.\d+)?)\s*mm/i)?.[1],
  );
};

const parseHeight = (
  attributes: Record<string, string>,
  description: string,
): number | null => {
  const attributeHeight = parseFirstNumber(
    attributes["Height Above Board"] ||
      attributes.Height ||
      attributes["Body Height"],
  );
  if (attributeHeight !== null) return attributeHeight;

  const heightAfterPins = description.match(
    /\b\d+\s*P\s+(\d+(?:\.\d+)?)\s*mm\b/i,
  );
  if (heightAfterPins) return Number(heightAfterPins[1]);

  const heightBeforePins = description.match(
    /\b(\d+(?:\.\d+)?)\s*mm\s+\d+\s*P\b/i,
  );
  return heightBeforePins ? Number(heightBeforePins[1]) : null;
};

const parseOperatingTemperature = (
  value: string,
): { min: number | null; max: number | null } => {
  const match = value.match(
    /(-?\d+(?:\.\d+)?)\s*(?:℃|°C)\s*(?:~|to)\s*\+?(-?\d+(?:\.\d+)?)\s*(?:℃|°C)/i,
  );
  if (!match) return { min: null, max: null };

  return {
    min: Number(match[1]),
    max: Number(match[2]),
  };
};

const getMemoryConnectorFormFactor = (
  attributes: Record<string, string>,
  searchableText: string,
  numPins: number | null,
): MemoryConnectorFormFactor | null => {
  const declaredType = (
    readText(attributes["DDR Type"]) ||
    readText(attributes["Memory Module Type"]) ||
    ""
  )
    .replace(/[\s_-]/g, "")
    .toLowerCase();

  if (declaredType === "sodimm") return "sodimm";
  if (declaredType === "dimm") return "dimm";

  if (/\bSO[\s_-]?DIMM\b/i.test(searchableText)) return "sodimm";
  if (/\bDIMM\b/i.test(searchableText)) return "dimm";

  // Older catalog entries sometimes describe the socket style as a
  // "clamping plate" and omit the DIMM form factor.
  if ([168, 184, 240, 288].includes(numPins ?? 0)) return "dimm";
  if ([72, 100, 144, 200, 204, 260, 262].includes(numPins ?? 0)) {
    return "sodimm";
  }

  return null;
};

const getMountingType = (
  attributes: Record<string, string>,
  searchableText: string,
): string | null => {
  const declaredType =
    readText(attributes["Mounting Type"]) ||
    readText(attributes["Mounting Style"]);
  if (declaredType) return declaredType;

  if (/\b(?:SMD|SMT|surface mount)\b/i.test(searchableText)) {
    return "Surface Mount";
  }
  if (/through[- ]?hole|vertical welding|插件/i.test(searchableText)) {
    return "Through Hole";
  }

  return null;
};

const createMemoryConnectorTableSpec = (
  tableName: "dimm_connector" | "sodimm_connector",
  formFactor: MemoryConnectorFormFactor,
): DerivedTableSpec<MemoryConnector> => ({
  tableName,
  extraColumns: [
    { name: "package", type: "text" },
    { name: "ddr_standard", type: "text" },
    { name: "num_pins", type: "integer" },
    { name: "pitch_mm", type: "real" },
    { name: "height_above_board_mm", type: "real" },
    { name: "mounting_type", type: "text" },
    { name: "operating_temp_min", type: "real" },
    { name: "operating_temp_max", type: "real" },
    { name: "is_right_angle", type: "boolean" },
    { name: "is_basic", type: "boolean" },
    { name: "is_preferred", type: "boolean" },
  ],
  indexes: [
    { name: `idx_${tableName}_stock`, columns: ["stock"] },
    {
      name: `idx_${tableName}_package_stock`,
      columns: ["package", "stock"],
    },
    {
      name: `idx_${tableName}_ddr_standard_stock`,
      columns: ["ddr_standard", "stock"],
    },
    {
      name: `idx_${tableName}_num_pins_stock`,
      columns: ["num_pins", "stock"],
    },
    {
      name: `idx_${tableName}_pitch_mm_stock`,
      columns: ["pitch_mm", "stock"],
    },
    {
      name: `idx_${tableName}_height_above_board_mm_stock`,
      columns: ["height_above_board_mm", "stock"],
    },
    {
      name: `idx_${tableName}_mounting_type_stock`,
      columns: ["mounting_type", "stock"],
    },
    {
      name: `idx_${tableName}_is_right_angle_stock`,
      columns: ["is_right_angle", "stock"],
    },
    {
      name: `idx_${tableName}_is_basic_stock`,
      columns: ["is_basic", "stock"],
    },
    {
      name: `idx_${tableName}_is_preferred_stock`,
      columns: ["is_preferred", "stock"],
    },
  ],
  listCandidateComponents: (db) =>
    db
      .selectFrom("components")
      .innerJoin("categories", "components.category_id", "categories.id")
      .selectAll("components")
      .where("categories.subcategory", "=", "Memory Connector (DDR)"),
  mapToTable: (components) =>
    components.map((component): MemoryConnector | null => {
      const attributes = readAttributes(component.extra);

      const description = String(component.description || "");
      const packageName = String(component.package || "");
      const searchableText = [description, packageName]
        .filter(Boolean)
        .join(" ");
      const numPins =
        parseFirstNumber(attributes["Number of Pins"]) ??
        parseFirstNumber(description.match(/\b(\d+)\s*P\b/i)?.[1]);

      if (
        getMemoryConnectorFormFactor(attributes, searchableText, numPins) !==
        formFactor
      ) {
        return null;
      }

      const declaredTemperature =
        readText(attributes["Operating Temperature"]) ||
        readText(attributes["Operating Temperature Range"]);
      let temperature = parseOperatingTemperature(declaredTemperature || "");
      if (temperature.min === null && temperature.max === null) {
        temperature = parseOperatingTemperature(description);
      }
      const ddrStandard =
        readText(attributes["DDR SDRAM Standard"]) ||
        searchableText.match(/\bDDR(?:[1-5])?\b/i)?.[0]?.toUpperCase() ||
        null;
      const mountingType = getMountingType(attributes, searchableText);

      return {
        lcsc: Number(component.lcsc),
        mfr: String(component.mfr || ""),
        description,
        stock: Number(component.stock || 0),
        price1: extractMinQPrice(component.price),
        in_stock: Number(component.stock || 0) > 0,
        is_basic: Boolean(component.basic),
        is_preferred: Boolean(component.preferred),
        package: packageName,
        ddr_standard: ddrStandard,
        num_pins: numPins,
        pitch_mm: parsePitch(attributes, searchableText),
        height_above_board_mm: parseHeight(attributes, description),
        mounting_type: mountingType,
        operating_temp_min: temperature.min,
        operating_temp_max: temperature.max,
        is_right_angle:
          /right[\s-]?angle|horizontal|卧贴/i.test(searchableText) ||
          /right[\s-]?angle|horizontal|卧贴/i.test(mountingType || ""),
        attributes,
      };
    }),
});

export const dimmConnectorTableSpec = createMemoryConnectorTableSpec(
  "dimm_connector",
  "dimm",
);

export const sodimmConnectorTableSpec = createMemoryConnectorTableSpec(
  "sodimm_connector",
  "sodimm",
);
