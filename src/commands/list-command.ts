import process from "node:process";
import { styleText } from "node:util";
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
        const alias =
          version.aliases.length <= 0 ? "" : `(${version.aliases.join(", ")})`;
        print(
          `${version.isUsing ? "* " : "  "}${version.version} ${styleText("dim", alias)}`,
        );
      });
    }
  }
}
