/**
 * @file test/conventional.test.js
 * Unit tests for Conventional Commits parsing and automated bump detection.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatConventionalChangelog } from '../dist/utils/changelog.js';
import { parseConventionalCommit } from '../dist/utils/git.js';

describe('Conventional Commits parsing and changelog', () => {
  it('correctly parses standard conventional commits', () => {
    const feat = parseConventionalCommit(
      'a1b2c3d',
      'feat(core): add registry resolver'
    );
    assert.equal(feat.type, 'feat');
    assert.equal(feat.scope, 'core');
    assert.equal(feat.isBreaking, false);
    assert.equal(feat.subject, 'add registry resolver');

    const fix = parseConventionalCommit(
      'b2c3d4e',
      'fix: resolve edge case in semver parser'
    );
    assert.equal(fix.type, 'fix');
    assert.equal(fix.scope, undefined);
    assert.equal(fix.isBreaking, false);
  });

  it('detects breaking changes via exclamation mark or footer', () => {
    const bangBreaking = parseConventionalCommit(
      'c3d4e5f',
      'feat(api)!: remove deprecated methods'
    );
    assert.equal(bangBreaking.isBreaking, true);
    assert.equal(bangBreaking.type, 'feat');

    const footerBreaking = parseConventionalCommit(
      'd4e5f6a',
      'refactor: redesign config schema',
      'BREAKING CHANGE: old config format is no longer supported'
    );
    assert.equal(footerBreaking.isBreaking, true);
  });

  it('formats structured conventional changelog sections with emoji', () => {
    const commits = [
      parseConventionalCommit('1111111', 'feat(cli): add dry run flag'),
      parseConventionalCommit(
        '2222222',
        'fix(npmrc): handle missing home directory'
      ),
      parseConventionalCommit('3333333', 'feat(auth)!: require token in CI'),
      parseConventionalCommit(
        '4444444',
        'perf(scan): speed up package discovery'
      ),
    ];

    const changelog = formatConventionalChangelog(commits);
    assert.ok(changelog.includes('### 💥 Breaking Changes'));
    assert.ok(changelog.includes('### ✨ Features'));
    assert.ok(changelog.includes('### 🐛 Bug Fixes'));
    assert.ok(changelog.includes('### ⚡ Performance Improvements'));
    assert.ok(changelog.includes('**cli:** add dry run flag'));
    assert.ok(changelog.includes('(1111111)'));
  });
});
