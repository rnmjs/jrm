# JRM - JavaScript Runtime Manager

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![](./badge/coverage.svg)]()

A fast and simple JavaScript runtime version manager for Node.js, Bun, and Deno.

## ✨ Features

- 🚀 **Fast & Lightweight** - Minimal overhead with efficient version switching
- 🎯 **Auto-Detection** - Automatically detect and use project-specific runtime versions
- 📁 **Project-Based** - Support for `.node-version` files and `package.json` devEngines
- 📦 **Version Range Support** - Use semantic versioning ranges for flexible version management

## 🚀 Installation

### Download from GitHub Releases

1. Go to the [GitHub Releases](https://github.com/rnmjs/jrm/releases) page
2. Download the latest binary for your platform
3. Make it executable and move to `/usr/local/bin`:

```bash
# For Linux/macOS
chmod +x jrm
sudo mv jrm /usr/local/bin/
```

### Verify Installation

```bash
jrm --version
```

## 📖 Usage

### Shell Setup

Add JRM to your shell profile. This step is required for JRM to work properly:

```bash
# For bash users (~/.bashrc)
eval "$(jrm env)"

# For zsh users (~/.zshrc)
eval "$(jrm env)"
```

After adding this line, restart your terminal or run `source ~/.bashrc` (or `source ~/.zshrc`).

### Basic Commands

```bash
# Set specific Node.js version
jrm use node@20

# Set multiple runtime versions
jrm use node@20.0.0 deno@2.0.0
```

### Project Configuration

JRM can automatically detect runtime versions from your project configuration:

```bash
echo "22.21.1" > .node-version
echo "2.6.3" > .deno-version
echo "1.3.5" > .bun-version

jrm use

node --version # -> 22.21.1
deno --version # -> 2.6.3
bun --version # -> 1.3.5
```

Not only `.{runtime}-version` files, JRM but also supports `devEngines` in `package.json`:

```json
{
  "devEngines": {
    "runtime": {
      "name": "node",
      "version": ">=20.0.0"
    }
  }
}
```

## 🛠️ How It Works

1. **Environment Setup**: `jrm env` generates shell commands that set up PATH and environment variables
2. **Version Detection**: JRM searches for version specifications in:
   - `.{runtime}-version` files (e.g., `.node-version`)
   - `package.json` devEngines configuration
   - Command line arguments
3. **Automatic Installation**: If a required version isn't installed, JRM automatically downloads and installs it
4. **Symlink Management**: JRM uses symlinks to switch between different runtime versions efficiently

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

```bash
# Clone the repository
git clone https://github.com/rnmjs/jrm.git
cd jrm

# Install dependencies
pnpm install

# Run tests
pnpm test

# Build the project
pnpm build
```

## 📄 License

[MIT](./LICENSE)
