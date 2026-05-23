---
"jrm": patch
---

feat: suggest non-interactive `jrm use -y` in stub binary error message

Users hitting the stub binary will likely copy-paste the suggested command
in a non-interactive context (CI, scripts, automated shells), where the
default prompt would block. Adding `-y` makes the suggestion work out of
the box.
