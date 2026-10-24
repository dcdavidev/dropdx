/**
 * @file src/engines/semantic-release.ts
 * Release engine adapter for semantic-release.
 */

import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import type { CliOptions } from '../types.js';
import { bold, logInfo, logSuccess } from '../utils/banner.js';
import { runInherited } from '../utils/exec.js';

/**
 * Runs semantic-release with CLI options.
 *
 * @param root - Path to repository workspace root.
 * @param options - Configuration flags.
 */
export function runSemanticRelease(root: string, options: CliOptions): void {
  const pm = existsSync(path.join(root, 'pnpm-lock.yaml'))
    ? 'pnpm exec'
    : 'npx';
  const args: string[] = [];

  if (options.dryRun) {
    args.push('--dry-run');
  }

  if (!process.env.CI && !process.env.GITHUB_ACTIONS) {
    args.push('--no-ci');
  }

  const suffix = args.length > 0 ? ` ${args.join(' ')}` : '';
  const cmd = `${pm} semantic-release${suffix}`;
  logInfo(`Executing semantic-release: ${bold(cmd)}`);
  runInherited(cmd, root);
  logSuccess('semantic-release executed successfully');
}
