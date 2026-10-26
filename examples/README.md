# `dropdx` Configuration Examples

`dropdx` automatically discovers configuration files in `.config/` (recommended) or the project root in **JSON**, **JSONC**, **YAML**, and **TOML** formats:

- [`.config/dropdx.config.json`](./dropdx.config.json) _(default)_
- [`.config/dropdx.config.jsonc`](./dropdx.config.jsonc)
- [`.config/dropdx.config.yaml`](./dropdx.config.yaml) _(or `.yml`)_
- [`.config/dropdx.config.toml`](./dropdx.config.toml)

You can also pass a custom path explicitly via `--config <path>` (or `-c <path>`).

## Generating a Configuration File

Instead of writing the file by hand, scaffold it with the `init` command:

```bash
# Generate .config/dropdx.config.json stamped with the current dropdx version
dropdx init

# Overwrite an existing configuration file
dropdx init --force

# Write to a custom path
dropdx init --config custom/dropdx.config.json
```

Every generated file includes a `version` property matching the version of `dropdx` that created it:

```json
{
  "version": "0.3.0",
  "conventionalCommits": true,
  "engine": "auto",
  "skipBuild": false,
  "skipGit": false,
  "skipPublish": false,
  "allowDirty": false
}
```

If a loaded configuration file declares a `version` that does not match the running `dropdx` version, `dropdx` prints a warning so you know you are using a config file generated for a different version.

## Important Notes

- **Version Bumping (`bump`)**: SemVer bump calculation (`patch`, `minor`, `major`, `prerelease`) is **automatic** by default based on Git commit history since the latest tag, or overridden per release via CLI flags (`--patch`, `--minor`, `--major`, `--prerelease`, `--bump <type>`). It is intentionally not stored in static configuration files.
- **Distribution Tag (`tag`)**: The npm dist-tag (`latest`, `next`, `beta`, `canary`, etc.) defaults to `latest` and is passed per release via the `--tag <name>` CLI option rather than stored in the static configuration file.
- **Package Access (`access`)**: Package visibility (`"public"` or `"restricted"`) belongs in `package.json` under `"publishConfig": { "access": "public" }`, or can be overridden per run with `--access`.
