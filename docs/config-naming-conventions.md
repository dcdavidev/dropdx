# `dropdx` Configuration Naming Conventions

`dropdx` uses cosmiconfig to search for configuration from the workspace root. It checks these paths in order:

1. `.config/dropdx.json`
2. `.config/dropdx.jsonc`
3. `.config/dropdx.yml`
4. `.config/dropdx.toml`
5. `dropdx.config.json`
6. `dropdx.config.jsonc`
7. `dropdx.config.yml`
8. `dropdx.config.toml`

The `.config/dropdx.*` paths are recommended and take precedence over root-level `dropdx.config.*` files. Both naming conventions support the same settings. See [Supported Configuration Formats](../README.md#supported-configuration-formats) for complete examples.

Use `--config <path>` (or `-c <path>`) to load a configuration from a custom location.

## Schema and Editor Support

The dropdx configuration uses JSON Schema Draft 2020-12. The schema is available as [JSON](../schemas/dropdx.schema.json) and [YAML](../schemas/dropdx.schema.yml) documents; both describe the same supported properties. Set the `$schema` property to the JSON schema URI for editor validation and completion:

```text
https://raw.githubusercontent.com/dcdavidev/dropdx/main/schemas/dropdx.schema.json
```

### JSON and JSONC

Add `$schema` as a top-level property. It is schema metadata and is ignored by dropdx:

```json
{
  "$schema": "https://raw.githubusercontent.com/dcdavidev/dropdx/main/schemas/dropdx.schema.json",
  "engine": "auto"
}
```

### YAML

For editors using yaml-language-server, add a schema directive comment at the top of the file:

```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/dcdavidev/dropdx/main/schemas/dropdx.schema.json
engine: auto
```

### TOML

There is no separate TOML schema format. TOML editors that support JSON Schema can use the same schema; see the [TOML schema association documentation](https://taplo.tamasfe.dev/configuration/using-schemas.html). In the editor described there, associate the schema with a TOML file by adding this top-level key (quoted because TOML bare keys cannot start with `$`):

```toml
'$schema' = 'https://raw.githubusercontent.com/dcdavidev/dropdx/main/schemas/dropdx.schema.json'
engine = 'auto'
```

These associations enable editor completion and diagnostics. They do not add runtime schema validation to the dropdx CLI.

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
