# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

JRM (JavaScript Runtime Manager) is a fast and lightweight JavaScript runtime version manager for Node.js, Bun, and Deno, written in TypeScript. It uses Commander.js for CLI, esbuild for bundling, and Vitest for testing.

## Commands

```bash
pnpm install                    # Install dependencies
pnpm build                      # Bundle with esbuild, compile binaries for all platforms (calls build.sh)
pnpm test                       # Run style check + type check + vitest with coverage
pnpm vitest run <test-file>     # Run a specific test file (e.g., pnpm vitest run src/executable.test.ts)
pnpm style                      # Code style check
pnpm style:update               # Code style check + update
```

> 当前项目使用 pnpm，禁止使用 npm 和 npx。

## Architecture

### Core Structure

- `src/main.cli.ts` — CLI entry point (Commander.js), registers `env`, `install`, `list`, `use`, `uninstall` subcommands
- `src/executable.ts` — Abstract base class (`Executable`) with install, use, list, uninstall, env, download, and strict mode logic; all runtimes extend this
- `src/detector.ts` — Abstract base class (`Detector`) defining the `detectVersionRange()` interface
- `src/runtime-detector.ts` — Auto-detects runtime versions from `.{runtime}-version` files and `package.json` `devEngines`, recursing up parent directories
- `src/interfaces.ts` — Shared types (`VersionDetectResult`)
- `src/common.ts` — Registry managing all supported runtimes (Node.js, Bun, Deno)

### Module Organization

- `src/commands/` — CLI commands: `env`, `install`, `list`, `uninstall`, `use`
- `src/runtimes/` — Runtime-specific implementations for node, bun, deno
- `src/utils/` — Shared utilities (`ask`, `download`, `exists`, `is-in-project`)

### Key Patterns

1. **Executable Base Class**: `Executable` is abstract with `getRemoteVersionsRaw()` and `installRaw()` as required methods for subclasses. Supports semver range resolution, interactive prompts, and strict mode (generates error stub binaries when a project lacks configuration).
2. **Version Storage**: Versions stored in `~/.jrm/{runtime}/versions/v{version}`, managed via symlinks.
3. **Multi-Shell Support**: Creates unique directories per process with timestamps to avoid env conflicts.
4. **Auto-Detection**: Recursive directory traversal upward looking for version config files.

## Build

The build is handled by `build.sh` which:

1. Bundles source with esbuild to `dist/jrm.js`
2. Compiles binaries for all platforms using Deno compile (x86_64/aarch64 on macOS/Linux)

## Commit Workflow

Before committing `fix` or `feat` type changes, create a changeset file in the `.changeset` directory. The file header should list all the affected package name(s), and the content should be a single English sentence starting with `fix:` or `feat:`. Use the **same** sentence as the commit message.
