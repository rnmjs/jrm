import process from "node:process";
import { getAllExecutables, getExecutable } from "../common.ts";

function print(content: string) {
  process.stdout.write(`${content}\n`);
}

export async function listCommand(name?: string): Promise<void> {
  const executables = name ? [getExecutable(name)] : getAllExecutables();
  for (const executable of executables) {
    const versions = await executable.list();

    if (versions.length === 0) {
      print(`No ${executable.name} versions installed`);
    } else {
      print(`${executable.name} versions:`);
      versions.forEach((version) => {
        print(`${version.isUsing ? "* " : "  "}${version.version}`);
      });
    }
  }
}
