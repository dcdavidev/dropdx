/**
 * @file test/conventional.test.js
 * Unit tests for Conventional and Non-Conventional Commits parsing, bump detection, and changelog formatting.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatConventionalChangelog } from '../dist/utils/changelog.js';
import {
  analyzeCommitsForBump,
  formatReleaseCommitMessage,
  parseConventionalCommit,
} from '../dist/utils/git.js';

describe('Conventional and Non-Conventional Commits handling', () => {
  it('correctly parses standard conventional commits and flags non-conventional commits', () => {
    const feat = parseConventionalCommit(
      'a1b2c3d',
      'feat(core): add registry resolver'
    );
    assert.equal(feat.type, 'feat');
    assert.equal(feat.scope, 'core');
    assert.equal(feat.isBreaking, false);
    assert.equal(feat.isConventional, true);
    assert.equal(feat.subject, 'add registry resolver');

    const fix = parseConventionalCommit(
      'b2c3d4e',
      'fix: resolve edge case in semver parser'
    );
    assert.equal(fix.type, 'fix');
    assert.equal(fix.scope, undefined);
    assert.equal(fix.isBreaking, false);
    assert.equal(fix.isConventional, true);

    const nonConv = parseConventionalCommit(
      'e5f6a7b',
      'Update README with new examples'
    );
    assert.equal(nonConv.type, 'other');
    assert.equal(nonConv.isConventional, false);
    assert.equal(nonConv.subject, 'Update README with new examples');

    const unknownPrefix = parseConventionalCommit(
      'f6a7b8c',
      'Note: this is not a conventional commit type'
    );
    assert.equal(unknownPrefix.type, 'other');
    assert.equal(unknownPrefix.isConventional, false);
  });

  it('detects breaking changes via exclamation mark or footer', () => {
    const bangBreaking = parseConventionalCommit(
      'c3d4e5f',
      'feat(api)!: remove deprecated methods'
    );
    assert.equal(bangBreaking.isBreaking, true);
    assert.equal(bangBreaking.isConventional, true);
    assert.equal(bangBreaking.type, 'feat');

    const footerBreaking = parseConventionalCommit(
      'd4e5f6a',
      'refactor: redesign config schema',
      'BREAKING CHANGE: old config format is no longer supported'
    );
    assert.equal(footerBreaking.isBreaking, true);
    assert.equal(footerBreaking.isConventional, true);
  });

  it('analyzes conventional vs non-conventional git history for version bumps', () => {
    const convCommits = [
      parseConventionalCommit('1111111', 'fix: handle edge case'),
      parseConventionalCommit('2222222', 'feat: add new command'),
    ];
    const convResult = analyzeCommitsForBump(convCommits, 'v0.1.0');
    assert.equal(convResult.isConventionalHistory, true);
    assert.equal(convResult.bump, 'minor');

    const nonConvCommits = [
      parseConventionalCommit('3333333', 'Add new feature to CLI'),
      parseConventionalCommit('4444444', 'Fix typo in docs'),
    ];
    const nonConvResult = analyzeCommitsForBump(nonConvCommits, 'v0.1.0');
    assert.equal(nonConvResult.isConventionalHistory, false);
    assert.equal(nonConvResult.bump, 'patch');
  });

  it('formats structured conventional changelog sections with emoji when conventional', () => {
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

  it('formats plain changelog list when history is non-conventional', () => {
    const commits = [
      parseConventionalCommit('aaaaaaa', 'Initial release setup'),
      parseConventionalCommit('bbbbbbb', 'Add unit tests for parser'),
    ];

    const changelog = formatConventionalChangelog(commits);
    assert.ok(!changelog.includes('### Other Changes'));
    assert.ok(changelog.includes('* Initial release setup (aaaaaaa)'));
    assert.ok(changelog.includes('* Add unit tests for parser (bbbbbbb)'));
  });

  it('formats release commit messages according to git history style', () => {
    assert.equal(
      formatReleaseCommitMessage('v1.2.0', true),
      'chore(release): bump to v1.2.0'
    );
    assert.equal(
      formatReleaseCommitMessage('v1.2.0', true, 'publish new minor'),
      'chore(release): publish new minor'
    );
    assert.equal(
      formatReleaseCommitMessage('v1.2.0', true, 'chore(release): v1.2.0'),
      'chore(release): v1.2.0'
    );
    assert.equal(formatReleaseCommitMessage('v1.2.0', false), 'Release v1.2.0');
    assert.equal(
      formatReleaseCommitMessage('v1.2.0', false, 'Custom release note'),
      'Custom release note'
    );
  });
});
