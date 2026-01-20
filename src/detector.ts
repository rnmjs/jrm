import fs from "node:fs/promises";
import path from "node:path";
import { exists } from "./utils/exists.ts";

export interface VersionDetectResult {
  versionRange: string;
  onFail?: "download" | "error" | "warn" | "ignore";
}

export class Detector {
  private readonly name: string;
  constructor(name: string) {
    this.name = name;
  }

  private async detectByVersionFile(
    dirPath: string,
  ): Promise<VersionDetectResult | undefined> {
    const versionFilePath = path.join(dirPath, `.${this.name}-version`);
    if (!(await exists(versionFilePath))) return undefined;

    const content = await fs.readFile(versionFilePath, "utf8");
    return { versionRange: content.trim() };
  }

  private async detectByPackageJsonFile(
    dirPath: string,
  ): Promise<VersionDetectResult | undefined> {
    const packageJsonPath = path.join(dirPath, "package.json");
    if (!(await exists(packageJsonPath))) return undefined;

    const content = await fs.readFile(packageJsonPath, "utf8");
    const rawRuntime = JSON.parse(content)?.devEngines?.runtime;
    const runtime: {
      name?: string;
      version?: string;
      onFail?: Required<VersionDetectResult>["onFail"];
    }[] = !rawRuntime
      ? []
      : Array.isArray(rawRuntime)
        ? rawRuntime
        : [rawRuntime];
    const matched = runtime.find((r) => r.name === this.name);
    if (matched?.name === this.name && typeof matched.version === "string") {
      const result: VersionDetectResult = { versionRange: matched.version };
      if (matched.onFail) {
        result.onFail = matched.onFail;
      }
      return result;
    }
    return undefined;
  }

  async detectVersionRange(
    currentDir: string,
  ): Promise<VersionDetectResult | undefined> {
    const result =
      (await this.detectByVersionFile(currentDir).catch(() => undefined)) ??
      (await this.detectByPackageJsonFile(currentDir).catch(() => undefined));
    if (result) {
      return result;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return undefined;
    }
    return await this.detectVersionRange(parentDir);
  }
}
