import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import decompress from "decompress";
import { Runtime } from "../runtime.ts";
import { download } from "../utils/download.ts";

export class NodeRuntime extends Runtime {
  private readonly NODE_DIST_MIRROR = "https://nodejs.org/dist";

  override name = "node";
  protected override bundledBinaries = ["npm", "npx"];

  protected override async getRemoteVersionsRaw(): Promise<string[]> {
    const json = await fetch(`${this.NODE_DIST_MIRROR}/index.json`).then(
      async (res) => await res.json(),
    );
    return (Array.isArray(json) ? json : []).map(
      (item: { version: string }) => item.version,
    );
  }

  protected override async installRaw(
    version: string,
    installDir: string,
    downloadDir: string,
  ): Promise<void> {
    const filename = `node-v${version}-${this.platform}-${this.arch}.${this.platform === "win32" ? "zip" : "tar.gz"}`;
    const url = [this.NODE_DIST_MIRROR, `v${version}`, filename].join("/");

    const downloadedPath = path.join(downloadDir, filename);
    const localFileSize = await fs
      .stat(downloadedPath)
      .then((stat) => stat.size)
      .catch(() => null);
    await download(url, downloadDir, {
      onResponse: (response) => {
        const contentLength = response.headers.get("content-length");
        return !(
          contentLength &&
          localFileSize &&
          localFileSize === Number(contentLength)
        );
      },
      onProgress: (received, total) => {
        if (total) {
          process.stdout.write(
            `\rDownloading ${url}: ${Math.floor((received / total) * 100)}%`,
          );
        }
      },
    });
    process.stdout.write(`\rDownload ${url} completed\n`);

    await decompress(downloadedPath, installDir);
    await fs.rename(
      path.join(installDir, `node-v${version}-${this.platform}-${this.arch}`),
      path.join(installDir, `v${version}`),
    );
    await fs.rm(downloadedPath);
  }
}
