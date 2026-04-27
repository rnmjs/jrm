import path from "node:path";
import process from "node:process";
import { getAllExecutables } from "../common.ts";

function print(content: string) {
  process.stdout.write(`${content}\n`);
}

function getShellName(): string {
  return path.basename(process.env["SHELL"] ?? "");
}

function handleZsh(envs: Record<string, string>): string {
  return [
    ...Object.entries(envs).map(([k, v]) => `export ${k}="${v}"`),
    "jrm use",
    `export PATH="${Object.keys(envs)
      .map((k) => `$${k}/bin`)
      .join(":")}:$PATH"`,
    // Set up cd hook (non-destructive, idempotent).
    // Reference: https://unix.stackexchange.com/questions/214296/what-is-the-difference-between-autoload-and-autoload-u-in-zsh
    `
jrm__chpwd() {
  jrm use
}
autoload -Uz add-zsh-hook
add-zsh-hook chpwd jrm__chpwd`,
  ].join("\n");
}

function handleBash(envs: Record<string, string>): string {
  return [
    ...Object.entries(envs).map(([k, v]) => `export ${k}="${v}"`),
    "jrm use",
    `export PATH="${Object.keys(envs)
      .map((k) => `$${k}/bin`)
      .join(":")}:$PATH"`,
    // Set up cd hook.
    `
__jrmcd() {
  \\cd "$@" || return $?
  jrm use
}
alias cd=__jrmcd`,
  ].join("\n");
}

export function envCommand(): void {
  const envs = getAllExecutables()
    .map((executable) => executable.env())
    .reduce((acc, cur) => ({ ...acc, ...cur }), {});

  const shellName = getShellName();
  switch (shellName) {
    case "zsh":
      print(handleZsh(envs));
      break;
    case "bash":
      print(handleBash(envs));
      break;
    default:
      throw new Error(`Unsupported shell: ${shellName}`);
  }
}
