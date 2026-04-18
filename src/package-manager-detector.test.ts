import fs from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PackageManagerDetector } from "./package-manager-detector.ts";
import { exists } from "./utils/exists.ts";

vi.mock("node:fs/promises");
vi.mock("./utils/exists.ts");

describe("PackageManagerDetector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should detect version from package.json with single packageManager", async () => {
    const detector = new PackageManagerDetector("pnpm");
    vi.mocked(exists).mockImplementation(
      async (filePath: string) =>
        await Promise.resolve(filePath.endsWith("package.json")),
    );
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({
        name: "test-package",
        devEngines: {
          packageManager: {
            name: "pnpm",
            version: ">=9.0.0",
          },
        },
      }),
    );

    const result = await detector.detectVersionRange("/test/dir");

    expect(result).toEqual({ versionRange: ">=9.0.0", onFail: undefined });
  });

  it("should detect version from package.json with multiple packageManagers", async () => {
    const detector = new PackageManagerDetector("npm");
    vi.mocked(exists).mockImplementation(
      async (filePath: string) =>
        await Promise.resolve(filePath.endsWith("package.json")),
    );
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({
        name: "test-package",
        devEngines: {
          packageManager: [
            {
              name: "yarn",
              version: ">=4.0.0",
            },
            {
              name: "npm",
              version: ">=10.0.0",
            },
          ],
        },
      }),
    );

    const result = await detector.detectVersionRange("/test/dir");

    expect(result).toEqual({ versionRange: ">=10.0.0", onFail: undefined });
  });

  it("should return undefined when package.json has no devEngines", async () => {
    const detector = new PackageManagerDetector("pnpm");
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

  it("should return undefined when packageManager name does not match", async () => {
    const detector = new PackageManagerDetector("npm");
    vi.mocked(exists).mockImplementation(
      async (filePath: string) =>
        await Promise.resolve(filePath.endsWith("package.json")),
    );
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({
        name: "test-package",
        devEngines: {
          packageManager: {
            name: "pnpm",
            version: ">=9.0.0",
          },
        },
      }),
    );

    const version = await detector.detectVersionRange("/test/dir");

    expect(version).toBeUndefined();
  });

  it("should default version to '*' when version is not specified", async () => {
    const detector = new PackageManagerDetector("yarn");
    vi.mocked(exists).mockImplementation(
      async (filePath: string) =>
        await Promise.resolve(filePath.endsWith("package.json")),
    );
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({
        name: "test-package",
        devEngines: {
          packageManager: {
            name: "yarn",
          },
        },
      }),
    );

    const result = await detector.detectVersionRange("/test/dir");

    expect(result).toEqual({ versionRange: "*", onFail: undefined });
  });

  it("should search parent directories when no package.json in current directory", async () => {
    const detector = new PackageManagerDetector("pnpm");
    let callCount = 0;
    // eslint-disable-next-line @typescript-eslint/require-await -- Mock
    vi.mocked(exists).mockImplementation(async (filePath: string) => {
      callCount += 1;
      return callCount > 2 && filePath.endsWith("package.json");
    });

    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({
        devEngines: {
          packageManager: { name: "pnpm", version: "8.0.0" },
        },
      }),
    );

    const result = await detector.detectVersionRange("/test/dir/sub/nested");

    expect(result).toEqual({ versionRange: "8.0.0" });
  });

  it("should return undefined when no package.json found in any parent directory", async () => {
    const detector = new PackageManagerDetector("pnpm");
    vi.mocked(exists).mockResolvedValue(false);

    const version = await detector.detectVersionRange("/test/dir");

    expect(version).toBeUndefined();
  });

  it("should stop at root directory", async () => {
    const detector = new PackageManagerDetector("pnpm");
    vi.mocked(exists).mockResolvedValue(false);

    const version = await detector.detectVersionRange("/");

    expect(version).toBeUndefined();
  });

  it("should detect onFail from package.json", async () => {
    const detector = new PackageManagerDetector("pnpm");
    vi.mocked(exists).mockImplementation(
      async (filePath: string) =>
        await Promise.resolve(filePath.endsWith("package.json")),
    );
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({
        name: "test-package",
        devEngines: {
          packageManager: {
            name: "pnpm",
            version: ">=9.0.0",
            onFail: "warn",
          },
        },
      }),
    );

    const result = await detector.detectVersionRange("/test/dir");

    expect(result).toEqual({ versionRange: ">=9.0.0", onFail: "warn" });
  });

  it("should detect onFail with multiple packageManagers", async () => {
    const detector = new PackageManagerDetector("npm");
    vi.mocked(exists).mockImplementation(
      async (filePath: string) =>
        await Promise.resolve(filePath.endsWith("package.json")),
    );
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({
        name: "test-package",
        devEngines: {
          packageManager: [
            {
              name: "yarn",
              version: ">=4.0.0",
              onFail: "error",
            },
            {
              name: "npm",
              version: ">=10.0.0",
              onFail: "ignore",
            },
          ],
        },
      }),
    );

    const result = await detector.detectVersionRange("/test/dir");

    expect(result).toEqual({ versionRange: ">=10.0.0", onFail: "ignore" });
  });

  it("should handle invalid JSON in package.json gracefully", async () => {
    const detector = new PackageManagerDetector("pnpm");
    vi.mocked(exists).mockImplementation(
      async (filePath: string) =>
        await Promise.resolve(filePath.endsWith("package.json")),
    );
    vi.mocked(fs.readFile).mockResolvedValue("{ invalid json }");

    const version = await detector.detectVersionRange("/test/dir");

    expect(version).toBeUndefined();
  });

  it("should work with different package manager names", async () => {
    const detector = new PackageManagerDetector("yarn");
    vi.mocked(exists).mockImplementation(
      async (filePath: string) =>
        await Promise.resolve(filePath.endsWith("package.json")),
    );
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({
        name: "test-package",
        devEngines: {
          packageManager: {
            name: "yarn",
            version: "4.6.0",
          },
        },
      }),
    );

    const result = await detector.detectVersionRange("/test/dir");

    expect(result).toEqual({ versionRange: "4.6.0" });
  });

  it("should detect version from .jrmrc.json", async () => {
    const detector = new PackageManagerDetector("pnpm");
    vi.mocked(exists).mockImplementation(
      async (filePath: string) =>
        await Promise.resolve(filePath.endsWith(".jrmrc.json")),
    );
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({
        packageManager: {
          name: "pnpm",
          version: ">=9.0.0",
        },
      }),
    );

    const result = await detector.detectVersionRange("/test/dir");

    expect(result).toEqual({ versionRange: ">=9.0.0", onFail: undefined });
  });

  it("should detect version from jrm.config.json when .jrmrc.json not exists", async () => {
    const detector = new PackageManagerDetector("pnpm");
    vi.mocked(exists).mockImplementation(
      async (filePath: string) =>
        await Promise.resolve(filePath.endsWith("jrm.config.json")),
    );
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({
        packageManager: {
          name: "pnpm",
          version: ">=8.0.0",
        },
      }),
    );

    const result = await detector.detectVersionRange("/test/dir");

    expect(result).toEqual({ versionRange: ">=8.0.0", onFail: undefined });
  });

  it("should prefer .jrmrc.json over jrm.config.json", async () => {
    const detector = new PackageManagerDetector("pnpm");
    vi.mocked(exists).mockResolvedValue(true);
    // eslint-disable-next-line @typescript-eslint/require-await -- Mock
    vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
      if (typeof filePath === "string" && filePath.includes(".jrmrc.json")) {
        return JSON.stringify({
          packageManager: { name: "pnpm", version: "9.0.0" },
        });
      }
      return JSON.stringify({
        packageManager: { name: "pnpm", version: "8.0.0" },
      });
    });

    const result = await detector.detectVersionRange("/test/dir");

    expect(result).toEqual({ versionRange: "9.0.0" });
  });

  it("should fallback to package.json when config has no matching pm", async () => {
    const detector = new PackageManagerDetector("pnpm");
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
          packageManager: { name: "yarn", version: "4.0.0" },
        });
      }
      return JSON.stringify({
        devEngines: {
          packageManager: { name: "pnpm", version: ">=9.0.0" },
        },
      });
    });

    const result = await detector.detectVersionRange("/test/dir");

    expect(result).toEqual({ versionRange: ">=9.0.0" });
  });
});
