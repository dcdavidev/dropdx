/**
 * @file tests/config.test.ts
 * Unit tests for .config/dropdx.config.{json,jsonc,yaml,yml,toml} loading and CLI override precedence.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_CONFIG_PATH,
  loadConfigFile,
  parseArgs,
} from '../src/config.js';
import {
  parseJsoncConfig,
  parseTomlConfig,
  parseYamlConfig,
} from '../src/utils/config-parser.js';

describe('.config/dropdx.config.* loader, multi-format parsers, and precedence', () => {
  it('loads default .config/dropdx.config.json from the repository root', () => {
    const { config, configPath } = loadConfigFile(process.cwd());
    expect(configPath).toBe(DEFAULT_CONFIG_PATH);
    expect(config.conventionalCommits).toBe(true);
    expect(config.engine).toBe('auto');
  });

  it('merges .config/dropdx.config.json and lets CLI flags take precedence', () => {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'dropdx-config-'));
    try {
      const configDir = path.join(tmpDir, '.config');
      mkdirSync(configDir, { recursive: true });
      writeFileSync(
        path.join(configDir, 'dropdx.config.json'),
        JSON.stringify({
          conventionalCommits: false,
          engine: 'internal',
          skipBuild: true,
        }),
        'utf8'
      );

      const fromConfigOnly = parseArgs([], tmpDir);
      expect(fromConfigOnly.configPath).toBe('.config/dropdx.config.json');
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
      writeFileSync(
        path.join(configDir, 'dropdx.config.jsonc'),
        jsoncContent,
        'utf8'
      );

      const options = parseArgs([], tmpDir);
      expect(options.configPath).toBe('.config/dropdx.config.jsonc');
      expect(options.engine).toBe('internal');
      expect(options.skipBuild).toBe(true);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('parses and loads YAML (.yaml / .yml) configuration files', () => {
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
      writeFileSync(
        path.join(configDir, 'dropdx.config.yaml'),
        yamlContent,
        'utf8'
      );

      const options = parseArgs([], tmpDir);
      expect(options.configPath).toBe('.config/dropdx.config.yaml');
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
      writeFileSync(
        path.join(configDir, 'dropdx.config.toml'),
        tomlContent,
        'utf8'
      );

      const options = parseArgs([], tmpDir);
      expect(options.configPath).toBe('.config/dropdx.config.toml');
      expect(options.conventionalCommits).toBe(false);
      expect(options.engine).toBe('changeset');
      expect(options.allowDirty).toBe(true);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('loads all example configuration files from examples/', () => {
    const exampleFiles = [
      'examples/dropdx.config.json',
      'examples/dropdx.config.jsonc',
      'examples/dropdx.config.yaml',
      'examples/dropdx.config.toml',
    ];

    for (const file of exampleFiles) {
      const { config, configPath } = loadConfigFile(process.cwd(), file);
      expect(configPath).toBe(file);
      expect(config.conventionalCommits).toBe(true);
      expect(config.engine).toBe('auto');
      expect(config.skipBuild).toBe(false);
      expect(config.skipGit).toBe(false);
      expect(config.skipPublish).toBe(false);
      expect(config.allowDirty).toBe(false);
    }
  });
});
