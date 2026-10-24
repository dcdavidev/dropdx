#!/usr/bin/env node
/**
 * @file bin/dropx.js
 * CLI executable for dropx.
 */

import process from 'node:process';

import { run } from '../dist/index.js';

try {
  await run(process.argv.slice(2));
} catch (error) {
  console.error(`\n✖ Fatal dropx error: ${error.message}\n`);
  process.exit(1);
}
