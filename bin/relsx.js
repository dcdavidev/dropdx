#!/usr/bin/env node
/**
 * @file bin/relsx.js
 * CLI executable for relsx.
 */

import process from 'node:process';

import { run } from '../dist/index.js';

try {
  await run(process.argv.slice(2));
} catch (error) {
  console.error(`\n✖ Fatal relsx error: ${error.message}\n`);
  process.exit(1);
}
