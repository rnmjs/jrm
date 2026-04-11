import process from "node:process";
import { getExecutable } from "../common.ts";

export interface UninstallCommandOptions {
  name: string;
  version: string;
}

export async function uninstallCommand(
  options: UninstallCommandOptions[],
): Promise<void> {
  const items = options.map((option) => ({
    executable: getExecutable(option.name),
    version: option.version,
  }));

  for (const { executable, version } of items) {
    const uninstalled = await executable.uninstall(version);
    if (!uninstalled) {
      process.stdout.write(
        `${executable.name}@${version} is not installed, skip.\n`,
      );
    }
  }
}
