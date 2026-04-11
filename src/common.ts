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

export function getAllExecutables(): Executable[] {
  return [...ALL_RUNTIMES];
}

export function getExecutable(name: string): Executable {
  const executable = getAllExecutables().find(
    (executable) => executable.name === name,
  );
  if (executable) return executable;
  throw new Error(`Executable ${name} is not supported.`);
}
