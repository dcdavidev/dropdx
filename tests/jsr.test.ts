/**
 * @file tests/jsr.test.ts
 * JSR metadata, manifest, and publishing helpers.
 */

import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_OPTIONS } from '../src/config.js';
import {
  buildJsrPublishCommand,
  fetchJsrRegistryInfo,
  getLatestPublishedVersion,
  publishJsrPackages,
  readJsrPackageConfig,
  updateJsrPackageVersion,
} from '../src/utils/jsr.js';

const mockPackage = {
  name: '@npm/test-pkg',
  version: '1.2.3',
  directory: '',
  relativeDir: '.',
  private: false,
  publishConfig: {},
  isPublishable: true,
  dependencies: {},
  devDependencies: {},
  scripts: {},
};

const originalFetch = fetch;

afterEach(() => {
  vi.stubGlobal('fetch', originalFetch);
});

describe('JSR registry and publishing support', () => {
  it('uses the highest version published on either registry', () => {
    expect(getLatestPublishedVersion('1.2.0', '1.3.0')).toBe('1.3.0');
    expect(getLatestPublishedVersion('1.3.0', '1.2.0')).toBe('1.3.0');
    expect(getLatestPublishedVersion()).toBeUndefined();
  });

  it('reads and updates JSONC JSR manifests without removing comments', () => {
    const packageDir = mkdtempSync(path.join(os.tmpdir(), 'dropdx-jsr-'));
    try {
      const configPath = path.join(packageDir, 'jsr.jsonc');
      writeFileSync(
        configPath,
        `{
  // JSR package
  "name": "@scope/pkg",
  "version": "1.2.3",
  "exports": "./src/mod.ts",
}`,
        'utf8'
      );

      expect(readJsrPackageConfig(packageDir)).toStrictEqual({
        configPath,
        name: '@scope/pkg',
      });

      updateJsrPackageVersion(configPath, '1.2.4');
      const updatedConfig = readFileSync(configPath, 'utf8');
      expect(updatedConfig).toContain('// JSR package');
      expect(updatedConfig).toContain('"version": "1.2.4"');
    } finally {
      rmSync(packageDir, { recursive: true, force: true });
    }
  });

  it('fetches the latest version from JSR package metadata', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ latest: '1.0.19' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchJsrRegistryInfo('@scope/pkg')).resolves.toStrictEqual({
      exists: true,
      latestVersion: '1.0.19',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://jsr.io/@scope/pkg/meta.json',
      { headers: { Accept: 'application/json' } }
    );
  });

  it('treats a JSR 404 as a package that has not been published', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 404 })
    );

    await expect(fetchJsrRegistryInfo('@scope/new-pkg')).resolves.toStrictEqual(
      { exists: false }
    );
  });

  it('surfaces JSR registry failures instead of reporting an absent package', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 503 })
    );

    await expect(fetchJsrRegistryInfo('@scope/pkg')).rejects.toThrow(
      'JSR registry responded with HTTP 503'
    );
  });

  it('builds the JSR publish command for npm and pnpm workspaces', () => {
    expect(buildJsrPublishCommand(true, false)).toBe('pnpm dlx jsr publish');
    expect(buildJsrPublishCommand(false, true)).toBe(
      'npx jsr publish --dry-run'
    );
  });

  it('dry-runs JSR publication at the target version and restores the manifest', () => {
    const rootDir = mkdtempSync(path.join(os.tmpdir(), 'dropdx-jsr-dry-run-'));
    try {
      mkdirSync(path.join(rootDir, 'packages', 'test-pkg'), {
        recursive: true,
      });
      writeFileSync(path.join(rootDir, 'pnpm-lock.yaml'), '', 'utf8');
      const packageDir = path.join(rootDir, 'packages', 'test-pkg');
      const configPath = path.join(packageDir, 'jsr.json');
      writeFileSync(
        configPath,
        JSON.stringify({
          name: '@scope/test-pkg',
          version: '1.2.3',
          exports: './src/mod.ts',
        }),
        'utf8'
      );

      const packageInfo = { ...mockPackage, directory: packageDir };
      const executedCommands: string[] = [];
      const results = publishJsrPackages(
        [packageInfo],
        new Map([['@npm/test-pkg', '1.2.4']]),
        new Map([['@npm/test-pkg', { configPath, name: '@scope/test-pkg' }]]),
        { ...DEFAULT_OPTIONS, dryRun: true },
        rootDir,
        {
          runFn(command, cwd) {
            executedCommands.push(command);
            expect(cwd).toBe(packageDir);
            expect(JSON.parse(readFileSync(configPath, 'utf8')).version).toBe(
              '1.2.4'
            );
          },
        }
      );

      expect(executedCommands).toEqual(['pnpm dlx jsr publish --dry-run']);
      expect(JSON.parse(readFileSync(configPath, 'utf8')).version).toBe(
        '1.2.3'
      );
      expect(results).toMatchObject([
        {
          name: '@scope/test-pkg',
          version: '1.2.4',
          success: true,
          registry: 'https://jsr.io/',
        },
      ]);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });
});
