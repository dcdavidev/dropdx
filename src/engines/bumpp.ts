/**
 * @file src/engines/bumpp.ts
 * Release engine adapter for bumpp version bumper.
 */

import { existsSync } from 'node:fs';
import path from 'node:path';

import type { CliOptions, WorkspacePackage } from '../types.js';
import { bold, logInfo, logSuccess } from '../utils/banner.js';
import { updateChangelog } from '../utils/changelog.js';
import { exec } from '../utils/exec.js';
import { findPackages } from '../utils/packages.js';

/**
 * Executes version bump using bumpp CLI and updates package changelogs.
 *
 * @param root - Path to repository workspace root.
 * @param packages - Publishable packages.
 * @param options - Configuration flags.
 */
export function runBumppVersion(
  root: string,
  packages: WorkspacePackage[],
  options: CliOptions
): void {
  const pm = existsSync(path.join(root, 'pnpm-lock.yaml'))
    ? 'pnpm exec'
    : 'npx';
  const args = [
    options.bump || 'patch',
    '--yes',
    '--no-commit',
    '--no-tag',
    '--no-push',
  ];

  if (packages.length > 1) {
    args.push('--recursive');
  }

  const cmd = `${pm} bumpp ${args.join(' ')}`;

  if (options.dryRun) {
    logInfo(`[DRY-RUN] Would execute bumpp version bump: ${bold(cmd)}`);
    return;
  }

  logInfo(`Executing bumpp version bump: ${bold(cmd)}`);
  exec(cmd, { cwd: root });

  const reloaded = findPackages(root).filter((p) => p.isPublishable);
  for (const pkg of reloaded) {
    updateChangelog(
      pkg.directory,
      pkg.version,
      options.summary,
      undefined,
      undefined,
      options.conventionalCommits
    );
  }

  logSuccess('bumpp version bump and changelog update executed successfully');
}
