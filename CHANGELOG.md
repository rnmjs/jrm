# jrm

## 0.4.0

### Minor Changes

- 6adb056: feat: support `.jrmrc.json` and `jrm.config.json` for version auto-detection, remove `.runtime-version` file support

## 0.3.3

### Patch Changes

- ce9dcb1: feat: write stub binaries in strict mode when user declines to install the required version

## 0.3.2

### Patch Changes

- d00ef93: feat: default option for installing prompts is Y now

## 0.3.1

### Patch Changes

- a7ab0db: feat: add `-y, --yes` option for `use` subcommand

## 0.3.0

### Minor Changes

- fa743b4: feat: add package manager support (npm, Yarn, pnpm)

## 0.2.3

### Patch Changes

- 50f384c: fix: optimize `use` command logic

## 0.2.2

### Patch Changes

- 8b7714d: fix: remove existing multishell directory before creating stub binaries

## 0.2.1

### Patch Changes

- dc20cb5: fix: ensure multishell path is always initialized before use

## 0.2.0

### Minor Changes

- 323eb6d: chore!: remove alias and unalias commands and all alias infrastructure

## 0.1.7

### Patch Changes

- f696938: chore: when running `jrm install`, it's required a version or a version range

## 0.1.6

### Patch Changes

- 38bc118: feat: skip download if file already exists with matching size

## 0.1.5

### Patch Changes

- c1c5e24: refactor: download files into `~/.jrm/downloads` directory

## 0.1.4

### Patch Changes

- eef022e: fix: add `default` alias back if the default version is uninstalled
- 8cc91dc: feat: add support for `devEngines.runtime.onFail` field in package.json

## 0.1.3

### Patch Changes

- 3372273: feat: support `uninstall` command, close #15
- 67a76cb: feat: support macos x64

## 0.1.2

### Patch Changes

- ab50459: refactor: optimize code. no significant changes

## 0.1.1

### Patch Changes

- 9e5bcc0: fix: avoid crash when unalias is called because of Deno

## 0.1.0

### Minor Changes

- 310f150: chore: bump to `0.1.0`

### Patch Changes

- ceed48b: feat: support `unalias` command
- 9b5d405: feat: support `jrm use node@some-alias`

## 0.0.8

### Patch Changes

- b652400: feat: ask user whether to install before fetching remote versions
- f2ddbd0: feat: print more msg for `list` command

## 0.0.7

### Patch Changes

- 66ce092: feat: support `alias` command

## 0.0.6

### Patch Changes

- 2ad92b7: fix: vanish unexpected prompt before installing bun

## 0.0.5

### Patch Changes

- a540478: fix: fix crash when `devEngines` is absent in `package.json`
- d9adf60: feat: support bun

## 0.0.4

### Patch Changes

- 11c8875: fix: support array objects for `devEngines.runtime` field
- 327aeb9: fix: don't ask for permission before installing deno

## 0.0.3

### Patch Changes

- e563895: feat: support deno
- 7d25855: fix: make `use` command work for the first time

## 0.0.2

### Patch Changes

- 92d1911: fix: fix `use` command not working

## 0.0.1

### Patch Changes

- 4615f55: feat: finish
