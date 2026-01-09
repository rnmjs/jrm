import process from "node:process";
import { getAllRuntimes, getRuntime } from "../common.ts";
import type { Runtime } from "../runtime.ts";

export interface UseCommandOptions {
  runtime: string;
  versionOrAlias: string;
}

export async function useCommand(options: UseCommandOptions[]): Promise<void> {
  const items: { runtime: Runtime; versionOrAlias?: string }[] =
    options.length === 0
      ? getAllRuntimes().map((runtime) => ({ runtime }))
      : options.map((option) => ({
          runtime: getRuntime(option.runtime),
          versionOrAlias: option.versionOrAlias,
        }));

  for (const { runtime, versionOrAlias } of items) {
    const usingVersion = await runtime.use(versionOrAlias);
    if (usingVersion) {
      process.stdout.write(`Using ${runtime.name}@${usingVersion}\n`);
    }
  }
}
