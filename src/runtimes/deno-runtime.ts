import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import decompress from "decompress";
import { download } from "../utils/download.ts";
import { Runtime } from "./runtime.ts";

export class DenoRuntime extends Runtime {
  private readonly DENO_DIST_MIRROR = "https://dl.deno.land";

  override name = "deno";
  protected override bundledBinaries: string[] = [];

  private getTarget(): string {
    if (this.platform === "win32") {
      return "x86_64-pc-windows-msvc";
    }

    if (this.platform === "darwin") {
      return this.arch === "arm64"
        ? "aarch64-apple-darwin"
        : "x86_64-apple-darwin";
    }

    if (this.platform === "linux") {
      return this.arch === "arm64"
        ? "aarch64-unknown-linux-gnu"
        : "x86_64-unknown-linux-gnu";
    }

    // Default fallback
    return "x86_64-unknown-linux-gnu";
  }

  protected override async getRemoteVersionsRaw(): Promise<string[]> {
    const allTags: Array<{ name: string }> = [];
    const perPage = 100;

    // eslint-disable-next-line @fenge/no-restricted-loops -- allow it
    for (let page = 1; ; page += 1) {
      const response = await fetch(
        `https://api.github.com/repos/denoland/deno/tags?per_page=${perPage}&page=${page}`,
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
      .filter((tagName: string) => tagName.startsWith("v"));
  }

  protected override async installRaw(
    version: string,
    installDir: string,
  ): Promise<void> {
    const filename = `deno-${this.getTarget()}.zip`;
    const url = `${this.DENO_DIST_MIRROR}/release/v${version}/${filename}`;

    await download(url, os.tmpdir(), {
      onProgress: (received, total) => {
        if (total) {
          process.stdout.write(
            `\rDownloading ${url}: ${Math.floor((received / total) * 100)}%`,
          );
        }
      },
    });
    process.stdout.write(`\rDownload ${url} completed\n`);

    const downloadedPath = path.join(os.tmpdir(), filename);
    const versionBinDir = path.join(installDir, `v${version}`, "bin");

    await fs.mkdir(versionBinDir, { recursive: true });
    await decompress(downloadedPath, versionBinDir);

    await fs.rm(downloadedPath);
  }
}
