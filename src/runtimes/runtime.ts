import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { createInterface } from "node:readline";
import semver from "semver";
import { Detector } from "./detector.ts";

export abstract class Runtime {
  abstract readonly name: string;
  protected readonly platform = os.platform();
  protected readonly arch = os.arch();
  private readonly home = path.join(os.homedir(), ".jrm");

  private getVersionsDir() {
    return path.join(this.home, this.name, "versions");
  }

  private getAliasesDir() {
    return path.join(this.home, this.name, "aliases");
  }

  private getMultishellsDir() {
    return path.join(this.home, this.name, "multishells");
  }

  private getDefaultAliasPath() {
    return path.join(this.getAliasesDir(), "default");
  }

  private getMultishellPath() {
    return path.join(this.getMultishellsDir(), `${process.ppid}_${Date.now()}`);
  }

  private async ask(question: string): Promise<string> {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return await new Promise((resolve) => {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });
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

  private async forceCreateSymlink(absolutePath: string, version: string) {
    if (!path.isAbsolute(absolutePath)) {
      throw new TypeError(`Path '${absolutePath}' is not an absolute path.`);
    }
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.unlink(absolutePath).catch(() => {
      /* do nothing */
    });
    await fs.symlink(
      path.relative(
        path.dirname(absolutePath),
        path.join(this.getVersionsDir(), `v${version}`),
      ),
      absolutePath,
    );
  }

  protected abstract installRaw(
    version: string,
    installDir: string,
  ): Promise<void>;
  async install(versionRange: string): Promise<void> {
    let version = semver.valid(versionRange);
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

    const installedVersions = await this.getInstalledVersions();
    if (installedVersions.includes(version)) {
      process.stdout.write(
        `${this.name}@${version} is already installed, skip.\n`,
      );
      return;
    }

    await this.installRaw(version, this.getVersionsDir());

    const updatedInstalledVersions = await this.getInstalledVersions();
    if (
      updatedInstalledVersions.length === 1 &&
      updatedInstalledVersions[0] === version
    ) {
      await this.forceCreateSymlink(
        this.getDefaultAliasPath(),
        updatedInstalledVersions[0],
      );
    }
  }

  async use(version?: string) {
    const multishellPath =
      process.env[`JRM_MULTISHELL_PATH_OF_${this.name.toUpperCase()}`];
    if (!multishellPath) {
      throw new Error(
        `JRM_MULTISHELL_PATH_OF_${this.name.toUpperCase()} is not set.`,
      );
    }

    // 1. No version range, do nothing.
    const versionRange =
      version ??
      (await new Detector(this.name).detectVersionRange(process.cwd()));
    if (!versionRange) {
      return;
    }

    // 2. Use installed version.
    const installedVersions = await this.getInstalledVersions();
    const satisfiedVersion = installedVersions.find((installedVersion) =>
      semver.satisfies(installedVersion, versionRange),
    );
    if (satisfiedVersion) {
      await this.forceCreateSymlink(multishellPath, satisfiedVersion);
      process.stdout.write(`Using ${this.name}@${satisfiedVersion}\n`);
      return;
    }

    // 3. Use remote version.
    const remoteVersions = await this.getRemoteVersions();
    const targetVersion = remoteVersions.find((remoteVersion) =>
      semver.satisfies(remoteVersion, versionRange),
    );
    if (targetVersion) {
      const answer = await this.ask(
        `${this.name}@${targetVersion} (satisfies ${versionRange}) is not installed. Do you want to install it? (y/N): `,
      );
      if (["y", "yes"].includes(answer.toLowerCase())) {
        await this.install(targetVersion);
        await this.forceCreateSymlink(multishellPath, targetVersion);
        process.stdout.write(`Using ${this.name}@${targetVersion}\n`);
      }
      return;
    }

    throw new Error(`No remote version satisfies ${versionRange}.`);
  }

  env() {
    return {
      [`JRM_MULTISHELL_PATH_OF_${this.name.toUpperCase()}`]:
        this.getMultishellPath(),
      [`JRM_DEFAULT_ALIAS_PATH_OF_${this.name.toUpperCase()}`]:
        this.getDefaultAliasPath(),
    };
  }

  async list(): Promise<string[]> {
    return await this.getInstalledVersions();
  }
}
