/**
 * @file src/config.ts
 * Default configuration values, cosmiconfig setup, and CLI argument parsing.
 */

import path from 'node:path';
import process from 'node:process';

import { cosmiconfigSync, defaultLoadersSync } from 'cosmiconfig';

import type {
  AccessType,
  BumpType,
  CliOptions,
  DropdxConfig,
  EngineType,
} from './types.js';
import { parseJsoncConfig, parseTomlConfig } from './utils/config-parser.js';

/**
 * Default relative path for the dropdx configuration file.
 */
export const DEFAULT_CONFIG_PATH = '.config/dropdx.json';

/**
 * Ordered list of candidate configuration file paths searched automatically.
 */
export const CONFIG_SEARCH_PATHS = [
  DEFAULT_CONFIG_PATH,
  '.config/dropdx.jsonc',
  '.config/dropdx.yml',
  '.config/dropdx.toml',
  'dropdx.config.json',
  'dropdx.config.jsonc',
  'dropdx.config.yml',
  'dropdx.config.toml',
] as const;

const configExplorer = cosmiconfigSync('dropdx', {
  searchPlaces: [...CONFIG_SEARCH_PATHS],
  searchStrategy: 'none',
  cache: false,
  ignoreEmptySearchPlaces: false,
  loaders: {
    noExt: (_filepath, content) => parseJsoncConfig(content),
    '.json': (_filepath, content) => parseJsoncConfig(content),
    '.jsonc': (_filepath, content) => parseJsoncConfig(content),
    '.yml': defaultLoadersSync['.yml'],
    '.yaml': defaultLoadersSync['.yaml'],
    '.toml': (_filepath, content) => parseTomlConfig(content),
  },
});

/**
 * Default CLI pipeline options.
 */
export const DEFAULT_OPTIONS: CliOptions = {
  bump: 'patch',
  isExplicitBump: false,
  conventionalCommits: undefined,
  dryRun: false,
  registry: undefined,
  publishToJsr: false,
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
  configVersion: undefined,
  init: false,
  force: false,
};

/**
 * Discovers and loads a dropdx configuration file from `.config/`, the workspace
 * root, or an explicit file path.
 *
 * @param rootDir - Project root directory.
 * @param customConfigPath - Optional explicit config file path from `--config`.
 * @returns Loaded configuration object and resolved relative path, if found.
 */
export function loadConfigFile(
  rootDir: string = process.cwd(),
  customConfigPath?: string
): { config: DropdxConfig; configPath?: string } {
  const absoluteRootDir = path.resolve(rootDir);
  const result = customConfigPath
    ? configExplorer.load(path.resolve(absoluteRootDir, customConfigPath))
    : configExplorer.search(absoluteRootDir);

  if (!result) {
    return { config: {}, configPath: undefined };
  }

  const configPath = path
    .relative(absoluteRootDir, result.filepath)
    .replaceAll(path.sep, '/');
  const loadedConfig: unknown = result.config;

  if (
    loadedConfig !== undefined &&
    loadedConfig !== null &&
    (typeof loadedConfig !== 'object' || Array.isArray(loadedConfig))
  ) {
    throw new TypeError(
      `Configuration file "${configPath}" must contain an object.`
    );
  }

  return {
    config: (loadedConfig ?? {}) as DropdxConfig,
    configPath,
  };
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
  if (config.version !== undefined) {
    options.configVersion = config.version;
  }
  if (config.conventionalCommits !== undefined) {
    options.conventionalCommits = Boolean(config.conventionalCommits);
  }
  if (config.registry !== undefined) {
    options.registry = config.registry;
  }
  if (config.publishToJsr !== undefined) {
    options.publishToJsr = Boolean(config.publishToJsr);
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
    case 'init': {
      options.init = true;
      return index + 1;
    }
    case '-f':
    case '--force': {
      options.force = true;
      return index + 1;
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
    case '--jsr': {
      options.publishToJsr = true;
      return index + 1;
    }
    case '--no-jsr': {
      options.publishToJsr = false;
      return index + 1;
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
 * Parses configuration file (`.config/dropdx.json`) and command-line arguments
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
  const { config, configPath } = argv.includes('init')
    ? { config: {}, configPath: undefined }
    : loadConfigFile(rootDir, customConfigPath);
  applyConfigToOptions(options, config, configPath);

  let i = 0;
  while (i < argv.length) {
    i = handleArg(options, argv, i);
  }

  if (options.init) {
    // `init` targets the default path unless an explicit --config was passed,
    // so an unrelated discovered config file is never reported as existing.
    options.configPath = customConfigPath;
  }

  return options;
}
