/**
 * @file src/engines/np.ts
 * Release engine adapter for the np npm publish tool.
 */

import { existsSync } from 'node:fs';
import path from 'node:path';

import type { CliOptions } from '../types.js';
import { bold, logInfo, logSuccess } from '../utils/banner.js';
import { runInherited } from '../utils/exec.js';

/**
 * Runs np with CLI options.
 *
 * @param root - Path to repository workspace root.
 * @param options - Configuration flags.
 */
export function runNp(root: string, options: CliOptions): void {
  const pm = existsSync(path.join(root, 'pnpm-lock.yaml'))
    ? 'pnpm exec'
    : 'npx';
  const args = [options.bump || 'patch', '--yolo'];

  if (options.dryRun) {
    args.push('--preview');
  }
  if (options.tag) {
    args.push(`--tag=${options.tag}`);
  }
  if (options.skipPublish) {
    args.push('--no-publish');
  }
  if (options.allowDirty) {
    args.push('--any-branch');
  }
  if (!options.otp) {
    args.push('--no-2fa');
  }

  const cmd = `${pm} np ${args.join(' ')}`;
  logInfo(`Executing np: ${bold(cmd)}`);
  runInherited(cmd, root);
  logSuccess('np executed successfully');
}
