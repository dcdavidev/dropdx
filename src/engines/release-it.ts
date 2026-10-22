/**
 * @file src/engines/release-it.ts
 * Release engine adapter for release-it.
 */

import { existsSync } from 'node:fs';
import path from 'node:path';

import type { CliOptions } from '../types.js';
import { bold, logInfo, logSuccess } from '../utils/banner.js';
import { runInherited } from '../utils/exec.js';

/**
 * Runs release-it with CLI options.
 *
 * @param root - Path to repository workspace root.
 * @param options - Configuration flags.
 */
export function runReleaseIt(root: string, options: CliOptions): void {
  const pm = existsSync(path.join(root, 'pnpm-lock.yaml'))
    ? 'pnpm exec'
    : 'npx';
  const args = [options.bump || 'patch', '--ci'];

  if (options.dryRun) {
    args.push('--dry-run');
  }
  if (options.tag) {
    args.push(`--npm.tag=${options.tag}`);
  }
  if (options.otp) {
    args.push(`--npm.otp=${options.otp}`);
  }
  if (options.allowDirty) {
    args.push('--git.requireCleanWorkingDir=false');
  }

  const cmd = `${pm} release-it ${args.join(' ')}`;
  logInfo(`Executing release-it: ${bold(cmd)}`);
  runInherited(cmd, root);
  logSuccess('release-it executed successfully');
}
