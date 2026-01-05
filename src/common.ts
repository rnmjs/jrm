import { BunRuntime } from "./runtimes/bun-runtime.ts";
import { DenoRuntime } from "./runtimes/deno-runtime.ts";
import { NodeRuntime } from "./runtimes/node-runtime.ts";
import type { Runtime } from "./runtimes/runtime.ts";

const ALL_RUNTIMES: Runtime[] = [
  new NodeRuntime(),
  new BunRuntime(),
  new DenoRuntime(),
];

export function getAllRuntimes() {
  return ALL_RUNTIMES;
}

export function getRuntime(name: string) {
  const result = ALL_RUNTIMES.find((runtime) => runtime.name === name);
  if (!result) throw new Error(`Runtime ${name} is not supported.`);
  return result;
}
