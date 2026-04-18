import { Detector, type VersionDetectResult } from "./detector.ts";

export class PackageManagerDetector extends Detector {
  protected override async handle(
    dirPath: string,
  ): Promise<VersionDetectResult | undefined> {
    return (
      (await this.handlePkgDevEngines(dirPath, "packageManager")) ??
      (await this.handleConfig(dirPath, "packageManager"))
    );
  }
}
