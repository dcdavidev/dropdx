/**
 * @file tests/helpers/mock-package.ts
 * Builds complete WorkspacePackage fixtures from the few fields a test cares about.
 */

import type { WorkspacePackage } from '../../src/types.js';

/**
 * Creates a WorkspacePackage with sensible defaults for every field not given.
 *
 * @param overrides - Fields to set on the fixture; `name` is required.
 * @returns A complete WorkspacePackage fixture.
 */
export function mockPackage(
  overrides: Partial<WorkspacePackage> & Pick<WorkspacePackage, 'name'>
): WorkspacePackage {
  return {
    version: '1.0.0',
    directory: '/tmp',
    relativeDir: '.',
    private: false,
    publishConfig: {},
    isPublishable: true,
    dependencies: {},
    devDependencies: {},
    scripts: {},
    ...overrides,
  };
}
