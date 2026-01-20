import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Detector } from "./detector.ts";
import { Runtime } from "./runtime.ts";
import { ask } from "./utils/ask.ts";
import { exists } from "./utils/exists.ts";

// Mock all external dependencies
vi.mock("node:fs/promises");
vi.mock("node:os");
vi.mock("node:process", () => ({
  default: {
    cwd: vi.fn(),
    ppid: 12345,
    env: {},
    stderr: {
      write: vi.fn(),
    },
  },
}));
vi.mock("./detector.ts");
vi.mock("./utils/ask.ts");
vi.mock("./utils/exists.ts");

// Create a concrete implementation of the abstract Runtime class for testing
class TestRuntime extends Runtime {
  readonly name = "testruntime";
  protected readonly bundledBinaries = ["testbin", "testtool"];

  protected async getRemoteVersionsRaw(): Promise<string[]> {
    return await Promise.resolve([
      "v3.0.0-beta.1",
      "v2.0.0-rc.1",
      "v3.0.0",
      "v2.1.0",
      "v2.0.0",
      "v1.5.0",
      "v1.0.0",
    ]);
  }

  protected async installRaw(
    version: string,
    installDir: string,
  ): Promise<void> {
    // Mock implementation - just create a directory
    await fs.mkdir(path.join(installDir, `v${version}`), { recursive: true });
  }
}

describe("Runtime", () => {
  const mockHomedir = "/home/testuser";
  const mockPlatform = "linux";
  const mockArch = "x64";

  beforeEach(() => {
    vi.resetAllMocks();

    // Setup os mocks
    vi.mocked(os.homedir).mockReturnValue(mockHomedir);
    vi.mocked(os.platform).mockReturnValue(mockPlatform);
    vi.mocked(os.arch).mockReturnValue(mockArch);

    // Setup process mocks
    vi.mocked(process.cwd).mockReturnValue("/test/project");
    process.env = {};

    // Setup default fs mocks
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.rm).mockResolvedValue(undefined);
    vi.mocked(fs.symlink).mockResolvedValue(undefined);
    vi.mocked(fs.readdir).mockResolvedValue([]);
    vi.mocked(fs.realpath).mockResolvedValue("");
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    vi.mocked(fs.chmod).mockResolvedValue(undefined);

    // Setup default exists mock
    vi.mocked(exists).mockResolvedValue(false);
  });

  describe("install", () => {
    it("should install a specific version", async () => {
      const runtime = new TestRuntime();
      vi.mocked(fs.readdir).mockResolvedValue([]);

      const result = await runtime.install("2.0.0");

      expect(result).toBe(true);
      expect(fs.mkdir).toHaveBeenCalledWith(
        path.join(mockHomedir, ".jrm", "testruntime", "versions"),
        { recursive: true },
      );
      expect(fs.mkdir).toHaveBeenCalledWith(
        path.join(mockHomedir, ".jrm", "testruntime", "versions", "v2.0.0"),
        { recursive: true },
      );
    });

    it("should not reinstall an already installed version", async () => {
      const runtime = new TestRuntime();
      vi.mocked(fs.readdir).mockResolvedValue(["v2.0.0"] as any);

      const result = await runtime.install("2.0.0");

      expect(result).toBe(false);
    });

    it("should install a version matching a range", async () => {
      const runtime = new TestRuntime();
      vi.mocked(fs.readdir).mockResolvedValue([]);

      const result = await runtime.install("^2.0.0");

      expect(result).toBe(true);
    });

    it("should throw error if no remote version satisfies the range", async () => {
      const runtime = new TestRuntime();
      vi.mocked(fs.readdir).mockResolvedValue([]);

      await expect(runtime.install("^99.0.0")).rejects.toThrow(
        "No remote version satisfies ^99.0.0.",
      );
    });

    it("should create default alias when installing first version", async () => {
      const runtime = new TestRuntime();
      vi.mocked(fs.readdir)
        .mockResolvedValueOnce([]) // First call - no versions installed
        .mockResolvedValueOnce(["v2.0.0"] as any); // Second call - version installed

      await runtime.install("2.0.0");

      expect(fs.symlink).toHaveBeenCalled();
    });
  });

  describe("use", () => {
    const multishellPath = "/home/testuser/.jrm/testruntime/multishells/test";

    beforeEach(() => {
      process.env["JRM_MULTISHELL_PATH_OF_TESTRUNTIME"] = multishellPath;
    });

    it("should throw error if multishell path env is not set", async () => {
      const runtime = new TestRuntime();
      process.env["JRM_MULTISHELL_PATH_OF_TESTRUNTIME"] = undefined;

      await expect(runtime.use("2.0.0")).rejects.toThrow(
        "JRM_MULTISHELL_PATH_OF_TESTRUNTIME is not set.",
      );
    });

    it("should throw error if multishell path is not absolute", async () => {
      const runtime = new TestRuntime();
      process.env["JRM_MULTISHELL_PATH_OF_TESTRUNTIME"] = "relative/path";

      await expect(runtime.use("2.0.0")).rejects.toThrow(
        "Value of JRM_MULTISHELL_PATH_OF_TESTRUNTIME is not an absolute path.",
      );
    });

    it("should initialize with default version if exists", async () => {
      const runtime = new TestRuntime();
      vi.mocked(exists).mockResolvedValue(true);
      vi.mocked(fs.realpath).mockResolvedValue(
        path.join(mockHomedir, ".jrm", "testruntime", "versions", "v2.0.0"),
      );
      vi.mocked(fs.readdir).mockResolvedValue(["v2.0.0"] as any);

      const result = await runtime.use("2.0.0");

      expect(result).toBe("2.0.0");
      expect(fs.symlink).toHaveBeenCalled();
    });

    it("should create placeholder binaries when no default version exists", async () => {
      const runtime = new TestRuntime();
      vi.mocked(exists).mockResolvedValue(false);
      vi.mocked(Detector.prototype.detectVersionRange).mockResolvedValue(
        undefined,
      );

      const result = await runtime.use();

      expect(result).toBeUndefined();
      expect(fs.mkdir).toHaveBeenCalledWith(path.join(multishellPath, "bin"), {
        recursive: true,
      });
      expect(fs.writeFile).toHaveBeenCalledTimes(3); // testruntime, testbin, testtool
      expect(fs.chmod).toHaveBeenCalledTimes(3);
    });

    it("should return undefined when no version range is detected", async () => {
      const runtime = new TestRuntime();
      vi.mocked(exists).mockResolvedValue(false);
      vi.mocked(Detector.prototype.detectVersionRange).mockResolvedValue(
        undefined,
      );

      const result = await runtime.use();

      expect(result).toBeUndefined();
    });

    it("should return undefined when onFail is ignore", async () => {
      const runtime = new TestRuntime();
      vi.mocked(exists).mockResolvedValue(true);
      vi.mocked(fs.realpath).mockResolvedValue(
        path.join(mockHomedir, ".jrm", "testruntime", "versions", "v1.0.0"),
      );
      vi.mocked(fs.readdir).mockResolvedValue(["v1.0.0"] as any);
      vi.mocked(Detector.prototype.detectVersionRange).mockResolvedValue({
        versionRange: "^3.0.0",
        onFail: "ignore",
      });

      const result = await runtime.use();

      expect(result).toBeUndefined();
      expect(ask).not.toHaveBeenCalled();
    });

    it("should print warning and return undefined when onFail is warn", async () => {
      const runtime = new TestRuntime();
      vi.mocked(exists).mockResolvedValue(true);
      vi.mocked(fs.realpath).mockResolvedValue(
        path.join(mockHomedir, ".jrm", "testruntime", "versions", "v1.0.0"),
      );
      vi.mocked(fs.readdir).mockResolvedValue(["v1.0.0"] as any);
      vi.mocked(Detector.prototype.detectVersionRange).mockResolvedValue({
        versionRange: "^3.0.0",
        onFail: "warn",
      });

      const result = await runtime.use();

      expect(result).toBeUndefined();
      expect(ask).not.toHaveBeenCalled();
      expect(process.stderr.write).toHaveBeenCalledWith(
        "No installed testruntime version satisfies ^3.0.0. Run `jrm install testruntime@^3.0.0` to install it.\n",
      );
    });

    it("should prompt to install when onFail is error", async () => {
      const runtime = new TestRuntime();
      vi.mocked(exists).mockResolvedValue(true);
      vi.mocked(fs.realpath).mockResolvedValue(
        path.join(mockHomedir, ".jrm", "testruntime", "versions", "v1.0.0"),
      );
      vi.mocked(fs.readdir)
        .mockResolvedValueOnce(["v1.0.0"] as any)
        .mockResolvedValueOnce(["v1.0.0"] as any)
        .mockResolvedValueOnce(["v3.0.0", "v1.0.0"] as any);
      vi.mocked(Detector.prototype.detectVersionRange).mockResolvedValue({
        versionRange: "^3.0.0",
        onFail: "error",
      });
      vi.mocked(ask).mockResolvedValue("y");

      const result = await runtime.use();

      expect(ask).toHaveBeenCalled();
      expect(result).toBe("3.0.0");
    });

    it("should prompt to install when onFail is download", async () => {
      const runtime = new TestRuntime();
      vi.mocked(exists).mockResolvedValue(true);
      vi.mocked(fs.realpath).mockResolvedValue(
        path.join(mockHomedir, ".jrm", "testruntime", "versions", "v1.0.0"),
      );
      vi.mocked(fs.readdir)
        .mockResolvedValueOnce(["v1.0.0"] as any)
        .mockResolvedValueOnce(["v1.0.0"] as any)
        .mockResolvedValueOnce(["v3.0.0", "v1.0.0"] as any);
      vi.mocked(Detector.prototype.detectVersionRange).mockResolvedValue({
        versionRange: "^3.0.0",
        onFail: "download",
      });
      vi.mocked(ask).mockResolvedValue("y");

      const result = await runtime.use();

      expect(ask).toHaveBeenCalled();
      expect(result).toBe("3.0.0");
    });

    it("should use default version if it satisfies range", async () => {
      const runtime = new TestRuntime();
      vi.mocked(exists).mockResolvedValue(true);
      vi.mocked(fs.realpath).mockResolvedValue(
        path.join(mockHomedir, ".jrm", "testruntime", "versions", "v2.0.0"),
      );

      const result = await runtime.use("^2.0.0");

      expect(result).toBe("2.0.0");
    });

    it("should use installed version if it satisfies range", async () => {
      const runtime = new TestRuntime();
      vi.mocked(exists)
        .mockResolvedValueOnce(true) // default alias exists
        .mockResolvedValueOnce(true); // for symlink creation
      vi.mocked(fs.realpath).mockResolvedValue(
        path.join(mockHomedir, ".jrm", "testruntime", "versions", "v1.0.0"),
      );
      vi.mocked(fs.readdir).mockResolvedValue([
        "v2.1.0",
        "v2.0.0",
        "v1.0.0",
      ] as any);

      const result = await runtime.use("^2.0.0");

      expect(result).toBe("2.1.0");
    });

    it("should handle alias name", async () => {
      const runtime = new TestRuntime();
      vi.mocked(exists)
        .mockResolvedValueOnce(true) // default alias exists
        .mockResolvedValueOnce(true) // custom alias exists
        .mockResolvedValueOnce(true); // for symlink creation
      vi.mocked(fs.realpath).mockResolvedValue(
        path.join(mockHomedir, ".jrm", "testruntime", "versions", "v2.0.0"),
      );
      vi.mocked(fs.readdir).mockResolvedValue(["v2.0.0"] as any);

      const result = await runtime.use("my-alias");

      expect(result).toBe("2.0.0");
    });

    it("should throw error if alias does not exist", async () => {
      const runtime = new TestRuntime();
      await expect(runtime.use("nonexistent-alias")).rejects.toThrow(
        "No alias named nonexistent-alias found.",
      );
    });

    it("should prompt to install if no installed version satisfies range", async () => {
      const runtime = new TestRuntime();
      vi.mocked(exists).mockResolvedValue(true);
      vi.mocked(fs.realpath).mockResolvedValue(
        path.join(mockHomedir, ".jrm", "testruntime", "versions", "v1.0.0"),
      );
      vi.mocked(fs.readdir)
        .mockResolvedValueOnce(["v1.0.0"] as any) // installed versions
        .mockResolvedValueOnce(["v1.0.0"] as any) // before install
        .mockResolvedValueOnce(["v3.0.0", "v1.0.0"] as any); // after install
      vi.mocked(ask).mockResolvedValue("y");

      const result = await runtime.use("^3.0.0");

      expect(ask).toHaveBeenCalled();
      expect(result).toBe("3.0.0");
    });

    it("should return undefined if user declines installation", async () => {
      const runtime = new TestRuntime();
      vi.mocked(exists).mockResolvedValue(true);
      vi.mocked(fs.realpath).mockResolvedValue(
        path.join(mockHomedir, ".jrm", "testruntime", "versions", "v1.0.0"),
      );
      vi.mocked(fs.readdir).mockResolvedValue(["v1.0.0"] as any);
      vi.mocked(ask).mockResolvedValue("n");

      const result = await runtime.use("^3.0.0");

      expect(result).toBeUndefined();
    });

    it("should throw error if no remote version satisfies range", async () => {
      const runtime = new TestRuntime();
      vi.mocked(exists).mockResolvedValue(true);
      vi.mocked(fs.realpath).mockResolvedValue(
        path.join(mockHomedir, ".jrm", "testruntime", "versions", "v1.0.0"),
      );
      vi.mocked(fs.readdir).mockResolvedValue(["v1.0.0"] as any);
      vi.mocked(ask).mockResolvedValue("y");

      await expect(runtime.use("^99.0.0")).rejects.toThrow(
        "No remote version satisfies ^99.0.0.",
      );
    });
  });

  describe("env", () => {
    it("should return environment variables", () => {
      const runtime = new TestRuntime();
      const env = runtime.env();

      expect(env).toHaveProperty("JRM_MULTISHELL_PATH_OF_TESTRUNTIME");
      expect(env).toHaveProperty("JRM_DEFAULT_ALIAS_PATH_OF_TESTRUNTIME");
      expect(env["JRM_MULTISHELL_PATH_OF_TESTRUNTIME"]).toContain(
        "testruntime/multishells",
      );
      expect(env["JRM_DEFAULT_ALIAS_PATH_OF_TESTRUNTIME"]).toContain(
        "testruntime/aliases/default",
      );
    });
  });

  describe("list", () => {
    it("should list installed versions with aliases", async () => {
      const runtime = new TestRuntime();
      vi.mocked(fs.readdir)
        .mockResolvedValueOnce(["default", "stable"] as any) // aliases
        .mockResolvedValueOnce(["v2.0.0", "v1.0.0"] as any); // versions
      vi.mocked(fs.realpath)
        .mockResolvedValueOnce(
          path.join(mockHomedir, ".jrm", "testruntime", "versions", "v2.0.0"),
        ) // default alias
        .mockResolvedValueOnce(
          path.join(mockHomedir, ".jrm", "testruntime", "versions", "v2.0.0"),
        ); // stable alias

      const result = await runtime.list();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        version: "2.0.0",
        aliases: ["default", "stable"],
        isUsing: false,
      });
      expect(result[1]).toEqual({
        version: "1.0.0",
        aliases: [],
        isUsing: false,
      });
    });

    it("should mark currently using version", async () => {
      const runtime = new TestRuntime();
      const multishellPath = path.join(
        mockHomedir,
        ".jrm",
        "testruntime",
        "multishells",
        "test",
      );
      process.env["JRM_MULTISHELL_PATH_OF_TESTRUNTIME"] = multishellPath;

      vi.mocked(fs.readdir)
        .mockResolvedValueOnce([]) // no aliases
        .mockResolvedValueOnce(["v2.0.0"] as any); // versions
      vi.mocked(fs.realpath).mockResolvedValue(
        path.join(mockHomedir, ".jrm", "testruntime", "versions", "v2.0.0"),
      );

      const result = await runtime.list();

      expect(result[0]?.isUsing).toBe(true);
    });

    it("should handle empty aliases directory", async () => {
      const runtime = new TestRuntime();
      vi.mocked(fs.readdir)
        .mockRejectedValueOnce(new Error("Directory not found")) // aliases
        .mockResolvedValueOnce(["v1.0.0"] as any); // versions

      const result = await runtime.list();

      expect(result).toHaveLength(1);
      expect(result[0]?.aliases).toEqual([]);
    });
  });

  describe("alias", () => {
    it("should create an alias for an installed version", async () => {
      const runtime = new TestRuntime();
      vi.mocked(exists).mockResolvedValue(true);

      await runtime.alias("my-alias", "2.0.0");

      expect(fs.symlink).toHaveBeenCalled();
    });

    it("should throw error for invalid version", async () => {
      const runtime = new TestRuntime();
      await expect(runtime.alias("my-alias", "invalid")).rejects.toThrow(
        "Invalid version: invalid. Expected a valid semver (e.g., 20.0.0).",
      );
    });

    it("should throw error if alias name is a valid semver range", async () => {
      const runtime = new TestRuntime();
      await expect(runtime.alias("^2.0.0", "2.0.0")).rejects.toThrow(
        "Invalid alias name: ^2.0.0. Alias name cannot be a valid semver or a valid semver range.",
      );
    });

    it("should throw error if version is not installed", async () => {
      const runtime = new TestRuntime();
      vi.mocked(exists).mockResolvedValue(false);

      await expect(runtime.alias("my-alias", "2.0.0")).rejects.toThrow(
        "testruntime@2.0.0 is not installed. Run `jrm install testruntime@2.0.0` first.",
      );
    });
  });

  describe("unalias", () => {
    it("should remove an alias", async () => {
      const runtime = new TestRuntime();
      vi.mocked(exists).mockResolvedValue(true);

      await runtime.unalias("my-alias");

      expect(fs.rm).toHaveBeenCalledWith(
        path.join(mockHomedir, ".jrm", "testruntime", "aliases", "my-alias"),
        { recursive: true },
      );
    });

    it("should throw error when trying to remove default alias", async () => {
      const runtime = new TestRuntime();
      await expect(runtime.unalias("default")).rejects.toThrow(
        "'default' alias is reserved. Cannot remove it.",
      );
    });

    it("should do nothing if alias does not exist", async () => {
      const runtime = new TestRuntime();
      vi.mocked(exists).mockResolvedValue(false);

      await runtime.unalias("nonexistent");

      expect(fs.rm).not.toHaveBeenCalled();
    });
  });

  describe("uninstall", () => {
    it("should uninstall an installed version", async () => {
      const runtime = new TestRuntime();
      vi.mocked(exists).mockResolvedValue(true);
      vi.mocked(fs.readdir).mockResolvedValue([]);

      const result = await runtime.uninstall("2.0.0");

      expect(result).toBe(true);
      expect(fs.rm).toHaveBeenCalledWith(
        path.join(mockHomedir, ".jrm", "testruntime", "versions", "v2.0.0"),
        { recursive: true },
      );
    });

    it("should return false if version is not installed", async () => {
      const runtime = new TestRuntime();
      vi.mocked(exists).mockResolvedValue(false);

      const result = await runtime.uninstall("2.0.0");

      expect(result).toBe(false);
      expect(fs.rm).not.toHaveBeenCalled();
    });

    it("should throw error for invalid version", async () => {
      const runtime = new TestRuntime();

      await expect(runtime.uninstall("invalid")).rejects.toThrow(
        "Invalid version: invalid. Expected a valid semver (e.g., 20.0.0).",
      );
    });

    it("should remove aliases pointing to the uninstalled version", async () => {
      const runtime = new TestRuntime();
      vi.mocked(exists).mockResolvedValue(true);
      vi.mocked(fs.readdir).mockResolvedValue(["default", "my-alias"] as any);
      vi.mocked(fs.realpath)
        .mockResolvedValueOnce(
          path.join(mockHomedir, ".jrm", "testruntime", "versions", "v2.0.0"),
        )
        .mockResolvedValueOnce(
          path.join(mockHomedir, ".jrm", "testruntime", "versions", "v2.0.0"),
        );

      const result = await runtime.uninstall("2.0.0");

      expect(result).toBe(true);
      expect(fs.rm).toHaveBeenCalledWith(
        path.join(mockHomedir, ".jrm", "testruntime", "aliases", "default"),
        { recursive: true },
      );
      expect(fs.rm).toHaveBeenCalledWith(
        path.join(mockHomedir, ".jrm", "testruntime", "aliases", "my-alias"),
        { recursive: true },
      );
      expect(fs.rm).toHaveBeenCalledWith(
        path.join(mockHomedir, ".jrm", "testruntime", "versions", "v2.0.0"),
        { recursive: true },
      );
    });

    it("should not remove aliases pointing to other versions", async () => {
      const runtime = new TestRuntime();
      vi.mocked(exists)
        .mockResolvedValueOnce(true) // version exists
        .mockResolvedValueOnce(true); // default alias exists after uninstall
      vi.mocked(fs.readdir)
        .mockResolvedValueOnce(["default", "other-alias"] as any) // aliases
        .mockResolvedValueOnce(["v1.0.0", "v3.0.0"] as any); // remaining versions
      vi.mocked(fs.realpath)
        .mockResolvedValueOnce(
          path.join(mockHomedir, ".jrm", "testruntime", "versions", "v1.0.0"),
        )
        .mockResolvedValueOnce(
          path.join(mockHomedir, ".jrm", "testruntime", "versions", "v3.0.0"),
        );

      const result = await runtime.uninstall("2.0.0");

      expect(result).toBe(true);
      expect(fs.rm).toHaveBeenCalledTimes(1);
      expect(fs.rm).toHaveBeenCalledWith(
        path.join(mockHomedir, ".jrm", "testruntime", "versions", "v2.0.0"),
        { recursive: true },
      );
    });

    it("should set default alias to first remaining version when default is removed", async () => {
      const runtime = new TestRuntime();
      vi.mocked(exists)
        .mockResolvedValueOnce(true) // version exists
        .mockResolvedValueOnce(false); // default alias does not exist after removal
      vi.mocked(fs.readdir)
        .mockResolvedValueOnce(["default"] as any) // aliases pointing to version being uninstalled
        .mockResolvedValueOnce(["v1.0.0", "v3.0.0"] as any); // remaining versions (will be sorted by semver descending)
      vi.mocked(fs.realpath).mockResolvedValueOnce(
        path.join(mockHomedir, ".jrm", "testruntime", "versions", "v2.0.0"),
      );

      const result = await runtime.uninstall("2.0.0");

      expect(result).toBe(true);
      // getInstalledVersions sorts by semver descending, so v3.0.0 comes first
      expect(fs.symlink).toHaveBeenCalledWith(
        "../versions/v3.0.0",
        path.join(mockHomedir, ".jrm", "testruntime", "aliases", "default"),
      );
    });

    it("should not set default alias when no remaining versions", async () => {
      const runtime = new TestRuntime();
      vi.mocked(exists)
        .mockResolvedValueOnce(true) // version exists
        .mockResolvedValueOnce(false); // default alias does not exist after removal
      vi.mocked(fs.readdir)
        .mockResolvedValueOnce(["default"] as any) // aliases
        .mockResolvedValueOnce([] as any); // no remaining versions
      vi.mocked(fs.realpath).mockResolvedValueOnce(
        path.join(mockHomedir, ".jrm", "testruntime", "versions", "v2.0.0"),
      );

      const result = await runtime.uninstall("2.0.0");

      expect(result).toBe(true);
      expect(fs.symlink).not.toHaveBeenCalled();
    });
  });

  describe("getRemoteVersions", () => {
    it("should filter out prerelease versions", async () => {
      const runtime = new TestRuntime();
      vi.mocked(fs.readdir).mockResolvedValue([]);

      await runtime.install("^2.0.0");

      // Should install 2.1.0, not 2.0.0-rc.1
      expect(fs.mkdir).toHaveBeenCalled();
    });
  });
});
