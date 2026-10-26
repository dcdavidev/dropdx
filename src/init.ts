/**
 * @file src/init.ts
 * `dropdx init` command: scaffolds a `.config/dropdx.config.json` configuration file.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { DEFAULT_CONFIG_PATH } from './config.js';
import type { CliOptions, DropdxConfig } from './types.js';
import {
  bold,
  cyan,
  dim,
  logInfo,
  logSuccess,
  logWarn,
} from './utils/banner.js';
import { getDropdxVersion } from './utils/version.js';

/**
 * Builds the default configuration object written by `dropdx init`.
 *
 * @param version - dropdx version used to stamp the generated config file.
 * @returns Default configuration object.
 */
export function buildInitConfig(version: string): DropdxConfig {
  return {
    version,
    conventionalCommits: true,
    engine: 'auto',
    skipBuild: false,
    skipGit: false,
    skipPublish: false,
    allowDirty: false,
  };
}

/**
 * Serializes a configuration object as pretty-printed JSON with a trailing newline.
 *
 * @param config - Configuration object.
 * @returns JSON string.
 */
export function serializeConfig(config: DropdxConfig): string {
  return `${JSON.stringify(config, null, 2)}\n`;
}

/**
 * Generates a `.config/dropdx.config.json` configuration file stamped with the
 * currently installed dropdx version.
 *
 * @param options - Parsed CLI options (`configPath` overrides the target path).
 * @param rootDir - Project root directory.
 * @returns Resolved relative path of the written file.
 */
export function runInit(
  options: Partial<CliOptions> = {},
  rootDir: string = process.cwd()
): string {
  const target = options.configPath || DEFAULT_CONFIG_PATH;
  const fullPath = path.isAbsolute(target)
    ? target
    : path.join(rootDir, target);
  const relativePath = path.relative(rootDir, fullPath) || target;

  if (existsSync(fullPath) && !options.force) {
    logWarn(
      `Configuration file already exists: ${bold(cyan(relativePath))}. Use ${cyan('dropdx init --force')} to overwrite it.`
    );
    return relativePath;
  }

  const version = getDropdxVersion();
  mkdirSync(path.dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, serializeConfig(buildInitConfig(version)), 'utf8');

  logSuccess(
    `Created configuration file: ${bold(cyan(relativePath))} ${dim(`(dropdx v${version})`)}`
  );
  logInfo(
    `Adjust the workflow options in the file, then run ${cyan('dropdx --dry-run')} to simulate a release.`
  );

  return relativePath;
}
