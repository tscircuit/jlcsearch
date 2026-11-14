import { expect, test } from "vitest"
import { D1_ROUTES, getD1RouteParams } from "../src/d1-routes"

test("every D1 route lists the parameters it reads", () => {
  for (const route of [...D1_ROUTES, "/api/search", "/components/list"]) {
    expect(getD1RouteParams(route), route).not.toBeNull()
  }
  expect(getD1RouteParams("/resistors/list")).toContain("resistance")
  expect(getD1RouteParams("/photo_diodes/list")).toContain("wavelength_min")
  expect(getD1RouteParams("/unknown/list")).toBeNull()
})
