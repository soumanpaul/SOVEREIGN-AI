import { describe, expect, it } from "vitest";

import { formatContextWindow } from "./api";

describe("formatContextWindow", () => {
  it("formats model context clearly", () => {
    expect(formatContextWindow(32768)).toBe("32K");
    expect(formatContextWindow(null)).toBe("Unknown");
  });
});

