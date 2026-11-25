/**
 * @file tests/npmrc.test.ts
 * Unit tests for .npmrc parsing and registry resolution.
 */

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_REGISTRY,
  normalizeRegistryUrl,
  resolveRegistry,
} from '../src/utils/npmrc.js';

describe('.npmrc and registry resolver', () => {
  it('normalizes registry URLs correctly', () => {
    expect(normalizeRegistryUrl('registry.npmjs.org')).toBe(
      'https://registry.npmjs.org/'
    );
    expect(normalizeRegistryUrl('https://custom-registry.com')).toBe(
      'https://custom-registry.com/'
    );
    expect(normalizeRegistryUrl('http://insecure.local/npm/')).toBe(
      'http://insecure.local/npm/'
    );
  });

  it('respects CLI registry override', () => {
    const reg = resolveRegistry(
      '@foo/bar',
      { registry: 'https://override.org' },
      process.cwd()
    );
    expect(reg).toBe('https://override.org/');
  });

  it('falls back to default registry when no custom config exists', () => {
    const reg = resolveRegistry('some-unscoped-pkg', {}, '/non-existent-dir');
    expect(reg).toBe(DEFAULT_REGISTRY);
  });
});
