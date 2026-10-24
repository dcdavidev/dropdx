/**
 * @file src/utils/exec.ts
 * Command execution wrappers with stdout/stderr capture and error handling.
 */

import { execSync, spawnSync } from 'node:child_process';
import process from 'node:process';

export interface ExecOptions {
  stdio?: 'inherit' | 'pipe' | 'ignore';
  cwd?: string;
  env?: Record<string, string | undefined>;
}

/**
 * Executes a shell command synchronously and returns standard output trimmed.
 *
 * @param cmd - Command string.
 * @param options - Execution options.
 * @returns Trimmed output string.
 */
export function exec(cmd: string, options: ExecOptions = {}): string {
  try {
    const res = execSync(cmd, {
      cwd: options.cwd ?? process.cwd(),
      encoding: 'utf8',
      stdio: options.stdio ?? 'pipe',
      env: { ...process.env, ...options.env },
    });
    return res ? res.trim() : '';
  } catch (error: unknown) {
    const err = error as { stderr?: Buffer; stdout?: Buffer; message: string };
    const stderr = err.stderr?.toString().trim() || '';
    const stdout = err.stdout?.toString().trim() || '';
    const combined = [stderr, stdout].filter(Boolean).join('\n');
    const message = combined || err.message;
    throw new Error(`Command failed: ${cmd}\n${message}`, { cause: error });
  }
}

/**
 * Spawns a shell command with inherited stdio and verifies zero exit status.
 *
 * @param cmd - Command string.
 * @param cwd - Target working directory.
 * @param env - Additional environment variables.
 */
export function runInherited(
  cmd: string,
  cwd: string = process.cwd(),
  env: Record<string, string | undefined> = {}
): void {
  const result = spawnSync(cmd, {
    shell: true,
    cwd,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });

  if (result.status !== 0) {
    throw new Error(`Command failed with exit code ${result.status}: ${cmd}`);
  }
}
