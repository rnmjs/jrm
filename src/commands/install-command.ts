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
    const { version, skipInstalling } = await executable.install(versionRange);
    if (skipInstalling) {
      process.stdout.write(
        `${executable.name}@${version} is already installed, skip.\n`,
      );
    }
  }
}
