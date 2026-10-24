/**
 * @file test/config.test.js
 * Unit tests for .config/dropdx.config.{json,jsonc,yaml,yml,toml} loading and CLI override precedence.
 */

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { describe, it } from 'node:test';

import {
  DEFAULT_CONFIG_PATH,
  loadConfigFile,
  parseArgs,
} from '../dist/config.js';
import {
  parseJsoncConfig,
  parseTomlConfig,
  parseYamlConfig,
} from '../dist/utils/config-parser.js';

describe('.config/dropdx.config.* loader, multi-format parsers, and precedence', () => {
  it('loads default .config/dropdx.config.json from the repository root', () => {
    const { config, configPath } = loadConfigFile(process.cwd());
    assert.equal(configPath, DEFAULT_CONFIG_PATH);
    assert.equal(config.conventionalCommits, true);
    assert.equal(config.engine, 'auto');
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
      assert.equal(fromConfigOnly.configPath, '.config/dropdx.config.json');
      assert.equal(fromConfigOnly.conventionalCommits, false);
      assert.equal(fromConfigOnly.engine, 'internal');
      assert.equal(fromConfigOnly.skipBuild, true);
      assert.equal(fromConfigOnly.tag, 'latest');

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
      assert.equal(withCliOverrides.tag, 'next');
      assert.equal(withCliOverrides.engine, 'changeset');
      assert.equal(withCliOverrides.conventionalCommits, true);
      assert.equal(withCliOverrides.stage, true);
      assert.equal(withCliOverrides.skipBuild, true);

      const withNoStageOverride = parseArgs(['--no-stage'], tmpDir);
      assert.equal(withNoStageOverride.stage, false);
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
    assert.equal(parsed.conventionalCommits, true);
    assert.equal(parsed.engine, 'internal');
    assert.equal(parsed.skipBuild, true);

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
      assert.equal(options.configPath, '.config/dropdx.config.jsonc');
      assert.equal(options.engine, 'internal');
      assert.equal(options.skipBuild, true);
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
    assert.equal(parsed.conventionalCommits, true);
    assert.equal(parsed.engine, 'internal');
    assert.equal(parsed.skipGit, true);

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
      assert.equal(options.configPath, '.config/dropdx.config.yaml');
      assert.equal(options.engine, 'internal');
      assert.equal(options.skipGit, true);
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
    assert.equal(parsed.conventionalCommits, false);
    assert.equal(parsed.engine, 'changeset');
    assert.equal(parsed.allowDirty, true);

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
      assert.equal(options.configPath, '.config/dropdx.config.toml');
      assert.equal(options.conventionalCommits, false);
      assert.equal(options.engine, 'changeset');
      assert.equal(options.allowDirty, true);
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
      assert.equal(configPath, file);
      assert.equal(config.conventionalCommits, true);
      assert.equal(config.engine, 'auto');
      assert.equal(config.skipBuild, false);
      assert.equal(config.skipGit, false);
      assert.equal(config.skipPublish, false);
      assert.equal(config.allowDirty, false);
    }
  });
});
