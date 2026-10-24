/**
 * @file test/engine.test.js
 * Unit tests for release engine detection across all supported engines:
 * changeset, release-it, semantic-release, lerna, bumpp, standard-version, np, internal.
 */

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { detectEngine, SUPPORTED_ENGINES } from '../dist/engines/index.js';

describe('Release engine detection', () => {
  it('detects explicit engine option for all supported engines', () => {
    for (const engine of SUPPORTED_ENGINES) {
      assert.equal(detectEngine(process.cwd(), [], { engine }), engine);
    }
  });

  it('defaults to internal when no external release engine is present', () => {
    const engine = detectEngine(process.cwd(), [], { engine: 'auto' });
    assert.equal(engine, 'internal');
  });

  it('detects changeset via @changesets/cli dependency or .changeset/config.json', () => {
    const mockPackages = [
      {
        name: 'pkg-with-changeset',
        dependencies: {},
        devDependencies: { '@changesets/cli': '^2.27.0' },
      },
    ];
    assert.equal(
      detectEngine('/tmp', mockPackages, { engine: 'auto' }),
      'changeset'
    );

    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'dropdx-eng-cs-'));
    try {
      mkdirSync(path.join(tmpDir, '.changeset'), { recursive: true });
      writeFileSync(path.join(tmpDir, '.changeset', 'config.json'), '{}');
      assert.equal(detectEngine(tmpDir, [], { engine: 'auto' }), 'changeset');
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
    assert.equal(
      detectEngine('/tmp', mockPackages, { engine: 'auto' }),
      'release-it'
    );

    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'dropdx-eng-ri-'));
    try {
      writeFileSync(path.join(tmpDir, '.release-it.json'), '{}');
      assert.equal(detectEngine(tmpDir, [], { engine: 'auto' }), 'release-it');
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
    assert.equal(
      detectEngine('/tmp', mockPackages, { engine: 'auto' }),
      'semantic-release'
    );

    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'dropdx-eng-sr-'));
    try {
      writeFileSync(path.join(tmpDir, '.releaserc.json'), '{}');
      assert.equal(
        detectEngine(tmpDir, [], { engine: 'auto' }),
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
    assert.equal(
      detectEngine('/tmp', mockPackages, { engine: 'auto' }),
      'lerna'
    );

    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'dropdx-eng-lerna-'));
    try {
      writeFileSync(path.join(tmpDir, 'lerna.json'), '{"version":"1.0.0"}');
      assert.equal(detectEngine(tmpDir, [], { engine: 'auto' }), 'lerna');
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
    assert.equal(
      detectEngine('/tmp', mockPackages, { engine: 'auto' }),
      'bumpp'
    );

    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'dropdx-eng-bumpp-'));
    try {
      writeFileSync(path.join(tmpDir, 'bump.config.ts'), 'export default {}');
      assert.equal(detectEngine(tmpDir, [], { engine: 'auto' }), 'bumpp');
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
    assert.equal(
      detectEngine('/tmp', mockPackages, { engine: 'auto' }),
      'standard-version'
    );

    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'dropdx-eng-sv-'));
    try {
      writeFileSync(path.join(tmpDir, '.versionrc.json'), '{}');
      assert.equal(
        detectEngine(tmpDir, [], { engine: 'auto' }),
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
    assert.equal(detectEngine('/tmp', mockPackages, { engine: 'auto' }), 'np');

    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'dropdx-eng-np-'));
    try {
      writeFileSync(path.join(tmpDir, '.np-config.json'), '{}');
      assert.equal(detectEngine(tmpDir, [], { engine: 'auto' }), 'np');
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
