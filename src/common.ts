import type { Executable } from "./executable.ts";
import { NpmPackageManager } from "./package-managers/npm.ts";
import { PnpmPackageManager } from "./package-managers/pnpm.ts";
import { YarnPackageManager } from "./package-managers/yarn.ts";
import { BunRuntime } from "./runtimes/bun-runtime.ts";
import { DenoRuntime } from "./runtimes/deno-runtime.ts";
import { NodeRuntime } from "./runtimes/node-runtime.ts";

const ALL_RUNTIMES: Executable[] = [
  new NodeRuntime(),
  new BunRuntime(),
  new DenoRuntime(),
];

const ALL_PACKAGE_MANAGERS: Executable[] = [
  new NpmPackageManager({ strict: true }),
  new YarnPackageManager({ strict: true }),
  new PnpmPackageManager({ strict: true }),
];

export function getAllExecutables(): Executable[] {
  return [...ALL_PACKAGE_MANAGERS, ...ALL_RUNTIMES]; // package managers must be in front of runtimes，otherwise node built-in binaries (npm and npx) will be seeked first.
}

export function getExecutable(name: string): Executable {
  const executable = getAllExecutables().find(
    (executable) => executable.name === name,
  );
  if (executable) return executable;
  throw new Error(`Executable ${name} is not supported.`);
}
