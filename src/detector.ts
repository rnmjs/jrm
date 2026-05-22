import fs from "node:fs/promises";
import path from "node:path";
import { exists } from "./utils/exists.ts";

export interface VersionDetectResult {
  versionRange: string;
  onFail?: "download" | "error" | "warn" | "ignore";
}

export type VersionDetectFailureReason =
  // No config file found (none of package.json, .jrmrc.json, jrm.config.json exist)
  | "no-config"
  // Config file exists, but missing devEngines, or missing the runtime/packageManager field under devEngines
  | "no-type-field"
  // The devEngines.runtime or devEngines.packageManager field exists, but contains no entry whose name matches the current one
  | "name-not-matched";

export interface VersionDetectFailedResult {
  reason: VersionDetectFailureReason;
}

const REASON_PRIORITY: Record<VersionDetectFailureReason, number> = {
  "no-config": 0,
  "no-type-field": 1,
  "name-not-matched": 2,
};

export abstract class Detector {
  protected abstract readonly type: "runtime" | "packageManager";

  protected readonly name: string;
  constructor(name: string) {
    this.name = name;
  }

  async detectVersionRange(
    currentDir: string,
  ): Promise<VersionDetectResult | VersionDetectFailedResult> {
    let bestReason: VersionDetectFailureReason = "no-config";
    let dir = currentDir;
    while (true) {
      const fallback: VersionDetectFailedResult = { reason: "no-config" };
      const result = await this.handle(dir).catch(() => fallback);
      if ("versionRange" in result) return result;
      if (REASON_PRIORITY[result.reason] > REASON_PRIORITY[bestReason]) {
        bestReason = result.reason;
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    return { reason: bestReason };
  }

  private async handle(
    dirPath: string,
  ): Promise<VersionDetectResult | VersionDetectFailedResult> {
    const pkg = await this.handlePkgDevEngines(dirPath, this.type);
    if ("versionRange" in pkg) return pkg;
    const config = await this.handleConfig(dirPath, this.type);
    if ("versionRange" in config) return config;
    return REASON_PRIORITY[pkg.reason] >= REASON_PRIORITY[config.reason]
      ? pkg
      : config;
  }

  private resolveVersionFromRaw(
    raw: unknown,
  ): VersionDetectResult | VersionDetectFailedResult {
    if (raw === undefined || raw === null) {
      return { reason: "no-type-field" };
    }
    const items: {
      name?: string;
      version?: string;
      onFail?: Required<VersionDetectResult>["onFail"];
    }[] = Array.isArray(raw) ? raw : [raw];
    const matched = items.find((i) => i.name === this.name);
    if (!matched) return { reason: "name-not-matched" };

    return {
      versionRange: matched.version ?? "*",
      ...(matched.onFail ? { onFail: matched.onFail } : {}),
    };
  }

  private async handleConfig(
    dirPath: string,
    field: "runtime" | "packageManager",
  ): Promise<VersionDetectResult | VersionDetectFailedResult> {
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
    if (!configPath) return { reason: "no-config" };

    const content = await fs.readFile(configPath, "utf8");
    return this.resolveVersionFromRaw(JSON.parse(content)?.[field]);
  }

  private async handlePkgDevEngines(
    dirPath: string,
    field: "runtime" | "packageManager",
  ): Promise<VersionDetectResult | VersionDetectFailedResult> {
    const packageJsonPath = path.join(dirPath, "package.json");
    if (!(await exists(packageJsonPath))) return { reason: "no-config" };

    const content = await fs.readFile(packageJsonPath, "utf8");
    return this.resolveVersionFromRaw(JSON.parse(content)?.devEngines?.[field]);
  }
}
