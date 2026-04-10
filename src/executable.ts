import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import semver from "semver";
import type { Detector } from "./detector.ts";
import { ask } from "./utils/ask.ts";
import { download } from "./utils/download.ts";
import { exists } from "./utils/exists.ts";
import { isInProject } from "./utils/is-in-project.ts";

export interface ExecutableOptions {
  /**
   * Home directory of JRM.
   */
  home?: string;
  strict?: boolean;
  DetectorClass: new (name: string) => Detector;
}

export abstract class Executable {
  abstract readonly name: string;
  /**
   * Other bundled binaries of this executable, like npm and npx in node.
   */
  protected abstract readonly bundledBinaries: string[];
  private readonly home: string;
  private readonly strict: boolean;
  private readonly DetectorClass: new (name: string) => Detector;

  constructor(options: ExecutableOptions) {
    this.home = options.home ?? path.join(os.homedir(), ".jrm");
    this.strict = options.strict ?? false;
    this.DetectorClass = options.DetectorClass;
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

  private async writeStubBinaries(
    targetDir: string,
    getMessage: (binary: string) => string,
  ) {
    await fs.rm(targetDir, { recursive: true }).catch(() => {
      /* do nothing */
    });
    await fs.mkdir(path.join(targetDir, "bin"), { recursive: true });
    for (const binary of [...this.bundledBinaries, this.name]) {
      await fs.writeFile(
        path.join(targetDir, "bin", binary),
        ["#!/usr/bin/env bash", `echo '${getMessage(binary)}'`, "exit 1"].join(
          "\n",
        ),
      );
      await fs.chmod(path.join(targetDir, "bin", binary), 0o755);
    }
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
    // 1. Check if multishell path is set.
    const multishellPath =
      process.env[`JRM_MULTISHELL_PATH_OF_${this.name.toUpperCase()}`];
    if (!multishellPath) {
      throw new Error(
        `JRM_MULTISHELL_PATH_OF_${this.name.toUpperCase()} is not set.`,
      );
    }
    if (!path.isAbsolute(multishellPath)) {
      throw new Error(
        `Value of JRM_MULTISHELL_PATH_OF_${this.name.toUpperCase()} is not an absolute path.`,
      );
    }

    // 2. Strict mode check.
    if (this.strict) {
      const isNotConfiguredWith =
        (await isInProject(process.cwd())) &&
        !(await new this.DetectorClass(this.name).detectVersionRange(
          process.cwd(),
        ));
      if (isNotConfiguredWith) {
        await this.writeStubBinaries(
          multishellPath,
          () =>
            `Current project is not configured with ${this.name}. Please review and configure the devEngines field in package.json at the project root directory.`,
        );
        return undefined;
      }
    }

    // 3. Initialize multishell.
    const installedVersions = await this.getInstalledVersions();
    const greatestVersion = installedVersions[0];
    await (greatestVersion
      ? this.createVersionSymlink(greatestVersion, multishellPath)
      : this.writeStubBinaries(
          multishellPath,
          (binary) =>
            `No ${this.name} is installed. Run \`jrm use ${this.name}@<version>\` to make ${binary} available.`,
        ));

    // 4. Use version.
    if (versionRange) {
      // This is often called manually.
      return await this.useWithVersionRange(multishellPath, versionRange);
    }
    // This is often called automatically.
    return await this.useWithoutVersionRange(multishellPath);
  }

  private async useWithVersionRange(
    multishellPath: string,
    versionRange: string,
  ): Promise<string | undefined> {
    if (!semver.validRange(versionRange)) {
      throw new Error(
        `Invalid version range: ${versionRange}. Expected a valid semver range (e.g., 20.0.0, *, 20).`,
      );
    }

    // 1. Use installed version.
    const installedVersions = await this.getInstalledVersions();
    const satisfiedVersion = installedVersions.find((installedVersion) =>
      semver.satisfies(installedVersion, versionRange),
    );
    if (satisfiedVersion) {
      await this.createVersionSymlink(satisfiedVersion, multishellPath);
      return satisfiedVersion;
    }

    // 2. Use remote version.
    return await this.askAndInstall(multishellPath, versionRange);
  }

  private async useWithoutVersionRange(
    multishellPath: string,
  ): Promise<string | undefined> {
    const detected = await new this.DetectorClass(this.name).detectVersionRange(
      process.cwd(),
    );

    // 1. If not detected, use the greatest version or stub.
    if (!detected) return undefined;

    // 2. Use installed version.
    const installedVersions = await this.getInstalledVersions();
    const satisfiedVersion = installedVersions.find((installedVersion) =>
      semver.satisfies(installedVersion, detected.versionRange),
    );
    if (satisfiedVersion) {
      await this.createVersionSymlink(satisfiedVersion, multishellPath);
      return satisfiedVersion;
    }

    // 3. Use remote version.
    const onFail = detected.onFail ?? "error";
    switch (onFail) {
      case "ignore":
        return undefined;
      case "warn":
        process.stderr.write(
          `No installed ${this.name} version satisfies ${detected.versionRange}. Run \`jrm install ${this.name}@${detected.versionRange}\` to install it.\n`,
        );
        return undefined;
      case "error":
      case "download":
        return await this.askAndInstall(multishellPath, detected.versionRange);
    }
  }

  private async askAndInstall(
    multishellPath: string,
    versionRange: string,
  ): Promise<string | undefined> {
    const installAnswer = await ask(
      `No installed ${this.name} version satisfies ${versionRange}. Do you want to install one? (y/N): `,
    );
    if (!["y", "yes"].includes(installAnswer.toLowerCase())) {
      return undefined;
    }

    const remoteVersions = await this.getRemoteVersions();
    const targetVersion = remoteVersions.find((remoteVersion) =>
      semver.satisfies(remoteVersion, versionRange),
    );
    if (!targetVersion) {
      throw new Error(`No remote version satisfies ${versionRange}.`);
    }
    await this.install(targetVersion);
    await this.createVersionSymlink(targetVersion, multishellPath);
    return targetVersion;
  }

  env() {
    return {
      [`JRM_MULTISHELL_PATH_OF_${this.name.toUpperCase()}`]:
        this.getMultishellPath(),
    };
  }

  async list() {
    const multishellPath =
      process.env[`JRM_MULTISHELL_PATH_OF_${this.name.toUpperCase()}`];
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
