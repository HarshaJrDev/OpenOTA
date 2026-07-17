import { describe, expect, it } from "vitest";

import { buildFailureResponse, buildSuccessResponse } from "../api/responses.js";
import { parseApiResponse, ResponseValidationError } from "../schemas/responses.schema.js";

describe("parseApiResponse", () => {
  it("accepts a well-formed success envelope", () => {
    const response = parseApiResponse<{ foo: string }>(buildSuccessResponse({ foo: "bar" }));
    expect(response).toEqual({ success: true, data: { foo: "bar" } });
  });

  it("accepts a well-formed failure envelope with a known error code", () => {
    const response = parseApiResponse(buildFailureResponse("PACKAGE_NOT_FOUND", "missing"));
    expect(response).toEqual({
      success: false,
      error: { code: "PACKAGE_NOT_FOUND", message: "missing", details: undefined },
    });
  });

  it("rejects a body with no success field", () => {
    expect(() => parseApiResponse({ data: {} })).toThrow(ResponseValidationError);
  });

  it("rejects a failure envelope with an unrecognized error code", () => {
    expect(() =>
      parseApiResponse({ success: false, error: { code: "MADE_UP_CODE", message: "x" } }),
    ).toThrow(ResponseValidationError);
  });

  it("rejects a success envelope missing data", () => {
    expect(() => parseApiResponse({ success: true })).toThrow(ResponseValidationError);
  });
});
