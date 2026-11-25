/**
 * @file tests/packages.test.ts
 * Unit tests for package discovery and topological sorting.
 */

import process from 'node:process';

import { describe, expect, it } from 'vitest';

import {
  findPackages,
  sortPackagesTopologically,
} from '../src/utils/packages.js';
import { mockPackage } from './helpers/mock-package.js';

describe('Package discovery and topological sort', () => {
  it('discovers the current project package as standalone', () => {
    const packages = findPackages(process.cwd());
    expect(packages.length > 0).toBeTruthy();
    const selfPkg = packages.find(
      (p) => p.name === 'dropdx' || p.name === '@dcdavidev/dropdx'
    );
    expect(selfPkg).toBeTruthy();
    expect(selfPkg?.isPublishable).toBe(true);
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

    const sorted = sortPackagesTopologically(
      [pkgC, pkgA, pkgB].map((p) => mockPackage(p))
    );
    const names = sorted.map((p) => p.name);

    expect(names.indexOf('pkg-b') < names.indexOf('pkg-a')).toBeTruthy();
    expect(names.indexOf('pkg-a') < names.indexOf('pkg-c')).toBeTruthy();
  });
});
