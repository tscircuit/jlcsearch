/**
 * Extracts the minimum quantity price from a price string.
 *
 * Example string: '[{"qFrom": 1, "qTo": 9, "price": 14.320289855}, {"qFrom": 10, "qTo": 11, "price": 14.320289855}, {"qFrom": 12, "qTo": 199, "price": 14.320289855}, {"qFrom": 200, "qTo": 499, "price": 5.542028986}, {"qFrom": 500, "qTo": 999, "price": 5.347826087}, {"qFrom": 1000, "qTo": null, "price": 5.250724638}]'
 */
export const extractMinQPrice = (price: string) => {
  try {
    return JSON.parse(price)[0].price as number
  } catch (e) {
    return null
  }
}
