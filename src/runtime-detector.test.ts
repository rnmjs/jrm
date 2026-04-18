import fs from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RuntimeDetector } from "./runtime-detector.ts";
import { exists } from "./utils/exists.ts";

vi.mock("node:fs/promises");
vi.mock("./utils/exists.ts");

describe("RuntimeDetector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should detect version from package.json with single runtime", async () => {
    const detector = new RuntimeDetector("node");
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

    const result = await detector.detectVersionRange("/test/dir");

    expect(result).toEqual({ versionRange: ">=16.0.0", onFail: undefined });
  });

  it("should detect version from package.json with multiple runtimes", async () => {
    const detector = new RuntimeDetector("node");
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

    const result = await detector.detectVersionRange("/test/dir");

    expect(result).toEqual({ versionRange: ">=18.0.0", onFail: undefined });
  });

  it("should return undefined when no version file found in any parent directory", async () => {
    const detector = new RuntimeDetector("node");
    vi.mocked(exists).mockResolvedValue(false);

    const version = await detector.detectVersionRange("/test/dir");

    expect(version).toBeUndefined();
  });

  it("should return undefined when package.json has no devEngines", async () => {
    const detector = new RuntimeDetector("node");
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
    const detector = new RuntimeDetector("node");
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

  it("should detect onFail from package.json", async () => {
    const detector = new RuntimeDetector("node");
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
            onFail: "warn",
          },
        },
      }),
    );

    const result = await detector.detectVersionRange("/test/dir");

    expect(result).toEqual({ versionRange: ">=16.0.0", onFail: "warn" });
  });

  it("should detect onFail with multiple runtimes", async () => {
    const detector = new RuntimeDetector("node");
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
              onFail: "error",
            },
            {
              name: "node",
              version: ">=18.0.0",
              onFail: "ignore",
            },
          ],
        },
      }),
    );

    const result = await detector.detectVersionRange("/test/dir");

    expect(result).toEqual({ versionRange: ">=18.0.0", onFail: "ignore" });
  });

  it("should detect onFail as download", async () => {
    const detector = new RuntimeDetector("node");
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
            version: ">=20.0.0",
            onFail: "download",
          },
        },
      }),
    );

    const result = await detector.detectVersionRange("/test/dir");

    expect(result).toEqual({ versionRange: ">=20.0.0", onFail: "download" });
  });

  it("should handle invalid JSON in package.json gracefully", async () => {
    const detector = new RuntimeDetector("node");
    vi.mocked(exists).mockImplementation(
      async (filePath: string) =>
        await Promise.resolve(filePath.endsWith("package.json")),
    );
    vi.mocked(fs.readFile).mockResolvedValue("{ invalid json }");

    const version = await detector.detectVersionRange("/test/dir");

    expect(version).toBeUndefined();
  });

  it("should stop at root directory", async () => {
    const detector = new RuntimeDetector("node");
    vi.mocked(exists).mockResolvedValue(false);

    const version = await detector.detectVersionRange("/");

    expect(version).toBeUndefined();
  });

  it("should detect version from .jrmrc.json", async () => {
    const detector = new RuntimeDetector("node");
    vi.mocked(exists).mockImplementation(
      async (filePath: string) =>
        await Promise.resolve(filePath.endsWith(".jrmrc.json")),
    );
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({
        runtime: {
          name: "node",
          version: ">=20.0.0",
        },
      }),
    );

    const result = await detector.detectVersionRange("/test/dir");

    expect(result).toEqual({ versionRange: ">=20.0.0", onFail: undefined });
  });

  it("should detect version from jrm.config.json when .jrmrc.json not exists", async () => {
    const detector = new RuntimeDetector("node");
    vi.mocked(exists).mockImplementation(
      async (filePath: string) =>
        await Promise.resolve(filePath.endsWith("jrm.config.json")),
    );
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({
        runtime: {
          name: "node",
          version: ">=18.0.0",
        },
      }),
    );

    const result = await detector.detectVersionRange("/test/dir");

    expect(result).toEqual({ versionRange: ">=18.0.0", onFail: undefined });
  });

  it("should prefer .jrmrc.json over jrm.config.json", async () => {
    const detector = new RuntimeDetector("node");
    vi.mocked(exists).mockResolvedValue(true);
    // eslint-disable-next-line @typescript-eslint/require-await -- Mock
    vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
      if (typeof filePath === "string" && filePath.includes(".jrmrc.json")) {
        return JSON.stringify({
          runtime: { name: "node", version: "20.0.0" },
        });
      }
      return JSON.stringify({
        runtime: { name: "node", version: "18.0.0" },
      });
    });

    const result = await detector.detectVersionRange("/test/dir");

    expect(result).toEqual({ versionRange: "20.0.0" });
  });

  it("should fallback to package.json when config has no matching runtime", async () => {
    const detector = new RuntimeDetector("node");
    vi.mocked(exists).mockImplementation(
      async (filePath: string) =>
        await Promise.resolve(
          filePath.endsWith(".jrmrc.json") || filePath.endsWith("package.json"),
        ),
    );
    // eslint-disable-next-line @typescript-eslint/require-await -- Mock
    vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
      if (typeof filePath === "string" && filePath.includes(".jrmrc.json")) {
        return JSON.stringify({
          runtime: { name: "bun", version: "1.0.0" },
        });
      }
      return JSON.stringify({
        devEngines: {
          runtime: { name: "node", version: ">=18.0.0" },
        },
      });
    });

    const result = await detector.detectVersionRange("/test/dir");

    expect(result).toEqual({ versionRange: ">=18.0.0" });
  });
});
