import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import semver from "semver";
import type { VersionDetectResult } from "./interfaces.ts";
import { RuntimeDetector } from "./runtime-detector.ts";
import { ask } from "./utils/ask.ts";
import { download } from "./utils/download.ts";
import { exists } from "./utils/exists.ts";

export interface RuntimeOptions {
  /**
   * Home directory of JRM.
   */
  home?: string;
}

export abstract class Runtime {
  abstract readonly name: string;
  /**
   * Other bundled binaries of this runtime, like npm and npx in node.
   */
  protected abstract readonly bundledBinaries: string[];
  protected readonly platform = os.platform();
  protected readonly arch = os.arch();
  private readonly home: string;

  constructor(options: RuntimeOptions = {}) {
    this.home = options.home ?? path.join(os.homedir(), ".jrm");
  }

  private getDownloadsDir() {
    return path.join(this.home, this.name, "downloads");
  }

  private getVersionsDir() {
    return path.join(this.home, this.name, "versions");
  }

  private getMultishellsDir() {
    return path.join(this.home, this.name, "multishells");
  }

  private getMultishellPath() {
    return path.join(this.getMultishellsDir(), `${process.ppid}_${Date.now()}`);
  }

  private async createVersionSymlink(version: string, source: string) {
    if (!path.isAbsolute(source)) {
      throw new TypeError(`Source path '${source}' is not an absolute path.`);
    }
    const target = path.join(this.getVersionsDir(), `v${version}`);

    await fs.mkdir(path.dirname(source), { recursive: true });
    await fs.rm(source, { recursive: true }).catch(() => {
      /* do nothing */
    });
    await fs.symlink(path.relative(path.dirname(source), target), source);
  }

  private async getVersionBySymlink(source: string) {
    return path.basename(await fs.realpath(source)).replace(/^v/, "");
  }

  private async getInstalledVersions(): Promise<string[]> {
    return (await fs.readdir(this.getVersionsDir()).catch(() => []))
      .filter((file) => file.startsWith("v"))
      .map((file) => file.slice(1))
      .filter((version) => semver.valid(version))
      .sort((x, y) => semver.compare(y, x));
  }

  protected abstract getRemoteVersionsRaw(): Promise<string[]>;
  private async getRemoteVersions(): Promise<string[]> {
    return (await this.getRemoteVersionsRaw())
      .map((v) => v.replace(/^v/, ""))
      .filter((version) => semver.parse(version)?.prerelease.length === 0)
      .sort((x, y) => semver.compare(y, x));
  }

  protected async downloadToLocal(url: string): Promise<string> {
    const downloadsDir = this.getDownloadsDir();
    const filename = url.split("/").pop();
    if (!filename) {
      throw new Error(
        `Internal error: unable to extract filename from URL "${url}".`,
      );
    }
    const downloadedPath = path.join(downloadsDir, filename);
    const localFileSize = await fs
      .stat(downloadedPath)
      .then((stat) => stat.size)
      .catch(() => null);
    await download(url, downloadsDir, {
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
    return downloadedPath;
  }

  protected abstract installRaw(
    version: string,
    installDir: string,
  ): Promise<void>;
  async install(versionRange: string): Promise<boolean> {
    let version = semver.valid(versionRange);
    if (!version && !semver.validRange(versionRange)) {
      throw new Error(
        `\`${versionRange}\` is not a valid version or version range.`,
      );
    }
    if (!version) {
      const remoteVersions = await this.getRemoteVersions();
      const targetVersion = remoteVersions.find((remoteVersion) =>
        semver.satisfies(remoteVersion, versionRange),
      );
      if (!targetVersion) {
        throw new Error(`No remote version satisfies ${versionRange}.`);
      }
      version = targetVersion;
    }
    await fs.mkdir(this.getVersionsDir(), { recursive: true });
    await fs.mkdir(this.getDownloadsDir(), { recursive: true });

    const installedVersions = await this.getInstalledVersions();
    if (installedVersions.includes(version)) {
      return false;
    }

    await this.installRaw(version, this.getVersionsDir());
    return true;
  }

  async use(versionRange?: string): Promise<string | undefined> {
    const multishellPath =
      process.env[`JRM_MULTISHELL_PATH_OF_RT_${this.name.toUpperCase()}`];
    if (!multishellPath) {
      throw new Error(
        `JRM_MULTISHELL_PATH_OF_RT_${this.name.toUpperCase()} is not set.`,
      );
    }
    if (!path.isAbsolute(multishellPath)) {
      throw new Error(
        `Value of JRM_MULTISHELL_PATH_OF_RT_${this.name.toUpperCase()} is not an absolute path.`,
      );
    }

    // 0. Init
    const installedVersions = await this.getInstalledVersions();
    const greatestVersion = installedVersions[0];
    if (greatestVersion) {
      // Use greatest version as default version
      await this.createVersionSymlink(greatestVersion, multishellPath);
    } else {
      // If no version is installed, create stub binaries
      await fs.mkdir(path.join(multishellPath, "bin"), { recursive: true });
      for (const binary of [...this.bundledBinaries, this.name]) {
        await fs.writeFile(
          path.join(multishellPath, "bin", binary),
          [
            "#!/usr/bin/env bash",
            `echo 'No ${this.name} is used. Run \`jrm use ${this.name}@<version>\` to make ${binary} available.'`,
            "exit 1",
          ].join("\n"),
        );
        await fs.chmod(path.join(multishellPath, "bin", binary), 0o755);
      }
    }

    let onFail: Required<VersionDetectResult>["onFail"] = "error";
    let resolvedVersionRange: string | undefined = undefined;
    if (!versionRange) {
      // handle auto-detect
      const detected = await new RuntimeDetector(this.name).detectVersionRange(
        process.cwd(),
      );
      if (detected?.versionRange) resolvedVersionRange = detected.versionRange;
      if (detected?.onFail) onFail = detected.onFail;
    } else {
      // handle version range
      if (!semver.validRange(versionRange)) {
        throw new Error(
          `Invalid version range: ${versionRange}. Expected a valid semver range (e.g., 20.0.0, *, 20).`,
        );
      }
      resolvedVersionRange = versionRange;
    }

    // 1. No version range, do nothing.
    if (!resolvedVersionRange) {
      return undefined;
    }

    // 2. Use installed version.
    const satisfiedVersion = installedVersions.find((installedVersion) =>
      semver.satisfies(installedVersion, resolvedVersionRange),
    );
    if (satisfiedVersion) {
      await this.createVersionSymlink(satisfiedVersion, multishellPath);
      return satisfiedVersion;
    }

    // 3. Use remote version.
    switch (onFail) {
      case "ignore":
        return undefined;
      case "warn":
        process.stderr.write(
          `No installed ${this.name} version satisfies ${resolvedVersionRange}. Run \`jrm install ${this.name}@${resolvedVersionRange}\` to install it.\n`,
        );
        return undefined;
      case "error":
      case "download": {
        const installAnswer = await ask(
          `No installed ${this.name} version satisfies ${resolvedVersionRange}. Do you want to install one? (y/N): `,
        );
        if (!["y", "yes"].includes(installAnswer.toLowerCase())) {
          return undefined;
        }
        const remoteVersions = await this.getRemoteVersions();
        const targetVersion = remoteVersions.find((remoteVersion) =>
          semver.satisfies(remoteVersion, resolvedVersionRange),
        );
        if (targetVersion) {
          await this.install(targetVersion);
          await this.createVersionSymlink(targetVersion, multishellPath);
          return targetVersion;
        }
        throw new Error(`No remote version satisfies ${resolvedVersionRange}.`);
      }
    }
  }

  env() {
    return {
      [`JRM_MULTISHELL_PATH_OF_RT_${this.name.toUpperCase()}`]:
        this.getMultishellPath(),
    };
  }

  async list() {
    const multishellPath =
      process.env[`JRM_MULTISHELL_PATH_OF_RT_${this.name.toUpperCase()}`];
    const usingVersion = !multishellPath
      ? undefined
      : await this.getVersionBySymlink(multishellPath);

    return (await this.getInstalledVersions()).map((version) => ({
      version,
      isUsing: usingVersion === version,
    }));
  }

  async uninstall(version: string): Promise<boolean> {
    // Validate that version is a valid semver
    if (!semver.valid(version)) {
      throw new Error(
        `Invalid version: ${version}. Expected a valid semver (e.g., 20.0.0).`,
      );
    }

    const versionPath = path.join(this.getVersionsDir(), `v${version}`);

    // Check if the version is installed
    if (!(await exists(versionPath))) {
      return false;
    }

    await fs.rm(versionPath, { recursive: true });
    return true;
  }
}
