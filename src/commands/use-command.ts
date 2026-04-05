import process from "node:process";
import { getAllRuntimes, getRuntime } from "../common.ts";

export interface UseCommandOptions {
  runtime: string;
  versionRange: string;
}

export async function useCommand(options: UseCommandOptions[]): Promise<void> {
  const items =
    options.length === 0
      ? getAllRuntimes().map((runtime) => ({
          runtime,
          versionRange: undefined,
        }))
      : options.map((option) => ({
          runtime: getRuntime(option.runtime),
          versionRange: option.versionRange,
        }));

  for (const { runtime, versionRange } of items) {
    const usingVersion = await runtime.use(versionRange);
    if (usingVersion) {
      process.stdout.write(`Using ${runtime.name}@${usingVersion}\n`);
    }
  }
}
