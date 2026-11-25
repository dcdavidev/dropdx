# Package.json Scripts Naming Conventions

Every script in the `scripts` field of [`package.json`](../../package.json) follows a single grammar:

```text
action[:target][:modifier]
```

- **action**: what the script does. One verb or short, well-known name: `build`, `changeset`, `check`, `fmt`, `lint`, `test`, `update`.
- **target** (optional): what the action runs on, for example `code`, `commits`, `node`, `spelling`, `turbo`, `types`, or `version`.
- **modifier** (optional): how the action runs. The modifier always comes last.

Segments are separated by `:`. Words inside a segment are separated by `-`.

The full convention lives in the [npm script naming conventions gist](https://gist.github.com/dcdavidev/d3e7722932b87e2cd37843417603bc9b). This page documents how it is applied in dropdx.

## Modifiers

| Modifier | Meaning                                                       |
| :------- | :------------------------------------------------------------ |
| `check`  | Report problems and change nothing. Exits non-zero on errors. |
| `fix`    | Apply automatic fixes.                                        |

The bare action uses the behavior developers expect from it:

- `lint` only checks. Automatic fixes are always opt-in via `:fix` (for example `lint:code:fix`).
- `fmt` writes formatted files. `fmt:check` checks formatting without writing, for CI and local verification.

## Rules

1. **Full words in targets.** Write `commits`, not `cm`; `spelling`, not `spell`.
2. **Group related scripts under one action.** Read-only code and metadata checks belong under `lint:*`: `lint:code`, `lint:spelling`, `lint:types`, `lint:commits`. Do not introduce top-level aliases such as `spellcheck`, `typecheck`, or `commit:lint`.
3. **Use Turborepo for aggregate scripts.** `lint` runs `lint:code` and `lint:spelling` via Turborepo, and `check` runs the full local verification pipeline (`build`, `lint:code`, `lint:spelling`, `lint:types`, `fmt:check`, and `test`). CI runs each step individually in [`.github/workflows/code-quality-tests-build.yml`](../../.github/workflows/code-quality-tests-build.yml) so failures are reported per check.
4. **Do not shadow pnpm built-ins.** `pnpm publish` and `pnpm version` are built-in commands, so the versioning script is named `changeset:version`. Every script must work with the short form `pnpm <name>`.
5. **Files in `scripts/` match the script name**, replacing `:` with `-` (for example, `update:node` runs `scripts/update-node.ts` and `update:turbo` runs `scripts/update-turbo.ts`).
6. **Keep the `scripts` field sorted alphabetically.** This is also enforced by `eslint-plugin-package-json`.

## Named Exceptions

These scripts are standard ecosystem or lifecycle names rather than `action:target` pairs:

- `build`, `test`: standard names expected by JavaScript tooling and Turborepo.
- `check`: local single-command verification entrypoint powered by Turborepo.
- `commit`: runs the guided Conventional Commits prompt (`czg`).
- `prepare`: npm/pnpm lifecycle script executed after `pnpm install` to set up Lefthook Git hooks.

## Available Scripts

| Script              | What it does                                                                                 |
| :------------------ | :------------------------------------------------------------------------------------------- |
| `build`             | Compiles `src/` to `dist/` with `tsc -p tsconfig.build.json`.                                |
| `changeset`         | Creates a changeset interactively.                                                           |
| `changeset:commits` | Generates changesets from Conventional Commits (`changeset-conventional`).                   |
| `changeset:version` | Consumes pending changesets, bumps `package.json`, and updates `CHANGELOG.md`.               |
| `check`             | Runs `build`, `lint:code`, `lint:spelling`, `lint:types`, `fmt:check`, and `test` via Turbo. |
| `commit`            | Launches the interactive `czg` Conventional Commits prompt.                                  |
| `fmt`               | Formats all supported files with Prettier.                                                   |
| `fmt:check`         | Verifies Prettier formatting without modifying files.                                        |
| `lint`              | Runs `lint:code` and `lint:spelling` via Turborepo.                                          |
| `lint:code`         | Lints the repository with ESLint.                                                            |
| `lint:code:fix`     | Lints the repository with ESLint and applies automatic fixes.                                |
| `lint:commits`      | Validates the latest commit message with Commitlint (`HEAD~1`).                              |
| `lint:spelling`     | Checks spelling across the repository with CSpell.                                           |
| `lint:types`        | Type-checks `src/`, `tests/`, and `scripts/` with `tsc --noEmit`.                            |
| `prepare`           | Installs Lefthook Git hooks.                                                                 |
| `test`              | Runs Vitest once with V8 coverage (`--no-fsModuleCache --passWithNoTests --coverage`).       |
| `update:node`       | Syncs `.nvmrc` and `@types/node` with the latest active Node.js LTS release.                 |
| `update:turbo`      | Upgrades `turbo` and runs `@turbo/codemod` migrations.                                       |

Pass extra flags after the script name. For example, run `pnpm check --force` to bypass the Turborepo cache.

## Adding a Script

1. Pick an existing **action** if one fits (`lint`, `fmt`, `changeset`, `update`, etc.).
2. Add a full-word **target** when the action can apply to multiple things.
3. Add a `:check` or `:fix` **modifier** only when the script has a variant with that behavior.
4. If the script runs a custom file, place it in `scripts/` and name it after the script with `-` instead of `:`.
5. Register cached tasks in [`turbo.json`](../../turbo.json) and add the script to `lint` or `check` if it belongs in the verification pipeline.
6. Keep the `scripts` object in [`package.json`](../../package.json) sorted alphabetically.
