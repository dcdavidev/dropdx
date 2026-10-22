/**
 * @file test/npmrc.test.js
 * Unit tests for .npmrc parsing and registry resolution.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_REGISTRY,
  normalizeRegistryUrl,
  resolveRegistry,
} from '../dist/utils/npmrc.js';

describe('.npmrc and registry resolver', () => {
  it('normalizes registry URLs correctly', () => {
    assert.equal(
      normalizeRegistryUrl('registry.npmjs.org'),
      'https://registry.npmjs.org/'
    );
    assert.equal(
      normalizeRegistryUrl('https://custom-registry.com'),
      'https://custom-registry.com/'
    );
    assert.equal(
      normalizeRegistryUrl('http://insecure.local/npm/'),
      'http://insecure.local/npm/'
    );
  });

  it('respects CLI registry override', () => {
    const reg = resolveRegistry(
      '@foo/bar',
      { registry: 'https://override.org' },
      process.cwd()
    );
    assert.equal(reg, 'https://override.org/');
  });

  it('falls back to default registry when no custom config exists', () => {
    const reg = resolveRegistry('some-unscoped-pkg', {}, '/non-existent-dir');
    assert.equal(reg, DEFAULT_REGISTRY);
  });
});
