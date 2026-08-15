import childProcess from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import packageJson from "../package.json" with { type: "json" };

const CLI_PATH = path.join(import.meta.dirname, "..", "src", "main.cli.ts");

async function runCLI(
  args: string[] = [],
  cwd?: string,
  env?: Record<string, string>,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return await new Promise((resolve) => {
    const command = `${process.execPath} ${CLI_PATH} ${args.join(" ")}`;
    childProcess.exec(
      command,
      { cwd, env: { ...process.env, ...env } },
      (error, stdout, stderr) => {
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: error?.code ?? 0,
        });
      },
    );
  });
}

describe("JRM CLI Tests", () => {
  it("should display version with -v and --version flags", async () => {
    const resultShort = await runCLI(["-v"]);
    const resultLong = await runCLI(["--version"]);

    expect(resultShort.exitCode).toBe(0);
    expect(resultShort.stdout).toBe(packageJson.version);
    expect(resultLong.exitCode).toBe(0);
    expect(resultLong.stdout).toBe(packageJson.version);
  });

  it("should display help with -h and --help flags", async () => {
    const resultShort = await runCLI(["-h"]);
    const resultLong = await runCLI(["--help"]);

    const expectedUsagePattern = new RegExp(`^Usage: ${packageJson.name}`);

    expect(resultShort.exitCode).toBe(0);
    expect(resultShort.stdout).toMatch(expectedUsagePattern);

    expect(resultLong.exitCode).toBe(0);
    expect(resultLong.stdout).toMatch(expectedUsagePattern);
  });
});

describe("jrm pm", () => {
  let fixtureDir: string;

  beforeEach(async () => {
    fixtureDir = await fs.mkdtemp(path.join(os.tmpdir(), "jrm-pm-test-"));
  });

  afterEach(async () => {
    await fs.rm(fixtureDir, { recursive: true, force: true });
  });

  const writeJson = async (relativePath: string, content: unknown) => {
    const filePath = path.join(fixtureDir, relativePath);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(content));
  };

  it("should print the package manager declared in package.json devEngines", async () => {
    await writeJson("package.json", {
      devEngines: { packageManager: { name: "pnpm", version: "10.0.0" } },
    });

    const result = await runCLI(["pm"], fixtureDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("pnpm");
    expect(result.stderr).toBe("");
  });

  it("should pick the first supported entry and skip unsupported names", async () => {
    await writeJson("package.json", {
      devEngines: {
        packageManager: [
          { name: "vlt", version: "1.0.0" },
          { name: "yarn", version: "4.0.0" },
          { name: "npm", version: "10.0.0" },
        ],
      },
    });

    const result = await runCLI(["pm"], fixtureDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("yarn");
  });

  it("should prefer the config closest to the current directory", async () => {
    await writeJson(".jrmrc.json", {
      packageManager: { name: "pnpm", version: "10.0.0" },
    });
    await writeJson("sub/jrm.config.json", {
      packageManager: { name: "npm", version: "10.0.0" },
    });

    const result = await runCLI(["pm"], path.join(fixtureDir, "sub"));

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("npm");
  });

  it("should prefer package.json devEngines over .jrmrc.json in the same directory", async () => {
    await writeJson("package.json", {
      devEngines: { packageManager: { name: "yarn", version: "4.0.0" } },
    });
    await writeJson(".jrmrc.json", {
      packageManager: { name: "npm", version: "10.0.0" },
    });

    const result = await runCLI(["pm"], fixtureDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("yarn");
  });

  it("should prefer .jrmrc.json over jrm.config.json in the same directory", async () => {
    await writeJson(".jrmrc.json", {
      packageManager: { name: "npm", version: "10.0.0" },
    });
    await writeJson("jrm.config.json", {
      packageManager: { name: "pnpm", version: "10.0.0" },
    });

    const result = await runCLI(["pm"], fixtureDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("npm");
  });

  it("should pick the entry with the smallest index in the same file", async () => {
    await writeJson("package.json", {
      devEngines: {
        packageManager: [
          { name: "npm", version: "10.0.0" },
          { name: "yarn", version: "4.0.0" },
        ],
      },
    });

    const result = await runCLI(["pm"], fixtureDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("npm");
  });

  it("should fail with exit code 1 when no supported package manager is detected", async () => {
    await writeJson("package.json", {
      devEngines: { packageManager: { name: "vlt", version: "1.0.0" } },
    });

    const result = await runCLI(["pm"], fixtureDir);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe(
      "Unable to determine the package manager for the current project/directory.",
    );
  });
});

describe("jrm env", () => {
  it("should inject the pm function by default", async () => {
    const result = await runCLI(["env"], undefined, { SHELL: "/bin/bash" });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("pm() {");
  });

  it("should not inject the pm function with --no-pm", async () => {
    const result = await runCLI(["env", "--no-pm"], undefined, {
      SHELL: "/bin/bash",
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toContain("pm() {");
  });
});
