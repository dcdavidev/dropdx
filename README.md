# relsx 🧙‍♂️🚀

[![npm version](https://img.shields.io/npm/v/@dcdavidev/relsx?color=a855f7&style=flat-square)](https://www.npmjs.com/package/@dcdavidev/relsx)
[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg?style=flat-square)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-9333ea.svg?style=flat-square)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-c084fc.svg?style=flat-square)](https://www.typescriptlang.org/)

> **relsx** is an automated release, version bumping, and publishing CLI for single packages and monorepos. Designed with a vibrant purple terminal UI inspired by the [Spellbookx](https://github.com/dcdavidev/spellbookx) ecosystem.

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
- [Contributing & Development](#contributing--development)
- [License](#license)

---

## Overview

Publishing npm packages manually or in complex monorepos often involves repetitive, error-prone manual steps:

- Forgetting to verify npm registry authentication (`npm whoami`).
- Attempting to publish an existing or outdated version that the registry rejects with `403 Forbidden` / `version already exists`.
- Forgetting to bump internal dependency versions between workspace packages.
- Overlooking git commit, annotated tagging, or remote branch synchronization.

**relsx** streamlines this entire process into a single command with zero initial configuration required. It inspects your repository, queries your registry, determines whether version bumps are necessary, updates changelogs, builds packages, creates annotated Git tags, pushes to remote origin, and publishes packages reliably.

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
- 💻 **Full TypeScript Support & Programmatic API**: Use as a CLI binary (`relsx`) or import helper functions and types into your own Node.js/TypeScript scripts.

---

## Installation

You can run `relsx` on-demand using your preferred package runner, or install it locally as a development dependency.

### Using Package Runners (No Installation Needed)

```bash
# Using pnpm
pnpm dlx @dcdavidev/relsx

# Using npm
npx @dcdavidev/relsx

# Using yarn
yarn dlx @dcdavidev/relsx
```

### Local Project Installation

```bash
# Using pnpm
pnpm add -D @dcdavidev/relsx

# Using npm
npm install --save-dev @dcdavidev/relsx

# Using yarn
yarn add -D @dcdavidev/relsx
```

---

## Quick Start

### 1. Add Release Script to `package.json`

```json
{
  "scripts": {
    "release": "relsx",
    "release:dry": "relsx --dry-run",
    "release:minor": "relsx --minor",
    "release:major": "relsx --major"
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
🧙 RELSX - Automated Release & Publish CLI 🚀

Usage:
  relsx [options]
  npx relsx [options]
  pnpm exec relsx [options]
```

### Options Table

| Option             | Shorthand | Description                                                     | Default                    |
| :----------------- | :-------- | :-------------------------------------------------------------- | :------------------------- |
| `--bump <type>`    |           | SemVer increment level: `patch`, `minor`, or `major`            | `patch`                    |
| `--patch`          |           | Shortcut for `--bump patch`                                     |                            |
| `--minor`          |           | Shortcut for `--bump minor`                                     |                            |
| `--major`          |           | Shortcut for `--bump major`                                     |                            |
| `--summary <text>` | `-m`      | Release summary note (used in commit message & changelog)       | Auto-generated             |
| `--registry <url>` |           | Target npm registry URL                                         | From `.npmrc` or npmjs.org |
| `--tag <name>`     |           | npm dist-tag (e.g., `latest`, `beta`, `next`)                   | `latest`                   |
| `--access <level>` |           | Package access level: `public` or `restricted`                  | `public`                   |
| `--otp <code>`     |           | Two-factor authentication (2FA) one-time password               |                            |
| `--provenance`     |           | Generate npm provenance attestation (useful in CI)              | `false`                    |
| `--engine <name>`  |           | Release engine: `auto`, `changeset`, `release-it`, `internal`   | `auto`                     |
| `--dry-run`        | `-d`      | Simulate validations, bumps, build, and publish without changes | `false`                    |
| `--skip-build`     |           | Skip running package build scripts                              | `false`                    |
| `--skip-git`       |           | Skip git commit, tag, and push steps                            | `false`                    |
| `--skip-publish`   |           | Skip publishing packages to the registry                        | `false`                    |
| `--skip-auth`      |           | Skip `npm whoami` registry authentication check                 | `false`                    |
| `--allow-dirty`    |           | Allow release even with uncommitted changes in git repository   | `false`                    |
| `--help`           | `-h`      | Display help screen                                             |                            |
| `--version`        | `-v`      | Display `relsx` version                                         |                            |

---

## The 7-Step Release Pipeline

When executed, `relsx` follows a structured 7-phase release pipeline:

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

`relsx` prioritizes your configured registry using the following resolution chain:

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

`relsx` adapts dynamically to existing tooling in your repository:

| Engine           | When Selected                                                                         | Behavior                                                                                                                                   |
| :--------------- | :------------------------------------------------------------------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------- |
| **`changeset`**  | Detected when `@changesets/cli` is in dependencies or `.changeset/config.json` exists | Automatically creates a release changeset if none exists, runs `changeset version`, and runs `changeset publish`.                          |
| **`release-it`** | Detected when `release-it` is in dependencies or `.release-it.json` exists            | Executes `release-it` with non-interactive flags.                                                                                          |
| **`internal`**   | Default fallback when no third-party release tool is found                            | Uses the built-in, zero-dependency release engine with SemVer comparison, topological workspace resolution, and direct package publishing. |

You can explicitly force an engine at any time with `--engine <name>`:

```bash
relsx --engine changeset
relsx --engine internal
```

---

## Monorepo Support

`relsx` automatically identifies workspaces in:

- **pnpm workspaces**: Reads `pnpm-workspace.yaml`.
- **npm / yarn workspaces**: Reads the `workspaces` array in root `package.json`.
- **Lerna**: Reads `packages` from `lerna.json`.

### Topological Dependency Sorting

If package `B` depends on package `A` within the monorepo, `relsx` ensures that package `A` is versioned, built, and published **before** package `B`. Internal dependency version ranges in `package.json` are also automatically updated to match the newly bumped version.

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

      - name: Run relsx release
        run: pnpm exec relsx --bump ${{ inputs.bump }} --provenance
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

---

## Programmatic TypeScript API

`relsx` exports all core utilities and types, allowing you to build custom release automation scripts:

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
} from 'relsx';

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

All TypeScript definitions are exported directly from `relsx`:

- `CliOptions`
- `WorkspacePackage`
- `NpmRegistryInfo`
- `VersionBump`
- `PublishResult`
- `SemVer`
- `GitEnvironmentInfo`
- `ReleaseEngine`

---

## Contributing & Development

```bash
# Clone the repository
git clone https://github.com/dcdavidev/relsx.git
cd relsx

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
