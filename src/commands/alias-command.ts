import { getRuntime } from "../common.ts";

export interface AliasCommandOptions {
  runtime: string;
  name: string;
  version: string;
}

export async function aliasCommand(
  options: AliasCommandOptions,
): Promise<void> {
  const { runtime, name, version } = options;
  await getRuntime(runtime).alias(name, version);
}
