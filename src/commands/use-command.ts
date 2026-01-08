import process from "node:process";
import { getAllRuntimes, getRuntime } from "../common.ts";
import type { Runtime } from "../runtime.ts";

export interface UseCommandOptions {
  runtime: string;
  version: string;
}

export async function useCommand(options: UseCommandOptions[]): Promise<void> {
  const items: { runtime: Runtime; version?: string }[] =
    options.length === 0
      ? getAllRuntimes().map((runtime) => ({ runtime }))
      : options.map((option) => ({
          runtime: getRuntime(option.runtime),
          version: option.version,
        }));

  for (const { runtime, version } of items) {
    const usingVersion = await runtime.use(version);
    if (usingVersion) {
      process.stdout.write(`Using ${runtime.name}@${usingVersion}\n`);
    }
  }
}
