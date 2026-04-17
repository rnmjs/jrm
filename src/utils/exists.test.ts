import path from "node:path";
import { describe, expect, it } from "vitest";
import { exists } from "./exists.ts";

describe("exists", () => {
  it("should return true when the file exists", async () => {
    const result = await exists(import.meta.filename);

    expect(result).toBe(true);
  });

  it("should return false when the file does not exist", async () => {
    const result = await exists(
      path.join(import.meta.dirname, "does-not-exist.ts"),
    );

    expect(result).toBe(false);
  });

  it("should return true when the directory exists", async () => {
    const result = await exists(import.meta.dirname);

    expect(result).toBe(true);
  });
});
