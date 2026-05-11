import process from "node:process";
import { getAllExecutables, getExecutable } from "../common.ts";

export interface ExecutableSpec {
  name: string;
  versionRange: string;
}

export interface UseCommandFlags {
  yes?: boolean;
}

export async function useCommand(
  specs: ExecutableSpec[],
  flags?: UseCommandFlags,
): Promise<void> {
  const items =
    specs.length === 0
      ? getAllExecutables().map((executable) => ({
          executable,
          versionRange: undefined,
        }))
      : specs.map((spec) => ({
          executable: getExecutable(spec.name),
          versionRange: spec.versionRange,
        }));

  const errors: unknown[] = [];

  for (const { executable, versionRange } of items) {
    try {
      const usingVersion = await executable.use(versionRange, flags);
      if (usingVersion) {
        process.stdout.write(`Using ${executable.name}@${usingVersion}\n`);
      }
    } catch (error) {
      errors.push(error);
    }
  }

  if (errors.length > 0) {
    throw new AggregateError(errors, "Some executables failed to use.");
  }
}
