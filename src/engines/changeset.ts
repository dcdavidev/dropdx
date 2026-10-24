/**
 * @file src/engines/changeset.ts
 * Release engine adapter for Changesets tool.
 */

import { existsSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { BumpType, CliOptions, WorkspacePackage } from '../types.js';
import { bold, cyan, logInfo, logSuccess } from '../utils/banner.js';
import { exec } from '../utils/exec.js';

/**
 * Returns pending changeset filenames in .changeset directory.
 *
 * @param root - Workspace root directory path.
 * @returns List of unreleased changeset files.
 */
export function getPendingChangesets(root: string): string[] {
  const changesetDir = path.join(root, '.changeset');
  if (!existsSync(changesetDir)) return [];

  try {
    const files = readdirSync(changesetDir);
    return files.filter(
      (f) => f.endsWith('.md') && f.toLowerCase() !== 'readme.md'
    );
  } catch {
    return [];
  }
}

/**
 * Creates an automatic changeset markdown file without user prompt.
 *
 * @param root - Workspace root path.
 * @param packages - Target packages list.
 * @param bumpType - Version level (patch, minor, major).
 * @param summary - Description text.
 * @returns Created changeset file path.
 */
export function createAutomaticChangeset(
  root: string,
  packages: WorkspacePackage[],
  bumpType: BumpType,
  summary: string
): string {
  const changesetDir = path.join(root, '.changeset');
  const filename = `auto-${Date.now()}.md`;
  const filePath = path.join(changesetDir, filename);

  const frontmatter = packages
    .filter((pkg) => !pkg.private)
    .map((pkg) => `'${pkg.name}': ${bumpType}`)
    .join('\n');

  const content = `---\n${frontmatter}\n---\n\n${summary}\n`;
  writeFileSync(filePath, content, 'utf8');

  return filePath;
}

/**
 * Executes version bump using changeset CLI.
 *
 * @param root - Workspace root path.
 * @param packages - Target packages list.
 * @param options - Execution flags.
 * @returns Temporary changeset path if created.
 */
export function runChangesetVersion(
  root: string,
  packages: WorkspacePackage[],
  options: CliOptions
): string | null {
  const existingChangesets = getPendingChangesets(root);

  if (options.dryRun) {
    const dryRunDetail =
      existingChangesets.length > 0
        ? `[DRY-RUN] Found ${bold(String(existingChangesets.length))} pending changeset(s): ${existingChangesets.join(', ')}`
        : `[DRY-RUN] Would create automatic changeset (${bold(options.bump)})`;
    logInfo(dryRunDetail);
    logInfo('[DRY-RUN] Would execute "changeset version"');
    return null;
  }

  let createdPath: string | null = null;

  if (existingChangesets.length > 0) {
    logInfo(
      `Found ${bold(String(existingChangesets.length))} pending changeset(s): ${existingChangesets.join(', ')}`
    );
  } else {
    const summary =
      options.summary ||
      `chore(release): automated ${options.bump} release bump`;
    createdPath = createAutomaticChangeset(
      root,
      packages,
      options.bump,
      summary
    );
    logSuccess(
      `Created automatic changeset: ${cyan(path.relative(root, createdPath))} (${bold(options.bump)})`
    );
  }

  logInfo('Executing "changeset version"...');
  try {
    const pm = existsSync(path.join(root, 'pnpm-lock.yaml'))
      ? 'pnpm exec'
      : 'npx';
    exec(`${pm} changeset version`, { cwd: root });
    logSuccess('Changeset version bump executed successfully');
    return createdPath;
  } catch (error) {
    if (createdPath && existsSync(createdPath)) {
      rmSync(createdPath, { force: true });
    }
    throw error;
  }
}
