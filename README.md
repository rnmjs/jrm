# JRM - JavaScript Runtime Manager

[![GitHub license](https://img.shields.io/github/license/rnmjs/jrm)](./LICENSE)
[![](./badge/coverage.svg)]()

A fast and simple version manager for JavaScript runtimes and package managers. Alternative to FNM and Corepack.

- **Supported Runtimes:** Node.js, Bun, Deno
- **Supported Package Managers:** npm, Yarn, pnpm
- **Supported Platforms:** macOS, Linux
- **Supported Shells:** bash, zsh

## ✨ Features

- 🚀 **Fast & Lightweight** — Written in TypeScript, bundled with esbuild
- 🎯 **Auto-Detection** — Automatically detects versions from project files and `package.json`
- 📦 **Version Range Support** — Use semver ranges like `node@>=20`
- 🌐 **Custom Registry** — Respects your npm registry configuration

## 🚀 Installation

```bash
# Linux/macOS (may require sudo)
curl -L "https://github.com/rnmjs/jrm/releases/latest/download/jrm-$(uname -s)-$(uname -m)" -o /usr/local/bin/jrm
chmod +x /usr/local/bin/jrm
```

> See [GitHub Releases](https://github.com/rnmjs/jrm/releases) for all platforms.

```bash
jrm --help
```

## 📖 Usage

### 1. Shell Setup

Add this to `~/.bashrc` or `~/.zshrc`, then restart your terminal:

```bash
eval "$(jrm env)"
```

### 2. Use Versions

```bash
# Specific versions (the -y flag skips the interactive confirmation prompt)
jrm use -y node@18
jrm use -y bun@1.3.5 deno@2.6.3

node -v # 18.x.x
bun -v # 1.3.5
deno -v # 2.6.3

# Package manager versions
jrm use -y pnpm@9
jrm use -y yarn@4.6.0

pnpm -v # 9.x.x
yarn -v # 4.6.0
```

### 3. Project Configuration

With `eval "$(jrm env)"` enabled, JRM auto-detects versions and uses correct versions when you `cd` into a project. Configure versions using:

**Version files:**

```bash
.node-version    # Node.js
.bun-version     # Bun
.deno-version    # Deno
```

**Or `package.json` devEngines:**

```json
{
  "devEngines": {
    "runtime": {
      "name": "node",
      "version": "^20.0.0"
    },
    "packageManager": {
      "name": "pnpm",
      "version": "9.0.0"
    }
  }
}
```

```bash
node -v # 20.x.x
pnpm -v # 9.0.0
```

### 4. Other Commands

```bash
# Install specific versions
jrm install node@20
jrm install bun@1.3.5 deno@2.6.3

# List installed versions
jrm list
jrm list node
jrm list pnpm

# Uninstall a version
jrm uninstall node@18.0.0
```

## 🗑️ Uninstallation

1. Remove JRM binary: `rm /usr/local/bin/jrm`
2. Remove JRM data: `rm -rf ~/.jrm`
3. Remove `eval "$(jrm env)"` from your shell profile

## 👀 See Also

- [fnm](https://github.com/Schniz/fnm) — Fast Node.js version manager in Rust (JRM is inspired by this)
- [@rnm/pm](https://github.com/rnmjs/pm) — Unified Package manager for Node.js

## 🤝 Contributing

```bash
git clone https://github.com/rnmjs/jrm.git
cd jrm
pnpm install
pnpm test
pnpm build
```

## 📄 License

[MIT](./LICENSE)
