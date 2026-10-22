/**
 * @file test/semver.test.js
 * Unit tests for SemVer parsing, comparison, and resolution logic.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  bumpVersion,
  compareSemVer,
  isSemVerGreaterThan,
  parseSemVer,
  resolveTargetVersion,
} from '../dist/utils/semver.js';

describe('SemVer parser and comparison', () => {
  it('parses valid semantic version strings correctly', () => {
    assert.deepEqual(parseSemVer('1.2.3'), {
      major: 1,
      minor: 2,
      patch: 3,
      prerelease: [],
    });

    assert.deepEqual(parseSemVer('v2.0.1-alpha.2'), {
      major: 2,
      minor: 0,
      patch: 1,
      prerelease: ['alpha', 2],
    });

    assert.equal(parseSemVer('invalid-version'), null);
  });

  it('correctly compares semantic versions', () => {
    assert.equal(compareSemVer('1.0.0', '1.0.0'), 0);
    assert.equal(compareSemVer('1.0.1', '1.0.0'), 1);
    assert.equal(compareSemVer('1.0.0', '1.0.1'), -1);
    assert.equal(compareSemVer('2.0.0', '1.9.9'), 1);
    assert.equal(compareSemVer('1.1.0', '1.0.9'), 1);
    assert.equal(compareSemVer('1.0.0', '1.0.0-rc.1'), 1);
    assert.equal(compareSemVer('1.0.0-rc.2', '1.0.0-rc.1'), 1);

    assert.equal(isSemVerGreaterThan('1.0.1', '1.0.0'), true);
    assert.equal(isSemVerGreaterThan('1.0.0', '1.0.1'), false);
    assert.equal(isSemVerGreaterThan('1.0.0', '1.0.0'), false);
  });

  it('calculates bumped versions correctly', () => {
    assert.equal(bumpVersion('1.0.0', 'patch'), '1.0.1');
    assert.equal(bumpVersion('1.0.0', 'minor'), '1.1.0');
    assert.equal(bumpVersion('1.0.0', 'major'), '2.0.0');
    assert.equal(bumpVersion('1.0.0', 'prerelease'), '1.0.1-rc.0');
    assert.equal(bumpVersion('1.0.1-rc.0', 'prerelease'), '1.0.1-rc.1');
  });

  it('resolves target versions based on registry comparison', () => {
    // Package not on registry: keep local
    const newPkg = resolveTargetVersion('0.0.1', undefined, 'patch', false);
    assert.equal(newPkg.targetVersion, '0.0.1');
    assert.equal(newPkg.bumpNeeded, false);

    // Local <= registry: MUST bump from registry version
    const outdated = resolveTargetVersion('1.0.0', '1.0.0', 'patch', false);
    assert.equal(outdated.targetVersion, '1.0.1');
    assert.equal(outdated.bumpNeeded, true);

    const behind = resolveTargetVersion('0.9.0', '1.2.3', 'patch', false);
    assert.equal(behind.targetVersion, '1.2.4');
    assert.equal(behind.bumpNeeded, true);

    const behindMinor = resolveTargetVersion('0.9.0', '1.2.3', 'minor', false);
    assert.equal(behindMinor.targetVersion, '1.3.0');
    assert.equal(behindMinor.bumpNeeded, true);

    // Local > registry: local is ready
    const ahead = resolveTargetVersion('2.0.0', '1.9.0', 'patch', false);
    assert.equal(ahead.targetVersion, '2.0.0');
    assert.equal(ahead.bumpNeeded, false);

    // Local > registry but forced bump
    const forced = resolveTargetVersion('2.0.0', '1.9.0', 'patch', true);
    assert.equal(forced.targetVersion, '2.0.1');
    assert.equal(forced.bumpNeeded, true);
  });
});
