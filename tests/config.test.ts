/**
 * @file tests/config.test.ts
 * Unit tests for cosmiconfig discovery, multi-format parsers, and CLI precedence.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

import { describe, expect, it } from 'vitest';

import { loadConfigFile, parseArgs } from '../src/config.js';
import {
  parseJsoncConfig,
  parseTomlConfig,
  parseYamlConfig,
} from '../src/utils/config-parser.js';

describe('cosmiconfig loader, multi-format parsers, and precedence', () => {
  it('loads the repository .config/dropdx.yml configuration', () => {
    const { config, configPath } = loadConfigFile(process.cwd());
    expect(configPath).toBe('.config/dropdx.yml');
    expect(config.conventionalCommits).toBe(true);
    expect(config.engine).toBe('auto');
  });

  it.each([
    ['.config/dropdx.json', '{"engine":"internal"}'],
    ['.config/dropdx.jsonc', '{"engine":"internal",}'],
    ['.config/dropdx.yml', 'engine: internal'],
    ['.config/dropdx.toml', "engine = 'internal'"],
    ['dropdx.config.json', '{"engine":"internal"}'],
    ['dropdx.config.jsonc', '{"engine":"internal",}'],
    ['dropdx.config.yml', 'engine: internal'],
    ['dropdx.config.toml', "engine = 'internal'"],
  ] as const)('discovers %s', (configFile, content) => {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'dropdx-discovery-'));
    try {
      const fullPath = path.join(tmpDir, configFile);
      mkdirSync(path.dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, content, 'utf8');

      const { config, configPath } = loadConfigFile(tmpDir);
      expect(config.engine).toBe('internal');
      expect(configPath).toBe(configFile);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('prefers .config files over workspace-root dropdx.config files', () => {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'dropdx-precedence-'));
    try {
      const configDir = path.join(tmpDir, '.config');
      mkdirSync(configDir, { recursive: true });
      writeFileSync(
        path.join(configDir, 'dropdx.json'),
        '{"engine":"internal"}'
      );
      writeFileSync(
        path.join(tmpDir, 'dropdx.config.json'),
        '{"engine":"changeset"}'
      );

      const { config, configPath } = loadConfigFile(tmpDir);
      expect(config.engine).toBe('internal');
      expect(configPath).toBe('.config/dropdx.json');
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('keeps an empty .config file ahead of a populated root config file', () => {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'dropdx-empty-config-'));
    try {
      const configDir = path.join(tmpDir, '.config');
      mkdirSync(configDir, { recursive: true });
      writeFileSync(path.join(configDir, 'dropdx.yml'), '', 'utf8');
      writeFileSync(
        path.join(tmpDir, 'dropdx.config.json'),
        '{"engine":"changeset"}',
        'utf8'
      );

      const { config, configPath } = loadConfigFile(tmpDir);
      expect(config).toStrictEqual({});
      expect(configPath).toBe('.config/dropdx.yml');
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('does not search parent directories outside the workspace root', () => {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'dropdx-workspace-'));
    try {
      const workspaceDir = path.join(tmpDir, 'workspace');
      mkdirSync(workspaceDir);
      writeFileSync(
        path.join(tmpDir, 'dropdx.config.json'),
        '{"engine":"internal"}'
      );

      const { config, configPath } = loadConfigFile(workspaceDir);
      expect(config).toStrictEqual({});
      expect(configPath).toBeUndefined();
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('reports an explicitly requested config file that does not exist', () => {
    const tmpDir = mkdtempSync(
      path.join(os.tmpdir(), 'dropdx-explicit-config-')
    );
    try {
      expect(() => loadConfigFile(tmpDir, 'missing/dropdx.json')).toThrow();
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('merges .config/dropdx.json and lets CLI flags take precedence', () => {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'dropdx-config-'));
    try {
      const configDir = path.join(tmpDir, '.config');
      mkdirSync(configDir, { recursive: true });
      writeFileSync(
        path.join(configDir, 'dropdx.json'),
        JSON.stringify({
          conventionalCommits: false,
          engine: 'internal',
          skipBuild: true,
        }),
        'utf8'
      );

      const fromConfigOnly = parseArgs([], tmpDir);
      expect(fromConfigOnly.configPath).toBe('.config/dropdx.json');
      expect(fromConfigOnly.conventionalCommits).toBe(false);
      expect(fromConfigOnly.engine).toBe('internal');
      expect(fromConfigOnly.skipBuild).toBe(true);
      expect(fromConfigOnly.tag).toBe('latest');

      const withCliOverrides = parseArgs(
        [
          '--tag',
          'next',
          '--engine',
          'changeset',
          '--conventional-commits',
          '--stage',
        ],
        tmpDir
      );
      expect(withCliOverrides.tag).toBe('next');
      expect(withCliOverrides.engine).toBe('changeset');
      expect(withCliOverrides.conventionalCommits).toBe(true);
      expect(withCliOverrides.stage).toBe(true);
      expect(withCliOverrides.skipBuild).toBe(true);

      const withNoStageOverride = parseArgs(['--no-stage'], tmpDir);
      expect(withNoStageOverride.stage).toBe(false);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('enables optional JSR publishing through config and CLI flags', () => {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'dropdx-jsr-config-'));
    try {
      writeFileSync(
        path.join(tmpDir, 'dropdx.config.json'),
        '{"publishToJsr":true}',
        'utf8'
      );

      expect(parseArgs([], tmpDir).publishToJsr).toBe(true);
      expect(parseArgs(['--no-jsr'], tmpDir).publishToJsr).toBe(false);
      expect(parseArgs(['--jsr'], tmpDir).publishToJsr).toBe(true);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('parses and loads JSONC configuration files with comments and trailing commas', () => {
    const jsoncContent = `{
      // Enable conventional commits
      "conventionalCommits": true,
      /* Custom engine */
      "engine": "internal",
      "skipBuild": true,
    }`;

    const parsed = parseJsoncConfig(jsoncContent);
    expect(parsed.conventionalCommits).toBe(true);
    expect(parsed.engine).toBe('internal');
    expect(parsed.skipBuild).toBe(true);

    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'dropdx-jsonc-'));
    try {
      const configDir = path.join(tmpDir, '.config');
      mkdirSync(configDir, { recursive: true });
      writeFileSync(path.join(configDir, 'dropdx.jsonc'), jsoncContent, 'utf8');

      const options = parseArgs([], tmpDir);
      expect(options.configPath).toBe('.config/dropdx.jsonc');
      expect(options.engine).toBe('internal');
      expect(options.skipBuild).toBe(true);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('parses YAML and discovers .config/dropdx.yml configuration files', () => {
    const yamlContent = `---
# dropdx YAML configuration
conventionalCommits: true
engine: internal # inline comment
skipGit: true
`;

    const parsed = parseYamlConfig(yamlContent);
    expect(parsed.conventionalCommits).toBe(true);
    expect(parsed.engine).toBe('internal');
    expect(parsed.skipGit).toBe(true);

    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'dropdx-yaml-'));
    try {
      const configDir = path.join(tmpDir, '.config');
      mkdirSync(configDir, { recursive: true });
      writeFileSync(path.join(configDir, 'dropdx.yml'), yamlContent, 'utf8');

      const options = parseArgs([], tmpDir);
      expect(options.configPath).toBe('.config/dropdx.yml');
      expect(options.engine).toBe('internal');
      expect(options.skipGit).toBe(true);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('parses and loads TOML (.toml) configuration files', () => {
    const tomlContent = `# dropdx TOML configuration
conventionalCommits = false
engine = "changeset" # release engine
allowDirty = true
`;

    const parsed = parseTomlConfig(tomlContent);
    expect(parsed.conventionalCommits).toBe(false);
    expect(parsed.engine).toBe('changeset');
    expect(parsed.allowDirty).toBe(true);

    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'dropdx-toml-'));
    try {
      const configDir = path.join(tmpDir, '.config');
      mkdirSync(configDir, { recursive: true });
      writeFileSync(path.join(configDir, 'dropdx.toml'), tomlContent, 'utf8');

      const options = parseArgs([], tmpDir);
      expect(options.configPath).toBe('.config/dropdx.toml');
      expect(options.conventionalCommits).toBe(false);
      expect(options.engine).toBe('changeset');
      expect(options.allowDirty).toBe(true);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
