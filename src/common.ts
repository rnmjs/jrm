import { NodeRuntime } from "./runtimes/node-runtime.ts";
import type { Runtime } from "./runtimes/runtime.ts";

const ALL_RUNTIMES: Runtime[] = [new NodeRuntime()];

export function getAllRuntimes() {
  return ALL_RUNTIMES;
}

export function getRuntime(name: string) {
  const result = ALL_RUNTIMES.find((runtime) => runtime.name === name);
  if (!result) throw new Error(`Runtime ${name} is not supported.`);
  return result;
}
