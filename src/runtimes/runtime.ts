import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { createInterface } from "node:readline";
import semver from "semver";
import { createRelativeSymlink } from "../utils/create-relative-symlink.ts";
import { exists } from "../utils/exists.ts";
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
      await createRelativeSymlink(
        path.join(this.getVersionsDir(), `v${updatedInstalledVersions[0]}`),
        this.getDefaultAliasPath(),
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
    if (!path.isAbsolute(multishellPath)) {
      throw new Error(
        `Value of JRM_MULTISHELL_PATH_OF_${this.name.toUpperCase()} is not an absolute path.`,
      );
    }

    // 0. Init
    const isDefaultAliasExisting = await exists(this.getDefaultAliasPath());
    await (isDefaultAliasExisting
      ? createRelativeSymlink(this.getDefaultAliasPath(), multishellPath)
      : fs.mkdir(path.join(multishellPath, "bin"), { recursive: true }));

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
      await createRelativeSymlink(
        path.join(this.getVersionsDir(), `v${satisfiedVersion}`),
        multishellPath,
      );
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
        await createRelativeSymlink(
          path.join(this.getVersionsDir(), `v${targetVersion}`),
          multishellPath,
        );
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
      // TODO: Remove this env variable. It seems useless.
      [`JRM_DEFAULT_ALIAS_PATH_OF_${this.name.toUpperCase()}`]:
        this.getDefaultAliasPath(),
    };
  }

  async list(): Promise<string[]> {
    return await this.getInstalledVersions();
  }
}
