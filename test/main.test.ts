import childProcess from "node:child_process";
import process from "node:process";
import { describe, expect, it } from "vitest";
import packageJson from "../package.json" with { type: "json" };

async function runCLI(
  args: string[] = [],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return await new Promise((resolve) => {
    const command = `${process.execPath} src/main.cli.ts ${args.join(" ")}`;
    childProcess.exec(command, (error, stdout, stderr) => {
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: error?.code ?? 0,
      });
    });
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
