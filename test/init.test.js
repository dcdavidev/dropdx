/**
 * @file test/init.test.js
 * Unit tests for the `dropdx init` command, config version stamping, and
 * config/CLI version mismatch warnings.
 */

import assert from 'node:assert/strict';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { describe, it } from 'node:test';

import { parseArgs } from '../dist/config.js';
import { buildInitConfig, runInit, serializeConfig } from '../dist/init.js';
import {
  getConfigVersionWarning,
  getDropdxVersion,
} from '../dist/utils/version.js';

describe('dropdx init command and config version compatibility', () => {
  it('resolves the CLI version from package.json', () => {
    const pkgPath = path.join(process.cwd(), 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    assert.equal(getDropdxVersion(), pkg.version);
  });

  it('builds and serializes the default init configuration with a version prop', () => {
    const config = buildInitConfig('1.2.3');
    assert.equal(config.version, '1.2.3');
    assert.equal(config.conventionalCommits, true);
    assert.equal(config.engine, 'auto');
    assert.equal(config.skipBuild, false);
    assert.equal(config.skipGit, false);
    assert.equal(config.skipPublish, false);
    assert.equal(config.allowDirty, false);

    const serialized = serializeConfig(config);
    assert.ok(serialized.endsWith('\n'));
    assert.deepEqual(JSON.parse(serialized), config);
  });

  it('generates .config/dropdx.config.json stamped with the running CLI version', () => {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'dropdx-init-'));
    try {
      const relativePath = runInit({}, tmpDir);
      assert.equal(relativePath, '.config/dropdx.config.json');

      const written = JSON.parse(
        readFileSync(path.join(tmpDir, relativePath), 'utf8')
      );
      assert.equal(written.version, getDropdxVersion());
      assert.equal(written.engine, 'auto');
      assert.equal(written.conventionalCommits, true);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('does not overwrite an existing config file unless force is set', () => {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'dropdx-init-force-'));
    try {
      const configPath = path.join(tmpDir, '.config/dropdx.config.json');
      runInit({}, tmpDir);
      writeFileSync(configPath, '{"version":"0.0.1"}', 'utf8');

      runInit({}, tmpDir);
      assert.equal(readFileSync(configPath, 'utf8'), '{"version":"0.0.1"}');

      runInit({ force: true }, tmpDir);
      const rewritten = JSON.parse(readFileSync(configPath, 'utf8'));
      assert.equal(rewritten.version, getDropdxVersion());
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('honors a custom --config path for the generated file', () => {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'dropdx-init-custom-'));
    try {
      const options = parseArgs(
        ['init', '--config', 'custom/my.config.json'],
        tmpDir
      );
      assert.equal(options.init, true);

      const relativePath = runInit(options, tmpDir);
      assert.equal(relativePath, 'custom/my.config.json');
      assert.ok(existsSync(path.join(tmpDir, relativePath)));
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('parses the init command and --force flag without picking up discovered config', () => {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'dropdx-init-parse-'));
    try {
      const options = parseArgs(['init', '--force'], tmpDir);
      assert.equal(options.init, true);
      assert.equal(options.force, true);
      assert.equal(options.configPath, undefined);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('exposes the config version through parsed options', () => {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'dropdx-init-ver-'));
    try {
      const configDir = path.join(tmpDir, '.config');
      runInit({}, tmpDir);
      assert.ok(existsSync(configDir));

      const options = parseArgs([], tmpDir);
      assert.equal(options.configVersion, getDropdxVersion());
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('warns only when the config version differs from the CLI version', () => {
    assert.equal(getConfigVersionWarning('0.3.0', '0.3.0'), null);
    assert.equal(getConfigVersionWarning(undefined, '0.3.0'), null);

    const warning = getConfigVersionWarning('0.1.0', '0.3.0');
    assert.ok(warning.includes('dropdx v0.1.0'));
    assert.ok(warning.includes('dropdx v0.3.0'));
    assert.ok(warning.includes('dropdx init --force'));
  });

  it('stamps the repository config file with the current CLI version', () => {
    const configPath = path.join(process.cwd(), '.config/dropdx.config.json');
    const repoConfig = JSON.parse(readFileSync(configPath, 'utf8'));
    assert.equal(repoConfig.version, getDropdxVersion());
  });
});
