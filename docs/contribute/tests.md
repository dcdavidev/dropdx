# Tests

This guide explains how to run the test suite, inspect coverage, and write new tests in dropdx. The repository uses [Vitest](https://vitest.dev/) with `@vitest/coverage-v8` for unit and integration tests.

## Run the Tests

Run the full test suite once with coverage:

```bash
pnpm test
```

Under the hood, `pnpm test` executes:

```bash
vitest run --no-fsModuleCache --passWithNoTests --coverage
```

There is no `vitest.config.*` file by default: the repository uses Vitest's built-in defaults and transforms TypeScript source files directly from `src/`.

Run a single test file by passing its path:

```bash
pnpm test tests/engine.test.ts
```

Filter tests by name using Vitest's `-t` flag:

```bash
pnpm test -- -t "Release engine detection"
```

Run Vitest in watch mode while developing:

```bash
pnpm exec vitest
```

Run tests through Turborepo (as part of the full cached check pipeline), or bypass the Turborepo cache with `--force`:

```bash
pnpm check
```

```bash
pnpm exec turbo run test --force
```

See [`turbo.json`](../../turbo.json) for the cached inputs (`src/**`, `tests/**`, `vitest.config.*`, `tsconfig*.json`, `package.json`) and outputs (`coverage/**`).

## Coverage

`pnpm test` generates V8 coverage reports in the `coverage/` directory (including HTML reports at `coverage/index.html`). The `coverage/` folder is gitignored and excluded from Prettier and ESLint checks.

## Write Tests

- Every new feature, utility function, or bug fix must include tests.
- Place test files in the root `tests/` directory, mirroring the structure of `src/` rather than co-locating tests beside source files.
- Name each test file after the module it tests with the `.test.ts` suffix, for example `tests/semver.test.ts` for `src/utils/semver.ts`. Keep each file focused on a single module.
- Name the top-level `describe` block clearly after the function or module under test:

  ```ts
  describe('Release engine detection', () => {
    // ...
  });
  ```

- Import Vitest helpers explicitly; globals are not enabled:

  ```ts
  import { describe, expect, it, vi } from 'vitest';
  ```

- Import the code under test from `../src/` with the `.js` extension (required by `moduleResolution: NodeNext`):

  ```ts
  import { detectEngine } from '../src/engines/index.js';
  ```

- Tests that touch the filesystem must use a temporary directory (`mkdtempSync(path.join(os.tmpdir(), '<prefix>-'))`) and clean it up afterwards. Never write test artifacts into the repository tree.
- Restore spies and mocks after each test, for example by calling `vi.restoreAllMocks()` in `afterEach`.

The `tests/` directory is included in [`tsconfig.json`](../../tsconfig.json) and type-checked by `pnpm lint:types`, while [`tsconfig.build.json`](../../tsconfig.build.json) excludes `tests/` from the published `dist/` output.

## Continuous Integration

CI runs `pnpm test` on every pull request and push to `main` after the build, commitlint, ESLint, Prettier, CSpell, and type-check steps. See [`.github/workflows/code-quality-tests-build.yml`](../../.github/workflows/code-quality-tests-build.yml).
