/**
 * @file test/engine.test.js
 * Unit tests for release engine detection (changeset, release-it, internal).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { detectEngine } from '../dist/engines/index.js';

describe('Release engine detection', () => {
  it('detects explicit engine option if passed', () => {
    assert.equal(
      detectEngine(process.cwd(), [], { engine: 'changeset' }),
      'changeset'
    );
    assert.equal(
      detectEngine(process.cwd(), [], { engine: 'release-it' }),
      'release-it'
    );
    assert.equal(
      detectEngine(process.cwd(), [], { engine: 'internal' }),
      'internal'
    );
  });

  it('defaults to internal when neither changeset nor release-it are present', () => {
    const engine = detectEngine(process.cwd(), [], { engine: 'auto' });
    assert.equal(engine, 'internal');
  });

  it('detects changeset when package has @changesets/cli dependency', () => {
    const mockPackages = [
      {
        name: 'pkg-with-changeset',
        dependencies: {},
        devDependencies: { '@changesets/cli': '^2.27.0' },
      },
    ];
    const engine = detectEngine('/tmp', mockPackages, { engine: 'auto' });
    assert.equal(engine, 'changeset');
  });

  it('detects release-it when package has release-it dependency', () => {
    const mockPackages = [
      {
        name: 'pkg-with-release-it',
        dependencies: {},
        devDependencies: { 'release-it': '^17.0.0' },
      },
    ];
    const engine = detectEngine('/tmp', mockPackages, { engine: 'auto' });
    assert.equal(engine, 'release-it');
  });
});
