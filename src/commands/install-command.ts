import process from "node:process";
import { getRuntime } from "../common.ts";
import type { Runtime } from "../runtime.ts";

export interface InstallCommandOptions {
  runtime: string;
  version: string;
}

export async function installCommand(
  options: InstallCommandOptions[],
): Promise<void> {
  const items: { runtime: Runtime; version: string }[] = options.map(
    (option) => ({
      runtime: getRuntime(option.runtime),
      version: option.version,
    }),
  );

  for (const { runtime, version } of items) {
    const installed = await runtime.install(version);
    if (!installed) {
      process.stdout.write(
        `${runtime.name}@${version} is already installed, skip.\n`,
      );
    }
  }
}
