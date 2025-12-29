import process from "node:process";
import { getAllRuntimes, getRuntime } from "../common.ts";

function print(content: string) {
  process.stdout.write(`${content}\n`);
}

export async function listCommand(runtimeName?: string): Promise<void> {
  const runtimes = runtimeName ? [getRuntime(runtimeName)] : getAllRuntimes();
  for (const runtime of runtimes) {
    const versions = await runtime.list();

    if (versions.length === 0) {
      print(`No ${runtime.name} versions installed`);
    } else {
      print(`${runtime.name} versions:`);
      versions.forEach((version) => {
        print(`  ${version}`);
      });
    }
  }
}
