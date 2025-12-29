import fs from "node:fs/promises";
import path from "node:path";
import { exists } from "../utils/exists.ts";

export class Detector {
  private readonly name: string;
  constructor(name: string) {
    this.name = name;
  }

  private async detectByVersionFile(
    dirPath: string,
  ): Promise<string | undefined> {
    const versionFilePath = path.join(dirPath, `.${this.name}-version`);
    if (!(await exists(versionFilePath))) return undefined;

    const content = await fs.readFile(versionFilePath, "utf8");
    return content.trim();
  }

  private async detectByPackageJsonFile(
    dirPath: string,
  ): Promise<string | undefined> {
    const packageJsonPath = path.join(dirPath, "package.json");
    if (!(await exists(packageJsonPath))) return undefined;

    const content = await fs.readFile(packageJsonPath, "utf8");
    const packageJson = JSON.parse(content);
    const { name, version }: { name?: string; version?: string } =
      packageJson.devEngines?.runtime ?? {};
    return name === this.name && typeof version === "string"
      ? version
      : undefined;
  }

  async detectVersionRange(currentDir: string): Promise<string | undefined> {
    const result =
      (await this.detectByVersionFile(currentDir)) ??
      (await this.detectByPackageJsonFile(currentDir));
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
