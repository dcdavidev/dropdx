/**
 * @file src/utils/npmrc.ts
 * .npmrc configuration file parser and registry resolution utilities.
 */

import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

export const DEFAULT_REGISTRY = 'https://registry.npmjs.org/';

/**
 * Normalizes a registry URL to ensure standard protocol and trailing slash.
 *
 * @param url - Registry URL string.
 * @returns Normalized URL with trailing slash.
 */
export function normalizeRegistryUrl(url?: string): string {
  if (!url || typeof url !== 'string') return DEFAULT_REGISTRY;
  let normalized = url.trim();
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = `https://${normalized}`;
  }
  if (!normalized.endsWith('/')) {
    normalized += '/';
  }
  return normalized;
}

/**
 * Parses an .npmrc file content into a key-value dictionary.
 *
 * @param filePath - Path to .npmrc file.
 * @returns Parsed configuration entries.
 */
export function parseNpmrcFile(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) return {};

  try {
    const content = readFileSync(filePath, 'utf8');
    const result: Record<string, string> = {};
    const lines = content.split('\n');

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#') || line.startsWith(';')) {
        continue;
      }

      const eqIndex = line.indexOf('=');
      if (eqIndex === -1) continue;

      const key = line.slice(0, eqIndex).trim();
      const val = line.slice(eqIndex + 1).trim();
      result[key] = val;
    }

    return result;
  } catch {
    return {};
  }
}

/**
 * Loads project and user-level .npmrc configurations.
 *
 * @param rootDir - Project root directory.
 * @returns Configs object.
 */
export function loadNpmrc(rootDir: string = process.cwd()): {
  projectConfig: Record<string, string>;
  userConfig: Record<string, string>;
} {
  const projectNpmrcPath = path.join(rootDir, '.npmrc');
  const userNpmrcPath = path.join(os.homedir(), '.npmrc');

  const projectConfig = parseNpmrcFile(projectNpmrcPath);
  const userConfig = parseNpmrcFile(userNpmrcPath);

  return { projectConfig, userConfig };
}

/**
 * Resolves the target registry for a given package name.
 *
 * @param pkgName - Package name (e.g. "@scope/package" or "package").
 * @param options - CLI options.
 * @param options.registry - CLI registry override URL.
 * @param rootDir - Project root directory.
 * @returns Resolved registry URL with trailing slash.
 */
export function resolveRegistry(
  pkgName = '',
  options: { registry?: string } = {},
  rootDir: string = process.cwd()
): string {
  if (options.registry) {
    return normalizeRegistryUrl(options.registry);
  }

  const { projectConfig, userConfig } = loadNpmrc(rootDir);

  // Check scoped registry if package is scoped (e.g. @spellbookx/recipes -> @spellbookx:registry)
  if (pkgName.startsWith('@') && pkgName.includes('/')) {
    const scope = pkgName.split('/', 1)[0];
    const scopeKey = `${scope}:registry`;

    if (Object.hasOwn(projectConfig, scopeKey)) {
      return normalizeRegistryUrl(projectConfig[scopeKey]);
    }
  }

  // Check project default registry
  if (projectConfig.registry) {
    return normalizeRegistryUrl(projectConfig.registry);
  }

  // Check environment variable
  if (process.env.NPM_CONFIG_REGISTRY) {
    return normalizeRegistryUrl(process.env.NPM_CONFIG_REGISTRY);
  }

  // Check user scoped registry
  if (pkgName.startsWith('@') && pkgName.includes('/')) {
    const scope = pkgName.split('/', 1)[0];
    const scopeKey = `${scope}:registry`;

    if (Object.hasOwn(userConfig, scopeKey)) {
      return normalizeRegistryUrl(userConfig[scopeKey]);
    }
  }

  // Check user default registry
  return userConfig.registry
    ? normalizeRegistryUrl(userConfig.registry)
    : DEFAULT_REGISTRY;
}
