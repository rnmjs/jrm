import { getRuntime } from "../common.ts";

export interface UnaliasCommandOptions {
  runtime: string;
  name: string;
}

export async function unaliasCommand(
  options: UnaliasCommandOptions,
): Promise<void> {
  const { runtime, name } = options;
  await getRuntime(runtime).unalias(name);
}
