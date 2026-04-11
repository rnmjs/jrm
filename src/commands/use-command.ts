import process from "node:process";
import { getAllExecutables, getExecutable } from "../common.ts";

export interface UseCommandOptions {
  name: string;
  versionRange: string;
}

export async function useCommand(options: UseCommandOptions[]): Promise<void> {
  const items =
    options.length === 0
      ? getAllExecutables().map((executable) => ({
          executable,
          versionRange: undefined,
        }))
      : options.map((option) => ({
          executable: getExecutable(option.name),
          versionRange: option.versionRange,
        }));

  for (const { executable, versionRange } of items) {
    const usingVersion = await executable.use(versionRange);
    if (usingVersion) {
      process.stdout.write(`Using ${executable.name}@${usingVersion}\n`);
    }
  }
}
