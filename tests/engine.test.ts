/**
 * @file tests/engine.test.ts
 * Unit tests for release engine detection across all supported engines:
 * changeset, release-it, semantic-release, lerna, bumpp, standard-version, np, internal.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { detectEngine, SUPPORTED_ENGINES } from '../src/engines/index.js';
import { mockPackage } from './helpers/mock-package.js';

describe('Release engine detection', () => {
  it('detects explicit engine option for all supported engines', () => {
    for (const engine of SUPPORTED_ENGINES) {
      expect(detectEngine(process.cwd(), [], { engine })).toBe(engine);
    }
  });

  it('defaults to internal when no external release engine is present', () => {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'dropdx-engine-'));
    try {
      const engine = detectEngine(tmpDir, [], { engine: 'auto' });
      expect(engine).toBe('internal');
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('detects changeset via @changesets/cli dependency or .changeset/config.json', () => {
    const mockPackages = [
      {
        name: 'pkg-with-changeset',
        dependencies: {},
        devDependencies: { '@changesets/cli': '^2.27.0' },
      },
    ];
    expect(
      detectEngine(
        '/tmp',
        mockPackages.map((p) => mockPackage(p)),
        {
          engine: 'auto',
        }
      )
    ).toBe('changeset');

    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'dropdx-eng-cs-'));
    try {
      mkdirSync(path.join(tmpDir, '.changeset'), { recursive: true });
      writeFileSync(path.join(tmpDir, '.changeset', 'config.json'), '{}');
      expect(detectEngine(tmpDir, [], { engine: 'auto' })).toBe('changeset');
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('detects release-it via release-it dependency or .release-it.json', () => {
    const mockPackages = [
      {
        name: 'pkg-with-release-it',
        dependencies: {},
        devDependencies: { 'release-it': '^17.0.0' },
      },
    ];
    expect(
      detectEngine(
        '/tmp',
        mockPackages.map((p) => mockPackage(p)),
        {
          engine: 'auto',
        }
      )
    ).toBe('release-it');

    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'dropdx-eng-ri-'));
    try {
      writeFileSync(path.join(tmpDir, '.release-it.json'), '{}');
      expect(detectEngine(tmpDir, [], { engine: 'auto' })).toBe('release-it');
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('detects semantic-release via semantic-release dependency or .releaserc.json', () => {
    const mockPackages = [
      {
        name: 'pkg-with-semantic-release',
        dependencies: {},
        devDependencies: { 'semantic-release': '^24.0.0' },
      },
    ];
    expect(
      detectEngine(
        '/tmp',
        mockPackages.map((p) => mockPackage(p)),
        {
          engine: 'auto',
        }
      )
    ).toBe('semantic-release');

    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'dropdx-eng-sr-'));
    try {
      writeFileSync(path.join(tmpDir, '.releaserc.json'), '{}');
      expect(detectEngine(tmpDir, [], { engine: 'auto' })).toBe(
        'semantic-release'
      );
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('detects lerna via lerna dependency or lerna.json', () => {
    const mockPackages = [
      {
        name: 'pkg-with-lerna',
        dependencies: {},
        devDependencies: { lerna: '^8.0.0' },
      },
    ];
    expect(
      detectEngine(
        '/tmp',
        mockPackages.map((p) => mockPackage(p)),
        {
          engine: 'auto',
        }
      )
    ).toBe('lerna');

    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'dropdx-eng-lerna-'));
    try {
      writeFileSync(path.join(tmpDir, 'lerna.json'), '{"version":"1.0.0"}');
      expect(detectEngine(tmpDir, [], { engine: 'auto' })).toBe('lerna');
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('detects bumpp via bumpp dependency or bump.config.ts', () => {
    const mockPackages = [
      {
        name: 'pkg-with-bumpp',
        dependencies: {},
        devDependencies: { bumpp: '^9.0.0' },
      },
    ];
    expect(
      detectEngine(
        '/tmp',
        mockPackages.map((p) => mockPackage(p)),
        {
          engine: 'auto',
        }
      )
    ).toBe('bumpp');

    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'dropdx-eng-bumpp-'));
    try {
      writeFileSync(path.join(tmpDir, 'bump.config.ts'), 'export default {}');
      expect(detectEngine(tmpDir, [], { engine: 'auto' })).toBe('bumpp');
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('detects standard-version via commit-and-tag-version / standard-version dependency or .versionrc.json', () => {
    const mockPackages = [
      {
        name: 'pkg-with-catv',
        dependencies: {},
        devDependencies: { 'commit-and-tag-version': '^12.0.0' },
      },
    ];
    expect(
      detectEngine(
        '/tmp',
        mockPackages.map((p) => mockPackage(p)),
        {
          engine: 'auto',
        }
      )
    ).toBe('standard-version');

    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'dropdx-eng-sv-'));
    try {
      writeFileSync(path.join(tmpDir, '.versionrc.json'), '{}');
      expect(detectEngine(tmpDir, [], { engine: 'auto' })).toBe(
        'standard-version'
      );
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('detects np via np dependency or .np-config.json', () => {
    const mockPackages = [
      {
        name: 'pkg-with-np',
        dependencies: {},
        devDependencies: { np: '^10.0.0' },
      },
    ];
    expect(
      detectEngine(
        '/tmp',
        mockPackages.map((p) => mockPackage(p)),
        {
          engine: 'auto',
        }
      )
    ).toBe('np');

    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'dropdx-eng-np-'));
    try {
      writeFileSync(path.join(tmpDir, '.np-config.json'), '{}');
      expect(detectEngine(tmpDir, [], { engine: 'auto' })).toBe('np');
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
