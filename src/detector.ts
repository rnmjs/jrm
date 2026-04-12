export interface VersionDetectResult {
  versionRange: string;
  onFail?: "download" | "error" | "warn" | "ignore";
}

export abstract class Detector {
  protected readonly name: string;
  constructor(name: string) {
    this.name = name;
  }
  abstract detectVersionRange(
    currentDir: string,
  ): Promise<VersionDetectResult | undefined>;
}
