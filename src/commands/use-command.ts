import process from "node:process";
import { getAllRuntimes, getRuntime } from "../common.ts";

export interface UseCommandOptions {
  runtime: string;
  versionRangeOrAlias: string;
}

export async function useCommand(options: UseCommandOptions[]): Promise<void> {
  const items =
    options.length === 0
      ? getAllRuntimes().map((runtime) => ({
          runtime,
          versionRangeOrAlias: undefined,
        }))
      : options.map((option) => ({
          runtime: getRuntime(option.runtime),
          versionRangeOrAlias: option.versionRangeOrAlias,
        }));

  for (const { runtime, versionRangeOrAlias } of items) {
    const usingVersion = await runtime.use(versionRangeOrAlias);
    if (usingVersion) {
      process.stdout.write(`Using ${runtime.name}@${usingVersion}\n`);
    }
  }
}
