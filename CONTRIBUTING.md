# Contributing to dropx 🧙‍♂️✨

Thank you for your interest in contributing to **dropx**! We welcome contributions of all kinds, including bug reports, feature suggestions, documentation improvements, and pull requests.

Please take a few moments to review these guidelines before getting started.

---

## Code of Conduct

We are dedicated to providing a friendly, safe, and welcoming environment for everyone, regardless of background or identity. Please maintain professional, respectful, and constructive communication at all times.

---

## Development Setup

### Prerequisites

- **Node.js**: `>= 20.0.0` (LTS recommended)
- **pnpm**: `>= 10.0.0` (core package manager)
- **Git**: `>= 2.30.0`

### 1. Clone the Repository

```bash
git clone https://github.com/dcdavidev/dropx.git
cd dropx
```

### 2. Install Dependencies

```bash
pnpm install
```

> **Note**: Running `pnpm install` automatically activates our Git hooks via [Lefthook](https://github.com/evilmartians/lefthook) (`pre-commit` and `commit-msg`).

### 3. Build TypeScript

```bash
pnpm run build
```

This compiles `src/` to `dist/` with declaration maps and type definitions.

### 4. Run Tests

```bash
pnpm test
```

Executes all unit tests with the Node.js native test runner.

---

## Available Scripts

| Script                | Command                               | Purpose                                               |
| :-------------------- | :------------------------------------ | :---------------------------------------------------- |
| `pnpm run build`      | `tsc`                                 | Compiles TypeScript source files to `dist/`           |
| `pnpm test`           | `pnpm run build && node --test`       | Compiles and executes unit test suites                |
| `pnpm run lint`       | `eslint --no-warn-ignored --fix .`    | Checks and automatically fixes code style issues      |
| `pnpm run lint:check` | `eslint --no-warn-ignored .`          | Verifies code style without modifying files           |
| `pnpm run fmt`        | `prettier --ignore-unknown --write .` | Formats all files with Prettier                       |
| `pnpm run fmt:check`  | `prettier --ignore-unknown --check .` | Verifies formatting with Prettier                     |
| `pnpm run spellcheck` | `cspell --no-progress --no-summary .` | Spellchecks all project files                         |
| `pnpm run check:ci`   | Full pipeline                         | Runs build, lint, format check, spellcheck, and tests |
| `pnpm run commit`     | `cz`                                  | Interactive Conventional Commits prompt via `cz-git`  |

---

## Commit Guidelines (Conventional Commits)

This repository enforces the [Conventional Commits](https://www.conventionalcommits.org/) specification using `@commitlint/cli` and `commitlint-config-spellbookx`.

### Commit Format

```text
<type>(<scope>): <short description>

[optional body]

[optional footer(s)]
```

### Supported Types

- `feat`: A new feature or capability.
- `fix`: A bug fix.
- `docs`: Documentation updates or additions.
- `style`: Changes that do not affect code semantics (formatting, indentation).
- `refactor`: Code refactoring without bug fixes or feature additions.
- `perf`: Performance improvements.
- `test`: Adding or correcting tests.
- `build`: Changes affecting build system or external dependencies.
- `ci`: Changes to CI/CD workflows and configuration files.
- `chore`: Maintenance tasks, repo administration, dependency updates.

### Interactive Commit Prompt

You can use the interactive Commitizen prompt powered by `cz-git`:

```bash
pnpm run commit
```

---

## Submitting Pull Requests

1. **Create a Topic Branch**:
   ```bash
   git checkout -b feat/add-support-for-yarn-berry
   ```
2. **Implement Your Changes**:
   - Write clean, type-safe TypeScript in `src/`.
   - Maintain full test coverage by adding tests in `test/`.
   - Preserve existing documentation and comments.
3. **Run Quality Checks**:
   Ensure that the full CI quality suite passes locally:
   ```bash
   pnpm run check:ci
   ```
4. **Commit Your Changes**:
   Follow Conventional Commits or use `pnpm run commit`.
5. **Push and Open a Pull Request**:
   - Push your branch to GitHub.
   - Open a Pull Request targeting the `main` branch.
   - Fill in the Pull Request template clearly describing the motivation, changes, and testing steps.

---

## Need Help?

Feel free to open an issue or reach out with any questions. We are glad to help!
