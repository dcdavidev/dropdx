/**
 * @file src/utils/semver.ts
 * SemVer 2.0.0 parser, comparator, and version bumper.
 */

import type { BumpType, SemVer, TargetVersionResult } from '../types.js';

/**
 * Parses a semantic version string into structured numeric and prerelease parts.
 *
 * @param version - Semantic version string (e.g. "1.2.3", "v2.0.0-rc.1").
 * @returns Parsed structure or null if invalid.
 */
export function parseSemVer(version: string): SemVer | null {
  if (!version || typeof version !== 'string') return null;

  const clean = version.trim().replace(/^v/, '');
  const semverRegex =
    /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/;
  const match = semverRegex.exec(clean);
  if (!match) return null;

  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  const prereleaseRaw = match[4];

  const prerelease: Array<string | number> = prereleaseRaw
    ? prereleaseRaw.split('.').map((part) => {
        const num = Number(part);
        return Number.isNaN(num) ? part : num;
      })
    : [];

  return { major, minor, patch, prerelease };
}

/**
 * Compares two semantic version strings according to SemVer 2.0.0 rules.
 *
 * @param a - First version string.
 * @param b - Second version string.
 * @returns 1 if a > b, -1 if a < b, 0 if equal.
 */
export function compareSemVer(a: string, b: string): number {
  const parsedA = parseSemVer(a);
  const parsedB = parseSemVer(b);

  if (!parsedA || !parsedB) {
    throw new Error(`Invalid SemVer comparison between "${a}" and "${b}"`);
  }

  if (parsedA.major !== parsedB.major) {
    return parsedA.major > parsedB.major ? 1 : -1;
  }
  if (parsedA.minor !== parsedB.minor) {
    return parsedA.minor > parsedB.minor ? 1 : -1;
  }
  if (parsedA.patch !== parsedB.patch) {
    return parsedA.patch > parsedB.patch ? 1 : -1;
  }

  // 1.0.0 > 1.0.0-alpha
  if (parsedA.prerelease.length === 0 && parsedB.prerelease.length > 0)
    return 1;
  if (parsedA.prerelease.length > 0 && parsedB.prerelease.length === 0)
    return -1;
  if (parsedA.prerelease.length === 0 && parsedB.prerelease.length === 0)
    return 0;

  const minLen = Math.min(parsedA.prerelease.length, parsedB.prerelease.length);
  for (let i = 0; i < minLen; i++) {
    const idA = parsedA.prerelease[i];
    const idB = parsedB.prerelease[i];
    if (idA === idB) continue;

    const isNumA = typeof idA === 'number';
    const isNumB = typeof idB === 'number';
    if (isNumA && !isNumB) return -1;
    if (!isNumA && isNumB) return 1;
    return idA > idB ? 1 : -1;
  }

  if (parsedA.prerelease.length !== parsedB.prerelease.length) {
    return parsedA.prerelease.length > parsedB.prerelease.length ? 1 : -1;
  }

  return 0;
}

/**
 * Checks whether version a is strictly greater than version b.
 *
 * @param a - Prospective version.
 * @param b - Baseline comparison version.
 * @returns True if a > b.
 */
export function isSemVerGreaterThan(a: string, b: string): boolean {
  return compareSemVer(a, b) > 0;
}

/**
 * Calculates the next version string based on bump type.
 *
 * @param currentVersion - Base version string.
 * @param bumpType - Type of bump (major, minor, prerelease, patch).
 * @param preid - Prerelease tag identifier.
 * @returns Bumped version string.
 */
export function bumpVersion(
  currentVersion: string,
  bumpType: BumpType = 'patch',
  preid = 'rc'
): string {
  const parsed = parseSemVer(currentVersion) || {
    major: 0,
    minor: 0,
    patch: 0,
    prerelease: [],
  };

  let { major, minor, patch } = parsed;

  if (bumpType === 'major') {
    major += 1;
    minor = 0;
    patch = 0;
    return `${major}.${minor}.${patch}`;
  }

  if (bumpType === 'minor') {
    minor += 1;
    patch = 0;
    return `${major}.${minor}.${patch}`;
  }

  if (bumpType === 'prerelease') {
    if (parsed.prerelease.length > 0) {
      const lastPart = parsed.prerelease.at(-1);
      if (typeof lastPart === 'number') {
        const nextPrerelease = [
          ...parsed.prerelease.slice(0, -1),
          lastPart + 1,
        ];
        return `${major}.${minor}.${patch}-${nextPrerelease.join('.')}`;
      }
    }
    patch += 1;
    return `${major}.${minor}.${patch}-${preid}.0`;
  }

  patch += 1;
  return `${major}.${minor}.${patch}`;
}

/**
 * Resolves the target version to publish, ensuring it is strictly greater than the registry version.
 *
 * @param localVersion - Local package.json version.
 * @param registryVersion - Version on the registry (if published).
 * @param bumpType - Desired bump type.
 * @param isForceBump - If true, bumps even if localVersion > registryVersion.
 * @returns Version decision object.
 */
export function resolveTargetVersion(
  localVersion: string,
  registryVersion: string | undefined,
  bumpType: BumpType = 'patch',
  isForceBump = false
): TargetVersionResult {
  if (!registryVersion) {
    if (isForceBump) {
      const bumped = bumpVersion(localVersion, bumpType);
      return {
        targetVersion: bumped,
        bumpNeeded: true,
        reason: 'forced bump on new/unpublished package',
      };
    }
    return {
      targetVersion: localVersion,
      bumpNeeded: false,
      reason: 'new package not yet on registry',
    };
  }

  const comparison = compareSemVer(localVersion, registryVersion);

  if (comparison <= 0) {
    // Local version is <= registry version. Must bump from registry version!
    const targetVersion = bumpVersion(registryVersion, bumpType);
    return {
      targetVersion,
      bumpNeeded: true,
      reason: `local v${localVersion} <= registry v${registryVersion}`,
    };
  }

  // Local version is already > registry version.
  if (isForceBump) {
    const targetVersion = bumpVersion(localVersion, bumpType);
    return {
      targetVersion,
      bumpNeeded: true,
      reason: `forced bump above local v${localVersion}`,
    };
  }

  return {
    targetVersion: localVersion,
    bumpNeeded: false,
    reason: `local v${localVersion} > registry v${registryVersion}`,
  };
}
