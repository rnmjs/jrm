# Support `.jrmrc.json` and `jrm.config.json` as standalone devEngines carriers

JRM's primary configuration source is the standard `devEngines` field in `package.json`. But not every project maintainer agrees to add `devEngines` to `package.json`, which leaves individual contributors unable to enforce a toolchain via JRM in those projects. We proposed standardizing a standalone file (`dev-engines.config.json`) upstream in the OpenJS package-metadata-interoperability working group ([issue #52](https://github.com/openjs-foundation/package-metadata-interoperability-working-group/issues/52)), but maintainers rejected it — "package.json is the right place to put it" and a separate file would be "an explosion of mechanisms" — and the issue was closed as not planned.

Since no ecosystem-standard standalone file will exist, JRM defines its own: `.jrmrc.json` and `jrm.config.json`. Both carry the exact payload of `devEngines` (top-level `runtime` / `packageManager`, same `name`/`version`/`onFail` semantics per the [devEngines proposal](https://github.com/openjs-foundation/package-metadata-interoperability-working-group/blob/main/devengines-field-proposal.md)), just without the `devEngines` wrapper. This keeps them trivially convertible to/from the standard field while being ignorable by projects that don't use JRM (e.g. via personal `.git/info/exclude`).

## Considered Options

- **Standard standalone file (`dev-engines.config.json`)** — rejected upstream; JRM cannot unilaterally claim a generic name as a standard.
- **`package.json` `devEngines` only** — insufficient: fails the core use case of enforcing a toolchain when the project won't adopt the field.
- **JRM-specific files (chosen)** — tool-namespaced names avoid pretending to be a standard while delivering the same capability.

## Consequences

- Lookup priority within a directory is `package.json` `devEngines` > `.jrmrc.json` > `jrm.config.json`; only the first existing JRM config file is read (no field-level fallback between them).
- If the standalone file is ever standardized upstream, JRM should adopt it and deprecate these files.
