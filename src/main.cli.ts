#!/usr/bin/env node
import { Command } from "commander";
// eslint-disable-next-line esm/no-external-src-imports -- We can't use fs to read package.json.
import pkgJson from "../package.json" with { type: "json" };
import { envCommand } from "./commands/env-command.ts";
import { installCommand } from "./commands/install-command.ts";
import { listCommand } from "./commands/list-command.ts";
import { useCommand } from "./commands/use-command.ts";

/**
 * Parse runtime specifications from command line arguments
 * @param runtimeSpecs Array of runtime specifications (e.g., ["node@20.0.0", "deno@2.0.0"])
 * @returns Array of parsed runtime objects with runtime name and version
 */
function parseRuntimeSpecs(runtimeSpecs: string[]) {
  return runtimeSpecs.map((runtimeSpec) => {
    const match = /^([^@]+)@(.+)$/.exec(runtimeSpec);
    if (!match?.[1] || !match[2]) {
      throw new Error(
        `Invalid runtime specification: ${runtimeSpec}. Expected format: runtime@version (e.g., node@20.0.0)`,
      );
    }
    return { runtime: match[1], version: match[2] };
  });
}

const program = new Command();

program
  .name(pkgJson.name)
  .version(pkgJson.version, "-v, --version")
  .description(pkgJson.description);

program
  .command("env")
  .description("generate shell environment setup script")
  .action(() => {
    envCommand();
  });

program
  .command("install")
  .description("install specified runtime versions")
  .argument(
    "<runtimes...>",
    "runtime specifications (e.g., node@20 deno@2.0.0)",
  )
  .action(async (runtimeSpecs: string[]) => {
    await installCommand(parseRuntimeSpecs(runtimeSpecs));
  });

program
  .command("list")
  .description("list installed runtime versions")
  .argument(
    "[runtime]",
    "runtime name to list versions for (e.g., node). If not specified, lists all runtimes",
  )
  .action(async (runtimeName?: string) => {
    await listCommand(runtimeName);
  });

program
  .command("use")
  .description("use specified runtime versions or auto-detect from project")
  .argument(
    "[runtimes...]",
    "runtime specifications (e.g., node@20 deno@2.0.0)",
  )
  .action(async (runtimeSpecs: string[]) => {
    await useCommand(parseRuntimeSpecs(runtimeSpecs));
  });

program.parse();
