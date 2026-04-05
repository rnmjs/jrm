export interface VersionDetectResult {
  versionRange: string;
  onFail?: "download" | "error" | "warn" | "ignore";
}
