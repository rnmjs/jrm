import fs from "node:fs/promises";
import path from "node:path";
import { exists } from "./utils/exists.ts";

export interface VersionDetectSource {
  configPath: string;
  index: number;
}

export interface VersionDetectResult {
  versionRange: string;
  onFail?: "download" | "error" | "warn" | "ignore";
  source?: VersionDetectSource;
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

export class Detector {
  private readonly name: string;
  private readonly type: "runtime" | "packageManager";
  constructor(name: string, type: "runtime" | "packageManager") {
    this.name = name;
    this.type = type;
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
    const pkg = await this.handlePkgDevEngines(dirPath);
    if ("versionRange" in pkg) return pkg;
    const config = await this.handleConfig(dirPath);
    if ("versionRange" in config) return config;
    return REASON_PRIORITY[pkg.reason] >= REASON_PRIORITY[config.reason]
      ? pkg
      : config;
  }

  private resolveVersionFromRaw(
    raw: unknown,
    configPath: string,
  ): VersionDetectResult | VersionDetectFailedResult {
    if (raw === undefined || raw === null) {
      return { reason: "no-type-field" };
    }
    const items: {
      name?: string;
      version?: string;
      onFail?: Required<VersionDetectResult>["onFail"];
    }[] = Array.isArray(raw) ? raw : [raw];
    const index = items.findIndex((i) => i.name === this.name);
    const matched = items[index];
    if (!matched) return { reason: "name-not-matched" };

    return {
      versionRange: matched.version ?? "*",
      ...(matched.onFail ? { onFail: matched.onFail } : {}),
      source: { configPath, index },
    };
  }

  private async handleConfig(
    dirPath: string,
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
    // Intentional: only the first existing config file is read. If .jrmrc.json
    // exists but lacks the requested field, jrm.config.json in the same
    // directory is shadowed rather than used as a fallback.
    const configPath = configs.find((config) => config.isExists)?.configPath;
    if (!configPath) return { reason: "no-config" };

    const content = await fs.readFile(configPath, "utf8");
    return this.resolveVersionFromRaw(
      JSON.parse(content)?.[this.type],
      configPath,
    );
  }

  private async handlePkgDevEngines(
    dirPath: string,
  ): Promise<VersionDetectResult | VersionDetectFailedResult> {
    const packageJsonPath = path.join(dirPath, "package.json");
    if (!(await exists(packageJsonPath))) return { reason: "no-config" };

    const content = await fs.readFile(packageJsonPath, "utf8");
    return this.resolveVersionFromRaw(
      JSON.parse(content)?.devEngines?.[this.type],
      packageJsonPath,
    );
  }
}
