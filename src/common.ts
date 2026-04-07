import type { Executable } from "./executable.ts";
import { PackageManagerDetector } from "./package-manager-detector.ts";
import { NpmPackageManager } from "./package-managers/npm.ts";
import { PnpmPackageManager } from "./package-managers/pnpm.ts";
import { YarnPackageManager } from "./package-managers/yarn.ts";
import { RuntimeDetector } from "./runtime-detector.ts";
import { BunRuntime } from "./runtimes/bun-runtime.ts";
import { DenoRuntime } from "./runtimes/deno-runtime.ts";
import { NodeRuntime } from "./runtimes/node-runtime.ts";

const ALL_RUNTIMES: Executable[] = [
  new NodeRuntime({ DetectorClass: RuntimeDetector }),
  new BunRuntime({ DetectorClass: RuntimeDetector }),
  new DenoRuntime({ DetectorClass: RuntimeDetector }),
];

const ALL_PACKAGE_MANAGERS: Executable[] = [
  new NpmPackageManager({
    DetectorClass: PackageManagerDetector,
    strict: true,
  }),
  new YarnPackageManager({
    DetectorClass: PackageManagerDetector,
    strict: true,
  }),
  new PnpmPackageManager({
    DetectorClass: PackageManagerDetector,
    strict: true,
  }),
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
