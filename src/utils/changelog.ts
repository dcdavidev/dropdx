/**
 * @file src/utils/changelog.ts
 * Changelog generator and updater.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { ConventionalCommit } from '../types.js';
import { getConventionalCommits, getLatestTag } from './git.js';

/**
 * Formats a list of Conventional Commits into structured markdown sections.
 *
 * @param commits - Array of parsed conventional commits.
 * @param summary - Fallback summary text if no commits are provided.
 * @returns Markdown formatted changelog section.
 */
export function formatConventionalChangelog(
  commits: ConventionalCommit[],
  summary = 'Release version bump'
): string {
  if (commits.length === 0) {
    return `* ${summary}\n`;
  }

  const hasConventional = commits.some((c) => c.isConventional);
  const breaking = commits.filter((c) => c.isBreaking);

  // If history does not use Conventional Commits, format a clean list of changes
  if (!hasConventional) {
    const regular = commits.filter((c) => !c.isBreaking);
    const formatPlainList = (list: ConventionalCommit[]): string =>
      list.map((c) => `* ${c.subject} (${c.hash})`).join('\n');

    if (breaking.length === 0) {
      return formatPlainList(regular) || `* ${summary}`;
    }

    const nonConventionalSections: string[] = [
      `### 💥 Breaking Changes\n\n${formatPlainList(breaking)}`,
    ];
    if (regular.length > 0) {
      nonConventionalSections.push(
        `### Changes\n\n${formatPlainList(regular)}`
      );
    }
    return nonConventionalSections.join('\n\n');
  }

  const features = commits.filter(
    (c) => !c.isBreaking && c.isConventional && c.type === 'feat'
  );
  const fixes = commits.filter(
    (c) => !c.isBreaking && c.isConventional && c.type === 'fix'
  );
  const perf = commits.filter(
    (c) => !c.isBreaking && c.isConventional && c.type === 'perf'
  );
  const docs = commits.filter(
    (c) => !c.isBreaking && c.isConventional && c.type === 'docs'
  );
  const chores = commits.filter(
    (c) =>
      !c.isBreaking &&
      c.isConventional &&
      ['chore', 'build', 'ci', 'refactor', 'style'].includes(c.type)
  );
  const others = commits.filter(
    (c) =>
      !c.isBreaking &&
      (!c.isConventional ||
        ![
          'feat',
          'fix',
          'perf',
          'docs',
          'chore',
          'build',
          'ci',
          'refactor',
          'style',
        ].includes(c.type))
  );

  const sections: string[] = [];

  const formatList = (list: ConventionalCommit[]): string =>
    list
      .map(
        (c) => `* ${c.scope ? `**${c.scope}:** ` : ''}${c.subject} (${c.hash})`
      )
      .join('\n');

  if (breaking.length > 0) {
    sections.push(`### 💥 Breaking Changes\n\n${formatList(breaking)}`);
  }
  if (features.length > 0) {
    sections.push(`### ✨ Features\n\n${formatList(features)}`);
  }
  if (fixes.length > 0) {
    sections.push(`### 🐛 Bug Fixes\n\n${formatList(fixes)}`);
  }
  if (perf.length > 0) {
    sections.push(`### ⚡ Performance Improvements\n\n${formatList(perf)}`);
  }
  if (docs.length > 0) {
    sections.push(`### 📝 Documentation\n\n${formatList(docs)}`);
  }
  if (chores.length > 0) {
    sections.push(`### 🔧 Maintenance & Chores\n\n${formatList(chores)}`);
  }
  if (others.length > 0) {
    sections.push(`### Other Changes\n\n${formatList(others)}`);
  }

  return sections.join('\n\n') || `* ${summary}`;
}

/**
 * Generates or prepends a release entry in CHANGELOG.md.
 *
 * @param pkgDir - Directory of the package.
 * @param newVersion - Target release version.
 * @param summary - Summary description.
 * @param dateStr - ISO Date string.
 * @param commits - Optional pre-filtered conventional commits.
 * @returns Path to CHANGELOG.md.
 */
export function updateChangelog(
  pkgDir: string,
  newVersion: string,
  summary = 'Release version bump',
  dateStr = new Date().toISOString().slice(0, 10),
  commits?: ConventionalCommit[]
): string {
  const changelogPath = path.join(pkgDir, 'CHANGELOG.md');

  // If commits are not passed, retrieve them automatically from git
  const resolvedCommits =
    commits ?? getConventionalCommits(getLatestTag(pkgDir), pkgDir);

  const bodyContent = formatConventionalChangelog(resolvedCommits, summary);
  const entry = `## v${newVersion} - ${dateStr}\n\n${bodyContent}\n\n`;

  if (!existsSync(changelogPath)) {
    const content = `# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n${entry}`;
    writeFileSync(changelogPath, content, 'utf8');
    return changelogPath;
  }

  const existingContent = readFileSync(changelogPath, 'utf8');
  if (
    existingContent.includes(`## v${newVersion}`) ||
    existingContent.includes(`## [${newVersion}]`)
  ) {
    // Version entry already exists in changelog
    return changelogPath;
  }

  // Prepend entry right after the header if exists, or at the top
  const headerMatch = /^#\s+[^\n]+\n+/.exec(existingContent);
  const updatedContent = headerMatch
    ? `${headerMatch[0]}${entry}${existingContent.slice(headerMatch[0].length)}`
    : `${entry}${existingContent}`;

  writeFileSync(changelogPath, updatedContent, 'utf8');
  return changelogPath;
}
