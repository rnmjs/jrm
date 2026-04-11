import process from "node:process";
import { getExecutable } from "../common.ts";

export interface InstallCommandOptions {
  name: string;
  versionRange: string;
}

export async function installCommand(
  options: InstallCommandOptions[],
): Promise<void> {
  const items = options.map((option) => ({
    executable: getExecutable(option.name),
    versionRange: option.versionRange,
  }));

  for (const { executable, versionRange } of items) {
    const installed = await executable.install(versionRange);
    if (!installed) {
      process.stdout.write(
        `${executable.name}@${versionRange} is already installed, skip.\n`,
      );
    }
  }
}
