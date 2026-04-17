import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import decompress from "decompress";
import { Executable } from "../executable.ts";

export class NodeRuntime extends Executable {
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
  ): Promise<void> {
    const filename = `node-v${version}-${os.platform()}-${os.arch()}.${os.platform() === "win32" ? "zip" : "tar.gz"}`;
    const url = [this.NODE_DIST_MIRROR, `v${version}`, filename].join("/");

    const downloadedPath = await this.downloadToLocal(url);

    await decompress(downloadedPath, path.join(installDir, `v${version}`), {
      strip: 1,
    });
    await fs.rm(downloadedPath);
  }
}
