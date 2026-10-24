#!/usr/bin/env node
/**
 * @file bin/dropdx.js
 * CLI executable for dropdx.
 */

import process from 'node:process';

import { run } from '../dist/index.js';

try {
  await run(process.argv.slice(2));
} catch (error) {
  console.error(`\n✖ Fatal dropdx error: ${error.message}\n`);
  process.exit(1);
}
