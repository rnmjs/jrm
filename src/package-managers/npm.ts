import fs from "node:fs/promises";
import path from "node:path";
import decompress from "decompress";
import { Executable } from "../executable.ts";
import { registryUrl } from "../utils/registry-url.ts";

export class NpmPackageManager extends Executable {
  private readonly NPM_REGISTRY = registryUrl();

  override name = "npm";
  protected override bundledBinaries = ["npx"];

  protected override async getRemoteVersionsRaw(): Promise<string[]> {
    const json: any = await fetch(`${this.NPM_REGISTRY}/npm`).then(
      async (res) => await res.json(),
    );
    return Object.keys(json.versions);
  }

  protected override async installRaw(
    version: string,
    installDir: string,
  ): Promise<void> {
    const filename = `npm-${version}.tgz`;
    const url = `${this.NPM_REGISTRY}/npm/-/${filename}`;

    const downloadedPath = await this.downloadToLocal(url);

    const versionDir = path.join(installDir, `v${version}`);
    await decompress(downloadedPath, versionDir);

    const packageJsonPath = path.join(versionDir, "package", "package.json");
    const packageJson: { bin?: string | Record<string, string> } = JSON.parse(
      await fs.readFile(packageJsonPath, "utf8"),
    );
    const rawBin = packageJson.bin;
    const binEntries: [string, string][] =
      typeof rawBin === "string"
        ? [["npm", rawBin]]
        : Object.entries(rawBin ?? {});

    const binDir = path.join(versionDir, "bin");
    await fs.mkdir(binDir, { recursive: true });

    for (const [binName, binPath] of binEntries) {
      const target = path.join(versionDir, "package", binPath);
      const link = path.join(binDir, binName);
      await fs.symlink(path.relative(path.dirname(link), target), link);
    }

    await fs.rm(downloadedPath);
  }
}
