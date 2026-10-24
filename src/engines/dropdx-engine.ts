/**
 * @file src/engines/dropdx-engine.ts
 * Default autonomous dropdx release engine for versioning, changelog, and publishing.
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
  cyan,
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
import {
  approveStagedPackage,
  extractStageId,
  fetchStagedPackageId,
  isInteractiveTty,
  isTwoFactorRequiredError,
  promptOtpInteractive,
} from '../utils/registry.js';
import { resolveTargetVersion } from '../utils/semver.js';

export interface PublishDependencies {
  execFn?: typeof exec;
  isInteractiveFn?: () => boolean;
  promptOtpFn?: (pkgName: string, version: string) => string;
}

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
    updateChangelog(
      pkg.directory,
      nextVer,
      options.summary,
      undefined,
      undefined,
      options.conventionalCommits
    );
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
 * Builds the direct publish CLI command string for a workspace package.
 *
 * @param pkg - Workspace package.
 * @param targetRegistry - Resolved registry URL.
 * @param options - CLI options.
 * @param rootDir - Workspace root directory.
 * @param isPnpm - Whether pnpm lockfile is present.
 * @returns Command string.
 */
export function buildPublishCommand(
  pkg: WorkspacePackage,
  targetRegistry: string,
  options: CliOptions,
  rootDir: string,
  isPnpm: boolean
): string {
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

  const pkgAccess =
    (pkg.publishConfig.access as 'public' | 'restricted' | undefined) ||
    options.access ||
    'public';

  publishCmdParts.push(
    `--registry ${targetRegistry}`,
    `--access ${pkgAccess}`,
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

  return publishCmdParts.join(' ');
}

/**
 * Builds the staged publish CLI command string (`npm stage publish` / `pnpm stage publish`)
 * for deferring 2FA proof-of-presence to `npm stage approve`.
 *
 * @param pkg - Workspace package.
 * @param targetRegistry - Resolved registry URL.
 * @param options - CLI options.
 * @param rootDir - Workspace root directory.
 * @param isPnpm - Whether to use pnpm stage publish.
 * @returns Command string.
 */
export function buildStagePublishCommand(
  pkg: WorkspacePackage,
  targetRegistry: string,
  options: CliOptions,
  rootDir: string,
  isPnpm: boolean
): string {
  const stageCmdParts: string[] = [];

  if (isPnpm) {
    stageCmdParts.push('pnpm');
    if (pkg.directory !== rootDir) {
      stageCmdParts.push(`--filter "${pkg.name}"`);
    }
    stageCmdParts.push('stage publish');
  } else {
    stageCmdParts.push('npm stage publish');
  }

  const pkgAccess =
    (pkg.publishConfig.access as 'public' | 'restricted' | undefined) ||
    options.access ||
    'public';

  stageCmdParts.push(
    `--registry ${targetRegistry}`,
    `--access ${pkgAccess}`,
    `--tag ${options.tag || 'latest'}`
  );

  if (isPnpm) {
    stageCmdParts.push('--no-git-checks');
  }
  if (options.provenance) {
    stageCmdParts.push('--provenance');
  }
  if (options.dryRun) {
    stageCmdParts.push('--dry-run');
  }

  return stageCmdParts.join(' ');
}

/**
 * Logs manual instructions for approving a staged package release with 2FA.
 *
 * @param pkgName - Package name.
 * @param stageId - Optional stage ID if known.
 * @param targetRegistry - Registry URL.
 */
function logManualStageApprovalInstructions(
  pkgName: string,
  stageId: string | undefined,
  targetRegistry: string
): void {
  const message = stageId
    ? `Staged release awaiting 2FA approval. Run: ${bold(cyan(`npm stage approve ${stageId} --registry ${targetRegistry}`))}`
    : `Staged release awaiting 2FA approval. List and approve via: ${bold(cyan(`npm stage list "${pkgName}" --registry ${targetRegistry}`))} && ${bold(cyan(`npm stage approve <stage-id> --registry ${targetRegistry}`))}`;
  logInfo(message);
}

/**
 * Stages a package version via `npm stage publish` (or `pnpm stage publish`) and,
 * if running in an interactive TTY or `--otp` is provided, approves the staged version.
 *
 * @param pkg - Workspace package.
 * @param targetVersion - Target version string.
 * @param targetRegistry - Resolved registry URL.
 * @param options - CLI options.
 * @param rootDir - Workspace root directory.
 * @param isPnpm - Whether pnpm lockfile exists.
 * @param deps - Injectable execution and prompt dependencies.
 * @returns PublishResult for the staged package.
 */
function stageAndApprovePackage(
  pkg: WorkspacePackage,
  targetVersion: string,
  targetRegistry: string,
  options: CliOptions,
  rootDir: string,
  isPnpm: boolean,
  deps: Required<PublishDependencies>
): PublishResult {
  const primaryStageCmd = buildStagePublishCommand(
    pkg,
    targetRegistry,
    options,
    rootDir,
    isPnpm
  );
  logInfo(
    `Staging ${bold(pkg.name)}@${bold(targetVersion)} on ${dim(targetRegistry)}...`
  );
  logInfo(`Command: ${dim(primaryStageCmd)}`);

  let stageOutput: string;
  try {
    stageOutput = deps.execFn(primaryStageCmd, { cwd: pkg.directory });
  } catch (stageError: unknown) {
    // If an older pnpm version does not support `pnpm stage publish`, fall back to `npm stage publish`
    if (isPnpm) {
      const npmFallbackCmd = buildStagePublishCommand(
        pkg,
        targetRegistry,
        options,
        rootDir,
        false
      );
      logInfo(`Fallback command: ${dim(npmFallbackCmd)}`);
      stageOutput = deps.execFn(npmFallbackCmd, { cwd: pkg.directory });
    } else {
      throw stageError;
    }
  }

  if (options.dryRun) {
    logSuccess(
      `[DRY-RUN] Simulated staging for ${bold(green(`${pkg.name}@${targetVersion}`))}`
    );
    return {
      name: pkg.name,
      version: targetVersion,
      success: true,
      staged: true,
      registry: targetRegistry,
    };
  }

  const stageId =
    extractStageId(stageOutput) ??
    fetchStagedPackageId(pkg.name, targetVersion, targetRegistry, deps.execFn);

  const stageIdNotice = stageId ? ` (stage ID: ${bold(stageId)})` : '';
  logSuccess(
    `Staged ${bold(green(`${pkg.name}@${targetVersion}`))}${stageIdNotice}`
  );

  // Determine if we can approve immediately via --otp or interactive TTY prompt
  let otpToUse = options.otp;
  if (!otpToUse && stageId && deps.isInteractiveFn()) {
    otpToUse = deps.promptOtpFn(pkg.name, targetVersion);
  }

  if (stageId && otpToUse) {
    logInfo(
      `Approving staged package ${bold(pkg.name)}@${bold(targetVersion)} (${dim(stageId)})...`
    );
    try {
      approveStagedPackage(
        stageId,
        targetRegistry,
        otpToUse,
        pkg.directory,
        deps.execFn
      );
      logSuccess(
        `Approved and published ${bold(green(`${pkg.name}@${targetVersion}`))}`
      );
      return {
        name: pkg.name,
        version: targetVersion,
        success: true,
        staged: true,
        approved: true,
        stageId,
        registry: targetRegistry,
      };
    } catch (approveError: unknown) {
      const err = approveError as Error;
      logWarn(
        `Could not auto-approve staged package ${pkg.name}@${targetVersion}: ${err.message}`
      );
      logManualStageApprovalInstructions(pkg.name, stageId, targetRegistry);
      return {
        name: pkg.name,
        version: targetVersion,
        success: true,
        staged: true,
        approved: false,
        stageId,
        registry: targetRegistry,
      };
    }
  }

  logManualStageApprovalInstructions(pkg.name, stageId, targetRegistry);
  return {
    name: pkg.name,
    version: targetVersion,
    success: true,
    staged: true,
    approved: false,
    stageId,
    registry: targetRegistry,
  };
}

/**
 * Publishes packages to their designated registries, with support for explicit staged
 * publishing (`--stage`) and automatic fallback to `npm stage publish` when 2FA/EOTP is required.
 *
 * @param packages - Publishable packages.
 * @param updatedVersionsMap - Name to new version map.
 * @param options - CLI options.
 * @param rootDir - Root directory.
 * @param customDeps - Optional injectable dependencies for testing.
 * @returns Publish results list.
 */
export function publishPackages(
  packages: WorkspacePackage[],
  updatedVersionsMap: Map<string, string>,
  options: CliOptions,
  rootDir: string,
  customDeps: PublishDependencies = {}
): PublishResult[] {
  const isPnpm = existsSync(path.join(rootDir, 'pnpm-lock.yaml'));
  const results: PublishResult[] = [];
  const deps: Required<PublishDependencies> = {
    execFn: customDeps.execFn ?? exec,
    isInteractiveFn: customDeps.isInteractiveFn ?? isInteractiveTty,
    promptOtpFn: customDeps.promptOtpFn ?? promptOtpInteractive,
  };

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
        registry: targetRegistry,
      });
      continue;
    }

    if (options.stage) {
      try {
        const stageResult = stageAndApprovePackage(
          pkg,
          targetVersion,
          targetRegistry,
          options,
          rootDir,
          isPnpm,
          deps
        );
        results.push(stageResult);
      } catch (error: unknown) {
        const err = error as Error;
        logError(
          `Failed to stage ${pkg.name}@${targetVersion}: ${err.message}`
        );
        results.push({
          name: pkg.name,
          version: targetVersion,
          success: false,
          staged: true,
          reason: err.message,
          registry: targetRegistry,
        });
        if (!options.dryRun) {
          logError('Halting remaining package publishing due to failure.');
          break;
        }
      }
      continue;
    }

    const publishCmd = buildPublishCommand(
      pkg,
      targetRegistry,
      options,
      rootDir,
      isPnpm
    );
    logInfo(`Command: ${dim(publishCmd)}`);

    try {
      deps.execFn(publishCmd, { cwd: pkg.directory });
      logSuccess(
        `Successfully published ${bold(green(`${pkg.name}@${targetVersion}`))}`
      );
      results.push({
        name: pkg.name,
        version: targetVersion,
        success: true,
        registry: targetRegistry,
      });
    } catch (error: unknown) {
      const err = error as Error;

      if (isTwoFactorRequiredError(err.message)) {
        logWarn(
          `Direct publish for ${bold(`${pkg.name}@${targetVersion}`)} requires Two-Factor Authentication (2FA/EOTP). Falling back to staged publishing (https://docs.npmjs.com/staged-publishing)...`
        );
        try {
          const stageResult = stageAndApprovePackage(
            pkg,
            targetVersion,
            targetRegistry,
            options,
            rootDir,
            isPnpm,
            deps
          );
          results.push(stageResult);
          continue;
        } catch (stageError: unknown) {
          const stageErr = stageError as Error;
          logError(
            `Staged publish fallback also failed for ${pkg.name}@${targetVersion}: ${stageErr.message}`
          );
          results.push({
            name: pkg.name,
            version: targetVersion,
            success: false,
            staged: true,
            reason: stageErr.message,
            registry: targetRegistry,
          });
          if (!options.dryRun) {
            logError('Halting remaining package publishing due to failure.');
            break;
          }
          continue;
        }
      }

      logError(
        `Failed to publish ${pkg.name}@${targetVersion}: ${err.message}`
      );
      results.push({
        name: pkg.name,
        version: targetVersion,
        success: false,
        reason: err.message,
        registry: targetRegistry,
      });

      if (!options.dryRun) {
        logError('Halting remaining package publishing due to failure.');
        break;
      }
    }
  }

  return results;
}
