/**
 * @file tests/stage-publish.test.ts
 * Unit tests for npm staged publishing (`npm stage publish`, `npm stage approve`),
 * 2FA / EOTP detection, automatic fallback, interactive TTY OTP approval, and non-TTY instructions.
 */

import { describe, expect, it } from 'vitest';

import { DEFAULT_OPTIONS } from '../src/config.js';
import {
  buildPublishCommand,
  buildStagePublishCommand,
  publishPackages,
} from '../src/engines/dropdx-engine.js';
import {
  approveStagedPackage,
  extractStageId,
  fetchStagedPackageId,
  isTwoFactorRequiredError,
} from '../src/utils/registry.js';

const mockPkg = {
  name: '@scope/test-pkg',
  version: '1.2.0',
  directory: '/workspace/packages/test-pkg',
  relativeDir: 'packages/test-pkg',
  private: false,
  publishConfig: { access: 'public' },
  isPublishable: true,
  dependencies: {},
  devDependencies: {},
  scripts: {},
};

describe('Staged publishing and 2FA / EOTP handling', () => {
  it('detects 2FA / EOTP / stage-only errors accurately', () => {
    expect(
      isTwoFactorRequiredError(
        'npm error code EOTP\nnpm error This operation requires a one-time password.'
      )
    ).toBe(true);
    expect(
      isTwoFactorRequiredError(
        'Two-factor authentication or granular access token with bypass 2fa is required'
      )
    ).toBe(true);
    expect(
      isTwoFactorRequiredError(
        'Package access requires 2FA and disallow tokens'
      )
    ).toBe(true);
    expect(
      isTwoFactorRequiredError('Token is stage-only (allow-stage-publish)')
    ).toBe(true);
    expect(
      isTwoFactorRequiredError(
        'You cannot publish over the previously published versions: 1.0.0'
      )
    ).toBe(false);
    expect(isTwoFactorRequiredError('ENEEDAUTH')).toBe(false);
  });

  it('extracts stageId from standard and JSON npm stage publish outputs', () => {
    const standardOutput =
      '+ @scope/test-pkg@1.2.0 (staged with id 12345678-1234-1234-1234-123456789abc)\nnpm notice package @scope/test-pkg@1.2.0 has been staged with tag latest';
    expect(extractStageId(standardOutput)).toBe(
      '12345678-1234-1234-1234-123456789abc'
    );

    const jsonOutput = JSON.stringify({
      id: '@scope/test-pkg@1.2.0',
      stageId: 'abcdef01-2345-6789-abcd-ef0123456789',
    });
    expect(extractStageId(jsonOutput)).toBe(
      'abcdef01-2345-6789-abcd-ef0123456789'
    );

    expect(extractStageId('+ @scope/test-pkg@1.2.0 (staged)')).toBe(undefined);
  });

  it('fetches staged package ID via npm stage list --json when not in stdout', () => {
    const mockExec = (cmd: string): string => {
      expect(cmd).toMatch(/^npm stage list "@scope\/test-pkg" --json/);
      return JSON.stringify([
        {
          id: 'stage-uuid-1111',
          packageName: '@scope/test-pkg',
          version: '1.1.0',
        },
        {
          id: 'stage-uuid-2222',
          packageName: '@scope/test-pkg',
          version: '1.2.0',
        },
      ]);
    };

    const stageId = fetchStagedPackageId(
      '@scope/test-pkg',
      '1.2.0',
      'https://registry.npmjs.org/',
      mockExec
    );
    expect(stageId).toBe('stage-uuid-2222');
  });

  it('builds publish and stage publish commands for pnpm and npm', () => {
    const opts = { ...DEFAULT_OPTIONS, provenance: true, tag: 'next' };

    const pnpmPub = buildPublishCommand(
      mockPkg,
      'https://registry.npmjs.org/',
      opts,
      '/workspace',
      true
    );
    expect(pnpmPub).toBe(
      'pnpm --filter "@scope/test-pkg" publish --registry https://registry.npmjs.org/ --access public --no-git-checks --tag next --provenance'
    );

    const pnpmStage = buildStagePublishCommand(
      mockPkg,
      'https://registry.npmjs.org/',
      opts,
      '/workspace',
      true
    );
    expect(pnpmStage).toBe(
      'pnpm --filter "@scope/test-pkg" stage publish --registry https://registry.npmjs.org/ --access public --tag next --no-git-checks --provenance'
    );

    const npmStage = buildStagePublishCommand(
      mockPkg,
      'https://registry.npmjs.org/',
      opts,
      '/workspace',
      false
    );
    expect(npmStage).toBe(
      'npm stage publish --registry https://registry.npmjs.org/ --access public --tag next --provenance'
    );
  });

  it('automatically falls back to staged publishing on EOTP error and prints instructions in non-TTY', () => {
    const executedCommands: string[] = [];
    const mockExec = (cmd: string): string => {
      executedCommands.push(cmd);
      if (cmd.includes(' publish ') && !cmd.includes('stage publish')) {
        throw new Error(
          'Command failed: pnpm publish\nnpm error code EOTP\nnpm error This operation requires a one-time password.'
        );
      }
      return cmd.includes('stage publish')
        ? '+ @scope/test-pkg@1.2.0 (staged with id 99999999-1111-2222-3333-444444444444)'
        : '';
    };

    const results = publishPackages(
      [mockPkg],
      new Map([['@scope/test-pkg', '1.2.0']]),
      { ...DEFAULT_OPTIONS },
      process.cwd(),
      {
        execFn: mockExec,
        isInteractiveFn: () => false,
        promptOtpFn: () => '',
      }
    );

    expect(results.length).toBe(1);
    expect(results[0].success).toBe(true);
    expect(results[0].staged).toBe(true);
    expect(results[0].approved).toBe(false);
    expect(results[0].stageId).toBe('99999999-1111-2222-3333-444444444444');
    expect(executedCommands.length).toBe(2);
    expect(executedCommands[1]).toMatch(/stage publish/);
  });

  it('prompts interactively for OTP in TTY and runs npm stage approve automatically', () => {
    const executedCommands: string[] = [];
    const mockExec = (cmd: string): string => {
      executedCommands.push(cmd);
      if (cmd.includes('stage publish')) {
        return '+ @scope/test-pkg@1.2.0 (staged with id 88888888-1111-2222-3333-444444444444)';
      }
      return cmd.startsWith('npm stage approve')
        ? 'Staged package 88888888-1111-2222-3333-444444444444 approved and published successfully.'
        : '';
    };

    const results = publishPackages(
      [mockPkg],
      new Map([['@scope/test-pkg', '1.2.0']]),
      { ...DEFAULT_OPTIONS, stage: true },
      process.cwd(),
      {
        execFn: mockExec,
        isInteractiveFn: () => true,
        promptOtpFn: () => '654321',
      }
    );

    expect(results.length).toBe(1);
    expect(results[0].success).toBe(true);
    expect(results[0].staged).toBe(true);
    expect(results[0].approved).toBe(true);
    expect(results[0].stageId).toBe('88888888-1111-2222-3333-444444444444');
    expect(executedCommands.length).toBe(2);
    expect(executedCommands[0]).toMatch(/stage publish/);
    expect(executedCommands[1]).toBe(
      'npm stage approve 88888888-1111-2222-3333-444444444444 --registry https://registry.npmjs.org/ --otp 654321'
    );
  });

  it('executes approveStagedPackage with registry and optional otp', () => {
    const calls: string[] = [];
    approveStagedPackage(
      'uuid-1234',
      'https://registry.npmjs.org/',
      '112233',
      '/tmp',
      (cmd: string) => {
        calls.push(cmd);
        return 'ok';
      }
    );
    expect(calls).toStrictEqual([
      'npm stage approve uuid-1234 --registry https://registry.npmjs.org/ --otp 112233',
    ]);
  });
});
