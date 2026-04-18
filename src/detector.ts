import fs from "node:fs/promises";
import path from "node:path";
import { exists } from "./utils/exists.ts";

export interface VersionDetectResult {
  versionRange: string;
  onFail?: "download" | "error" | "warn" | "ignore";
}

export abstract class Detector {
  protected readonly name: string;
  constructor(name: string) {
    this.name = name;
  }

  async detectVersionRange(
    currentDir: string,
  ): Promise<VersionDetectResult | undefined> {
    let dir = currentDir;
    while (true) {
      const result = await this.handle(dir).catch(() => undefined);
      if (result) return result;
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    return undefined;
  }

  protected abstract handle(
    dirPath: string,
  ): Promise<VersionDetectResult | undefined>;

  private resolveVersionFromRaw(raw: unknown): VersionDetectResult | undefined {
    const items: {
      name?: string;
      version?: string;
      onFail?: Required<VersionDetectResult>["onFail"];
    }[] = !raw ? [] : Array.isArray(raw) ? raw : [raw];
    const matched = items.find((i) => i.name === this.name);
    if (!matched) return undefined;

    const result: VersionDetectResult = {
      versionRange: matched.version ?? "*",
    };
    if (matched.onFail) {
      result.onFail = matched.onFail;
    }
    return result;
  }

  protected async handleConfig(
    dirPath: string,
    field: "runtime" | "packageManager",
  ): Promise<VersionDetectResult | undefined> {
    const configPaths = [".jrmrc.json", "jrm.config.json"].map((file) =>
      path.join(dirPath, file),
    );
    const configs = await Promise.all(
      configPaths.map(async (configPath) => ({
        configPath,
        isExists: await exists(configPath),
      })),
    );
    const configPath = configs.find((config) => config.isExists)?.configPath;
    if (!configPath) return undefined;

    const content = await fs.readFile(configPath, "utf8");
    return this.resolveVersionFromRaw(JSON.parse(content)?.[field]);
  }

  protected async handlePkgDevEngines(
    dirPath: string,
    field: "runtime" | "packageManager",
  ): Promise<VersionDetectResult | undefined> {
    const packageJsonPath = path.join(dirPath, "package.json");
    if (!(await exists(packageJsonPath))) return undefined;

    const content = await fs.readFile(packageJsonPath, "utf8");
    return this.resolveVersionFromRaw(JSON.parse(content)?.devEngines?.[field]);
  }
}
