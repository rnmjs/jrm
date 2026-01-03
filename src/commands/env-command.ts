import process from "node:process";
import { getAllRuntimes } from "../common.ts";

function print(content: string) {
  process.stdout.write(`${content}\n`);
}

export function envCommand(): void {
  const envs = getAllRuntimes()
    .map((runtime) => runtime.env())
    .reduce((acc, cur) => ({ ...acc, ...cur }), {});

  print(
    [
      ...Object.entries(envs).map(([k, v]) => `export ${k}="${v}"`),
      `
if [ -n "$ZSH_VERSION" ]; then
  # zsh environment - use chpwd hook
  chpwd() {
    jrm use
  }
else
  # bash or other shells - use cd alias
  __jrmcd() {
    \\cd "$@" || return $?
    jrm use
  }
  alias cd=__jrmcd
fi
`.trim(),
      "jrm use",
      `export PATH="${Object.keys(envs)
        .map((k) => `$${k}/bin`)
        .join(":")}:$PATH"`,
    ].join("\n"),
  );
}
