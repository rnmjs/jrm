import { Detector, type VersionDetectResult } from "./detector.ts";

export class RuntimeDetector extends Detector {
  protected override async handle(
    dirPath: string,
  ): Promise<VersionDetectResult | undefined> {
    return (
      (await this.handlePkgDevEngines(dirPath, "runtime")) ??
      (await this.handleConfig(dirPath, "runtime"))
    );
  }
}
