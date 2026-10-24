# 🤖 dropdx Agent Skills

Official AI agent skills for **`dropdx`** conforming to the open [Agent Skills specification](https://github.com/vercel-labs/skills).

These skills provide AI coding assistants (including **Google Antigravity**, **Cursor**, **Claude Code**, **GitHub Copilot**, **Cline**, **Windsurf**, **Zed**, and **Warp**) with contextual knowledge and deterministic workflows to configure, dry-run, troubleshoot, and execute automated package releases across single packages and monorepos.

---

## Available Skills

| Skill        | Description                                                                                                                                                                                                                | Location                                             |
| :----------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------- |
| **`dropdx`** | Guides automated package releasing, SemVer version bumping, Conventional Commits changelog generation, `.npmrc` registry resolution, and npm publishing for single packages and monorepos via CLI and programmatic TS API. | [`skills/dropdx/SKILL.md`](./skills/dropdx/SKILL.md) |

---

## Installation

### Option 1: Via the `skills` CLI (Recommended)

Install the `dropdx` skill directly into your project repository using the `skills` CLI:

```bash
# Install the dropdx skill into the current project
npx skills add dcdavidev/dropdx --skill dropdx

# Or install all skills from the repository
npx skills add dcdavidev/dropdx
```

#### Global Installation (Available across all your projects)

To make the `dropdx` skill available globally to your AI assistant across every repository on your machine:

```bash
npx skills add -g dcdavidev/dropdx --skill dropdx
```

---

### Option 2: Manual Installation

You can copy the `.agents/skills/dropdx` folder directly into any project:

```bash
# In your target project root:
mkdir -p .agents/skills
git clone --depth 1 https://github.com/dcdavidev/dropdx.git /tmp/dropdx
cp -r /tmp/dropdx/.agents/skills/dropdx .agents/skills/
rm -rf /tmp/dropdx
```

---

## Supported AI Assistants

Skills in `.agents/skills` are automatically recognized and loaded by:

- **Google Antigravity** (CLI `agy` & Antigravity IDE)
- **Cursor** (`.agents/skills` or `.cursor/skills`)
- **Claude Code** (`.agents/skills`)
- **GitHub Copilot Workspace & Chat**
- **Cline** / **Roo Code**
- **Windsurf** / **Cascade**
- **Zed** & **Warp**

---

## Usage Examples

Once installed, prompt your AI assistant naturally:

- _"Run a dry-run release check on this monorepo using the `dropdx` skill."_
- _"Set up `dropdx` release scripts in `package.json` and a GitHub Actions workflow with npm provenance."_
- _"Release a new minor version of our packages to npm using `dropdx`."_
- _"Configure `.npmrc` scoped registry resolution and verify publishing with `dropdx --dry-run`."_
