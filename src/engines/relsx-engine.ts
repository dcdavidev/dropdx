/**
 * @file src/engines/relsx-engine.ts
 * Default autonomous relsx release engine for versioning, changelog, and publishing.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type {
  CliOptions,
  NpmRegistryInfo,
  PublishResult,
  VersionBump,
  WorkspacePackage,
} from '../types.js';
import {
  bold,
  dim,
  green,
  logError,
  logInfo,
  logSuccess,
  logWarn,
} from '../utils/banner.js';
import { updateChangelog } from '../utils/changelog.js';
import { exec, runInherited } from '../utils/exec.js';
import { resolveRegistry } from '../utils/npmrc.js';
import { resolveTargetVersion } from '../utils/semver.js';

interface MutablePackageJson {
  version?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  [key: string]: unknown;
}

/**
 * Updates version in package.json and updates internal workspace references.
 *
 * @param packages - Discovered packages.
 * @param registryInfoMap - Registry info for packages.
 * @param options - CLI options.
 * @returns Bumps list.
 */
export function bumpPackages(
  packages: WorkspacePackage[],
  registryInfoMap: Map<string, NpmRegistryInfo>,
  options: CliOptions
): VersionBump[] {
  const versionBumps: VersionBump[] = [];
  const newVersionsMap = new Map<string, string>();

  for (const pkg of packages) {
    const regInfo = registryInfoMap.get(pkg.name);
    const regVersion = regInfo?.exists ? regInfo.latestVersion : undefined;

    let isExistingGitTag = false;
    try {
      isExistingGitTag = Boolean(
        exec(`git tag -l "v${pkg.version}"`, { cwd: pkg.directory })
      );
    } catch {
      // Non-fatal
    }

    const shouldForceBump = Boolean(
      isExistingGitTag || options.isForceBump || options.isExplicitBump
    );

    const { targetVersion, bumpNeeded } = resolveTargetVersion(
      pkg.version,
      regVersion,
      options.bump,
      shouldForceBump
    );

    versionBumps.push({
      name: pkg.name,
      oldVersion: pkg.version,
      newVersion: targetVersion,
      bumped: bumpNeeded || pkg.version !== targetVersion,
    });

    newVersionsMap.set(pkg.name, targetVersion);
  }

  // Apply bumps to package.json files
  const depTypes: Array<
    'dependencies' | 'devDependencies' | 'peerDependencies'
  > = ['dependencies', 'devDependencies', 'peerDependencies'];

  for (const pkg of packages) {
    const nextVer = newVersionsMap.get(pkg.name)!;
    const pkgJsonPath = path.join(pkg.directory, 'package.json');
    const raw = readFileSync(pkgJsonPath, 'utf8');
    const json = JSON.parse(raw) as MutablePackageJson;

    json.version = nextVer;

    // Update cross-package references in monorepos if any
    for (const depType of depTypes) {
      const depsMap = json[depType];
      if (!depsMap) continue;

      const entries = Object.entries(depsMap);
      for (const [depName, currentSpecifier] of entries) {
        if (
          !newVersionsMap.has(depName) ||
          currentSpecifier.startsWith('workspace:')
        ) {
          continue;
        }

        const depNewVer = newVersionsMap.get(depName)!;

        if (currentSpecifier.startsWith('^')) {
          depsMap[depName] = `^${depNewVer}`;
        } else if (currentSpecifier.startsWith('~')) {
          depsMap[depName] = `~${depNewVer}`;
        } else {
          depsMap[depName] = depNewVer;
        }
      }
    }

    if (options.dryRun) {
      continue;
    }

    writeFileSync(pkgJsonPath, `${JSON.stringify(json, null, 2)}\n`, 'utf8');
    updateChangelog(pkg.directory, nextVer, options.summary);
  }

  return versionBumps;
}

/**
 * Builds packages if build scripts are present.
 *
 * @param packages - Packages to build.
 * @param options - CLI options.
 * @param rootDir - Root directory.
 */
export function buildPackages(
  packages: WorkspacePackage[],
  options: CliOptions,
  rootDir: string
): void {
  if (options.skipBuild) {
    logWarn('Skipping build phase (--skip-build specified)');
    return;
  }

  const isPnpm = existsSync(path.join(rootDir, 'pnpm-lock.yaml'));
  const rootPkgPath = path.join(rootDir, 'package.json');
  const rootPkg = existsSync(rootPkgPath)
    ? (JSON.parse(readFileSync(rootPkgPath, 'utf8')) as MutablePackageJson)
    : {};

  if (rootPkg.scripts?.build) {
    logInfo(
      `Executing root build script: "${isPnpm ? 'pnpm' : 'npm'} run build"...`
    );
    runInherited(isPnpm ? 'pnpm run build' : 'npm run build', rootDir);
    logSuccess('Root build completed successfully');
  } else {
    // Check individual packages
    for (const pkg of packages) {
      if (!pkg.scripts?.build) {
        continue;
      }

      logInfo(`Building ${bold(pkg.name)}...`);
      runInherited(
        isPnpm ? `pnpm --filter "${pkg.name}" run build` : 'npm run build',
        pkg.directory
      );
    }
    logSuccess('Package builds completed');
  }
}

/**
 * Publishes packages to their designated registries.
 *
 * @param packages - Publishable packages.
 * @param updatedVersionsMap - Name to new version map.
 * @param options - CLI options.
 * @param rootDir - Root directory.
 * @returns Publish results list.
 */
export function publishPackages(
  packages: WorkspacePackage[],
  updatedVersionsMap: Map<string, string>,
  options: CliOptions,
  rootDir: string
): PublishResult[] {
  const isPnpm = existsSync(path.join(rootDir, 'pnpm-lock.yaml'));
  const results: PublishResult[] = [];

  for (const pkg of packages) {
    const targetVersion = updatedVersionsMap.get(pkg.name) || pkg.version;
    const targetRegistry = resolveRegistry(pkg.name, options, rootDir);

    logInfo(
      `Publishing ${bold(pkg.name)}@${bold(targetVersion)} to ${dim(targetRegistry)}...`
    );

    if (options.skipPublish) {
      logWarn(`Skipped publishing ${pkg.name} (--skip-publish specified)`);
      results.push({
        name: pkg.name,
        version: targetVersion,
        success: true,
        reason: 'skipped',
      });
      continue;
    }

    const publishCmdParts: string[] = [];

    if (isPnpm) {
      publishCmdParts.push('pnpm');
      if (pkg.directory !== rootDir) {
        publishCmdParts.push(`--filter "${pkg.name}"`);
      }
      publishCmdParts.push('publish');
    } else {
      publishCmdParts.push('npm publish');
    }

    publishCmdParts.push(
      `--registry ${targetRegistry}`,
      `--access ${options.access || 'public'}`,
      '--no-git-checks',
      `--tag ${options.tag || 'latest'}`
    );

    if (options.otp) {
      publishCmdParts.push(`--otp ${options.otp}`);
    }
    if (options.provenance) {
      publishCmdParts.push('--provenance');
    }
    if (options.dryRun) {
      publishCmdParts.push('--dry-run');
    }

    const publishCmd = publishCmdParts.join(' ');
    logInfo(`Command: ${dim(publishCmd)}`);

    try {
      exec(publishCmd, { stdio: 'inherit', cwd: pkg.directory });
      logSuccess(
        `Successfully published ${bold(green(`${pkg.name}@${targetVersion}`))}`
      );
      results.push({
        name: pkg.name,
        version: targetVersion,
        success: true,
      });
    } catch (error: unknown) {
      const err = error as Error;
      logError(
        `Failed to publish ${pkg.name}@${targetVersion}: ${err.message}`
      );
      results.push({
        name: pkg.name,
        version: targetVersion,
        success: false,
        reason: err.message,
      });

      if (!options.dryRun) {
        logError('Halting remaining package publishing due to failure.');
        break;
      }
    }
  }

  return results;
}
