/**
 * @file src/engines/lerna.ts
 * Release engine adapter for Lerna monorepo versioning.
 */

import { existsSync } from 'node:fs';
import path from 'node:path';

import type { CliOptions } from '../types.js';
import { bold, logInfo, logSuccess } from '../utils/banner.js';
import { exec } from '../utils/exec.js';

/**
 * Executes version bump using Lerna CLI (`lerna version`).
 *
 * @param root - Path to repository workspace root.
 * @param options - Configuration flags.
 */
export function runLernaVersion(root: string, options: CliOptions): void {
  const pm = existsSync(path.join(root, 'pnpm-lock.yaml'))
    ? 'pnpm exec'
    : 'npx';
  const args = [
    'version',
    options.bump || 'patch',
    '--yes',
    '--no-git-tag-version',
    '--no-push',
  ];

  if (options.conventionalCommits === true) {
    args.push('--conventional-commits');
  }

  if (options.isForceBump) {
    args.push('--force-publish');
  }

  const cmd = `${pm} lerna ${args.join(' ')}`;

  if (options.dryRun) {
    logInfo(`[DRY-RUN] Would execute Lerna version bump: ${bold(cmd)}`);
    return;
  }

  logInfo(`Executing Lerna version bump: ${bold(cmd)}`);
  exec(cmd, { cwd: root });
  logSuccess('Lerna version bump executed successfully');
}
