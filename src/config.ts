/**
 * @file src/config.ts
 * Default configuration values, .config/dropdx.config.json loader, and CLI argument parsing.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import type {
  AccessType,
  BumpType,
  CliOptions,
  DropdxConfig,
  EngineType,
} from './types.js';
import { parseConfigContent } from './utils/config-parser.js';

/**
 * Default relative path for the dropdx configuration file.
 */
export const DEFAULT_CONFIG_PATH = '.config/dropdx.config.json';

/**
 * Ordered list of candidate configuration file paths searched automatically.
 */
export const CONFIG_SEARCH_PATHS = [
  DEFAULT_CONFIG_PATH,
  '.config/dropdx.config.jsonc',
  '.config/dropdx.config.yaml',
  '.config/dropdx.config.yml',
  '.config/dropdx.config.toml',
  'dropdx.config.json',
  'dropdx.config.jsonc',
  'dropdx.config.yaml',
  'dropdx.config.yml',
  'dropdx.config.toml',
] as const;

/**
 * Default CLI pipeline options.
 */
export const DEFAULT_OPTIONS: CliOptions = {
  bump: 'patch',
  isExplicitBump: false,
  conventionalCommits: undefined,
  dryRun: false,
  registry: undefined,
  tag: 'latest',
  access: 'public',
  otp: undefined,
  stage: false,
  skipBuild: false,
  skipGit: false,
  skipPublish: false,
  allowDirty: false,
  engine: 'auto',
  summary: undefined,
  provenance: Boolean(process.env.GITHUB_ACTIONS),
  isForceBump: false,
  configPath: undefined,
};

/**
 * Discovers and loads a dropdx configuration file from `.config/dropdx.config.json`,
 * `dropdx.config.json`, or an explicit file path.
 *
 * @param rootDir - Project root directory.
 * @param customConfigPath - Optional explicit config file path from `--config`.
 * @returns Loaded configuration object and resolved relative path, if found.
 */
export function loadConfigFile(
  rootDir: string = process.cwd(),
  customConfigPath?: string
): { config: DropdxConfig; configPath?: string } {
  const candidates = customConfigPath
    ? [customConfigPath]
    : [...CONFIG_SEARCH_PATHS];

  for (const candidate of candidates) {
    const fullPath = path.isAbsolute(candidate)
      ? candidate
      : path.join(rootDir, candidate);

    if (!existsSync(fullPath)) {
      continue;
    }

    try {
      const raw = readFileSync(fullPath, 'utf8');
      const parsed = parseConfigContent(raw, fullPath);
      const relativePath = path.relative(rootDir, fullPath) || candidate;
      return { config: parsed, configPath: relativePath };
    } catch (error: unknown) {
      const err = error as Error;
      throw new Error(
        `Failed to parse configuration file "${candidate}": ${err.message}`,
        { cause: error }
      );
    }
  }

  return { config: {}, configPath: undefined };
}

/**
 * Applies loaded DropdxConfig properties onto an options object.
 *
 * @param options - Target options accumulator.
 * @param config - Parsed DropdxConfig object.
 * @param configPath - Resolved path of the config file.
 */
function applyConfigToOptions(
  options: CliOptions,
  config: DropdxConfig,
  configPath?: string
): void {
  if (configPath) {
    options.configPath = configPath;
  }
  if (config.conventionalCommits !== undefined) {
    options.conventionalCommits = Boolean(config.conventionalCommits);
  }
  if (config.registry !== undefined) {
    options.registry = config.registry;
  }
  if (config.engine !== undefined) {
    options.engine = config.engine;
  }
  if (config.dryRun !== undefined) {
    options.dryRun = Boolean(config.dryRun);
  }
  if (config.skipBuild !== undefined) {
    options.skipBuild = Boolean(config.skipBuild);
  }
  if (config.skipGit !== undefined) {
    options.skipGit = Boolean(config.skipGit);
  }
  if (config.skipPublish !== undefined) {
    options.skipPublish = Boolean(config.skipPublish);
  }
  if (config.allowDirty !== undefined) {
    options.allowDirty = Boolean(config.allowDirty);
  }
  if (config.provenance !== undefined) {
    options.provenance = Boolean(config.provenance);
  }
  if (config.stage !== undefined) {
    options.stage = Boolean(config.stage);
  }
  if (config.forceBump !== undefined) {
    options.isForceBump = Boolean(config.forceBump);
  }
  if (config.summary !== undefined) {
    options.summary = config.summary;
  }
}

/**
 * Extracts `--config` / `-c` argument from argv before full argument parsing.
 *
 * @param argv - Command line arguments.
 * @returns Explicit config path if provided.
 */
function extractConfigArg(argv: string[]): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg !== '-c' && arg !== '--config') {
      continue;
    }
    const nextArg = argv[i + 1];
    if (nextArg) {
      return nextArg;
    }
  }
  return undefined;
}

/**
 * Handles a single command-line argument.
 *
 * @param options - Accumulator options object.
 * @param argv - Argument array.
 * @param index - Index in argv.
 * @returns Next index to evaluate.
 */
function handleArg(options: CliOptions, argv: string[], index: number): number {
  const arg = argv[index];

  switch (arg) {
    case '-h':
    case '--help': {
      options.help = true;
      return index + 1;
    }
    case '-v':
    case '--version': {
      options.version = true;
      return index + 1;
    }
    case '-c':
    case '--config': {
      options.configPath = argv[index + 1] || DEFAULT_CONFIG_PATH;
      return index + 2;
    }
    case '-d':
    case '--dry-run': {
      options.dryRun = true;
      return index + 1;
    }
    case '--patch': {
      options.bump = 'patch';
      options.isExplicitBump = true;
      return index + 1;
    }
    case '--minor': {
      options.bump = 'minor';
      options.isExplicitBump = true;
      return index + 1;
    }
    case '--major': {
      options.bump = 'major';
      options.isExplicitBump = true;
      return index + 1;
    }
    case '--prerelease': {
      options.bump = 'prerelease';
      options.isExplicitBump = true;
      return index + 1;
    }
    case '--bump': {
      options.bump = (argv[index + 1] as BumpType) || 'patch';
      options.isExplicitBump = true;
      return index + 2;
    }
    case '--registry': {
      options.registry = argv[index + 1];
      return index + 2;
    }
    case '--tag': {
      options.tag = argv[index + 1] || 'latest';
      return index + 2;
    }
    case '--access': {
      options.access = (argv[index + 1] as AccessType) || 'public';
      return index + 2;
    }
    case '--otp': {
      options.otp = argv[index + 1];
      return index + 2;
    }
    case '--engine': {
      options.engine = (argv[index + 1] as EngineType) || 'auto';
      return index + 2;
    }
    case '-m':
    case '--summary': {
      options.summary = argv[index + 1];
      return index + 2;
    }
    case '--skip-build': {
      options.skipBuild = true;
      return index + 1;
    }
    case '--skip-git': {
      options.skipGit = true;
      return index + 1;
    }
    case '--skip-publish': {
      options.skipPublish = true;
      return index + 1;
    }
    case '--allow-dirty': {
      options.allowDirty = true;
      return index + 1;
    }
    case '--provenance': {
      options.provenance = true;
      return index + 1;
    }
    case '--stage': {
      options.stage = true;
      return index + 1;
    }
    case '--no-stage': {
      options.stage = false;
      return index + 1;
    }
    case '--force-bump': {
      options.isForceBump = true;
      return index + 1;
    }
    case '--conventional-commits': {
      options.conventionalCommits = true;
      return index + 1;
    }
    case '--no-conventional-commits': {
      options.conventionalCommits = false;
      return index + 1;
    }
    default: {
      return index + 1;
    }
  }
}

/**
 * Parses configuration file (`.config/dropdx.config.json`) and command-line arguments
 * into structured options, with CLI arguments taking highest precedence.
 *
 * @param argv - Command line arguments.
 * @param rootDir - Project root directory to search for config file.
 * @returns Parsed options.
 */
export function parseArgs(
  argv: string[] = process.argv.slice(2),
  rootDir: string = process.cwd()
): CliOptions {
  const options: CliOptions = { ...DEFAULT_OPTIONS };

  const customConfigPath = extractConfigArg(argv);
  const { config, configPath } = loadConfigFile(rootDir, customConfigPath);
  applyConfigToOptions(options, config, configPath);

  let i = 0;
  while (i < argv.length) {
    i = handleArg(options, argv, i);
  }

  return options;
}
