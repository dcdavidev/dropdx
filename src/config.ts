/**
 * @file src/config.ts
 * Default configuration values and CLI argument parsing.
 */

import process from 'node:process';

import type { AccessType, BumpType, CliOptions, EngineType } from './types.js';

/**
 * Default CLI pipeline options.
 */
export const DEFAULT_OPTIONS: CliOptions = {
  bump: 'patch',
  isExplicitBump: false,
  dryRun: false,
  registry: undefined,
  tag: 'latest',
  access: 'public',
  otp: undefined,
  skipBuild: false,
  skipGit: false,
  skipPublish: false,
  allowDirty: false,
  engine: 'auto',
  summary: undefined,
  provenance: Boolean(process.env.GITHUB_ACTIONS),
  isForceBump: false,
};

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
    case '--force-bump': {
      options.isForceBump = true;
      return index + 1;
    }
    default: {
      return index + 1;
    }
  }
}

/**
 * Parses command-line arguments into structured options.
 *
 * @param argv - Command line arguments.
 * @returns Parsed options.
 */
export function parseArgs(argv: string[] = process.argv.slice(2)): CliOptions {
  const options: CliOptions = { ...DEFAULT_OPTIONS };

  let i = 0;
  while (i < argv.length) {
    i = handleArg(options, argv, i);
  }

  return options;
}
