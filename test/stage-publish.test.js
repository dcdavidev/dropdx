/**
 * @file test/stage-publish.test.js
 * Unit tests for npm staged publishing (`npm stage publish`, `npm stage approve`),
 * 2FA / EOTP detection, automatic fallback, interactive TTY OTP approval, and non-TTY instructions.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DEFAULT_OPTIONS } from '../dist/config.js';
import {
  buildPublishCommand,
  buildStagePublishCommand,
  publishPackages,
} from '../dist/engines/dropdx-engine.js';
import {
  approveStagedPackage,
  extractStageId,
  fetchStagedPackageId,
  isTwoFactorRequiredError,
} from '../dist/utils/registry.js';

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
    assert.equal(
      isTwoFactorRequiredError(
        'npm error code EOTP\nnpm error This operation requires a one-time password.'
      ),
      true
    );
    assert.equal(
      isTwoFactorRequiredError(
        'Two-factor authentication or granular access token with bypass 2fa is required'
      ),
      true
    );
    assert.equal(
      isTwoFactorRequiredError(
        'Package access requires 2FA and disallow tokens'
      ),
      true
    );
    assert.equal(
      isTwoFactorRequiredError('Token is stage-only (allow-stage-publish)'),
      true
    );
    assert.equal(
      isTwoFactorRequiredError(
        'You cannot publish over the previously published versions: 1.0.0'
      ),
      false
    );
    assert.equal(isTwoFactorRequiredError('ENEEDAUTH'), false);
  });

  it('extracts stageId from standard and JSON npm stage publish outputs', () => {
    const standardOutput =
      '+ @scope/test-pkg@1.2.0 (staged with id 12345678-1234-1234-1234-123456789abc)\nnpm notice package @scope/test-pkg@1.2.0 has been staged with tag latest';
    assert.equal(
      extractStageId(standardOutput),
      '12345678-1234-1234-1234-123456789abc'
    );

    const jsonOutput = JSON.stringify({
      id: '@scope/test-pkg@1.2.0',
      stageId: 'abcdef01-2345-6789-abcd-ef0123456789',
    });
    assert.equal(
      extractStageId(jsonOutput),
      'abcdef01-2345-6789-abcd-ef0123456789'
    );

    assert.equal(extractStageId('+ @scope/test-pkg@1.2.0 (staged)'), undefined);
  });

  it('fetches staged package ID via npm stage list --json when not in stdout', () => {
    const mockExec = (cmd) => {
      assert.match(cmd, /^npm stage list "@scope\/test-pkg" --json/);
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
    assert.equal(stageId, 'stage-uuid-2222');
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
    assert.equal(
      pnpmPub,
      'pnpm --filter "@scope/test-pkg" publish --registry https://registry.npmjs.org/ --access public --no-git-checks --tag next --provenance'
    );

    const pnpmStage = buildStagePublishCommand(
      mockPkg,
      'https://registry.npmjs.org/',
      opts,
      '/workspace',
      true
    );
    assert.equal(
      pnpmStage,
      'pnpm --filter "@scope/test-pkg" stage publish --registry https://registry.npmjs.org/ --access public --tag next --no-git-checks --provenance'
    );

    const npmStage = buildStagePublishCommand(
      mockPkg,
      'https://registry.npmjs.org/',
      opts,
      '/workspace',
      false
    );
    assert.equal(
      npmStage,
      'npm stage publish --registry https://registry.npmjs.org/ --access public --tag next --provenance'
    );
  });

  it('automatically falls back to staged publishing on EOTP error and prints instructions in non-TTY', () => {
    const executedCommands = [];
    const mockExec = (cmd) => {
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

    assert.equal(results.length, 1);
    assert.equal(results[0].success, true);
    assert.equal(results[0].staged, true);
    assert.equal(results[0].approved, false);
    assert.equal(results[0].stageId, '99999999-1111-2222-3333-444444444444');
    assert.equal(executedCommands.length, 2);
    assert.match(executedCommands[1], /stage publish/);
  });

  it('prompts interactively for OTP in TTY and runs npm stage approve automatically', () => {
    const executedCommands = [];
    const mockExec = (cmd) => {
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

    assert.equal(results.length, 1);
    assert.equal(results[0].success, true);
    assert.equal(results[0].staged, true);
    assert.equal(results[0].approved, true);
    assert.equal(results[0].stageId, '88888888-1111-2222-3333-444444444444');
    assert.equal(executedCommands.length, 2);
    assert.match(executedCommands[0], /stage publish/);
    assert.equal(
      executedCommands[1],
      'npm stage approve 88888888-1111-2222-3333-444444444444 --registry https://registry.npmjs.org/ --otp 654321'
    );
  });

  it('executes approveStagedPackage with registry and optional otp', () => {
    const calls = [];
    approveStagedPackage(
      'uuid-1234',
      'https://registry.npmjs.org/',
      '112233',
      '/tmp',
      (cmd) => {
        calls.push(cmd);
        return 'ok';
      }
    );
    assert.deepEqual(calls, [
      'npm stage approve uuid-1234 --registry https://registry.npmjs.org/ --otp 112233',
    ]);
  });
});
