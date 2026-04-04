# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

JRM (JavaScript Runtime Manager) is a fast and lightweight JavaScript runtime version manager for Node.js, Bun, and Deno, written in TypeScript. It uses Commander.js for CLI, esbuild for bundling, and Vitest for testing.

## Commands

```bash
pnpm install        # Install dependencies
pnpm build          # Bundle with esbuild, compile binaries for all platforms (calls build.sh)
pnpm test           # Run style check + type check + vitest with coverage
pnpm style          # Code style checking (eslint)
```

## Architecture

### Core Structure

- `src/main.cli.ts` — CLI entry point (Commander.js)
- `src/runtime.ts` — Abstract base class defining the Runtime interface; all runtimes extend this
- `src/common.ts` — Registry managing all supported runtimes (Node.js, Bun, Deno)
- `src/detector.ts` — Auto-detects versions from `.node-version`, `.bun-version`, `.deno-version`, and `package.json` `devEngines`

### Module Organization

- `src/commands/` — Individual CLI command implementations (install, use, list, alias, etc.)
- `src/runtimes/` — Runtime-specific implementations for node, bun, deno
- `src/utils/` — Shared utilities (download, file existence checks, user prompts)

### Key Patterns

1. **Abstract Runtime Class**: `Runtime` is abstract with `getRemoteVersionsRaw()` and `installRaw()` as required methods for subclasses.
2. **Version Storage**: Versions stored in `~/.jrm/{runtime}/versions/v{version}`, managed via symlinks.
3. **Multi-Shell Support**: Creates unique directories per process with timestamps to avoid env conflicts.
4. **Auto-Detection**: Recursive directory traversal upward looking for version config files.

## Build

The build is handled by `build.sh` which:

1. Bundles source with esbuild to `dist/jrm.js`
2. Compiles binaries for all platforms using Deno compile (x86_64/aarch64 on macOS/Linux)

## Commit Workflow

Before committing `fix` or `feat` type changes, create a changeset file in the `.changeset` directory. The file header should list all the affected package name(s), and the content should be a single English sentence starting with `fix:` or `feat:`. Use the **same** sentence as the commit message.
