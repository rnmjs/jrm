import process from "node:process";
import { getRuntime } from "../common.ts";

export interface UninstallCommandOptions {
  runtime: string;
  version: string;
}

export async function uninstallCommand(
  options: UninstallCommandOptions[],
): Promise<void> {
  const items = options.map((option) => ({
    runtime: getRuntime(option.runtime),
    version: option.version,
  }));

  for (const { runtime, version } of items) {
    const uninstalled = await runtime.uninstall(version);
    if (!uninstalled) {
      process.stdout.write(
        `${runtime.name}@${version} is not installed, skip.\n`,
      );
    }
  }
}
