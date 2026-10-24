# `dropdx` Configuration Examples

`dropdx` automatically discovers configuration files in `.config/` (recommended) or the project root in **JSON**, **JSONC**, **YAML**, and **TOML** formats:

- [`.config/dropdx.config.json`](./dropdx.config.json) _(default)_
- [`.config/dropdx.config.jsonc`](./dropdx.config.jsonc)
- [`.config/dropdx.config.yaml`](./dropdx.config.yaml) _(or `.yml`)_
- [`.config/dropdx.config.toml`](./dropdx.config.toml)

You can also pass a custom path explicitly via `--config <path>` (or `-c <path>`).

## Important Notes

- **Version Bumping (`bump`)**: SemVer bump calculation (`patch`, `minor`, `major`, `prerelease`) is **automatic** by default based on Git commit history since the latest tag, or overridden per release via CLI flags (`--patch`, `--minor`, `--major`, `--prerelease`, `--bump <type>`). It is intentionally not stored in static configuration files.
- **Distribution Tag (`tag`)**: The npm dist-tag (`latest`, `next`, `beta`, `canary`, etc.) defaults to `latest` and is passed per release via the `--tag <name>` CLI option rather than stored in the static configuration file.
- **Package Access (`access`)**: Package visibility (`"public"` or `"restricted"`) belongs in `package.json` under `"publishConfig": { "access": "public" }`, or can be overridden per run with `--access`.
