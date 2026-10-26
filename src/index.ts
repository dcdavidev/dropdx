/**
 * @file src/index.ts
 * Programmatic API for dropdx.
 */

export { cli, cli as run } from './cli.js';
export {
  CONFIG_SEARCH_PATHS,
  DEFAULT_CONFIG_PATH,
  DEFAULT_OPTIONS,
  loadConfigFile,
  parseArgs,
} from './config.js';
export {
  buildPublishCommand,
  buildStagePublishCommand,
  publishPackages,
} from './engines/dropdx-engine.js';
export { detectEngine, SUPPORTED_ENGINES } from './engines/index.js';
export { buildInitConfig, runInit, serializeConfig } from './init.js';
export * from './types.js';
export {
  formatConventionalChangelog,
  updateChangelog,
} from './utils/changelog.js';
export {
  parseConfigContent,
  parseJsoncConfig,
  parseTomlConfig,
  parseYamlConfig,
  stripJsonCommentsAndTrailingCommas,
} from './utils/config-parser.js';
export {
  analyzeCommitsForBump,
  CONVENTIONAL_COMMIT_TYPES,
  detectBumpFromCommits,
  formatReleaseCommitMessage,
  getConventionalCommits,
  getLatestTag,
  isConventionalCommitMessage,
  parseConventionalCommit,
} from './utils/git.js';
export { resolveRegistry } from './utils/npmrc.js';
export { findPackages, sortPackagesTopologically } from './utils/packages.js';
export {
  approveStagedPackage,
  checkNpmWhoami,
  extractStageId,
  fetchNpmRegistryInfo,
  fetchStagedPackageId,
  isInteractiveTty,
  isTwoFactorRequiredError,
  promptOtpInteractive,
} from './utils/registry.js';
export {
  bumpVersion,
  compareSemVer,
  isSemVerGreaterThan,
  parseSemVer,
  resolveTargetVersion,
} from './utils/semver.js';
export { getConfigVersionWarning, getDropdxVersion } from './utils/version.js';
