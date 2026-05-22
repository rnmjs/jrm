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

  describe("runtime", () => {
    it("should detect version from package.json with single runtime", async () => {
      const detector = new Detector("node", "runtime");
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
      const detector = new Detector("node", "runtime");
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

    it("should return no-config reason when no version file found in any parent directory", async () => {
      const detector = new Detector("node", "runtime");
      vi.mocked(exists).mockResolvedValue(false);

      const result = await detector.detectVersionRange("/test/dir");

      expect(result).toEqual({ reason: "no-config" });
    });

    it("should return no-type-field reason when package.json has no devEngines", async () => {
      const detector = new Detector("node", "runtime");
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

      const result = await detector.detectVersionRange("/test/dir");

      expect(result).toEqual({ reason: "no-type-field" });
    });

    it("should return no-type-field reason when devEngines exists but has no runtime field", async () => {
      const detector = new Detector("node", "runtime");
      vi.mocked(exists).mockImplementation(
        async (filePath: string) =>
          await Promise.resolve(filePath.endsWith("package.json")),
      );
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          name: "test-package",
          devEngines: {
            packageManager: { name: "pnpm", version: "10.0.0" },
          },
        }),
      );

      const result = await detector.detectVersionRange("/test/dir");

      expect(result).toEqual({ reason: "no-type-field" });
    });

    it("should return name-not-matched reason when runtime name does not match", async () => {
      const detector = new Detector("node", "runtime");
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

      const result = await detector.detectVersionRange("/test/dir");

      expect(result).toEqual({ reason: "name-not-matched" });
    });

    it("should detect onFail from package.json", async () => {
      const detector = new Detector("node", "runtime");
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
      const detector = new Detector("node", "runtime");
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
      const detector = new Detector("node", "runtime");
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
      const detector = new Detector("node", "runtime");
      vi.mocked(exists).mockImplementation(
        async (filePath: string) =>
          await Promise.resolve(filePath.endsWith("package.json")),
      );
      vi.mocked(fs.readFile).mockResolvedValue("{ invalid json }");

      const result = await detector.detectVersionRange("/test/dir");

      expect(result).toEqual({ reason: "no-config" });
    });

    it("should stop at root directory", async () => {
      const detector = new Detector("node", "runtime");
      vi.mocked(exists).mockResolvedValue(false);

      const result = await detector.detectVersionRange("/");

      expect(result).toEqual({ reason: "no-config" });
    });

    it("should detect version from .jrmrc.json", async () => {
      const detector = new Detector("node", "runtime");
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
      const detector = new Detector("node", "runtime");
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
      const detector = new Detector("node", "runtime");
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
      const detector = new Detector("node", "runtime");
      vi.mocked(exists).mockImplementation(
        async (filePath: string) =>
          await Promise.resolve(
            filePath.endsWith(".jrmrc.json") ||
              filePath.endsWith("package.json"),
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

    it("should prefer name-not-matched over no-type-field across ancestors", async () => {
      const detector = new Detector("node", "runtime");
      // /test/dir/sub has package.json with runtime.name="bun" (name-not-matched)
      // /test/dir has package.json with no devEngines (no-type-field)
      vi.mocked(exists).mockImplementation(
        async (filePath: string) =>
          await Promise.resolve(filePath.endsWith("package.json")),
      );
      // eslint-disable-next-line @typescript-eslint/require-await -- Mock
      vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
        if (typeof filePath === "string" && filePath.includes("/sub/")) {
          return JSON.stringify({
            devEngines: { runtime: { name: "bun", version: "1.0.0" } },
          });
        }
        return JSON.stringify({ name: "outer" });
      });

      const result = await detector.detectVersionRange("/test/dir/sub");

      expect(result).toEqual({ reason: "name-not-matched" });
    });

    it("should prefer no-type-field over no-config across ancestors", async () => {
      const detector = new Detector("node", "runtime");
      // /test/dir/sub has no package.json (no-config)
      // /test/dir has package.json with no devEngines (no-type-field)
      vi.mocked(exists).mockImplementation(
        async (filePath: string) =>
          await Promise.resolve(
            filePath.endsWith("package.json") && !filePath.includes("/sub/"),
          ),
      );
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({ name: "outer", version: "1.0.0" }),
      );

      const result = await detector.detectVersionRange("/test/dir/sub");

      expect(result).toEqual({ reason: "no-type-field" });
    });
  });

  describe("packageManager", () => {
    it("should detect version from package.json with single packageManager", async () => {
      const detector = new Detector("pnpm", "packageManager");
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
      const detector = new Detector("npm", "packageManager");
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

    it("should return no-type-field reason when package.json has no devEngines", async () => {
      const detector = new Detector("pnpm", "packageManager");
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

      const result = await detector.detectVersionRange("/test/dir");

      expect(result).toEqual({ reason: "no-type-field" });
    });

    it("should return no-type-field reason when devEngines exists but has no packageManager field", async () => {
      const detector = new Detector("pnpm", "packageManager");
      vi.mocked(exists).mockImplementation(
        async (filePath: string) =>
          await Promise.resolve(filePath.endsWith("package.json")),
      );
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          name: "test-package",
          devEngines: {
            runtime: { name: "node", version: ">=22.0.0" },
          },
        }),
      );

      const result = await detector.detectVersionRange("/test/dir");

      expect(result).toEqual({ reason: "no-type-field" });
    });

    it("should return name-not-matched reason when packageManager name does not match", async () => {
      const detector = new Detector("npm", "packageManager");
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

      expect(result).toEqual({ reason: "name-not-matched" });
    });

    it("should default version to '*' when version is not specified", async () => {
      const detector = new Detector("yarn", "packageManager");
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
      const detector = new Detector("pnpm", "packageManager");
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

    it("should return no-config reason when no package.json found in any parent directory", async () => {
      const detector = new Detector("pnpm", "packageManager");
      vi.mocked(exists).mockResolvedValue(false);

      const result = await detector.detectVersionRange("/test/dir");

      expect(result).toEqual({ reason: "no-config" });
    });

    it("should stop at root directory", async () => {
      const detector = new Detector("pnpm", "packageManager");
      vi.mocked(exists).mockResolvedValue(false);

      const result = await detector.detectVersionRange("/");

      expect(result).toEqual({ reason: "no-config" });
    });

    it("should detect onFail from package.json", async () => {
      const detector = new Detector("pnpm", "packageManager");
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
      const detector = new Detector("npm", "packageManager");
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
      const detector = new Detector("pnpm", "packageManager");
      vi.mocked(exists).mockImplementation(
        async (filePath: string) =>
          await Promise.resolve(filePath.endsWith("package.json")),
      );
      vi.mocked(fs.readFile).mockResolvedValue("{ invalid json }");

      const result = await detector.detectVersionRange("/test/dir");

      expect(result).toEqual({ reason: "no-config" });
    });

    it("should work with different package manager names", async () => {
      const detector = new Detector("yarn", "packageManager");
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
      const detector = new Detector("pnpm", "packageManager");
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
      const detector = new Detector("pnpm", "packageManager");
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
      const detector = new Detector("pnpm", "packageManager");
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
      const detector = new Detector("pnpm", "packageManager");
      vi.mocked(exists).mockImplementation(
        async (filePath: string) =>
          await Promise.resolve(
            filePath.endsWith(".jrmrc.json") ||
              filePath.endsWith("package.json"),
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

    it("should prefer name-not-matched over no-type-field across ancestors", async () => {
      const detector = new Detector("npm", "packageManager");
      vi.mocked(exists).mockImplementation(
        async (filePath: string) =>
          await Promise.resolve(filePath.endsWith("package.json")),
      );
      // eslint-disable-next-line @typescript-eslint/require-await -- Mock
      vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
        if (typeof filePath === "string" && filePath.includes("/sub/")) {
          return JSON.stringify({
            devEngines: { packageManager: { name: "yarn", version: "4.0.0" } },
          });
        }
        return JSON.stringify({ name: "outer" });
      });

      const result = await detector.detectVersionRange("/test/dir/sub");

      expect(result).toEqual({ reason: "name-not-matched" });
    });
  });
});
