# JRM - JavaScript Runtime Manager

[![GitHub license](https://img.shields.io/github/license/rnmjs/jrm)](./LICENSE)
[![](./badge/coverage.svg)]()

A fast and simple JavaScript runtime version manager for Node.js, Bun, and Deno.

## ✨ Features

- 🚀 **Fast & Lightweight** - Minimal overhead with efficient version switching
- 🎯 **Auto-Detection** - Automatically detect and use project-specific runtime versions
- 📁 **Project-Based** - Support for `.node-version` files and `package.json` devEngines
- 📦 **Version Range Support** - Use semantic versioning ranges for flexible version management

## 🚀 Installation

### Download from GitHub Releases

```bash
# For Linux/macOS. You may need to add `sudo` in front of these two commands.
curl -L "https://github.com/rnmjs/jrm/releases/latest/download/jrm-$(uname -s)-$(uname -m)" -o /usr/local/bin/jrm
chmod +x /usr/local/bin/jrm
```

> Go to the [GitHub Releases](https://github.com/rnmjs/jrm/releases) for more assets.

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
jrm use node@18
node --version # -> 18.20.8

# Set multiple runtime versions
jrm use node@22.21.1 bun@1.3.5 deno@2.6.3
node --version # -> 22.21.1
bun --version # -> 1.3.5
deno --version # -> 2.6.3
```

### Project Configuration

JRM can automatically detect runtime versions from your project configuration:

```bash
echo "22.21.1" > .node-version
echo "1.3.5" > .bun-version
echo "2.6.3" > .deno-version

jrm use

node --version # -> 22.21.1
bun --version # -> 1.3.5
deno --version # -> 2.6.3
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

## 👀 See Also

- [fnm](https://github.com/Schniz/fnm) - 🚀 Fast and simple Node.js version manager, built in Rust. (JRM is inspired by this project)
- [@rnm/pm](https://github.com/rnmjs/pm) - 📦 Unified Package Manager for Node.js (npm, yarn, pnpm)

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

## ⭐️ Show Your Support

If this project helps you, please give it a ⭐️!

## 📄 License

[MIT](./LICENSE)
