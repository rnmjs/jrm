---
"jrm": patch
---

feat: add `pm` alias via new `jrm pm` subcommand and shell function injection in `jrm env`

- `jrm pm` detects the package manager for the current directory (closest dir > devEngines > .jrmrc.json > jrm.config.json > smallest index), printing the bare name or failing with exit code 1
- `jrm env` injects a `pm()` shell function for bash/zsh by default; opt out with `--no-pm`
- Detector success results now carry an optional `source: { configPath, index }` field
