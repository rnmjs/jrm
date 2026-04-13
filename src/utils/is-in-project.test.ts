import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exists } from "./exists.ts";
import { isInProject } from "./is-in-project.ts";

vi.mock("./exists.ts");

describe("isInProject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return true when package.json exists in current directory", async () => {
    vi.mocked(exists).mockResolvedValue(true);

    const result = await isInProject("/test/dir");

    expect(result).toBe(true);
    expect(exists).toHaveBeenCalledTimes(1);
  });

  it("should return true when package.json exists in parent directory", async () => {
    vi.mocked(exists).mockImplementation(
      async (filePath: string) =>
        await Promise.resolve(filePath === "/test/dir/package.json"),
    );

    const result = await isInProject("/test/dir/nested");

    expect(result).toBe(true);
    expect(exists).toHaveBeenCalledTimes(2);
  });

  it("should return false when no package.json found in any directory", async () => {
    vi.mocked(exists).mockResolvedValue(false);

    const result = await isInProject("/test/dir");

    expect(result).toBe(false);
  });

  it("should stop at root directory", async () => {
    vi.mocked(exists).mockResolvedValue(false);

    const result = await isInProject("/");

    expect(result).toBe(false);
    expect(exists).toHaveBeenCalledTimes(1);
  });

  it("should search multiple levels deep before finding package.json", async () => {
    const searchPath = "/a/b/c/d";
    vi.mocked(exists).mockImplementation(
      async (filePath: string) =>
        await Promise.resolve(filePath === "/a/b/package.json"),
    );

    const result = await isInProject(searchPath);

    expect(result).toBe(true);
    expect(exists).toHaveBeenCalledTimes(3);
  });
});
