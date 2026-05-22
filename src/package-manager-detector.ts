import { Detector } from "./detector.ts";

export class PackageManagerDetector extends Detector {
  protected override type: "runtime" | "packageManager" = "packageManager";
}
