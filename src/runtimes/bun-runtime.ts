import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import decompress from "decompress";
import { Runtime } from "../runtime.ts";

export class BunRuntime extends Runtime {
  private readonly GITHUB_API_URL = "https://api.github.com";
  private readonly GITHUB_URL = "https://github.com";
  private readonly GITHUB_REPO = "oven-sh/bun";

  override name = "bun";
  protected override bundledBinaries: string[] = [];

  private getTarget(): string {
    if (os.platform() === "win32") {
      return "windows-x64";
    }

    if (os.platform() === "darwin") {
      return os.arch() === "arm64" ? "darwin-aarch64" : "darwin-x64";
    }

    if (os.platform() === "linux") {
      return os.arch() === "arm64" ? "linux-aarch64" : "linux-x64";
    }

    // Default fallback
    return "linux-x64";
  }

  protected override async getRemoteVersionsRaw(): Promise<string[]> {
    const allTags: Array<{ name: string }> = [];
    const perPage = 100;

    for (let page = 1; true; page += 1) {
      const response = await fetch(
        `${this.GITHUB_API_URL}/repos/${this.GITHUB_REPO}/tags?per_page=${perPage}&page=${page}`,
      );
      if (!response.ok) {
        break;
      }

      const tags = await response.json();
      if (!Array.isArray(tags) || tags.length === 0) {
        break; // No more tags
      }
      allTags.push(...tags);
      if (tags.length < perPage) {
        break;
      }
    }

    return allTags
      .map((tag) => tag.name)
      .filter((tagName: string) => tagName.startsWith("bun-v"))
      .map((tagName: string) => tagName.replace("bun-", ""));
  }

  protected override async installRaw(
    version: string,
    installDir: string,
  ): Promise<void> {
    const target = this.getTarget();
    const filename = `bun-${target}.zip`;
    const url = `${this.GITHUB_URL}/${this.GITHUB_REPO}/releases/download/bun-v${version}/${filename}`;

    const downloadedPath = await this.downloadToLocal(url);

    const versionDir = path.join(installDir, `v${version}`);

    await fs.mkdir(versionDir, { recursive: true });
    await decompress(downloadedPath, versionDir);

    await fs.rename(
      path.join(versionDir, `bun-${target}`),
      path.join(versionDir, "bin"),
    );
    await fs.rm(downloadedPath);
  }
}
