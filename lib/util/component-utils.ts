export const getIsExtendedPromotional = (component: any): boolean => {
  try {
    // Logic to determine if a component is "extended promotional"
    // Since we don't have direct access to the source DB flags, we check attributes
    // or description for hints.
    // TODO: Verify exact column/flag in source DB.

    if (!component.extra) return false

    // Check for specific attributes if they exist in the JSON
    // The component.extra is a JSON string in some contexts, but here 'component'
    // usually refers to the raw row from 'components' table which has 'extra' as string(?).
    // But in mapToTable, it's usually already parsed or we parse it.
    // Let's assume this function takes the raw component or the parsed attributes.

    // If we look at resistor.ts:
    // const extra = JSON.parse(c.extra ?? "{}")

    // We will design this to take the PARSED extra object for safety,
    // OR the raw component and do the parsing.

    // Let's look at usage:
    // return { ... is_extended_promotional: getIsExtendedPromotional(c /* raw */) }

    const extra =
      typeof component.extra === "string"
        ? JSON.parse(component.extra)
        : component.extra

    if (!extra || !extra.attributes) return false

    // Hypothetical checks:
    if (extra.attributes["Promotional Type"] === "Extended") return true

    // Until we know for sure, we return false to ensure the column exists but is empty/default.
    return false
  } catch (e) {
    return false
  }
}
