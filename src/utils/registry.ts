/**
 * @file src/utils/registry.ts
 * NPM Registry interaction, authentication checks (npm whoami), package metadata,
 * and staged publishing / 2FA helpers.
 */

import { readSync } from 'node:fs';
import process from 'node:process';

import type { NpmRegistryInfo } from '../types.js';
import { bold, cyan, dim, red, yellow } from './colors.js';
import { exec } from './exec.js';

/**
 * Checks npm authentication using `npm whoami`.
 *
 * @param registry - Target registry URL.
 * @returns Authenticated npm username.
 */
export function checkNpmWhoami(registry: string): string {
  try {
    const user = exec(`npm whoami --registry ${registry}`).trim();
    if (!user || user.includes('npm error') || user.includes('ENEEDAUTH')) {
      throw new Error('npm whoami returned empty or invalid response');
    }
    return user;
  } catch (error: unknown) {
    const err = error as Error;
    console.error(
      `\n  ${red('Authentication failure:')} You are not authenticated with registry ${bold(registry)}.\n` +
        `  ${yellow('Fix:')} Ensure ${bold('NPM_TOKEN')} or ${bold('NODE_AUTH_TOKEN')} is exported, or run ${bold(`npm login --registry ${registry}`)}.\n` +
        `  ${dim(err.message)}\n`
    );
    throw new Error(
      `npm authentication check failed for registry ${registry}`,
      {
        cause: error,
      }
    );
  }
}

/**
 * Fetches package details and maintainers from the registry.
 *
 * @param pkgName - Target package name string.
 * @param registry - Destination registry URL.
 * @returns Registry metadata and maintainers.
 */
export async function fetchNpmRegistryInfo(
  pkgName: string,
  registry: string
): Promise<NpmRegistryInfo> {
  const cleanRegistry = registry.endsWith('/') ? registry : `${registry}/`;
  const url = `${cleanRegistry}${encodeURIComponent(pkgName)}`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (response.status === 404) {
      return { exists: false, isUnpublished: false, maintainers: [] };
    }

    if (!response.ok) {
      throw new Error(`Registry responded with HTTP ${response.status}`);
    }

    const data = (await response.json()) as {
      maintainers?: Array<string | { name: string }>;
      time?: { unpublished?: unknown };
      'dist-tags'?: { latest?: string };
    };

    const isUnpublished = Boolean(
      data.time?.unpublished || !data['dist-tags']?.latest
    );
    const latestVersion = isUnpublished ? undefined : data['dist-tags']?.latest;
    const maintainers = Array.isArray(data.maintainers)
      ? data.maintainers.map((m) =>
          (typeof m === 'string' ? m : m.name).toLowerCase()
        )
      : [];

    return {
      exists: !isUnpublished,
      isUnpublished,
      latestVersion,
      maintainers,
    };
  } catch {
    // Network or parse fallback via npm view CLI
    try {
      const latestRaw = exec(
        `npm view "${pkgName}" version --registry ${cleanRegistry} --json 2>/dev/null`
      );
      const latest = latestRaw ? (JSON.parse(latestRaw) as string) : undefined;
      const ownersRaw = exec(
        `npm owner ls "${pkgName}" --registry ${cleanRegistry} 2>/dev/null || true`
      );
      const owners = ownersRaw
        .split('\n')
        .map((line) => line.trim().split(' ', 1)[0]?.toLowerCase())
        .filter(Boolean);

      return {
        exists: Boolean(latest),
        isUnpublished: false,
        latestVersion: latest,
        maintainers: owners,
      };
    } catch {
      return { exists: false, isUnpublished: false, maintainers: [] };
    }
  }
}

/**
 * Determines whether a publish failure message indicates that Two-Factor Authentication (2FA/OTP)
 * or staged publishing is required by the npm registry.
 *
 * @param errorMessage - Error output from `npm publish` or `pnpm publish`.
 * @returns True if the failure is caused by a 2FA / OTP / stage-only requirement.
 */
export function isTwoFactorRequiredError(errorMessage: string): boolean {
  if (!errorMessage) {
    return false;
  }

  const patterns = [
    /\beotp\b/i,
    /one-time pass(?:word)?/i,
    /two-factor authentication/i,
    /\b2fa\b/i,
    /--otp\b/i,
    /disallow tokens/i,
    /stage[- ]only/i,
    /only allowed to stage/i,
    /allow-stage-publish/i,
  ];

  return patterns.some((pattern) => pattern.test(errorMessage));
}

/**
 * Extracts a stage ID from the stdout/stderr of `npm stage publish` or `pnpm stage publish`.
 *
 * @param output - Command output string.
 * @returns Extracted stage ID, if present.
 */
export function extractStageId(output: string): string | undefined {
  if (!output) {
    return undefined;
  }

  // Matches: "+ pkg@1.0.0 (staged with id 12345678-1234-1234-1234-123456789abc)"
  const stagedWithIdMatch = /staged with id\s+([0-9a-zA-Z_-]{8,})/i.exec(
    output
  );
  if (stagedWithIdMatch?.[1]) {
    return stagedWithIdMatch[1];
  }

  // Matches JSON field: "stageId": "..."
  const jsonStageIdMatch = /"stageId"\s*:\s*"([^"]+)"/i.exec(output);
  if (jsonStageIdMatch?.[1]) {
    return jsonStageIdMatch[1];
  }

  // Matches UUID formatted stage id labels: "stage id: <uuid>" or "stage-id: <uuid>"
  const uuidLabelMatch =
    /stage[-_\s]?id\s*[:=]\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i.exec(
      output
    );
  return uuidLabelMatch?.[1];
}

/**
 * Queries `npm stage list` in JSON mode to find the stage ID for a staged package version.
 *
 * @param pkgName - Target npm package identifier.
 * @param version - Staged SemVer version string.
 * @param registry - Target npm registry URL.
 * @param execFn - Command execution function (injectable for testing).
 * @returns Stage ID if found.
 */
export function fetchStagedPackageId(
  pkgName: string,
  version: string,
  registry: string,
  execFn: typeof exec = exec
): string | undefined {
  try {
    const raw = execFn(
      `npm stage list "${pkgName}" --json --registry ${registry}`
    );
    if (!raw) {
      return undefined;
    }

    const parsed = JSON.parse(raw) as unknown;
    const items = Array.isArray(parsed)
      ? (parsed as Array<{
          id?: string;
          stageId?: string;
          packageName?: string;
          name?: string;
          version?: string;
        }>)
      : [];

    const matchingVersion = items.find(
      (item) =>
        item.version === version &&
        (!item.packageName || item.packageName === pkgName) &&
        (!item.name || item.name === pkgName)
    );

    if (matchingVersion) {
      return matchingVersion.id || matchingVersion.stageId;
    }

    const first = items[0];
    return first?.id || first?.stageId;
  } catch {
    return undefined;
  }
}

/**
 * Checks whether the current process is running in an interactive TTY terminal
 * where the user can be prompted for a 2FA OTP code.
 *
 * @returns True if interactive TTY and not CI.
 */
export function isInteractiveTty(): boolean {
  return Boolean(
    process.stdin.isTTY &&
    process.stdout.isTTY &&
    !process.env.CI &&
    !process.env.GITHUB_ACTIONS
  );
}

/**
 * Prompts the user synchronously in a TTY terminal for a 2FA One-Time Password (OTP)
 * to approve a staged package release.
 *
 * @param pkgName - Package name.
 * @param version - Package version.
 * @returns Trimmed OTP string (empty string if user skipped).
 */
export function promptOtpInteractive(pkgName: string, version: string): string {
  process.stdout.write(
    `  ${cyan('🔐')} Enter 2FA OTP to approve staged ${bold(`${pkgName}@${version}`)} ${dim('(press Enter to skip and approve later)')}: `
  );

  const chunks: Buffer[] = [];
  const buf = Buffer.alloc(1);

  try {
    while (true) {
      const bytesRead = readSync(process.stdin.fd, buf, 0, 1, null);
      if (bytesRead === 0) {
        break;
      }
      const char = buf.toString('utf8');
      if (char === '\n') {
        break;
      }
      if (char !== '\r') {
        chunks.push(Buffer.from(buf));
      }
    }
  } catch {
    return '';
  }

  return Buffer.concat(chunks).toString('utf8').trim();
}

/**
 * Approves a staged package release on the npm registry using `npm stage approve`.
 *
 * @param stageId - Staged release identifier.
 * @param registry - Target npm registry URL.
 * @param otp - Optional 2FA one-time password.
 * @param cwd - Working directory.
 * @param execFn - Command execution function (injectable for testing).
 * @returns Command output.
 */
export function approveStagedPackage(
  stageId: string,
  registry: string,
  otp?: string,
  cwd?: string,
  execFn: typeof exec = exec
): string {
  const args = ['npm stage approve', stageId, `--registry ${registry}`];
  if (otp) {
    args.push(`--otp ${otp}`);
  }
  return execFn(args.join(' '), { cwd });
}
