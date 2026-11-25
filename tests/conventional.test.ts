/**
 * @file tests/conventional.test.ts
 * Unit tests for Conventional and Non-Conventional Commits parsing, bump detection, and changelog formatting.
 */

import { describe, expect, it } from 'vitest';

import { formatConventionalChangelog } from '../src/utils/changelog.js';
import {
  analyzeCommitsForBump,
  formatReleaseCommitMessage,
  parseConventionalCommit,
} from '../src/utils/git.js';

describe('Conventional and Non-Conventional Commits handling', () => {
  it('correctly parses standard conventional commits and flags non-conventional commits', () => {
    const feat = parseConventionalCommit(
      'a1b2c3d',
      'feat(core): add registry resolver'
    );
    expect(feat.type).toBe('feat');
    expect(feat.scope).toBe('core');
    expect(feat.isBreaking).toBe(false);
    expect(feat.isConventional).toBe(true);
    expect(feat.subject).toBe('add registry resolver');

    const fix = parseConventionalCommit(
      'b2c3d4e',
      'fix: resolve edge case in semver parser'
    );
    expect(fix.type).toBe('fix');
    expect(fix.scope).toBe(undefined);
    expect(fix.isBreaking).toBe(false);
    expect(fix.isConventional).toBe(true);

    const nonConv = parseConventionalCommit(
      'e5f6a7b',
      'Update README with new examples'
    );
    expect(nonConv.type).toBe('other');
    expect(nonConv.isConventional).toBe(false);
    expect(nonConv.subject).toBe('Update README with new examples');

    const unknownPrefix = parseConventionalCommit(
      'f6a7b8c',
      'Note: this is not a conventional commit type'
    );
    expect(unknownPrefix.type).toBe('other');
    expect(unknownPrefix.isConventional).toBe(false);
  });

  it('detects breaking changes via exclamation mark or footer', () => {
    const bangBreaking = parseConventionalCommit(
      'c3d4e5f',
      'feat(api)!: remove deprecated methods'
    );
    expect(bangBreaking.isBreaking).toBe(true);
    expect(bangBreaking.isConventional).toBe(true);
    expect(bangBreaking.type).toBe('feat');

    const footerBreaking = parseConventionalCommit(
      'd4e5f6a',
      'refactor: redesign config schema',
      'BREAKING CHANGE: old config format is no longer supported'
    );
    expect(footerBreaking.isBreaking).toBe(true);
    expect(footerBreaking.isConventional).toBe(true);
  });

  it('analyzes conventional vs non-conventional git history for version bumps', () => {
    const convCommits = [
      parseConventionalCommit('1111111', 'fix: handle edge case'),
      parseConventionalCommit('2222222', 'feat: add new command'),
    ];
    const convResult = analyzeCommitsForBump(convCommits, 'v0.1.0');
    expect(convResult.isConventionalHistory).toBe(true);
    expect(convResult.bump).toBe('minor');

    const nonConvCommits = [
      parseConventionalCommit('3333333', 'Add new feature to CLI'),
      parseConventionalCommit('4444444', 'Fix typo in docs'),
    ];
    const nonConvResult = analyzeCommitsForBump(nonConvCommits, 'v0.1.0');
    expect(nonConvResult.isConventionalHistory).toBe(false);
    expect(nonConvResult.bump).toBe('patch');
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
    expect(changelog.includes('### 💥 Breaking Changes')).toBeTruthy();
    expect(changelog.includes('### ✨ Features')).toBeTruthy();
    expect(changelog.includes('### 🐛 Bug Fixes')).toBeTruthy();
    expect(changelog.includes('### ⚡ Performance Improvements')).toBeTruthy();
    expect(changelog.includes('**cli:** add dry run flag')).toBeTruthy();
    expect(changelog.includes('(1111111)')).toBeTruthy();
  });

  it('formats plain changelog list when history is non-conventional', () => {
    const commits = [
      parseConventionalCommit('aaaaaaa', 'Initial release setup'),
      parseConventionalCommit('bbbbbbb', 'Add unit tests for parser'),
    ];

    const changelog = formatConventionalChangelog(commits);
    expect(!changelog.includes('### Other Changes')).toBeTruthy();
    expect(
      changelog.includes('* Initial release setup (aaaaaaa)')
    ).toBeTruthy();
    expect(
      changelog.includes('* Add unit tests for parser (bbbbbbb)')
    ).toBeTruthy();
  });

  it('formats release commit messages according to git history style', () => {
    expect(formatReleaseCommitMessage('v1.2.0', true)).toBe(
      'chore(release): bump to v1.2.0'
    );
    expect(
      formatReleaseCommitMessage('v1.2.0', true, 'publish new minor')
    ).toBe('chore(release): publish new minor');
    expect(
      formatReleaseCommitMessage('v1.2.0', true, 'chore(release): v1.2.0')
    ).toBe('chore(release): v1.2.0');
    expect(formatReleaseCommitMessage('v1.2.0', false)).toBe('Release v1.2.0');
    expect(
      formatReleaseCommitMessage('v1.2.0', false, 'Custom release note')
    ).toBe('Custom release note');
  });
});
