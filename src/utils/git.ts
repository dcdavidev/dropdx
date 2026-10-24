/**
 * @file src/utils/git.ts
 * Git validations, commit creation, annotated tagging, and remote pushing.
 */

import type {
  BumpDetectionResult,
  ConventionalCommit,
  GitEnvironmentInfo,
} from '../types.js';
import { bold, dim, yellow } from './colors.js';
import { exec } from './exec.js';

/**
 * Validates the Git environment, branch status, and working directory cleanliness.
 *
 * @param rootDir - Repository root directory path.
 * @param options - CLI options flags.
 * @param options.allowDirty - Allow uncommitted changes.
 * @returns Git status and remote metadata.
 */
export function checkGitEnvironment(
  rootDir: string,
  options: { allowDirty?: boolean } = {}
): GitEnvironmentInfo {
  try {
    exec('git rev-parse --is-inside-work-tree', { cwd: rootDir });
  } catch (error) {
    throw new Error(
      'Not inside a Git repository. dropdx must be executed at the repository root.',
      { cause: error }
    );
  }

  const gitStatus = exec('git status --porcelain', { cwd: rootDir });
  if (gitStatus.length > 0 && !options.allowDirty) {
    throw new Error(
      `Git working directory has uncommitted changes:\n${dim(gitStatus)}\n` +
        `  ${yellow('Fix:')} Commit or stash changes before releasing, or pass ${bold('--allow-dirty')}.`
    );
  }

  const currentBranch = exec('git rev-parse --abbrev-ref HEAD', {
    cwd: rootDir,
  });
  let remoteUrl = '';

  try {
    remoteUrl = exec('git remote get-url origin', { cwd: rootDir });
  } catch {
    // origin may not exist in some local-only setups
  }

  if (remoteUrl) {
    try {
      exec('git fetch origin', { cwd: rootDir });
      const behindCount = exec(
        `git rev-list --count HEAD..origin/${currentBranch} 2>/dev/null || echo 0`,
        { cwd: rootDir }
      );
      if (Number(behindCount) > 0) {
        throw new Error(
          `Local branch "${currentBranch}" is behind remote origin by ${behindCount} commit(s)!\n` +
            `  ${yellow('Fix:')} Run "git pull origin ${currentBranch}" before releasing.`
        );
      }
    } catch (error: unknown) {
      const err = error as Error;
      if (err.message.includes('is behind remote origin')) {
        throw error;
      }
      // Non-fatal if offline or remote branch not created yet
    }
  }

  return { currentBranch, remoteUrl };
}

/**
 * Stages changes and creates a Git commit.
 *
 * @param message - Descriptive commit message text.
 * @param options - Execution flags.
 * @param options.dryRun - Whether dry-run mode is active.
 * @param rootDir - Working directory for the git command.
 */
export function commitChanges(
  message: string,
  options: { dryRun?: boolean } = {},
  rootDir: string = process.cwd()
): void {
  if (options.dryRun) return;

  exec('git add .', { cwd: rootDir });
  const status = exec('git status --porcelain', { cwd: rootDir });
  if (!status.trim()) return;

  exec(`git commit -m "${message}"`, { cwd: rootDir });
}

/**
 * Creates an annotated Git tag.
 *
 * @param tagName - Name for the tag.
 * @param message - Annotation text for the tag.
 * @param options - Execution flags.
 * @param options.dryRun - Whether dry-run mode is active.
 * @param rootDir - Working directory for the git command.
 */
export function createTag(
  tagName: string,
  message: string,
  options: { dryRun?: boolean } = {},
  rootDir: string = process.cwd()
): void {
  const existingLocalTag = exec(`git tag -l "${tagName}"`, { cwd: rootDir });
  if (existingLocalTag) {
    throw new Error(`Git tag "${tagName}" already exists locally!`);
  }

  try {
    const existingRemoteTag = exec(
      `git ls-remote origin "refs/tags/${tagName}" 2>/dev/null || true`,
      { cwd: rootDir }
    );
    if (existingRemoteTag) {
      throw new Error(`Git tag "${tagName}" already exists on remote origin!`);
    }
  } catch {
    // Ignore remote check errors
  }

  if (options.dryRun) return;

  exec(`git tag -a "${tagName}" -m "${message}"`, { cwd: rootDir });
}

/**
 * Pushes commits and tags to remote origin.
 *
 * @param branch - Git branch name.
 * @param tagName - Git tag identifier.
 * @param options - Execution flags.
 * @param options.dryRun - Whether dry-run mode is active.
 * @param rootDir - Working directory for the git command.
 */
export function pushGit(
  branch: string,
  tagName: string,
  options: { dryRun?: boolean } = {},
  rootDir: string = process.cwd()
): void {
  if (options.dryRun) return;

  exec(`git push origin "${branch}"`, { cwd: rootDir });
  exec(`git push origin "${tagName}"`, { cwd: rootDir });
}

/**
 * Returns the most recent annotated or lightweight Git tag.
 *
 * @param rootDir - Working directory for the git command.
 * @returns Latest tag name, or null if no tags exist.
 */
export function getLatestTag(rootDir: string = process.cwd()): string | null {
  try {
    const tag = exec('git describe --tags --abbrev=0 2>/dev/null || true', {
      cwd: rootDir,
    });
    return tag ? tag.trim() : null;
  } catch {
    return null;
  }
}

/**
 * Recognized Conventional Commits v1.0.0 commit types.
 */
export const CONVENTIONAL_COMMIT_TYPES = new Set([
  'feat',
  'fix',
  'docs',
  'style',
  'refactor',
  'perf',
  'test',
  'build',
  'ci',
  'chore',
  'revert',
]);

/**
 * Parses a commit subject line and body according to Conventional Commits specification.
 *
 * @param hash - Commit short hash.
 * @param rawSubject - First line of the commit message.
 * @param body - Remainder of the commit message body.
 * @returns Parsed ConventionalCommit structure.
 */
export function parseConventionalCommit(
  hash: string,
  rawSubject: string,
  body = ''
): ConventionalCommit {
  const trimmedSubject = rawSubject.trim();
  const hasBreakingNotice =
    /BREAKING[- ]CHANGE:/i.test(body) ||
    /BREAKING[- ]CHANGE:/i.test(trimmedSubject);

  const match = /^([a-z]+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/.exec(trimmedSubject);
  if (!match || !CONVENTIONAL_COMMIT_TYPES.has(match[1])) {
    return {
      hash,
      type: 'other',
      isBreaking: hasBreakingNotice,
      isConventional: false,
      subject: trimmedSubject,
      body,
      rawSubject: trimmedSubject,
    };
  }

  const type = match[1];
  const scope = match[2] ? match[2].trim() : undefined;
  const isBangBreaking = Boolean(match[3]);
  const isBreaking = isBangBreaking || hasBreakingNotice;
  const subject = match[4].trim();

  return {
    hash,
    type,
    scope,
    isBreaking,
    isConventional: true,
    subject,
    body,
    rawSubject: trimmedSubject,
  };
}

/**
 * Checks whether a commit message string follows the Conventional Commits format.
 *
 * @param message - Commit message to test.
 * @returns True if message starts with a valid Conventional Commit header.
 */
export function isConventionalCommitMessage(message: string): boolean {
  if (!message || typeof message !== 'string') return false;
  const firstLine = message.trim().split('\n', 1)[0] || '';
  return parseConventionalCommit('', firstLine).isConventional;
}

/**
 * Formats a release commit message adapted to whether the repository uses Conventional Commits.
 *
 * @param tagName - Release tag (e.g. "v1.2.0").
 * @param isConventionalHistory - Whether the repository uses Conventional Commits.
 * @param summary - Optional user-supplied summary message.
 * @returns Formatted git commit message.
 */
export function formatReleaseCommitMessage(
  tagName: string,
  isConventionalHistory: boolean,
  summary?: string
): string {
  if (summary && summary.trim()) {
    const cleanSummary = summary.trim();
    return isConventionalHistory && !isConventionalCommitMessage(cleanSummary)
      ? `chore(release): ${cleanSummary}`
      : cleanSummary;
  }

  return isConventionalHistory
    ? `chore(release): bump to ${tagName}`
    : `Release ${tagName}`;
}

/**
 * Retrieves all commits since the specified Git tag.
 *
 * @param tag - Tag to compare against, or null for full history.
 * @param rootDir - Working directory for the git command.
 * @returns List of parsed commits.
 */
export function getConventionalCommits(
  tag: string | null = null,
  rootDir: string = process.cwd()
): ConventionalCommit[] {
  try {
    const range = tag ? `"${tag}..HEAD"` : 'HEAD';
    const raw = exec(
      `git log ${range} --pretty=format:"%h%x1f%s%x1f%b%x1e" 2>/dev/null || true`,
      { cwd: rootDir }
    );
    if (!raw.trim()) return [];

    const records = raw.split('\u{1E}');
    const commits: ConventionalCommit[] = [];

    for (const record of records) {
      if (!record.trim()) continue;
      const parts = record.split('\u{1F}', 3);
      const hash = parts[0] ? parts[0].trim() : '';
      const subject = parts[1] ? parts[1].trim() : '';
      const body = parts[2] ? parts[2].trim() : '';
      if (hash && subject) {
        commits.push(parseConventionalCommit(hash, subject, body));
      }
    }

    return commits;
  } catch {
    return [];
  }
}

/**
 * Analyzes a list of parsed commits to determine whether the history is conventional
 * and calculates the appropriate SemVer bump level.
 *
 * @param commits - Parsed commits since the previous tag.
 * @param latestTag - Previous git tag name, if any.
 * @param isFallbackConventional - Fallback when commits list is empty.
 * @returns Detected bump type, explanation, commit list, and conventional history flag.
 */
export function analyzeCommitsForBump(
  commits: ConventionalCommit[],
  latestTag: string | null = null,
  isFallbackConventional = false
): BumpDetectionResult {
  if (commits.length === 0) {
    return {
      bump: 'patch',
      reason:
        'No new git commits detected since previous tag; defaulting to patch',
      commits: [],
      isConventionalHistory: isFallbackConventional,
    };
  }

  const conventionalCommits = commits.filter((c) => c.isConventional);
  const isConventionalHistory = conventionalCommits.length > 0;

  if (!isConventionalHistory) {
    const breakingCommit = commits.find((c) => c.isBreaking);
    if (breakingCommit) {
      return {
        bump: 'major',
        reason: `Breaking change note in non-conventional commit ${breakingCommit.hash} ("${breakingCommit.rawSubject}")`,
        commits,
        isConventionalHistory: false,
      };
    }

    return {
      bump: 'patch',
      reason: `Non-conventional git history (${commits.length} commit(s) since ${latestTag ?? 'start'}); defaulting to patch`,
      commits,
      isConventionalHistory: false,
    };
  }

  // 1. Check for Breaking Changes (major)
  const breakingCommit = commits.find((c) => c.isBreaking);
  if (breakingCommit) {
    return {
      bump: 'major',
      reason: `Breaking change in ${breakingCommit.hash} ("${breakingCommit.rawSubject}")`,
      commits,
      isConventionalHistory: true,
    };
  }

  // 2. Check for Features (minor)
  const featureCommit = conventionalCommits.find((c) => c.type === 'feat');
  if (featureCommit) {
    return {
      bump: 'minor',
      reason: `Feature introduced in ${featureCommit.hash} ("${featureCommit.rawSubject}")`,
      commits,
      isConventionalHistory: true,
    };
  }

  // 3. Otherwise patch
  return {
    bump: 'patch',
    reason: `${conventionalCommits.length}/${commits.length} conventional commit(s) since ${latestTag ?? 'start'} (fixes/chores/maintenance)`,
    commits,
    isConventionalHistory: true,
  };
}

/**
 * Analyzes Git history to automatically determine whether commits are conventional
 * and recommends the appropriate SemVer bump level.
 *
 * @param rootDir - Working directory for git inspection.
 * @returns Detected bump type ('major' | 'minor' | 'patch'), explanation, commit list, and conventional status.
 */
export function detectBumpFromCommits(
  rootDir: string = process.cwd()
): BumpDetectionResult {
  const latestTag = getLatestTag(rootDir);
  const commits = getConventionalCommits(latestTag, rootDir);

  let isFallbackConventional = false;
  if (latestTag && commits.length === 0) {
    const recentCommits = getConventionalCommits(null, rootDir).slice(0, 20);
    isFallbackConventional = recentCommits.some((c) => c.isConventional);
  }

  return analyzeCommitsForBump(commits, latestTag, isFallbackConventional);
}
