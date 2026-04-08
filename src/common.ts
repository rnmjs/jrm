import type { Executable } from "./executable.ts";
import { RuntimeDetector } from "./runtime-detector.ts";
import { BunRuntime } from "./runtimes/bun-runtime.ts";
import { DenoRuntime } from "./runtimes/deno-runtime.ts";
import { NodeRuntime } from "./runtimes/node-runtime.ts";

const ALL_RUNTIMES: Executable[] = [
  new NodeRuntime({ DetectorClass: RuntimeDetector }),
  new BunRuntime({ DetectorClass: RuntimeDetector }),
  new DenoRuntime({ DetectorClass: RuntimeDetector }),
];

export function getAllRuntimes() {
  return ALL_RUNTIMES;
}

export function getRuntime(name: string) {
  const result = ALL_RUNTIMES.find((runtime) => runtime.name === name);
  if (!result) throw new Error(`Runtime ${name} is not supported.`);
  return result;
}
