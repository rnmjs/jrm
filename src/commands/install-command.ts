import process from "node:process";
import { getRuntime } from "../common.ts";

export interface InstallCommandOptions {
  runtime: string;
  versionRange: string;
}

export async function installCommand(
  options: InstallCommandOptions[],
): Promise<void> {
  const items = options.map((option) => ({
    runtime: getRuntime(option.runtime),
    versionRange: option.versionRange,
  }));

  for (const { runtime, versionRange } of items) {
    const installed = await runtime.install(versionRange);
    if (!installed) {
      process.stdout.write(
        `${runtime.name}@${versionRange} is already installed, skip.\n`,
      );
    }
  }
}
