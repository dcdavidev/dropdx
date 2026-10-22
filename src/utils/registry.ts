/**
 * @file src/utils/registry.ts
 * NPM Registry interaction, authentication checks (npm whoami), and package metadata.
 */

import type { NpmRegistryInfo } from '../types.js';
import { bold, dim, red, yellow } from './colors.js';
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
