/**
 * @file src/engines/standard-version.ts
 * Release engine adapter for commit-and-tag-version and standard-version.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import type { CliOptions, WorkspacePackage } from '../types.js';
import { bold, logInfo, logSuccess } from '../utils/banner.js';
import { exec } from '../utils/exec.js';

/**
 * Determines whether to invoke `commit-and-tag-version` or `standard-version`.
 *
 * @param root - Repository root directory.
 * @param packages - Workspace packages list.
 * @returns Binary name to execute.
 */
export function resolveStandardVersionBinary(
  root: string,
  packages: WorkspacePackage[]
): 'commit-and-tag-version' | 'standard-version' {
  const allPackages: Array<{
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  }> = [...packages];

  const rootPkgPath = path.join(root, 'package.json');
  if (existsSync(rootPkgPath)) {
    try {
      const rootPkg = JSON.parse(readFileSync(rootPkgPath, 'utf8')) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      allPackages.push(rootPkg);
    } catch {
      // Ignore read errors
    }
  }

  for (const pkg of allPackages) {
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (deps['commit-and-tag-version']) {
      return 'commit-and-tag-version';
    }
    if (deps['standard-version']) {
      return 'standard-version';
    }
  }

  return 'commit-and-tag-version';
}

/**
 * Executes version bump and changelog generation via commit-and-tag-version or standard-version.
 *
 * @param root - Path to repository workspace root.
 * @param packages - Workspace packages list.
 * @param options - Configuration flags.
 */
export function runStandardVersion(
  root: string,
  packages: WorkspacePackage[],
  options: CliOptions
): void {
  const pm = existsSync(path.join(root, 'pnpm-lock.yaml'))
    ? 'pnpm exec'
    : 'npx';
  const binary = resolveStandardVersionBinary(root, packages);
  const args = [
    `--release-as ${options.bump || 'patch'}`,
    '--skip.commit',
    '--skip.tag',
  ];

  const cmd = `${pm} ${binary} ${args.join(' ')}`;

  if (options.dryRun) {
    logInfo(`[DRY-RUN] Would execute ${binary}: ${bold(`${cmd} --dry-run`)}`);
    return;
  }

  logInfo(`Executing ${binary}: ${bold(cmd)}`);
  exec(cmd, { cwd: root });
  logSuccess(`${binary} version bump and changelog update completed`);
}
