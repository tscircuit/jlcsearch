import { expect, test } from "bun:test"
import "bun-match-svg"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import {
  EasyEdaJsonSchema,
  convertEasyEdaJsonToCircuitJson,
} from "easyeda/browser"
import rawEasy from "./fixtures/c41413180.raweasy.json"

test("the EasyEDA dependency preserves filled RGB fabrication symbols", async () => {
  const circuitJson = convertEasyEdaJsonToCircuitJson(
    EasyEdaJsonSchema.parse(rawEasy),
  )
  const paths = circuitJson.filter(
    (element) => element.type === "pcb_fabrication_note_path",
  )
  expect(paths).toHaveLength(4)
  for (const path of paths) {
    expect(path).toMatchObject({
      is_filled: true,
      has_stroke: false,
      stroke_width: 0,
    })
    expect(path.route.at(-1)).toEqual(path.route[0]!)
  }
  const plus = paths.find((path) => path.route.length === 13)
  if (!plus) throw new Error("Expected the supplier's plus-sign geometry")
  expect(Math.abs(plus.route[0]!.y - plus.route[1]!.y)).toBeCloseTo(0.127, 5)
  await expect(convertCircuitJsonToPcbSvg(circuitJson)).toMatchSvgSnapshot(
    import.meta.path,
  )
})
