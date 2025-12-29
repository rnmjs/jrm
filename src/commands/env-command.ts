import process from "node:process";
import { getAllRuntimes } from "../common.ts";

function print(content: string) {
  process.stdout.write(`${content}\n`);
}

export function envCommand(): void {
  const exportations = getAllRuntimes().flatMap((runtime) => {
    const envEntries = Object.entries(runtime.env());
    const envExportations = envEntries.map(([k, v]) => `export ${k}="${v}"`);
    const pathExportation = envEntries.map(([k]) => `$${k}/bin`).join(":");
    return [...envExportations, `export PATH="${pathExportation}:$PATH"`];
  });

  print(
    [
      ...exportations,
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
      "hash -r", // Refresh hash table, so that the new PATH takes effect.
    ].join("\n"),
  );
}
