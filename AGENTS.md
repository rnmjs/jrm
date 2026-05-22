## Project Overview

JRM (JavaScript Runtime Manager) is a fast and lightweight version manager for JavaScript runtimes (Node.js, Bun, Deno) and package managers (npm, Yarn, pnpm), written in TypeScript. It uses Commander.js for CLI, esbuild for bundling, and Vitest for testing.

> This project uses pnpm. Do NOT use npm or npx.

## Architecture

### Root package.json

@package.json

## Common Scripts

Read `scripts` field of `package.json` for common scripts.

### Core Structure

- `src/main.cli.ts` — CLI entry point, registers subcommands
- `src/executable.ts` — Abstract base class for all runtimes and package managers
- `src/detector.ts` — Abstract base class for version auto-detection, handles `.jrmrc.json` / `jrm.config.json` / `devEngines`
- `src/runtime-detector.ts` — Runtime version detection
- `src/package-manager-detector.ts` — Package manager version detection
- `src/common.ts` — Central registry of supported runtimes and package managers

### Module Organization

- `src/commands/` — CLI commands: `env`, `install`, `list`, `uninstall`, `use`
- `src/runtimes/` — Runtime-specific implementations for node, bun, deno
- `src/package-managers/` — Package manager implementations for npm, pnpm, yarn
- `src/utils/` — Shared utilities (`ask`, `download`, `exists`, `is-in-project`, `registry-url`)

### Key Patterns

1. **Executable Base Class**: `Executable` is abstract with `getRemoteVersionsRaw()` and `installRaw()` as required methods for subclasses. Supports semver range resolution, interactive prompts, and strict mode (generates error stub binaries when a project lacks configuration).
2. **Version Storage**: Versions stored in `~/.jrm/{executable}/versions/v{version}`, managed via symlinks.
3. **Multi-Shell Support**: Creates unique directories per process with timestamps to avoid env conflicts.
4. **Auto-Detection**: Recursive upward traversal checking `package.json` devEngines > `.jrmrc.json` > `jrm.config.json`, with priority ordering.

## Build

The build is handled by `build.sh` which:

1. Bundles source with esbuild to `dist/jrm.js`
2. Compiles binaries for all platforms using Deno compile (x86_64/aarch64 on macOS/Linux)
