export const formatPrice = (price: number | null) => {
  if (!price) return ""
  return price.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  })
}
