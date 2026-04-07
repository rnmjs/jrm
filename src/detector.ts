import type { VersionDetectResult } from "./interfaces.ts";

export abstract class Detector {
  protected readonly name: string;
  constructor(name: string) {
    this.name = name;
  }
  abstract detectVersionRange(
    currentDir: string,
  ): Promise<VersionDetectResult | undefined>;
}
