/**
 * @file src/engines/index.ts
 * Release engine discovery and dispatch (Changesets, Release-It, or Built-in).
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import type { CliOptions, EngineType, WorkspacePackage } from '../types.js';

/**
 * Detects whether Changesets, Release-It, or the built-in dropdx engine should be used.
 *
 * @param rootDir - Path to repository workspace root.
 * @param packages - Discovered packages list.
 * @param options - Configuration flags.
 * @returns Selected engine mode name.
 */
export function detectEngine(
  rootDir: string,
  packages: WorkspacePackage[],
  options: Partial<CliOptions> = {}
): EngineType {
  if (
    options.engine &&
    options.engine !== 'auto' &&
    ['changeset', 'release-it', 'internal'].includes(options.engine)
  ) {
    return options.engine;
  }

  // 1. Check for Changesets
  const changesetConfig = path.join(rootDir, '.changeset', 'config.json');
  if (existsSync(changesetConfig)) {
    return 'changeset';
  }

  const allPackagesWithRoot: Array<{
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    'release-it'?: unknown;
  }> = [...packages];

  const rootPkgPath = path.join(rootDir, 'package.json');
  if (existsSync(rootPkgPath)) {
    try {
      const rootPkg = JSON.parse(readFileSync(rootPkgPath, 'utf8')) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
        'release-it'?: unknown;
      };
      allPackagesWithRoot.push(rootPkg);
    } catch {
      // Ignore read errors
    }
  }

  for (const pkg of allPackagesWithRoot) {
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (deps['@changesets/cli']) {
      return 'changeset';
    }
  }

  // 2. Check for Release-It
  const releaseItConfigFiles = [
    '.release-it.json',
    '.release-it.js',
    '.release-it.cjs',
    '.release-it.yaml',
    '.release-it.yml',
    '.release-it.toml',
  ];

  for (const file of releaseItConfigFiles) {
    if (existsSync(path.join(rootDir, file))) {
      return 'release-it';
    }
  }

  for (const pkg of allPackagesWithRoot) {
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (deps['release-it'] || pkg['release-it']) {
      return 'release-it';
    }
  }

  // 3. Fallback to built-in autonomous engine
  return 'internal';
}
