import fs from "node:fs/promises";
import path from "node:path";
import { Detector, type VersionDetectResult } from "./detector.ts";
import { exists } from "./utils/exists.ts";

export class PackageManagerDetector extends Detector {
  private async detectByPackageJsonFile(
    dirPath: string,
  ): Promise<VersionDetectResult | undefined> {
    const packageJsonPath = path.join(dirPath, "package.json");
    if (!(await exists(packageJsonPath))) return undefined;

    const content = await fs.readFile(packageJsonPath, "utf8");
    const rawPm = JSON.parse(content)?.devEngines?.packageManager;
    const pm: {
      name?: string;
      version?: string;
      onFail?: Required<VersionDetectResult>["onFail"];
    }[] = !rawPm ? [] : Array.isArray(rawPm) ? rawPm : [rawPm];
    const matched = pm.find((p) => p.name === this.name);
    if (matched) {
      const result: VersionDetectResult = {
        versionRange: matched.version ?? "*",
      };
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
    const result = await this.detectByPackageJsonFile(currentDir).catch(
      () => undefined,
    );
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
