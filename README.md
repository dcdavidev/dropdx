# dropdx 🧙‍♂️🚀

[![npm version](https://img.shields.io/npm/v/@dcdavidev/dropdx?color=a855f7&style=flat-square)](https://www.npmjs.com/package/@dcdavidev/dropdx)
[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg?style=flat-square)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-9333ea.svg?style=flat-square)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-c084fc.svg?style=flat-square)](https://www.typescriptlang.org/)

> **dropdx** is an automated release, version bumping, and publishing CLI for single packages and monorepos. Designed with a vibrant purple terminal UI inspired by the [Spellbookx](https://github.com/dcdavidev/spellbookx) ecosystem.

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [CLI Command-Line Reference](#cli-command-line-reference)
- [The 7-Step Release Pipeline](#the-7-step-release-pipeline)
- [Registry Resolution (`.npmrc`)](#registry-resolution-npmrc)
- [Engine Auto-Detection](#engine-auto-detection)
- [Monorepo Support](#monorepo-support)
- [CI / CD Integration (GitHub Actions)](#ci--cd-integration-github-actions)
- [Programmatic TypeScript API](#programmatic-typescript-api)
- [AI Agent Skills](#ai-agent-skills)
- [Contributing & Development](#contributing--development)
- [License](#license)

---

## Overview

Publishing npm packages manually or in complex monorepos often involves repetitive, error-prone manual steps:

- Forgetting to verify npm registry authentication (`npm whoami`).
- Attempting to publish an existing or outdated version that the registry rejects with `403 Forbidden` / `version already exists`.
- Forgetting to bump internal dependency versions between workspace packages.
- Overlooking git commit, annotated tagging, or remote branch synchronization.

**dropdx** streamlines this entire process into a single command with zero initial configuration required. It inspects your repository, queries your registry, determines whether version bumps are necessary, updates changelogs, builds packages, creates annotated Git tags, pushes to remote origin, and publishes packages reliably.

---

## Key Features

- 🔐 **Npm Registry Authentication & Maintainer Checks**: Verifies credentials via `npm whoami` and validates maintainer permissions before publishing.
- 📦 **Automated SemVer Bumping & Conventional Commits**: Automatically analyzes Git history since the previous tag using the Conventional Commits specification to determine whether a `major` (breaking changes), `minor` (features), or `patch` bump is required. Also compares local versions against the registry so that `targetVersion > publishedVersion`.
- 🌐 **Smart Registry Resolution**: Resolves registries automatically from `--registry` flags, project `.npmrc` (including scoped registries like `@my-org:registry`), user-level `~/.npmrc`, or falls back to `https://registry.npmjs.org/`.
- ⚙️ **Automatic Engine Detection**: Automatically detects whether `@changesets/cli` or `release-it` is configured in your project and delegates to them, or runs its zero-dependency built-in engine.
- 🏢 **Monorepo & Standalone Ready**: Automatically detects standalone packages, pnpm workspaces (`pnpm-workspace.yaml`), npm/yarn workspaces (`package.json`), or Lerna. Only packages with `"private": false` (or without `private: true`) are published, sorted topologically according to internal package dependencies.
- 🏷️ **Git & Structured Changelog Automation**: Commits modified files with a Conventional Commit (`chore(release): vX.Y.Z [skip ci]`), generates/prepends `CHANGELOG.md` with structured sections (Breaking Changes, Features, Bug Fixes, etc.), creates annotated Git tags (e.g. `v1.2.0`), and pushes commits and tags to remote origin.
- ⚡ **Safe Dry-Run Mode**: Inspect everything with `--dry-run` without making any git changes or publishing to npm.
- 🛡️ **CI/CD Ready**: Supports `--provenance` attestation, `--otp` two-factor authentication, and non-interactive CI workflows.
- 🎨 **Purple & Lavender Visuals**: Truecolor ANSI styling with expressive emojis inspired by the Spellbookx suite.
- 🤖 **AI Agent Skills**: Built-in `.agents/skills` enabling AI coding assistants to automatically configure, dry-run, and execute release pipelines.
- 💻 **Full TypeScript Support & Programmatic API**: Use as a CLI binary (`dropdx`) or import helper functions and types into your own Node.js/TypeScript scripts.

---

## Installation

You can run `dropdx` on-demand using your preferred package runner, or install it locally as a development dependency.

### Using Package Runners (No Installation Needed)

```bash
# Using pnpm
pnpm dlx @dcdavidev/dropdx

# Using npm
npx @dcdavidev/dropdx

# Using yarn
yarn dlx @dcdavidev/dropdx
```

### Local Project Installation

```bash
# Using pnpm
pnpm add -D @dcdavidev/dropdx

# Using npm
npm install --save-dev @dcdavidev/dropdx

# Using yarn
yarn add -D @dcdavidev/dropdx
```

---

## Quick Start

### 1. Add Release Script to `package.json`

```json
{
  "scripts": {
    "release": "dropdx",
    "release:dry": "dropdx --dry-run",
    "release:minor": "dropdx --minor",
    "release:major": "dropdx --major"
  }
}
```

### 2. Run a Dry Run

Before making any real changes or publishing, test your setup with `--dry-run`:

```bash
pnpm run release:dry
```

### 3. Publish Your Release

When you are ready to publish:

```bash
pnpm run release
```

---

## CLI Command-Line Reference

```text
🧙 DROPDX - Automated Release & Publish CLI 🚀

Usage:
  dropdx [options]
  npx dropdx [options]
  pnpm exec dropdx [options]
```

### Options Table

| Option             | Shorthand | Description                                                     | Default                      |
| :----------------- | :-------- | :-------------------------------------------------------------- | :--------------------------- |
| `--bump <type>`    |           | SemVer increment level: `patch`, `minor`, `major`, `prerelease` | `patch`                      |
| `--patch`          |           | Shortcut for `--bump patch`                                     |                              |
| `--minor`          |           | Shortcut for `--bump minor`                                     |                              |
| `--major`          |           | Shortcut for `--bump major`                                     |                              |
| `--prerelease`     |           | Shortcut for `--bump prerelease`                                |                              |
| `--force-bump`     |           | Force version bump even when local version > registry version   | `false`                      |
| `--summary <text>` | `-m`      | Release summary note (used in commit message & changelog)       | Auto-generated               |
| `--registry <url>` |           | Target npm registry URL                                         | From `.npmrc` or npmjs.org   |
| `--tag <name>`     |           | npm dist-tag (e.g., `latest`, `beta`, `next`)                   | `latest`                     |
| `--access <level>` |           | Package access level: `public` or `restricted`                  | `public`                     |
| `--otp <code>`     |           | Two-factor authentication (2FA) one-time password               |                              |
| `--provenance`     |           | Generate npm provenance attestation (useful in CI)              | `false`                      |
| `--config <path>`  | `-c`      | Path to configuration file                                      | `.config/dropdx.config.json` |
| `--engine <name>`  |           | Release engine: `auto`, `changeset`, `release-it`, `internal`   | `auto`                       |
| `--dry-run`        | `-d`      | Simulate validations, bumps, build, and publish without changes | `false`                      |
| `--skip-build`     |           | Skip running package build scripts                              | `false`                      |
| `--skip-git`       |           | Skip git commit, tag, and push steps                            | `false`                      |
| `--skip-publish`   |           | Skip publishing packages to the registry                        | `false`                      |
| `--allow-dirty`    |           | Allow release even with uncommitted changes in git repository   | `false`                      |
| `--help`           | `-h`      | Display help screen                                             |                              |
| `--version`        | `-v`      | Display `dropdx` version                                        |                              |

---

## The 7-Step Release Pipeline

When executed, `dropdx` follows a structured 7-phase release pipeline:

```text
[1/7] 🔍 Pre-Flight Environment Validations
  ├── Check Node.js version (>= 20.0.0)
  ├── Verify clean git working tree (unless --allow-dirty)
  └── Verify git remote origin and sync status

[2/7] 🔐 Registry & Authentication Verification
  ├── Resolve registry from CLI / .npmrc / npmjs.org
  ├── Verify credentials via `npm whoami`
  └── Discover all workspace packages and check publishable status

[3/7] ⚙️ Release Engine Selection
  ├── Auto-detect `@changesets/cli` or `release-it`
  └── Select optimal release strategy (changeset / release-it / internal)

[4/7] 📦 Version Resolution & Registry Inspection
  ├── Fetch latest published version for each package
  ├── Verify user maintainer permissions on registry
  └── Calculate next version: targetVersion > registryVersion

[5/7] 🏗️ Building Packages
  └── Execute build scripts (e.g., `pnpm run build`) unless --skip-build

[6/7] 🏷️ Git Commit, Tag & Push
  ├── Update CHANGELOG.md and package.json files
  ├── Commit changes: "chore(release): vX.Y.Z [skip ci]"
  ├── Create annotated tag: `vX.Y.Z`
  └── Push branch and tag to remote origin (unless --skip-git)

[7/7] 🚀 Publishing Packages to Registry
  ├── Publish packages with configured access, dist-tag, and provenance
  └── Display final formatted summary table
```

---

## Registry Resolution (`.npmrc`)

`dropdx` prioritizes your configured registry using the following resolution chain:

1. **CLI Flag**: Value passed directly via `--registry <url>`.
2. **Project Scoped Registry**: Matching `@scope:registry` entry in `<projectRoot>/.npmrc`.
3. **Project Default Registry**: `registry=<url>` in `<projectRoot>/.npmrc`.
4. **User Scoped Registry**: Matching `@scope:registry` entry in `~/.npmrc`.
5. **User Default Registry**: `registry=<url>` in `~/.npmrc`.
6. **Fallback**: `https://registry.npmjs.org/`.

### Example `.npmrc` Configurations

#### Standard Custom Registry

```ini
registry=https://npm.pkg.github.com/
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

#### Scoped Monorepo Registry

```ini
@my-org:registry=https://npm.pkg.github.com/
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}

# All other unscoped packages go to npmjs
registry=https://registry.npmjs.org/
```

---

## Engine Auto-Detection

`dropdx` adapts dynamically to existing release and versioning tooling in your repository:

| Engine                 | When Selected                                                                                          | Behavior                                                                                                                                   |
| :--------------------- | :----------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------- |
| **`changeset`**        | Detected when `@changesets/cli` is in dependencies or `.changeset/config.json` exists                  | Automatically creates a release changeset if none exists, runs `changeset version`, then continues build, git tag/push, and publish.       |
| **`release-it`**       | Detected when `release-it` is in dependencies, `.release-it.*` exists, or `package.json#release-it`    | Delegates the release workflow to `release-it` with non-interactive CI flags.                                                              |
| **`semantic-release`** | Detected when `semantic-release` is in dependencies, `.releaserc*` / `release.config.*`, or `#release` | Delegates the release workflow to `semantic-release` (passing `--dry-run` / `--no-ci` when appropriate).                                   |
| **`lerna`**            | Detected when `lerna` is in dependencies or `lerna.json` exists                                        | Executes `lerna version <bump> --yes --no-git-tag-version --no-push`, then continues build, git tag/push, and publish.                     |
| **`bumpp`**            | Detected when `bumpp` is in dependencies or `bump.config.*` exists                                     | Executes `bumpp <bump> --yes --no-commit --no-tag --no-push` and updates `CHANGELOG.md`, then continues build, git tag/push, and publish.  |
| **`standard-version`** | Detected when `commit-and-tag-version` / `standard-version` is in dependencies or `.versionrc*` exists | Executes `commit-and-tag-version` (or `standard-version`) `--release-as <bump> --skip.commit --skip.tag`, then continues the pipeline.     |
| **`np`**               | Detected when `np` is in dependencies, `.np-config.*` exists, or `package.json#np`                     | Delegates the release workflow to `np <bump> --yolo`.                                                                                      |
| **`internal`**         | Default fallback when no third-party release tool is found                                             | Uses the built-in, zero-dependency release engine with SemVer comparison, topological workspace resolution, and direct package publishing. |

You can explicitly force an engine at any time with `--engine <name>` (or `"engine"` in `dropdx.config.*`):

```bash
dropdx --engine changeset
dropdx --engine lerna
dropdx --engine bumpp
dropdx --engine internal
```

---

## Monorepo Support

`dropdx` automatically identifies workspaces in:

- **pnpm workspaces**: Reads `pnpm-workspace.yaml`.
- **npm / yarn workspaces**: Reads the `workspaces` array in root `package.json`.
- **Lerna**: Reads `packages` from `lerna.json`.

### Topological Dependency Sorting

If package `B` depends on package `A` within the monorepo, `dropdx` ensures that package `A` is versioned, built, and published **before** package `B`. Internal dependency version ranges in `package.json` are also automatically updated to match the newly bumped version.

### Filtering Non-Publishable Packages

Packages marked with `"private": true` (such as root monorepo wrappers, example apps, or internal documentation websites) are ignored during publishing.

---

## CI / CD Integration (GitHub Actions)

Here is a recommended GitHub Actions workflow for automated releases:

```yaml
name: Release

on:
  workflow_dispatch:
    inputs:
      bump:
        description: 'Version bump level'
        required: true
        default: 'patch'
        type: choice
        options:
          - patch
          - minor
          - major

permissions:
  contents: write
  id-token: write # Required for npm provenance attestation

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Install pnpm
        uses: pnpm/action-setup@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
          registry-url: 'https://registry.npmjs.org/'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Configure Git
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"

      - name: Run dropdx release
        run: pnpm exec dropdx --bump ${{ inputs.bump }} --provenance
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

---

## Programmatic TypeScript API

`dropdx` exports all core utilities and types, allowing you to build custom release automation scripts:

```typescript
import {
  bumpVersion,
  checkNpmWhoami,
  cli,
  compareSemVer,
  detectEngine,
  fetchNpmRegistryInfo,
  findPackages,
  resolveRegistry,
  resolveTargetVersion,
} from '@dcdavidev/dropdx';

// Run the full CLI programmatically
await cli(['--dry-run', '--bump', 'minor']);

// Inspect registry version for a package
const registry = resolveRegistry('@my-org/my-pkg');
const info = await fetchNpmRegistryInfo('@my-org/my-pkg', registry);

console.log(`Published version: ${info.latestVersion}`);

// Compare and resolve target version
const target = resolveTargetVersion('1.0.0', info.latestVersion, 'patch');
console.log(`Target version to publish: ${target}`);
```

### Exported Types

All TypeScript definitions are exported directly from `dropdx`:

- `CliOptions`
- `WorkspacePackage`
- `NpmRegistryInfo`
- `VersionBump`
- `PublishResult`
- `SemVer`
- `GitEnvironmentInfo`
- `ReleaseEngine`

---

## AI Agent Skills

`dropdx` includes official agent skills conforming to the open [Agent Skills specification](https://github.com/vercel-labs/skills). These skills enable AI coding assistants (such as Antigravity, Cursor, GitHub Copilot, Claude Code, Cline, Windsurf, Zed, and Warp) to automatically configure release scripts, run dry-run simulations, troubleshoot registry permissions, and execute releases without manual prompt engineering.

### Available Skills

| Skill        | Description                                                                                                                                                                                                                | Location                                                    |
| :----------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------- |
| **`dropdx`** | Guides automated package releasing, SemVer version bumping, Conventional Commits changelog generation, `.npmrc` registry resolution, and npm publishing for single packages and monorepos via CLI and programmatic TS API. | [`.agents/skills/dropdx`](./.agents/skills/dropdx/SKILL.md) |

### Installation

Install the `dropdx` skill into your project using the `skills` CLI:

```bash
# Add the dropdx skill to your project
npx skills add dcdavidev/dropdx --skill dropdx

# Or install globally for your personal AI assistant across all workspaces:
npx skills add -g dcdavidev/dropdx --skill dropdx
```

#### Manual Installation

You can also copy the skill directly into any project's `.agents/skills` directory:

```bash
mkdir -p .agents/skills
git clone --depth 1 https://github.com/dcdavidev/dropdx.git /tmp/dropdx
cp -r /tmp/dropdx/.agents/skills/dropdx .agents/skills/
rm -rf /tmp/dropdx
```

### Usage with AI Assistants

Once installed, your AI coding assistant automatically discovers and activates the skill when relevant. You can also trigger it directly with natural language instructions:

- _"Run a dry-run release check on this repository using the `dropdx` skill."_
- _"Set up `dropdx` release scripts in `package.json` and a GitHub Actions workflow with npm provenance."_
- _"Release a new minor version of our workspace packages using `dropdx`."_
- _"Configure `.npmrc` scoped registry resolution and verify publishing with `dropdx --dry-run`."_

For full documentation and skill details, see [`.agents/README.md`](./.agents/README.md).

---

## Contributing & Development

```bash
# Clone the repository
git clone https://github.com/dcdavidev/dropdx.git
cd dropdx

# Install dependencies
pnpm install

# Build TypeScript to dist/
pnpm run build

# Run unit tests
pnpm test

# Run full CI quality check (Build + Lint + Format + Spellcheck + Tests)
pnpm run check:ci
```

---

## License

Released under the [MIT License](LICENSE).  
Copyright (c) 2026 Davide Di Criscito.
