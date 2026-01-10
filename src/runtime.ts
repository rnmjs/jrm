import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import semver from "semver";
import { Detector } from "./detector.ts";
import { ask } from "./utils/ask.ts";
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

  protected abstract installRaw(
    version: string,
    installDir: string,
  ): Promise<void>;
  async install(versionRange: string): Promise<boolean> {
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
      return false;
    }

    await this.installRaw(version, this.getVersionsDir());

    const updatedInstalledVersions = await this.getInstalledVersions();
    if (
      updatedInstalledVersions.length === 1 &&
      updatedInstalledVersions[0] === version
    ) {
      await this.createVersionSymlink(
        updatedInstalledVersions[0],
        this.getDefaultAliasPath(),
      );
    }
    return true;
  }

  async use(versionOrAlias?: string): Promise<string | undefined> {
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
    const defaultVersion = (await exists(this.getDefaultAliasPath()))
      ? await this.getVersionBySymlink(this.getDefaultAliasPath())
      : undefined;
    if (defaultVersion) {
      await this.createVersionSymlink(defaultVersion, multishellPath);
    } else {
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

    let versionRange: string | undefined = undefined;
    if (!versionOrAlias) {
      // handle auto-detect
      versionRange = await new Detector(this.name).detectVersionRange(
        process.cwd(),
      );
    } else if (semver.validRange(versionOrAlias)) {
      // handle version range
      versionRange = versionOrAlias;
    } else {
      // handle alias
      if (!(await exists(path.join(this.getAliasesDir(), versionOrAlias)))) {
        throw new Error(`No alias named ${versionOrAlias} found.`);
      }
      versionRange = await this.getVersionBySymlink(
        path.join(this.getAliasesDir(), versionOrAlias),
      );
    }

    // 1. No version range, do nothing.
    if (!versionRange) {
      return undefined;
    }

    // 2. Use default version first.
    if (defaultVersion && semver.satisfies(defaultVersion, versionRange)) {
      await this.createVersionSymlink(defaultVersion, multishellPath);
      return defaultVersion;
    }

    // 3. Use installed version.
    const installedVersions = await this.getInstalledVersions();
    const satisfiedVersion = installedVersions.find((installedVersion) =>
      semver.satisfies(installedVersion, versionRange),
    );
    if (satisfiedVersion) {
      await this.createVersionSymlink(satisfiedVersion, multishellPath);
      return satisfiedVersion;
    }

    // 4. Use remote version.
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
    if (targetVersion) {
      // const continueAnswer = await ask(
      //   `About to install ${this.name}@${targetVersion} (satisfies ${versionRange}). Do you want to continue? (y/N): `,
      // );
      // if (!["y", "yes"].includes(continueAnswer.toLowerCase())) {
      //   return undefined;
      // }
      await this.install(targetVersion);
      await this.createVersionSymlink(targetVersion, multishellPath);
      return targetVersion;
    }

    throw new Error(`No remote version satisfies ${versionRange}.`);
  }

  env() {
    return {
      [`JRM_MULTISHELL_PATH_OF_${this.name.toUpperCase()}`]:
        this.getMultishellPath(),
      // If we don't add this env variable, when user switch to other version, the installed npm packages under the default alias will not be found.
      [`JRM_DEFAULT_ALIAS_PATH_OF_${this.name.toUpperCase()}`]:
        this.getDefaultAliasPath(),
    };
  }

  async list() {
    const promises = (
      await fs.readdir(this.getAliasesDir()).catch(() => [])
    ).map(async (name) => ({
      name,
      version: await this.getVersionBySymlink(
        path.join(this.getAliasesDir(), name),
      ),
    }));
    const aliases = await Promise.all(promises);

    // Get currently using version
    const multishellPath =
      process.env[`JRM_MULTISHELL_PATH_OF_${this.name.toUpperCase()}`];
    const usingVersion = !multishellPath
      ? undefined
      : await this.getVersionBySymlink(multishellPath);

    return (await this.getInstalledVersions()).map((version) => ({
      version,
      aliases: aliases
        .filter((alias) => alias.version === version)
        .map((alias) => alias.name),
      isUsing: usingVersion === version,
    }));
  }

  async alias(aliasName: string, version: string): Promise<void> {
    // Validate that version is a valid semver
    if (!semver.valid(version)) {
      throw new Error(
        `Invalid version: ${version}. Expected a valid semver (e.g., 20.0.0).`,
      );
    }
    if (semver.validRange(aliasName)) {
      throw new Error(
        `Invalid alias name: ${aliasName}. Alias name cannot be a valid semver or a valid semver range.`,
      );
    }

    const aliasPath = path.join(this.getAliasesDir(), aliasName);
    const versionPath = path.join(this.getVersionsDir(), `v${version}`);

    // Check if the specific version is installed
    if (!(await exists(versionPath))) {
      throw new Error(
        `${this.name}@${version} is not installed. Run \`jrm install ${this.name}@${version}\` first.`,
      );
    }

    // We don't need to create the alias directory here, because if the version is installed, the alias directory must exist.
    // JRM will create the default alias once the first version is installed.
    await this.createVersionSymlink(version, aliasPath);
  }

  async unalias(aliasName: string): Promise<void> {
    if (aliasName === "default") {
      throw new Error("'default' alias is reserved. Cannot remove it.");
    }

    const aliasPath = path.join(this.getAliasesDir(), aliasName);
    if (!(await exists(aliasPath))) {
      return;
    }
    // If not recursive, Deno will throw an error when the alias is a symlink, but Node.js will not.
    await fs.rm(aliasPath, { recursive: true });
  }
}
