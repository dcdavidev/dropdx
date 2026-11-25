/**
 * @file tests/init.test.ts
 * Unit tests for the `dropdx init` command, config version stamping, and
 * config/CLI version mismatch warnings.
 */

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

import { describe, expect, it } from 'vitest';

import { parseArgs } from '../src/config.js';
import { buildInitConfig, runInit, serializeConfig } from '../src/init.js';
import {
  getConfigVersionWarning,
  getDropdxVersion,
} from '../src/utils/version.js';

describe('dropdx init command and config version compatibility', () => {
  it('resolves the CLI version from package.json', () => {
    const pkgPath = path.join(process.cwd(), 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    expect(getDropdxVersion()).toBe(pkg.version);
  });

  it('builds and serializes the default init configuration with a version prop', () => {
    const config = buildInitConfig('1.2.3');
    expect(config.version).toBe('1.2.3');
    expect(config.conventionalCommits).toBe(true);
    expect(config.engine).toBe('auto');
    expect(config.skipBuild).toBe(false);
    expect(config.skipGit).toBe(false);
    expect(config.skipPublish).toBe(false);
    expect(config.allowDirty).toBe(false);

    const serialized = serializeConfig(config);
    expect(serialized.endsWith('\n')).toBeTruthy();
    expect(JSON.parse(serialized)).toStrictEqual(config);
  });

  it('generates .config/dropdx.json stamped with the running CLI version', () => {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'dropdx-init-'));
    try {
      const relativePath = runInit({}, tmpDir);
      expect(relativePath).toBe('.config/dropdx.json');

      const written = JSON.parse(
        readFileSync(path.join(tmpDir, relativePath), 'utf8')
      );
      expect(written.version).toBe(getDropdxVersion());
      expect(written.engine).toBe('auto');
      expect(written.conventionalCommits).toBe(true);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('does not overwrite an existing config file unless force is set', () => {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'dropdx-init-force-'));
    try {
      const configPath = path.join(tmpDir, '.config/dropdx.json');
      runInit({}, tmpDir);
      writeFileSync(configPath, '{"version":"0.0.1"}', 'utf8');

      runInit({}, tmpDir);
      expect(readFileSync(configPath, 'utf8')).toBe('{"version":"0.0.1"}');

      runInit({ force: true }, tmpDir);
      const rewritten = JSON.parse(readFileSync(configPath, 'utf8'));
      expect(rewritten.version).toBe(getDropdxVersion());
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
      expect(options.init).toBe(true);

      const relativePath = runInit(options, tmpDir);
      expect(relativePath).toBe('custom/my.config.json');
      expect(existsSync(path.join(tmpDir, relativePath))).toBeTruthy();
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('parses the init command and --force flag without picking up discovered config', () => {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'dropdx-init-parse-'));
    try {
      const options = parseArgs(['init', '--force'], tmpDir);
      expect(options.init).toBe(true);
      expect(options.force).toBe(true);
      expect(options.configPath).toBe(undefined);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('exposes the config version through parsed options', () => {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'dropdx-init-ver-'));
    try {
      const configDir = path.join(tmpDir, '.config');
      runInit({}, tmpDir);
      expect(existsSync(configDir)).toBeTruthy();

      const options = parseArgs([], tmpDir);
      expect(options.configVersion).toBe(getDropdxVersion());
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('warns only when the config version differs from the CLI version', () => {
    expect(getConfigVersionWarning('0.3.0', '0.3.0')).toBe(null);
    expect(getConfigVersionWarning(undefined, '0.3.0')).toBe(null);

    const warning = getConfigVersionWarning('0.1.0', '0.3.0');
    expect(warning?.includes('dropdx v0.1.0')).toBeTruthy();
    expect(warning?.includes('dropdx v0.3.0')).toBeTruthy();
    expect(warning?.includes('dropdx init --force')).toBeTruthy();
  });

  it('stamps the repository config file with the current CLI version', () => {
    const configPath = path.join(process.cwd(), '.config/dropdx.json');
    const repoConfig = JSON.parse(readFileSync(configPath, 'utf8'));
    expect(repoConfig.version).toBe(getDropdxVersion());
  });
});
