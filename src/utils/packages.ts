/**
 * @file src/utils/packages.ts
 * Package and workspace discovery for single packages and monorepos (pnpm, yarn, npm, lerna).
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import type { WorkspacePackage } from '../types.js';

interface RawPackageJson {
  name?: string;
  version?: string;
  private?: boolean;
  publishConfig?: Record<string, unknown> & { access?: string };
  workspaces?: string[] | { packages?: string[] };
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

/**
 * Reads and parses a package.json file safely.
 *
 * @param pkgJsonPath - Path to package.json.
 * @returns Parsed content or null.
 */
function readPackageJson(pkgJsonPath: string): RawPackageJson | null {
  if (!existsSync(pkgJsonPath)) return null;
  try {
    return JSON.parse(readFileSync(pkgJsonPath, 'utf8')) as RawPackageJson;
  } catch {
    return null;
  }
}

/**
 * Parses glob patterns from pnpm-workspace.yaml without external dependencies.
 *
 * @param workspaceYamlPath - Path to pnpm-workspace.yaml.
 * @returns Workspace glob patterns.
 */
function parsePnpmWorkspaceYaml(workspaceYamlPath: string): string[] {
  if (!existsSync(workspaceYamlPath)) return [];
  try {
    const content = readFileSync(workspaceYamlPath, 'utf8');
    const lines = content.split('\n');
    const globs: string[] = [];
    let isInPackagesSection = false;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;

      if (line === 'packages:') {
        isInPackagesSection = true;
        continue;
      }

      if (isInPackagesSection) {
        if (line.startsWith('-')) {
          const pattern = line
            .replace(/^-\s*/, '')
            .replaceAll(/^['"]|['"]$/g, '')
            .trim();
          if (pattern) globs.push(pattern);
        } else if (!rawLine.startsWith(' ') && !rawLine.startsWith('\t')) {
          isInPackagesSection = false;
        }
      }
    }

    return globs;
  } catch {
    return [];
  }
}

/**
 * Resolves directory paths matching a workspace glob pattern.
 *
 * @param root - Repository root.
 * @param pattern - Glob pattern like "packages/*" or "@scope/*" or "apps/foo".
 * @returns Matching package directories with a package.json.
 */
function matchWorkspacePattern(root: string, pattern: string): string[] {
  if (!pattern) return [];
  const cleanPattern = pattern.replace(/\/+$/, '');
  const parts = cleanPattern.split('/');
  const results: string[] = [];

  /**
   * Recursive directory crawler matching pattern segments.
   *
   * @param currentDir - Current filesystem directory.
   * @param partIndex - Index into parts array.
   */
  function scan(currentDir: string, partIndex: number): void {
    if (!existsSync(currentDir)) return;

    if (partIndex >= parts.length) {
      if (existsSync(path.join(currentDir, 'package.json'))) {
        results.push(currentDir);
      }
      return;
    }

    const currentPart = parts[partIndex];

    if (currentPart === '*') {
      try {
        const entries = readdirSync(currentDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory() && !entry.name.startsWith('.')) {
            scan(path.join(currentDir, entry.name), partIndex + 1);
          }
        }
      } catch {
        // Ignore read errors
      }
    } else {
      const nextDir = path.join(currentDir, currentPart);
      if (existsSync(nextDir) && statSync(nextDir).isDirectory()) {
        scan(nextDir, partIndex + 1);
      }
    }
  }

  scan(root, 0);
  return results;
}

/**
 * Discovers all workspace packages in a monorepo or single package repository.
 *
 * @param rootDir - Repository root directory.
 * @returns Discovered packages.
 */
export function findPackages(
  rootDir: string = process.cwd()
): WorkspacePackage[] {
  const rootPkgJsonPath = path.join(rootDir, 'package.json');
  const rootPkgContent = readPackageJson(rootPkgJsonPath);

  const workspacePatterns = new Set<string>();

  // 1. Check pnpm-workspace.yaml
  const pnpmWorkspacePath = path.join(rootDir, 'pnpm-workspace.yaml');
  for (const glob of parsePnpmWorkspaceYaml(pnpmWorkspacePath)) {
    workspacePatterns.add(glob);
  }

  // 2. Check package.json workspaces
  if (rootPkgContent?.workspaces) {
    const ws = Array.isArray(rootPkgContent.workspaces)
      ? rootPkgContent.workspaces
      : rootPkgContent.workspaces.packages || [];
    for (const glob of ws) {
      workspacePatterns.add(glob);
    }
  }

  // 3. Check lerna.json
  const lernaJsonPath = path.join(rootDir, 'lerna.json');
  if (existsSync(lernaJsonPath)) {
    try {
      const lerna = JSON.parse(readFileSync(lernaJsonPath, 'utf8')) as {
        packages?: string[];
      };
      if (Array.isArray(lerna.packages)) {
        for (const glob of lerna.packages) workspacePatterns.add(glob);
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Collect directories
  const packageDirs = new Set<string>();

  for (const pattern of workspacePatterns) {
    for (const dir of matchWorkspacePattern(rootDir, pattern)) {
      packageDirs.add(dir);
    }
  }

  // If no workspace packages found or root is a standalone package
  if (rootPkgContent && packageDirs.size === 0) {
    packageDirs.add(rootDir);
  }

  const packages: WorkspacePackage[] = [];
  for (const dir of packageDirs) {
    const pkgJson = readPackageJson(path.join(dir, 'package.json'));
    if (!pkgJson || !pkgJson.name) continue;

    const isPrivate = Boolean(pkgJson.private);
    const publishConfig = pkgJson.publishConfig || {};
    // A package is publishable if not private or if access is explicitly public
    const isPublishable = !isPrivate || publishConfig.access === 'public';

    packages.push({
      name: pkgJson.name,
      version: pkgJson.version || '0.0.0',
      directory: dir,
      relativeDir: path.relative(rootDir, dir) || '.',
      private: isPrivate,
      publishConfig,
      isPublishable,
      dependencies: pkgJson.dependencies || {},
      devDependencies: pkgJson.devDependencies || {},
      peerDependencies: pkgJson.peerDependencies || {},
      scripts: pkgJson.scripts || {},
    });
  }

  return packages;
}

/**
 * Topologically sorts packages so internal dependencies are published before dependents.
 *
 * @param packages - Packages to sort.
 * @returns Topologically sorted packages.
 */
export function sortPackagesTopologically(
  packages: WorkspacePackage[]
): WorkspacePackage[] {
  const pkgMap = new Map<string, WorkspacePackage>(
    packages.map((p) => [p.name, p])
  );
  const visited = new Set<string>();
  const sorted: WorkspacePackage[] = [];

  /**
   * Depth-first search helper.
   *
   * @param pkg - Current package node.
   */
  function visit(pkg: WorkspacePackage): void {
    if (visited.has(pkg.name)) return;
    visited.add(pkg.name);

    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const depName of Object.keys(allDeps)) {
      const match = pkgMap.get(depName);
      if (match) {
        visit(match);
      }
    }
    sorted.push(pkg);
  }

  for (const pkg of packages) {
    visit(pkg);
  }

  return sorted;
}
