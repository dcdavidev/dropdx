/**
 * @file src/index.ts
 * Programmatic API for relsx.
 */

export { cli, cli as run } from './cli.js';
export { DEFAULT_OPTIONS, parseArgs } from './config.js';
export { detectEngine } from './engines/index.js';
export * from './types.js';
export {
  formatConventionalChangelog,
  updateChangelog,
} from './utils/changelog.js';
export {
  detectBumpFromCommits,
  getConventionalCommits,
  getLatestTag,
  parseConventionalCommit,
} from './utils/git.js';
export { resolveRegistry } from './utils/npmrc.js';
export { findPackages, sortPackagesTopologically } from './utils/packages.js';
export { checkNpmWhoami, fetchNpmRegistryInfo } from './utils/registry.js';
export {
  bumpVersion,
  compareSemVer,
  isSemVerGreaterThan,
  parseSemVer,
  resolveTargetVersion,
} from './utils/semver.js';
