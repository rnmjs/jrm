import fs from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Detector } from "./detector.ts";
import { exists } from "./utils/exists.ts";

vi.mock("node:fs/promises");
vi.mock("./utils/exists.ts");

describe("Detector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should detect version from .{name}-version file", async () => {
    const detector = new Detector("node");
    vi.mocked(exists).mockImplementation(
      async (filePath: string) =>
        await Promise.resolve(filePath.endsWith(".node-version")),
    );
    vi.mocked(fs.readFile).mockResolvedValue("18.0.0\n");

    const version = await detector.detectVersionRange("/test/dir");

    expect(version).toBe("18.0.0");
  });

  it("should detect version from package.json with single runtime", async () => {
    const detector = new Detector("node");
    vi.mocked(exists).mockImplementation(
      async (filePath: string) =>
        await Promise.resolve(filePath.endsWith("package.json")),
    );
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({
        name: "test-package",
        devEngines: {
          runtime: {
            name: "node",
            version: ">=16.0.0",
          },
        },
      }),
    );

    const version = await detector.detectVersionRange("/test/dir");

    expect(version).toBe(">=16.0.0");
  });

  it("should detect version from package.json with multiple runtimes", async () => {
    const detector = new Detector("node");
    vi.mocked(exists).mockImplementation(
      async (filePath: string) =>
        await Promise.resolve(filePath.endsWith("package.json")),
    );
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({
        name: "test-package",
        devEngines: {
          runtime: [
            {
              name: "bun",
              version: ">=1.0.0",
            },
            {
              name: "node",
              version: ">=18.0.0",
            },
          ],
        },
      }),
    );

    const version = await detector.detectVersionRange("/test/dir");

    expect(version).toBe(">=18.0.0");
  });

  it("should prioritize .{name}-version file over package.json", async () => {
    const detector = new Detector("node");
    vi.mocked(exists).mockResolvedValue(true);
    // eslint-disable-next-line @typescript-eslint/require-await -- for test
    vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
      if (typeof filePath !== "string") {
        throw new Error("filePath is not a string");
      }
      if (filePath.endsWith(".node-version")) {
        return "20.0.0";
      }
      return JSON.stringify({
        devEngines: {
          runtime: { name: "node", version: ">=16.0.0" },
        },
      });
    });

    const version = await detector.detectVersionRange("/test/dir");

    expect(version).toBe("20.0.0");
  });

  it("should search parent directories when no version file found", async () => {
    const detector = new Detector("node");
    let callCount = 0;
    // eslint-disable-next-line @typescript-eslint/require-await -- for test
    vi.mocked(exists).mockImplementation(async (filePath: string) => {
      callCount += 1;
      return callCount > 2 && filePath.endsWith(".node-version");
    });

    vi.mocked(fs.readFile).mockResolvedValue("18.0.0");

    const version = await detector.detectVersionRange("/test/dir/sub/nested");

    expect(version).toBe("18.0.0");
  });

  it("should return undefined when no version file found in any parent directory", async () => {
    const detector = new Detector("node");
    vi.mocked(exists).mockResolvedValue(false);

    const version = await detector.detectVersionRange("/test/dir");

    expect(version).toBeUndefined();
  });

  it("should return undefined when package.json has no devEngines", async () => {
    const detector = new Detector("node");
    vi.mocked(exists).mockImplementation(
      async (filePath: string) =>
        await Promise.resolve(filePath.endsWith("package.json")),
    );
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({
        name: "test-package",
        version: "1.0.0",
      }),
    );

    const version = await detector.detectVersionRange("/test/dir");

    expect(version).toBeUndefined();
  });

  it("should return undefined when runtime name does not match", async () => {
    const detector = new Detector("node");
    vi.mocked(exists).mockImplementation(
      async (filePath: string) =>
        await Promise.resolve(filePath.endsWith("package.json")),
    );
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({
        name: "test-package",
        devEngines: {
          runtime: {
            name: "bun",
            version: ">=1.0.0",
          },
        },
      }),
    );

    const version = await detector.detectVersionRange("/test/dir");

    expect(version).toBeUndefined();
  });

  it("should handle version file with whitespace", async () => {
    const detector = new Detector("node");
    vi.mocked(exists).mockImplementation(
      async (filePath: string) =>
        await Promise.resolve(filePath.endsWith(".node-version")),
    );
    vi.mocked(fs.readFile).mockResolvedValue("  18.0.0  \n");

    const version = await detector.detectVersionRange("/test/dir");

    expect(version).toBe("18.0.0");
  });

  it("should work with different runtime names", async () => {
    const bunDetector = new Detector("bun");

    vi.mocked(exists).mockImplementation(
      async (filePath: string) =>
        await Promise.resolve(filePath.endsWith(".bun-version")),
    );
    vi.mocked(fs.readFile).mockResolvedValue("1.0.0");

    const version = await bunDetector.detectVersionRange("/test/dir");

    expect(version).toBe("1.0.0");
  });

  it("should handle invalid JSON in package.json gracefully", async () => {
    const detector = new Detector("node");
    vi.mocked(exists).mockImplementation(
      async (filePath: string) =>
        await Promise.resolve(filePath.endsWith("package.json")),
    );
    vi.mocked(fs.readFile).mockResolvedValue("{ invalid json }");

    const version = await detector.detectVersionRange("/test/dir");

    expect(version).toBeUndefined();
  });

  it("should stop at root directory", async () => {
    const detector = new Detector("node");
    vi.mocked(exists).mockResolvedValue(false);

    const version = await detector.detectVersionRange("/");

    expect(version).toBeUndefined();
  });
});
