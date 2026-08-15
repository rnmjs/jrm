import path from "node:path";
import process from "node:process";
import { getAllExecutables } from "../common.ts";

function print(content: string) {
  process.stdout.write(`${content}\n`);
}

function getShellName(): string {
  return path.basename(process.env["SHELL"] ?? "");
}

const PM_FUNCTION = `
pm() {
  local p; p="$(jrm pm)" || return 1
  command "$p" "$@"
}`;

function handleZsh(envs: Record<string, string>, pm: boolean): string {
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
    ...(pm ? [PM_FUNCTION] : []),
  ].join("\n");
}

function handleBash(envs: Record<string, string>, pm: boolean): string {
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
    ...(pm ? [PM_FUNCTION] : []),
  ].join("\n");
}

export interface EnvCommandOptions {
  pm?: boolean;
}

export function envCommand(options: EnvCommandOptions = {}): void {
  const pm = options.pm ?? true;
  const envs = getAllExecutables()
    .map((executable) => executable.env())
    .reduce((acc, cur) => ({ ...acc, ...cur }), {});

  const shellName = getShellName();
  switch (shellName) {
    case "zsh":
      print(handleZsh(envs, pm));
      break;
    case "bash":
    case "":
      print(handleBash(envs, pm));
      break;
    default:
      throw new Error(`Unsupported shell: ${shellName}`);
  }
}
