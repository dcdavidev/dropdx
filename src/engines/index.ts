/**
 * @file src/engines/index.ts
 * Release engine discovery and dispatch (Changesets, Release-It, Semantic-Release,
 * Lerna, Bumpp, Standard-Version / Commit-and-Tag-Version, np, or Built-in).
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import type { CliOptions, EngineType, WorkspacePackage } from '../types.js';

/**
 * List of all supported release engines (excluding `auto`).
 */
export const SUPPORTED_ENGINES: readonly Exclude<EngineType, 'auto'>[] = [
  'changeset',
  'release-it',
  'semantic-release',
  'lerna',
  'bumpp',
  'standard-version',
  'np',
  'internal',
] as const;

interface InspectablePackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  'release-it'?: unknown;
  release?: unknown;
  'standard-version'?: unknown;
  np?: unknown;
}

const RELEASE_IT_CONFIG_FILES = [
  '.release-it.json',
  '.release-it.js',
  '.release-it.cjs',
  '.release-it.yaml',
  '.release-it.yml',
  '.release-it.toml',
];

const SEMANTIC_RELEASE_CONFIG_FILES = [
  '.releaserc',
  '.releaserc.json',
  '.releaserc.yaml',
  '.releaserc.yml',
  '.releaserc.js',
  '.releaserc.cjs',
  '.releaserc.mjs',
  'release.config.js',
  'release.config.cjs',
  'release.config.mjs',
];

const BUMPP_CONFIG_FILES = [
  'bump.config.ts',
  'bump.config.mts',
  'bump.config.cts',
  'bump.config.js',
  'bump.config.mjs',
  'bump.config.cjs',
  'bump.config.json',
];

const STANDARD_VERSION_CONFIG_FILES = [
  '.versionrc',
  '.versionrc.json',
  '.versionrc.js',
  '.versionrc.cjs',
];

const NP_CONFIG_FILES = [
  '.np-config.json',
  '.np-config.js',
  '.np-config.cjs',
  '.np-config.mjs',
];

/**
 * Checks whether any candidate file exists in `rootDir`.
 *
 * @param rootDir - Workspace root directory.
 * @param files - Candidate relative filenames.
 * @returns True if at least one file exists.
 */
function hasAnyConfigFile(rootDir: string, files: readonly string[]): boolean {
  return files.some((file) => existsSync(path.join(rootDir, file)));
}

/**
 * Checks whether any package has one of the specified dependency names or package.json keys.
 *
 * @param packages - Inspectable package manifests.
 * @param depNames - Dependency package names to check.
 * @param pkgJsonKeys - Optional top-level package.json config keys to check.
 * @returns True if matched.
 */
function hasPackageDependencyOrKey(
  packages: InspectablePackageJson[],
  depNames: readonly string[],
  pkgJsonKeys: readonly (keyof InspectablePackageJson)[] = []
): boolean {
  for (const pkg of packages) {
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (
      depNames.some((dep) => Object.hasOwn(deps, dep)) ||
      pkgJsonKeys.some((key) => Object.hasOwn(pkg, key))
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Collects all workspace packages plus the root `package.json` manifest.
 *
 * @param rootDir - Workspace root directory.
 * @param packages - Discovered workspace packages.
 * @returns Combined list of inspectable manifests.
 */
function collectAllManifests(
  rootDir: string,
  packages: WorkspacePackage[]
): InspectablePackageJson[] {
  const allPackagesWithRoot: InspectablePackageJson[] = [...packages];
  const rootPkgPath = path.join(rootDir, 'package.json');

  if (existsSync(rootPkgPath)) {
    try {
      const rootPkg = JSON.parse(
        readFileSync(rootPkgPath, 'utf8')
      ) as InspectablePackageJson;
      allPackagesWithRoot.push(rootPkg);
    } catch {
      // Ignore read errors
    }
  }

  return allPackagesWithRoot;
}

/**
 * Detects which release engine should be used based on explicit options,
 * configuration files, or installed dependencies.
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
): Exclude<EngineType, 'auto'> {
  if (
    options.engine &&
    options.engine !== 'auto' &&
    (SUPPORTED_ENGINES as readonly string[]).includes(options.engine)
  ) {
    return options.engine;
  }

  const allManifests = collectAllManifests(rootDir, packages);

  // 1. Changesets (@changesets/cli)
  if (
    hasAnyConfigFile(rootDir, ['.changeset/config.json']) ||
    hasPackageDependencyOrKey(allManifests, ['@changesets/cli'])
  ) {
    return 'changeset';
  }

  // 2. Release-It (release-it)
  if (
    hasAnyConfigFile(rootDir, RELEASE_IT_CONFIG_FILES) ||
    hasPackageDependencyOrKey(allManifests, ['release-it'], ['release-it'])
  ) {
    return 'release-it';
  }

  // 3. Semantic-Release (semantic-release)
  if (
    hasAnyConfigFile(rootDir, SEMANTIC_RELEASE_CONFIG_FILES) ||
    hasPackageDependencyOrKey(allManifests, ['semantic-release'], ['release'])
  ) {
    return 'semantic-release';
  }

  // 4. Lerna (lerna)
  if (
    hasAnyConfigFile(rootDir, ['lerna.json']) ||
    hasPackageDependencyOrKey(allManifests, ['lerna'])
  ) {
    return 'lerna';
  }

  // 5. Bumpp (bumpp)
  if (
    hasAnyConfigFile(rootDir, BUMPP_CONFIG_FILES) ||
    hasPackageDependencyOrKey(allManifests, ['bumpp'])
  ) {
    return 'bumpp';
  }

  // 6. Standard-Version / Commit-and-Tag-Version
  if (
    hasAnyConfigFile(rootDir, STANDARD_VERSION_CONFIG_FILES) ||
    hasPackageDependencyOrKey(
      allManifests,
      ['commit-and-tag-version', 'standard-version'],
      ['standard-version']
    )
  ) {
    return 'standard-version';
  }

  // 7. np (np) or 8. Fallback to built-in autonomous engine
  return hasAnyConfigFile(rootDir, NP_CONFIG_FILES) ||
    hasPackageDependencyOrKey(allManifests, ['np'], ['np'])
    ? 'np'
    : 'internal';
}
