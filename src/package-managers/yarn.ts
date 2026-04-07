import fs from "node:fs/promises";
import path from "node:path";
import decompress from "decompress";
import { Executable } from "../executable.ts";
import { registryUrl } from "../utils/registry-url.ts";

export class YarnPackageManager extends Executable {
  private readonly NPM_REGISTRY = registryUrl();

  override name = "yarn";
  protected override bundledBinaries = ["yarnpkg"];

  protected override async getRemoteVersionsRaw(): Promise<string[]> {
    const [classicJson, berryJson]: any[] = await Promise.all([
      fetch(`${this.NPM_REGISTRY}/yarn`).then(async (res) => await res.json()),
      fetch(`${this.NPM_REGISTRY}/@yarnpkg/cli-dist`).then(
        async (res) => await res.json(),
      ),
    ]);
    const classicVersions = Object.keys(classicJson.versions);
    const berryVersions = Object.keys(berryJson.versions);
    return [...classicVersions, ...berryVersions];
  }

  protected override async installRaw(
    version: string,
    installDir: string,
  ): Promise<void> {
    const isBerry = !version.startsWith("1.");
    const packageName = isBerry ? "@yarnpkg/cli-dist" : "yarn";
    const filename = isBerry
      ? `cli-dist-${version}.tgz`
      : `yarn-${version}.tgz`;
    const url = `${this.NPM_REGISTRY}/${packageName}/-/${filename}`;

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
        ? [["yarn", rawBin]]
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
