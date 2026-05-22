import { Detector } from "./detector.ts";

export class RuntimeDetector extends Detector {
  protected override type: "runtime" | "packageManager" = "runtime";
}
