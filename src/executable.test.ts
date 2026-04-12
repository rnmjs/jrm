import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Executable } from "./executable.ts";
import { RuntimeDetector } from "./runtime-detector.ts";
import { ask } from "./utils/ask.ts";
import { download } from "./utils/download.ts";
import { exists } from "./utils/exists.ts";
import { isInProject } from "./utils/is-in-project.ts";

// Mock all external dependencies
vi.mock("node:fs/promises");
vi.mock("node:os");
vi.mock("node:process", () => ({
  default: {
    cwd: vi.fn(),
    ppid: 12345,
    env: {},
    stdout: {
      write: vi.fn(),
    },
    stderr: {
      write: vi.fn(),
    },
  },
}));
vi.mock("./runtime-detector.ts");
vi.mock("./utils/ask.ts");
vi.mock("./utils/download.ts");
vi.mock("./utils/exists.ts");
vi.mock("./utils/is-in-project.ts");

// Create a concrete implementation of the abstract Executable class for testing
class TestExecutable extends Executable {
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

  async testDownloadToLocal(url: string): Promise<string> {
    return await this.downloadToLocal(url);
  }
}

describe("Executable", () => {
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

    // Setup default isInProject mock
    vi.mocked(isInProject).mockResolvedValue(false);
  });

  describe("install", () => {
    it("should install a specific version", async () => {
      const executable = new TestExecutable({ DetectorClass: RuntimeDetector });
      vi.mocked(fs.readdir).mockResolvedValue([]);

      const result = await executable.install("2.0.0");

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
      const executable = new TestExecutable({ DetectorClass: RuntimeDetector });
      vi.mocked(fs.readdir).mockResolvedValue(["v2.0.0"] as any);

      const result = await executable.install("2.0.0");

      expect(result).toBe(false);
    });

    it("should install a version matching a range", async () => {
      const executable = new TestExecutable({ DetectorClass: RuntimeDetector });
      vi.mocked(fs.readdir).mockResolvedValue([]);

      const result = await executable.install("^2.0.0");

      expect(result).toBe(true);
    });

    it("should throw error if no remote version satisfies the range", async () => {
      const executable = new TestExecutable({ DetectorClass: RuntimeDetector });
      vi.mocked(fs.readdir).mockResolvedValue([]);

      await expect(executable.install("^99.0.0")).rejects.toThrow(
        "No remote version satisfies ^99.0.0.",
      );
    });

    it("should install without creating aliases", async () => {
      const executable = new TestExecutable({ DetectorClass: RuntimeDetector });
      vi.mocked(fs.readdir).mockResolvedValue([]);

      await executable.install("2.0.0");

      expect(fs.symlink).not.toHaveBeenCalled();
    });
  });

  describe("use", () => {
    const multishellPath = "/home/testuser/.jrm/testruntime/multishells/test";

    beforeEach(() => {
      process.env["JRM_MULTISHELL_PATH_OF_TESTRUNTIME"] = multishellPath;
    });

    it("should throw error if multishell path env is not set", async () => {
      const executable = new TestExecutable({ DetectorClass: RuntimeDetector });
      process.env["JRM_MULTISHELL_PATH_OF_TESTRUNTIME"] = undefined;

      await expect(executable.use("2.0.0")).rejects.toThrow(
        "JRM_MULTISHELL_PATH_OF_TESTRUNTIME is not set.",
      );
    });

    it("should throw error if multishell path is not absolute", async () => {
      const executable = new TestExecutable({ DetectorClass: RuntimeDetector });
      process.env["JRM_MULTISHELL_PATH_OF_TESTRUNTIME"] = "relative/path";

      await expect(executable.use("2.0.0")).rejects.toThrow(
        "Value of JRM_MULTISHELL_PATH_OF_TESTRUNTIME is not an absolute path.",
      );
    });

    it("should use installed version that matches range", async () => {
      const executable = new TestExecutable({ DetectorClass: RuntimeDetector });
      vi.mocked(fs.readdir).mockResolvedValue(["v2.0.0"] as any);

      const result = await executable.use("2.0.0");

      expect(result).toBe("2.0.0");
      expect(fs.symlink).toHaveBeenCalled();
    });

    it("should create placeholder binaries when no default version exists", async () => {
      const executable = new TestExecutable({ DetectorClass: RuntimeDetector });
      vi.mocked(exists).mockResolvedValue(false);
      vi.mocked(RuntimeDetector.prototype.detectVersionRange).mockResolvedValue(
        undefined,
      );

      const result = await executable.use();

      expect(result).toBeUndefined();
      // Should delete existing multishell before creating stubs
      expect(fs.rm).toHaveBeenCalledWith(multishellPath, { recursive: true });
      expect(fs.mkdir).toHaveBeenCalledWith(path.join(multishellPath, "bin"), {
        recursive: true,
      });
      expect(fs.writeFile).toHaveBeenCalledTimes(3); // testruntime, testbin, testtool
      expect(fs.chmod).toHaveBeenCalledTimes(3);
    });

    it("should return undefined when no version range is detected", async () => {
      const executable = new TestExecutable({ DetectorClass: RuntimeDetector });
      vi.mocked(exists).mockResolvedValue(false);
      vi.mocked(RuntimeDetector.prototype.detectVersionRange).mockResolvedValue(
        undefined,
      );

      const result = await executable.use();

      expect(result).toBeUndefined();
    });

    it("should return undefined when onFail is ignore", async () => {
      const executable = new TestExecutable({ DetectorClass: RuntimeDetector });
      vi.mocked(exists).mockResolvedValue(true);
      vi.mocked(fs.realpath).mockResolvedValue(
        path.join(mockHomedir, ".jrm", "testruntime", "versions", "v1.0.0"),
      );
      vi.mocked(fs.readdir).mockResolvedValue(["v1.0.0"] as any);
      vi.mocked(RuntimeDetector.prototype.detectVersionRange).mockResolvedValue(
        {
          versionRange: "^3.0.0",
          onFail: "ignore",
        },
      );

      const result = await executable.use();

      expect(result).toBeUndefined();
      expect(ask).not.toHaveBeenCalled();
    });

    it("should print warning and return undefined when onFail is warn", async () => {
      const executable = new TestExecutable({ DetectorClass: RuntimeDetector });
      vi.mocked(isInProject).mockResolvedValue(true);
      vi.mocked(exists).mockResolvedValue(true);
      vi.mocked(fs.realpath).mockResolvedValue(
        path.join(mockHomedir, ".jrm", "testruntime", "versions", "v1.0.0"),
      );
      vi.mocked(fs.readdir).mockResolvedValue(["v1.0.0"] as any);
      vi.mocked(RuntimeDetector.prototype.detectVersionRange).mockResolvedValue(
        {
          versionRange: "^3.0.0",
          onFail: "warn",
        },
      );

      const result = await executable.use();

      expect(result).toBeUndefined();
      expect(ask).not.toHaveBeenCalled();
      expect(process.stderr.write).toHaveBeenCalledWith(
        "No installed testruntime version satisfies ^3.0.0. Run `jrm install testruntime@^3.0.0` to install it.\n",
      );
    });

    it("should prompt to install when onFail is error", async () => {
      const executable = new TestExecutable({ DetectorClass: RuntimeDetector });
      vi.mocked(isInProject).mockResolvedValue(true);
      vi.mocked(exists).mockResolvedValue(true);
      vi.mocked(fs.realpath).mockResolvedValue(
        path.join(mockHomedir, ".jrm", "testruntime", "versions", "v1.0.0"),
      );
      vi.mocked(fs.readdir)
        .mockResolvedValueOnce(["v1.0.0"] as any)
        .mockResolvedValueOnce(["v1.0.0"] as any)
        .mockResolvedValueOnce(["v3.0.0", "v1.0.0"] as any);
      vi.mocked(RuntimeDetector.prototype.detectVersionRange).mockResolvedValue(
        {
          versionRange: "^3.0.0",
          onFail: "error",
        },
      );
      vi.mocked(ask).mockResolvedValue("y");

      const result = await executable.use();

      expect(ask).toHaveBeenCalled();
      expect(result).toBe("3.0.0");
    });

    it("should prompt to install when onFail is download", async () => {
      const executable = new TestExecutable({ DetectorClass: RuntimeDetector });
      vi.mocked(isInProject).mockResolvedValue(true);
      vi.mocked(exists).mockResolvedValue(true);
      vi.mocked(fs.realpath).mockResolvedValue(
        path.join(mockHomedir, ".jrm", "testruntime", "versions", "v1.0.0"),
      );
      vi.mocked(fs.readdir)
        .mockResolvedValueOnce(["v1.0.0"] as any)
        .mockResolvedValueOnce(["v1.0.0"] as any)
        .mockResolvedValueOnce(["v3.0.0", "v1.0.0"] as any);
      vi.mocked(RuntimeDetector.prototype.detectVersionRange).mockResolvedValue(
        {
          versionRange: "^3.0.0",
          onFail: "download",
        },
      );
      vi.mocked(ask).mockResolvedValue("y");

      const result = await executable.use();

      expect(ask).toHaveBeenCalled();
      expect(result).toBe("3.0.0");
    });

    it("should use installed version if it satisfies range", async () => {
      const executable = new TestExecutable({ DetectorClass: RuntimeDetector });
      vi.mocked(fs.readdir).mockResolvedValue(["v2.0.0", "v1.0.0"] as any);

      const result = await executable.use("^2.0.0");

      expect(result).toBe("2.0.0");
    });

    it("should prompt to install if no installed version satisfies range", async () => {
      const executable = new TestExecutable({ DetectorClass: RuntimeDetector });
      vi.mocked(fs.readdir)
        .mockResolvedValueOnce(["v1.0.0"] as any) // initialize multishell
        .mockResolvedValueOnce(["v1.0.0"] as any) // installed versions check in useWithVersionRange
        .mockResolvedValueOnce(["v3.0.0", "v1.0.0"] as any); // after install
      vi.mocked(ask).mockResolvedValue("y");

      const result = await executable.use("^3.0.0");

      expect(ask).toHaveBeenCalled();
      expect(result).toBe("3.0.0");
    });

    it("should return undefined if user declines installation", async () => {
      const executable = new TestExecutable({ DetectorClass: RuntimeDetector });
      vi.mocked(fs.readdir).mockResolvedValue(["v1.0.0"] as any);
      vi.mocked(ask).mockResolvedValue("n");

      const result = await executable.use("^3.0.0");

      expect(result).toBeUndefined();
    });

    it("should throw error if no remote version satisfies range", async () => {
      const executable = new TestExecutable({ DetectorClass: RuntimeDetector });
      vi.mocked(fs.readdir).mockResolvedValue(["v1.0.0"] as any);
      vi.mocked(ask).mockResolvedValue("y");

      await expect(executable.use("^99.0.0")).rejects.toThrow(
        "No remote version satisfies ^99.0.0.",
      );
    });
  });

  describe("use with strict mode", () => {
    const multishellPath = "/home/testuser/.jrm/testruntime/multishells/test";

    beforeEach(() => {
      process.env["JRM_MULTISHELL_PATH_OF_TESTRUNTIME"] = multishellPath;
    });

    it("should create error stub binaries when strict mode is enabled, in project, and no version configured", async () => {
      const executable = new TestExecutable({
        strict: true,
        DetectorClass: RuntimeDetector,
      });
      vi.mocked(isInProject).mockResolvedValue(true);
      vi.mocked(RuntimeDetector.prototype.detectVersionRange).mockResolvedValue(
        undefined,
      );
      vi.mocked(fs.readdir).mockResolvedValue([]);

      const result = await executable.use(undefined);

      expect(result).toBeUndefined();
      // Should delete existing multishell before creating stubs
      expect(fs.rm).toHaveBeenCalledWith(multishellPath, { recursive: true });
      // Should create stub binaries with error message
      expect(fs.mkdir).toHaveBeenCalledWith(path.join(multishellPath, "bin"), {
        recursive: true,
      });
      // writeStubBinaries is called twice: once for no installed version (line 228), once for strict mode (line 279)
      expect(fs.writeFile).toHaveBeenCalledTimes(6); // 3 binaries × 2 calls
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(multishellPath, "bin", "testruntime"),
        expect.stringContaining(
          "Current project is not configured with testruntime",
        ),
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(multishellPath, "bin", "testbin"),
        expect.stringContaining(
          "Current project is not configured with testruntime",
        ),
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(multishellPath, "bin", "testtool"),
        expect.stringContaining(
          "Current project is not configured with testruntime",
        ),
      );
      // chmod is called twice: once for no installed version (line 228), once for strict mode (line 279)
      expect(fs.chmod).toHaveBeenCalledTimes(6); // 3 binaries × 2 writeStubBinaries calls
    });

    it("should proceed normally when strict mode is enabled but version is configured", async () => {
      const executable = new TestExecutable({
        strict: true,
        DetectorClass: RuntimeDetector,
      });
      vi.mocked(isInProject).mockResolvedValue(true);
      vi.mocked(RuntimeDetector.prototype.detectVersionRange).mockResolvedValue(
        {
          versionRange: "1.0.0",
        },
      );
      vi.mocked(fs.readdir).mockResolvedValue(["v1.0.0"] as any);

      const result = await executable.use(undefined);

      expect(result).toBe("1.0.0");
      expect(fs.symlink).toHaveBeenCalled();
      // Should NOT create error stub binaries
      expect(fs.writeFile).not.toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining("not configured"),
      );
    });

    it("should proceed normally when strict mode is enabled but not in project", async () => {
      const executable = new TestExecutable({
        strict: true,
        DetectorClass: RuntimeDetector,
      });
      vi.mocked(isInProject).mockResolvedValue(false);
      vi.mocked(RuntimeDetector.prototype.detectVersionRange).mockResolvedValue(
        undefined,
      );
      vi.mocked(fs.readdir).mockResolvedValue([]);

      const result = await executable.use(undefined);

      expect(result).toBeUndefined();
      // Should NOT create error stub binaries since not in project
      expect(fs.writeFile).not.toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining("not configured"),
      );
    });

    it("should skip strict mode check when strict option is not set", async () => {
      const executable = new TestExecutable({ DetectorClass: RuntimeDetector });
      vi.mocked(isInProject).mockResolvedValue(true);
      vi.mocked(RuntimeDetector.prototype.detectVersionRange).mockResolvedValue(
        undefined,
      );
      vi.mocked(fs.readdir).mockResolvedValue([]);

      const result = await executable.use(undefined);

      expect(result).toBeUndefined();
      // Should NOT create error stub binaries since strict mode is not enabled
      expect(fs.writeFile).not.toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining("not configured"),
      );
    });
  });

  describe("env", () => {
    it("should return environment variables", () => {
      const executable = new TestExecutable({ DetectorClass: RuntimeDetector });
      const env = executable.env();

      expect(env).toHaveProperty("JRM_MULTISHELL_PATH_OF_TESTRUNTIME");
      expect(Object.keys(env)).toHaveLength(1);
      expect(env["JRM_MULTISHELL_PATH_OF_TESTRUNTIME"]).toContain(
        "testruntime/multishells",
      );
    });
  });

  describe("list", () => {
    it("should list installed versions", async () => {
      const executable = new TestExecutable({ DetectorClass: RuntimeDetector });
      vi.mocked(fs.readdir).mockResolvedValue(["v2.0.0", "v1.0.0"] as any);

      const result = await executable.list();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        version: "2.0.0",
        isUsing: false,
      });
      expect(result[1]).toEqual({
        version: "1.0.0",
        isUsing: false,
      });
    });

    it("should mark currently using version", async () => {
      const executable = new TestExecutable({ DetectorClass: RuntimeDetector });
      const multishellPath = path.join(
        mockHomedir,
        ".jrm",
        "testruntime",
        "multishells",
        "test",
      );
      process.env["JRM_MULTISHELL_PATH_OF_TESTRUNTIME"] = multishellPath;

      vi.mocked(fs.readdir).mockResolvedValue(["v2.0.0"] as any);
      vi.mocked(fs.realpath).mockResolvedValue(
        path.join(mockHomedir, ".jrm", "testruntime", "versions", "v2.0.0"),
      );

      const result = await executable.list();

      expect(result[0]?.isUsing).toBe(true);
    });

    it("should list installed versions", async () => {
      const executable = new TestExecutable({ DetectorClass: RuntimeDetector });
      vi.mocked(fs.readdir).mockResolvedValueOnce(["v1.0.0"] as any); // versions

      const result = await executable.list();

      expect(result).toHaveLength(1);
      expect(result[0]?.version).toBe("1.0.0");
    });
  });

  describe("uninstall", () => {
    it("should uninstall an installed version", async () => {
      const executable = new TestExecutable({ DetectorClass: RuntimeDetector });
      vi.mocked(exists).mockResolvedValue(true);
      vi.mocked(fs.readdir).mockResolvedValue([]);

      const result = await executable.uninstall("2.0.0");

      expect(result).toBe(true);
      expect(fs.rm).toHaveBeenCalledWith(
        path.join(mockHomedir, ".jrm", "testruntime", "versions", "v2.0.0"),
        { recursive: true },
      );
    });

    it("should return false if version is not installed", async () => {
      const executable = new TestExecutable({ DetectorClass: RuntimeDetector });
      vi.mocked(exists).mockResolvedValue(false);

      const result = await executable.uninstall("2.0.0");

      expect(result).toBe(false);
      expect(fs.rm).not.toHaveBeenCalled();
    });

    it("should throw error for invalid version", async () => {
      const executable = new TestExecutable({ DetectorClass: RuntimeDetector });

      await expect(executable.uninstall("invalid")).rejects.toThrow(
        "Invalid version: invalid. Expected a valid semver (e.g., 20.0.0).",
      );
    });
  });

  describe("downloadToLocal", () => {
    it("should download file and return the downloaded path", async () => {
      const executable = new TestExecutable({ DetectorClass: RuntimeDetector });
      vi.mocked(download).mockResolvedValue(undefined);
      vi.mocked(fs.stat).mockRejectedValue(new Error("File not found"));

      const result = await executable.testDownloadToLocal(
        "https://example.com/dist/v1.0.0/test-file.tar.gz",
      );

      expect(result).toBe(
        path.join(
          mockHomedir,
          ".jrm",
          "testruntime",
          "downloads",
          "test-file.tar.gz",
        ),
      );
      expect(download).toHaveBeenCalledWith(
        "https://example.com/dist/v1.0.0/test-file.tar.gz",
        path.join(mockHomedir, ".jrm", "testruntime", "downloads"),
        expect.objectContaining({
          onResponse: expect.any(Function),
          onProgress: expect.any(Function),
        }),
      );
    });

    it("should skip download when local file size matches content-length", async () => {
      const executable = new TestExecutable({ DetectorClass: RuntimeDetector });
      vi.mocked(fs.stat).mockResolvedValue({ size: 1024 } as any);
      // eslint-disable-next-line @typescript-eslint/require-await -- mockImplementation needs async to match the download function signature
      vi.mocked(download).mockImplementation(async (_url, _dest, options) => {
        const mockResponse = {
          headers: {
            get: (name: string) => (name === "content-length" ? "1024" : null),
          },
        } as any;
        const shouldDownload = options?.onResponse?.(mockResponse);
        expect(shouldDownload).toBe(false);
      });

      await executable.testDownloadToLocal(
        "https://example.com/dist/v1.0.0/test-file.tar.gz",
      );

      expect(download).toHaveBeenCalled();
    });

    it("should proceed with download when local file size differs from content-length", async () => {
      const executable = new TestExecutable({ DetectorClass: RuntimeDetector });
      vi.mocked(fs.stat).mockResolvedValue({ size: 512 } as any);
      // eslint-disable-next-line @typescript-eslint/require-await -- mockImplementation needs async to match the download function signature
      vi.mocked(download).mockImplementation(async (_url, _dest, options) => {
        const mockResponse = {
          headers: {
            get: (name: string) => (name === "content-length" ? "1024" : null),
          },
        } as any;
        const shouldDownload = options?.onResponse?.(mockResponse);
        expect(shouldDownload).toBe(true);
      });

      await executable.testDownloadToLocal(
        "https://example.com/dist/v1.0.0/test-file.tar.gz",
      );

      expect(download).toHaveBeenCalled();
    });

    it("should throw error when URL has no filename", async () => {
      const executable = new TestExecutable({ DetectorClass: RuntimeDetector });

      await expect(
        executable.testDownloadToLocal("https://example.com/"),
      ).rejects.toThrow("Internal error: unable to extract filename from URL");
    });
  });

  describe("getRemoteVersions", () => {
    it("should filter out prerelease versions", async () => {
      const executable = new TestExecutable({ DetectorClass: RuntimeDetector });
      vi.mocked(fs.readdir).mockResolvedValue([]);

      await executable.install("^2.0.0");

      // Should install 2.1.0, not 2.0.0-rc.1
      expect(fs.mkdir).toHaveBeenCalled();
    });
  });
});
