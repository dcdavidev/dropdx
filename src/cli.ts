/**
 * @file src/cli.ts
 * CLI orchestrator for dropdx automated release pipeline.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { parseArgs } from './config.js';
import { runBumppVersion } from './engines/bumpp.js';
import { runChangesetVersion } from './engines/changeset.js';
import {
  buildPackages,
  bumpPackages,
  publishPackages,
} from './engines/dropdx-engine.js';
import { detectEngine } from './engines/index.js';
import { runLernaVersion } from './engines/lerna.js';
import { runNp } from './engines/np.js';
import { runReleaseIt } from './engines/release-it.js';
import { runSemanticRelease } from './engines/semantic-release.js';
import { runStandardVersion } from './engines/standard-version.js';
import type {
  CliOptions,
  EngineType,
  GitEnvironmentInfo,
  NpmRegistryInfo,
  VersionBump,
  WorkspacePackage,
} from './types.js';
import {
  bold,
  cyan,
  dim,
  green,
  logBanner,
  logError,
  logInfo,
  logStep,
  logSuccess,
  logTable,
  logWarn,
  printHelp,
  purple,
  yellow,
} from './utils/banner.js';
import {
  checkGitEnvironment,
  commitChanges,
  createTag,
  detectBumpFromCommits,
  formatReleaseCommitMessage,
  pushGit,
} from './utils/git.js';
import { resolveRegistry } from './utils/npmrc.js';
import { findPackages, sortPackagesTopologically } from './utils/packages.js';
import { checkNpmWhoami, fetchNpmRegistryInfo } from './utils/registry.js';
import { isSemVerGreaterThan } from './utils/semver.js';

/**
 * Returns package.json version of dropdx itself.
 *
 * @returns Version string.
 */
function getDropdxVersion(): string {
  try {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const pkgPath = path.join(__dirname, '..', 'package.json');
    const json = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
      version?: string;
    };
    return json.version || '0.0.1';
  } catch {
    return '0.0.1';
  }
}

/**
 * Verifies whether the authenticated user has maintainer access.
 *
 * @param regInfo - Registry metadata.
 * @param npmUser - Current npm username.
 * @returns True if user is owner or package is new.
 */
function hasOwnershipAccess(
  regInfo: NpmRegistryInfo,
  npmUser: string
): boolean {
  if (!regInfo.exists || regInfo.maintainers.length === 0) {
    return true;
  }
  const user = npmUser.toLowerCase();
  return regInfo.maintainers.includes(user);
}

/**
 * Executes a full-lifecycle delegated release engine (`release-it`, `semantic-release`, `np`)
 * if selected, and returns `true` when the pipeline has been delegated.
 *
 * @param engine - Selected release engine.
 * @param rootDir - Workspace root directory.
 * @param options - CLI options.
 * @returns True if delegated and completed.
 */
function didRunDelegatedEngine(
  engine: Exclude<EngineType, 'auto'>,
  rootDir: string,
  options: CliOptions
): boolean {
  const runners: Partial<
    Record<
      Exclude<EngineType, 'auto'>,
      (root: string, opts: CliOptions) => void
    >
  > = {
    'release-it': runReleaseIt,
    'semantic-release': runSemanticRelease,
    np: runNp,
  };

  const runner = runners[engine];
  if (!runner) {
    return false;
  }

  logInfo(`Delegating release workflow to ${engine}...`);
  try {
    runner(rootDir, options);
    logSuccess(`Release workflow handled by ${engine} finished.`);
    return true;
  } catch (error: unknown) {
    const err = error as Error;
    logError(`${engine} failed: ${err.message}`);
    process.exit(1);
  }
}

/**
 * Executes the version bumping and changelog phase using the selected engine
 * (`changeset`, `lerna`, `bumpp`, `standard-version`, or `internal`).
 *
 * @param engine - Selected release engine.
 * @param rootDir - Workspace root directory.
 * @param publishablePackages - Publishable workspace packages.
 * @param initialRegistryInfo - Registry metadata map.
 * @param options - CLI options.
 * @returns Version bumps list and updated version map.
 */
function executeVersionBumpPhase(
  engine: Exclude<EngineType, 'auto'>,
  rootDir: string,
  publishablePackages: WorkspacePackage[],
  initialRegistryInfo: Map<string, NpmRegistryInfo>,
  options: CliOptions
): {
  versionBumps: VersionBump[];
  updatedVersionsMap: Map<string, string>;
} {
  if (engine === 'internal') {
    const versionBumps = bumpPackages(
      publishablePackages,
      initialRegistryInfo,
      options
    );
    const updatedVersionsMap = new Map(
      versionBumps.map((b) => [b.name, b.newVersion])
    );
    return { versionBumps, updatedVersionsMap };
  }

  switch (engine) {
    case 'changeset': {
      runChangesetVersion(rootDir, publishablePackages, options);
      break;
    }
    case 'lerna': {
      runLernaVersion(rootDir, options);
      break;
    }
    case 'bumpp': {
      runBumppVersion(rootDir, publishablePackages, options);
      break;
    }
    case 'standard-version': {
      runStandardVersion(rootDir, publishablePackages, options);
      break;
    }
    default: {
      break;
    }
  }

  if (options.dryRun) {
    const versionBumps = bumpPackages(
      publishablePackages,
      initialRegistryInfo,
      options
    );
    const updatedVersionsMap = new Map(
      versionBumps.map((b) => [b.name, b.newVersion])
    );
    return { versionBumps, updatedVersionsMap };
  }

  const reloaded = findPackages(rootDir).filter((p) => p.isPublishable);
  const updatedVersionsMap = new Map(reloaded.map((p) => [p.name, p.version]));
  const versionBumps: VersionBump[] = publishablePackages.map((pkg) => {
    const nextVer = updatedVersionsMap.get(pkg.name) || pkg.version;
    return {
      name: pkg.name,
      oldVersion: pkg.version,
      newVersion: nextVer,
      bumped: pkg.version !== nextVer,
    };
  });

  return { versionBumps, updatedVersionsMap };
}

/**
 * Executes the full dropdx release pipeline.
 *
 * @param argv - Process CLI arguments.
 */
export async function cli(
  argv: string[] = process.argv.slice(2)
): Promise<void> {
  const rootDir = process.cwd();
  const options = parseArgs(argv, rootDir);

  if (options.help) {
    printHelp();
    return;
  }

  if (options.version) {
    console.log(`dropdx v${getDropdxVersion()}`);
    return;
  }

  const totalSteps = 7;

  logBanner();

  if (options.dryRun) {
    console.log(
      `  ${yellow(bold('⚡ DRY-RUN MODE ACTIVE'))}: No changes will be pushed to git or published to npm.\n`
    );
  }

  // --------------------------------------------------------------------------
  // STEP 1: Pre-flight checks (Git & Node environment)
  // --------------------------------------------------------------------------
  logStep(1, totalSteps, 'Pre-flight Environment Validations', '🔍');

  const nodeVersion = process.versions.node;
  const majorNode = Number(nodeVersion.split('.', 1)[0]);
  if (majorNode < 20) {
    logError(`Node.js >= 20 is required. Current version: v${nodeVersion}`);
    process.exit(1);
  }
  logSuccess(`Node.js environment check passed: v${nodeVersion}`);
  if (options.configPath) {
    logInfo(`Loaded configuration file: ${bold(cyan(options.configPath))}`);
  }

  let gitInfo: GitEnvironmentInfo;
  try {
    gitInfo = checkGitEnvironment(rootDir, options);
    logSuccess('Git working directory is clean');
    logInfo(`Current Git branch: ${bold(gitInfo.currentBranch)}`);
    if (gitInfo.remoteUrl) {
      logSuccess(`Git remote origin verified: ${dim(gitInfo.remoteUrl)}`);
    } else {
      logWarn('No remote "origin" detected. Git push steps will be skipped.');
    }
  } catch (error: unknown) {
    const err = error as Error;
    logError(err.message);
    process.exit(1);
  }

  // --------------------------------------------------------------------------
  // STEP 2: Registry & NPM Authentication Verification
  // --------------------------------------------------------------------------
  logStep(2, totalSteps, 'Registry & Authentication Verification', '🔐');

  const defaultRegistry = resolveRegistry('', options, rootDir);
  logInfo(`Resolved target registry: ${bold(cyan(defaultRegistry))}`);

  let npmUser = '';
  try {
    npmUser = checkNpmWhoami(defaultRegistry);
    logSuccess(`Authenticated on registry as user: ${bold(green(npmUser))}`);
  } catch (error: unknown) {
    const err = error as Error;
    logError(`Registry authentication check failed: ${err.message}`);
    process.exit(1);
  }

  const allPackages = findPackages(rootDir);
  const publishablePackages = sortPackagesTopologically(
    allPackages.filter((p) => p.isPublishable)
  );

  if (publishablePackages.length === 0) {
    logError(
      'No publishable packages found! Ensure packages have "private": false or "publishConfig": { "access": "public" }.'
    );
    process.exit(1);
  }

  logInfo(
    `Found ${bold(String(publishablePackages.length))} publishable package(s):`
  );
  for (const pkg of publishablePackages) {
    console.log(
      `    ${dim('•')} ${bold(pkg.name)} ${dim(`(${pkg.relativeDir})`)} - current v${pkg.version}`
    );
  }

  // --------------------------------------------------------------------------
  // STEP 3: Engine Selection (Changeset / Release-It / Built-in)
  // --------------------------------------------------------------------------
  logStep(3, totalSteps, 'Release Engine Selection', '⚙️');

  const engine = detectEngine(rootDir, publishablePackages, options);
  const engineName = purple(engine.toUpperCase());
  logInfo(`Selected release engine: ${bold(engineName)}`);

  if (didRunDelegatedEngine(engine, rootDir, options)) {
    return;
  }

  // --------------------------------------------------------------------------
  // STEP 4: Version Bump & Registry Comparison
  // --------------------------------------------------------------------------
  logStep(4, totalSteps, 'Version Resolution & Registry Inspection', '📦');

  const detectedHistory = detectBumpFromCommits(rootDir, options);
  const historyLabel = detectedHistory.isConventionalHistory
    ? 'Conventional Commits history'
    : 'Non-conventional git history';

  if (options.isExplicitBump) {
    const bumpName = options.bump.toUpperCase();
    const formattedBump = bold(purple(bumpName));
    logInfo(`${historyLabel}: using explicit ${formattedBump} bump override`);
  } else {
    options.bump = detectedHistory.bump;
    const bumpName = detectedHistory.bump.toUpperCase();
    const formattedBump = bold(purple(bumpName));
    logInfo(
      `${historyLabel}: auto-detected ${formattedBump} bump (${dim(detectedHistory.reason)})`
    );
  }

  const initialRegistryInfo = new Map<string, NpmRegistryInfo>();
  for (const pkg of publishablePackages) {
    const pkgRegistry = resolveRegistry(pkg.name, options, rootDir);
    logInfo(`Checking ${bold(pkg.name)} on ${dim(pkgRegistry)}...`);
    const regInfo = await fetchNpmRegistryInfo(pkg.name, pkgRegistry);
    initialRegistryInfo.set(pkg.name, regInfo);

    if (regInfo.exists) {
      const isOwner = hasOwnershipAccess(regInfo, npmUser);
      if (isOwner) {
        logSuccess(
          `${bold(pkg.name)}: Verified owner permissions for ${green(npmUser)} (registry v${regInfo.latestVersion})`
        );
      } else {
        logWarn(
          `User "${npmUser}" is not in the maintainer list for "${pkg.name}" (${regInfo.maintainers.join(', ')}). Publication might require permissions.`
        );
      }
    } else {
      logInfo(
        `${bold(pkg.name)}: Package not found on registry ${cyan('(First release)')}`
      );
    }
  }

  const { versionBumps, updatedVersionsMap } = executeVersionBumpPhase(
    engine,
    rootDir,
    publishablePackages,
    initialRegistryInfo,
    options
  );

  logSuccess('Version calculation complete:');
  for (const bump of versionBumps) {
    const arrow = bump.bumped ? '➜' : '=';
    console.log(
      `    ${dim('•')} ${bold(bump.name)}: ${dim(`v${bump.oldVersion}`)} ${arrow} ${bold(green(`v${bump.newVersion}`))}`
    );
  }

  // Validate that every bumped version is strictly greater than registry version
  let isComparisonFailed = false;
  for (const bump of versionBumps) {
    const regInfo = initialRegistryInfo.get(bump.name);
    if (!regInfo?.exists || !regInfo.latestVersion) {
      continue;
    }

    const isGreater = isSemVerGreaterThan(
      bump.newVersion,
      regInfo.latestVersion
    );
    if (isGreater) {
      logSuccess(
        `${bold(bump.name)}: target v${bump.newVersion} > registry v${regInfo.latestVersion} ${green('(valid)')}`
      );
    } else {
      logError(
        `Version check failed for "${bump.name}": target v${bump.newVersion} is NOT greater than registry v${regInfo.latestVersion}!`
      );
      isComparisonFailed = true;
    }
  }

  if (isComparisonFailed) {
    logError(
      'Aborting release: all versions to publish must be strictly greater than registry versions.'
    );
    process.exit(1);
  }

  // --------------------------------------------------------------------------
  // STEP 5: Build Packages
  // --------------------------------------------------------------------------
  logStep(5, totalSteps, 'Building Packages', '🏗️');
  buildPackages(publishablePackages, options, rootDir);

  // --------------------------------------------------------------------------
  // STEP 6: Git Commit, Tag & Remote Push
  // --------------------------------------------------------------------------
  logStep(6, totalSteps, 'Git Commit, Tag & Push', '🏷️');

  const primaryVersion = versionBumps[0]?.newVersion || '0.0.1';
  const gitTagName = `v${primaryVersion}`;
  const commitMsg = formatReleaseCommitMessage(
    gitTagName,
    detectedHistory.isConventionalHistory,
    options.summary
  );

  if (options.skipGit) {
    logWarn('Skipping git commit, tag, and push (--skip-git specified)');
  } else if (!gitInfo.remoteUrl) {
    logWarn('No remote origin configured; skipping git push');
  } else if (options.dryRun) {
    logInfo(`[DRY-RUN] Would commit: ${bold(commitMsg)}`);
    logInfo(`[DRY-RUN] Would create tag: ${bold(gitTagName)}`);
    logInfo(`[DRY-RUN] Would push to origin/${gitInfo.currentBranch} and tags`);
  } else {
    logInfo(`Creating git commit: "${commitMsg}"...`);
    commitChanges(commitMsg, options, rootDir);
    logSuccess('Git commit created');

    logInfo(`Creating annotated tag: "${gitTagName}"...`);
    createTag(gitTagName, `Release ${gitTagName}`, options, rootDir);
    logSuccess(`Git tag "${gitTagName}" created`);

    logInfo(
      `Pushing commit and tag "${gitTagName}" to origin/${gitInfo.currentBranch}...`
    );
    try {
      pushGit(gitInfo.currentBranch, gitTagName, options, rootDir);
      logSuccess(
        `Pushed commit and tag "${gitTagName}" to origin/${gitInfo.currentBranch}`
      );
    } catch (error: unknown) {
      const err = error as Error;
      logError(`Failed to push to remote git: ${err.message}`);
      process.exit(1);
    }
  }

  // --------------------------------------------------------------------------
  // STEP 7: Publish Packages to Registry
  // --------------------------------------------------------------------------
  logStep(7, totalSteps, 'Publishing Packages to Registry', '🚀');

  const publishResults = publishPackages(
    publishablePackages,
    updatedVersionsMap,
    options,
    rootDir
  );

  // --------------------------------------------------------------------------
  // Summary Table
  // --------------------------------------------------------------------------
  logTable(publishResults, { ...options, tag: gitTagName });

  const allSucceeded = publishResults.every((r) => r.success);
  if (!allSucceeded) {
    process.exit(1);
  }
}
