#!/usr/bin/env node
import { Command } from "commander";
// eslint-disable-next-line esm/no-external-src-imports -- We can't use fs to read package.json.
import pkgJson from "../package.json" with { type: "json" };
import { envCommand } from "./commands/env-command.ts";
import { installCommand } from "./commands/install-command.ts";
import { listCommand } from "./commands/list-command.ts";
import { uninstallCommand } from "./commands/uninstall-command.ts";
import { useCommand } from "./commands/use-command.ts";

/**
 * Parse executable specifications from command line arguments
 * @param specs Array of executable specifications (e.g., ["node@20.0.0", "npm@10.8.0"])
 * @returns Array of parsed executable objects with name and version
 */
function parseSpecs(specs: string[]) {
  return specs.map((spec) => {
    const match = /^([^@]+)@(.+)$/.exec(spec);
    if (!match?.[1] || !match[2]) {
      throw new Error(
        `Invalid specification: ${spec}. Expected format: name@version (e.g., node@20.0.0)`,
      );
    }
    return { name: match[1], versionRange: match[2] };
  });
}

const program = new Command().enablePositionalOptions();

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
  .description("install specified executable versions")
  .argument(
    "<executables...>",
    "executable specifications (e.g., node@20 npm@10.8.0)",
  )
  .action(async (specs: string[]) => {
    await installCommand(
      parseSpecs(specs).map((spec) => ({
        name: spec.name,
        versionRange: spec.versionRange,
      })),
    );
  });

program
  .command("list")
  .description("list installed executable versions")
  .argument(
    "[executable]",
    "executable name to list versions for (e.g., node, npm). If not specified, lists all executables",
  )
  .action(async (executableName?: string) => {
    await listCommand(executableName);
  });

program
  .command("use")
  .description("use specified executable versions or auto-detect from project")
  .argument(
    "[executables...]",
    "executable specifications (e.g., node@20 npm@10.8.0)",
  )
  .action(async (specs: string[]) => {
    await useCommand(parseSpecs(specs));
  });

program
  .command("uninstall")
  .description("uninstall specified executable versions")
  .argument(
    "<executables...>",
    "executable specifications (e.g., node@20.0.0 npm@10.8.0)",
  )
  .action(async (specs: string[]) => {
    await uninstallCommand(
      parseSpecs(specs).map((spec) => ({
        name: spec.name,
        version: spec.versionRange,
      })),
    );
  });

program.parse();
