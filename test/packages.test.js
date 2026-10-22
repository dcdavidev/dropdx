/**
 * @file test/packages.test.js
 * Unit tests for package discovery and topological sorting.
 */

import assert from 'node:assert/strict';
import process from 'node:process';
import { describe, it } from 'node:test';

import {
  findPackages,
  sortPackagesTopologically,
} from '../dist/utils/packages.js';

describe('Package discovery and topological sort', () => {
  it('discovers the current project package as standalone', () => {
    const packages = findPackages(process.cwd());
    assert.ok(packages.length > 0);
    const selfPkg = packages.find(
      (p) => p.name === '@dcdavidev/relsx' || p.name === 'relsx'
    );
    assert.ok(selfPkg);
    assert.equal(selfPkg.isPublishable, true);
  });

  it('correctly sorts packages topologically by internal dependencies', () => {
    const pkgA = {
      name: 'pkg-a',
      dependencies: { 'pkg-b': '^1.0.0' },
      devDependencies: {},
    };
    const pkgB = {
      name: 'pkg-b',
      dependencies: {},
      devDependencies: {},
    };
    const pkgC = {
      name: 'pkg-c',
      dependencies: { 'pkg-a': '^1.0.0' },
      devDependencies: {},
    };

    const sorted = sortPackagesTopologically([pkgC, pkgA, pkgB]);
    const names = sorted.map((p) => p.name);

    assert.ok(names.indexOf('pkg-b') < names.indexOf('pkg-a'));
    assert.ok(names.indexOf('pkg-a') < names.indexOf('pkg-c'));
  });
});
