/**
 * @file src/utils/jsr.ts
 * JSR package configuration, metadata lookup, and publishing helpers.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { applyEdits, modify, parse as parseJsonc } from 'jsonc-parser';

import type {
  CliOptions,
  JsrRegistryInfo,
  PublishResult,
  WorkspacePackage,
} from '../types.js';
import { logError, logInfo, logSuccess, logWarn } from './banner.js';
import { runInherited } from './exec.js';
import { compareSemVer, parseSemVer } from './semver.js';

const JSR_CONFIG_FILES = [
  'jsr.json',
  'jsr.jsonc',
  'deno.json',
  'deno.jsonc',
] as const;

const JSR_REGISTRY_URL = 'https://jsr.io/';

export interface JsrPackageConfig {
  configPath: string;
  name: string;
}

export interface JsrPublishDependencies {
  runFn?: (command: string, cwd: string) => void;
}

/**
 * Selects the highest published version across configured registries.
 *
 * @param versions - Published versions to compare.
 * @returns Highest version, or undefined when none exist.
 */
export function getLatestPublishedVersion(
  ...versions: Array<string | undefined>
): string | undefined {
  let latestVersion: string | undefined;
  for (const version of versions) {
    if (version) {
      latestVersion =
        !latestVersion || compareSemVer(version, latestVersion) > 0
          ? version
          : latestVersion;
    }
  }
  return latestVersion;
}

/**
 * Reads the package's JSR configuration and validates required metadata.
 *
 * @param packageDir - Workspace package directory.
 * @returns JSR config path and package name.
 */
export function readJsrPackageConfig(packageDir: string): JsrPackageConfig {
  const configPath = JSR_CONFIG_FILES.map((file) =>
    path.join(packageDir, file)
  ).find((file) => existsSync(file));

  if (!configPath) {
    throw new Error(
      `Package "${packageDir}" is missing a jsr.json, jsr.jsonc, deno.json, or deno.jsonc file.`
    );
  }

  const content = readFileSync(configPath, 'utf8');
  const parseErrors: Array<{ error: number; offset: number; length: number }> =
    [];
  const config = parseJsonc(content, parseErrors, {
    allowTrailingComma: true,
  });

  if (parseErrors.length > 0) {
    throw new Error(`Invalid JSR package configuration: ${configPath}`);
  }

  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error(`Invalid JSR package configuration: ${configPath}`);
  }

  const manifest = config as Record<string, unknown>;
  const name = manifest.name;

  if (
    typeof name !== 'string' ||
    !/^@[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*$/.test(name)
  ) {
    throw new Error(
      `JSR package configuration "${configPath}" must declare a scoped lowercase package name.`
    );
  }

  const version = manifest.version;
  if (typeof version !== 'string' || !parseSemVer(version)) {
    throw new Error(
      `JSR package configuration "${configPath}" must declare a valid SemVer version.`
    );
  }

  const exports = manifest.exports;
  if (
    !exports ||
    (typeof exports !== 'string' &&
      (typeof exports !== 'object' || Array.isArray(exports)))
  ) {
    throw new Error(
      `JSR package configuration "${configPath}" must declare exports as a string or object.`
    );
  }

  return { configPath, name };
}

/**
 * Updates the version field in a JSR JSON or JSONC configuration file.
 *
 * @param configPath - Path to jsr.json, jsr.jsonc, deno.json, or deno.jsonc.
 * @param version - Target package version.
 */
export function updateJsrPackageVersion(
  configPath: string,
  version: string
): void {
  const content = readFileSync(configPath, 'utf8');
  const parseErrors: Array<{ error: number; offset: number; length: number }> =
    [];
  const config = parseJsonc(content, parseErrors, {
    allowTrailingComma: true,
  });

  if (parseErrors.length > 0) {
    throw new Error(`Invalid JSR package configuration: ${configPath}`);
  }

  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error(`Invalid JSR package configuration: ${configPath}`);
  }

  const edits = modify(content, ['version'], version, {
    formattingOptions: {
      insertSpaces: true,
      tabSize: 2,
      eol: '\n',
    },
  });
  writeFileSync(configPath, applyEdits(content, edits), 'utf8');
}

/**
 * Fetches the latest published version from JSR's public package metadata API.
 *
 * @param packageName - Scoped JSR package name, such as `@scope/package`.
 * @returns JSR package existence and latest version.
 */
export async function fetchJsrRegistryInfo(
  packageName: string
): Promise<JsrRegistryInfo> {
  const response = await fetch(`${JSR_REGISTRY_URL}${packageName}/meta.json`, {
    headers: { Accept: 'application/json' },
  });

  if (response.status === 404) {
    return { exists: false };
  }

  if (!response.ok) {
    throw new Error(
      `JSR registry responded with HTTP ${response.status} for "${packageName}".`
    );
  }

  const metadata = (await response.json()) as { latest?: unknown };
  if (typeof metadata.latest !== 'string' || !parseSemVer(metadata.latest)) {
    throw new Error(
      `JSR registry returned invalid latest-version metadata for "${packageName}".`
    );
  }

  return { exists: true, latestVersion: metadata.latest };
}

/**
 * Builds the JSR CLI publish command.
 *
 * @param isPnpm - Whether the workspace uses pnpm.
 * @param isDryRun - Whether to publish in dry-run mode.
 * @returns Command string.
 */
export function buildJsrPublishCommand(
  isPnpm: boolean,
  isDryRun: boolean
): string {
  const command = isPnpm ? 'pnpm dlx jsr publish' : 'npx jsr publish';
  return isDryRun ? `${command} --dry-run` : command;
}

/**
 * Publishes workspace packages to JSR.
 *
 * @param packages - Packages to publish.
 * @param updatedVersionsMap - Name to target version map.
 * @param jsrConfigs - JSR package configs keyed by the package.json name.
 * @param options - CLI options.
 * @param rootDir - Workspace root.
 * @param customDeps - Optional command runner for tests.
 * @returns Publish results.
 */
export function publishJsrPackages(
  packages: WorkspacePackage[],
  updatedVersionsMap: Map<string, string>,
  jsrConfigs: ReadonlyMap<string, JsrPackageConfig>,
  options: CliOptions,
  rootDir: string,
  customDeps: JsrPublishDependencies = {}
): PublishResult[] {
  const isPnpm = existsSync(path.join(rootDir, 'pnpm-lock.yaml'));
  const runFn = customDeps.runFn ?? runInherited;
  const results: PublishResult[] = [];

  for (const pkg of packages) {
    const config = jsrConfigs.get(pkg.name);
    if (!config) {
      throw new Error(`Missing validated JSR configuration for "${pkg.name}".`);
    }

    const targetVersion = updatedVersionsMap.get(pkg.name) || pkg.version;
    logInfo(
      `Publishing ${pkg.name}@${targetVersion} to JSR (${JSR_REGISTRY_URL})...`
    );

    if (options.skipPublish) {
      logWarn(
        `Skipped JSR publishing for ${pkg.name} (--skip-publish specified)`
      );
      results.push({
        name: config.name,
        version: targetVersion,
        success: true,
        reason: 'skipped',
        registry: JSR_REGISTRY_URL,
      });
      continue;
    }

    const command = buildJsrPublishCommand(isPnpm, options.dryRun);
    logInfo(`Command: ${command}`);
    const originalContent = options.dryRun
      ? readFileSync(config.configPath, 'utf8')
      : undefined;

    try {
      updateJsrPackageVersion(config.configPath, targetVersion);
      runFn(command, pkg.directory);
      logSuccess(
        `${options.dryRun ? '[DRY-RUN] Would publish' : 'Published'} ${config.name}@${targetVersion} to JSR`
      );
      results.push({
        name: config.name,
        version: targetVersion,
        success: true,
        registry: JSR_REGISTRY_URL,
      });
    } catch (error: unknown) {
      const err = error as Error;
      logError(
        `Failed to publish ${config.name}@${targetVersion} to JSR: ${err.message}`
      );
      results.push({
        name: config.name,
        version: targetVersion,
        success: false,
        reason: err.message,
        registry: JSR_REGISTRY_URL,
      });
      if (!options.dryRun) {
        logError('Halting remaining JSR package publishing due to failure.');
        break;
      }
    } finally {
      if (originalContent !== undefined) {
        writeFileSync(config.configPath, originalContent, 'utf8');
      }
    }
  }

  return results;
}
