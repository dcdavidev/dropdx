# `dropdx` Configuration Examples

`dropdx` uses cosmiconfig to search for configuration from the workspace root. It checks these paths in order:

1. `.config/dropdx.json`
2. `.config/dropdx.jsonc`
3. `.config/dropdx.yml`
4. `.config/dropdx.toml`
5. `dropdx.config.json`
6. `dropdx.config.jsonc`
7. `dropdx.config.yml`
8. `dropdx.config.toml`

The `.config/dropdx.*` paths are recommended and take precedence over root-level `dropdx.config.*` files. The examples below use root-level names:

- [`dropdx.config.json`](./dropdx.config.json)
- [`dropdx.config.jsonc`](./dropdx.config.jsonc)
- [`dropdx.config.yml`](./dropdx.config.yml)
- [`dropdx.config.toml`](./dropdx.config.toml)

Use `--config <path>` (or `-c <path>`) to load a configuration from a custom location.

## Generating a Configuration File

Instead of writing the file by hand, scaffold it with the `init` command:

```bash
# Generate .config/dropdx.json stamped with the current dropdx version
dropdx init

# Overwrite an existing configuration file
dropdx init --force

# Write to a custom path
dropdx init --config custom/dropdx.json
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
