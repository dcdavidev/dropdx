/**
 * @file tests/semver.test.ts
 * Unit tests for SemVer parsing, comparison, and resolution logic.
 */

import { describe, expect, it } from 'vitest';

import {
  bumpVersion,
  compareSemVer,
  isSemVerGreaterThan,
  parseSemVer,
  resolveTargetVersion,
} from '../src/utils/semver.js';

describe('SemVer parser and comparison', () => {
  it('parses valid semantic version strings correctly', () => {
    expect(parseSemVer('1.2.3')).toStrictEqual({
      major: 1,
      minor: 2,
      patch: 3,
      prerelease: [],
    });

    expect(parseSemVer('v2.0.1-alpha.2')).toStrictEqual({
      major: 2,
      minor: 0,
      patch: 1,
      prerelease: ['alpha', 2],
    });

    expect(parseSemVer('invalid-version')).toBe(null);
  });

  it('correctly compares semantic versions', () => {
    expect(compareSemVer('1.0.0', '1.0.0')).toBe(0);
    expect(compareSemVer('1.0.1', '1.0.0')).toBe(1);
    expect(compareSemVer('1.0.0', '1.0.1')).toBe(-1);
    expect(compareSemVer('2.0.0', '1.9.9')).toBe(1);
    expect(compareSemVer('1.1.0', '1.0.9')).toBe(1);
    expect(compareSemVer('1.0.0', '1.0.0-rc.1')).toBe(1);
    expect(compareSemVer('1.0.0-rc.2', '1.0.0-rc.1')).toBe(1);

    expect(isSemVerGreaterThan('1.0.1', '1.0.0')).toBe(true);
    expect(isSemVerGreaterThan('1.0.0', '1.0.1')).toBe(false);
    expect(isSemVerGreaterThan('1.0.0', '1.0.0')).toBe(false);
  });

  it('calculates bumped versions correctly', () => {
    expect(bumpVersion('1.0.0', 'patch')).toBe('1.0.1');
    expect(bumpVersion('1.0.0', 'minor')).toBe('1.1.0');
    expect(bumpVersion('1.0.0', 'major')).toBe('2.0.0');
    expect(bumpVersion('1.0.0', 'prerelease')).toBe('1.0.1-rc.0');
    expect(bumpVersion('1.0.1-rc.0', 'prerelease')).toBe('1.0.1-rc.1');
  });

  it.each([
    ['2.0.0-rc.1', 'patch', '2.0.0'],
    ['2.0.0-rc.1', 'minor', '2.0.0'],
    ['2.0.0-rc.1', 'major', '2.0.0'],
    ['1.2.0-rc.1', 'minor', '1.2.0'],
    ['1.0.1-rc.1', 'patch', '1.0.1'],
  ] as const)(
    'graduates %s with a %s bump to %s',
    (currentVersion, bumpType, expectedVersion) => {
      expect(bumpVersion(currentVersion, bumpType)).toBe(expectedVersion);
    }
  );

  it('starts a new prerelease identifier without incrementing the patch', () => {
    expect(bumpVersion('1.0.0-rc', 'prerelease')).toBe('1.0.0-rc.0');
    expect(bumpVersion('1.0.0-beta', 'prerelease')).toBe('1.0.0-rc.0');
  });

  it('throws for invalid SemVer input', () => {
    expect(() => bumpVersion('v1.2', 'patch')).toThrow(/Invalid SemVer/);
  });

  it('resolves target versions based on registry comparison', () => {
    // Package not on registry: keep local
    const newPkg = resolveTargetVersion('0.0.1', undefined, 'patch', false);
    expect(newPkg.targetVersion).toBe('0.0.1');
    expect(newPkg.bumpNeeded).toBe(false);

    // Local <= registry: MUST bump from registry version
    const outdated = resolveTargetVersion('1.0.0', '1.0.0', 'patch', false);
    expect(outdated.targetVersion).toBe('1.0.1');
    expect(outdated.bumpNeeded).toBe(true);

    const behind = resolveTargetVersion('0.9.0', '1.2.3', 'patch', false);
    expect(behind.targetVersion).toBe('1.2.4');
    expect(behind.bumpNeeded).toBe(true);

    const behindMinor = resolveTargetVersion('0.9.0', '1.2.3', 'minor', false);
    expect(behindMinor.targetVersion).toBe('1.3.0');
    expect(behindMinor.bumpNeeded).toBe(true);

    // Local > registry: local is ready
    const ahead = resolveTargetVersion('2.0.0', '1.9.0', 'patch', false);
    expect(ahead.targetVersion).toBe('2.0.0');
    expect(ahead.bumpNeeded).toBe(false);

    // Local > registry but forced bump
    const forced = resolveTargetVersion('2.0.0', '1.9.0', 'patch', true);
    expect(forced.targetVersion).toBe('2.0.1');
    expect(forced.bumpNeeded).toBe(true);

    const prerelease = resolveTargetVersion(
      '2.0.0-rc.1',
      '2.0.0-rc.1',
      'patch'
    );
    expect(prerelease.targetVersion).toBe('2.0.0');
    expect(prerelease.bumpNeeded).toBe(true);
  });
});
