import { expect, it } from "vitest";
import { ERROR_CODES } from "@qweb/protocol";
import { ToolError, toErrorDetail } from "../tool-error.js";

it("preserves structured tool error codes", () => {
  const detail = toErrorDetail(new ToolError(ERROR_CODES.STALE_REF, "The ref is stale."));

  expect(detail).toEqual({
    code: "stale_ref",
    message: "The ref is stale.",
  });
});
