/**
 * @file src/utils/config-parser.ts
 * Zero-dependency parsers for JSON, JSONC, YAML, and TOML configuration files.
 */

import path from 'node:path';

import type { DropdxConfig } from '../types.js';

/**
 * Strips single-line (`//`) and multi-line (`/* ... *\/`) comments and trailing commas
 * from a JSONC string while preserving characters inside string literals.
 *
 * @param input - Raw JSON or JSONC string.
 * @returns Valid JSON string.
 */
export function stripJsonCommentsAndTrailingCommas(input: string): string {
  let out = '';
  let isInString = false;
  let isEscaped = false;
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    if (isInString) {
      out += ch;
      if (isEscaped) {
        isEscaped = false;
      } else if (ch === '\\') {
        isEscaped = true;
      } else if (ch === '"') {
        isInString = false;
      }
      i += 1;
      continue;
    }

    if (ch === '"') {
      isInString = true;
      out += ch;
      i += 1;
      continue;
    }

    const next = input[i + 1];

    // Single-line comment
    if (ch === '/' && next === '/') {
      i += 2;
      while (i < input.length && input[i] !== '\n') {
        i += 1;
      }
      continue;
    }

    // Multi-line comment
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < input.length && !(input[i] === '*' && input[i + 1] === '/')) {
        i += 1;
      }
      i += 2;
      continue;
    }

    out += ch;
    i += 1;
  }

  // Remove trailing commas before closing braces or brackets
  return out.replaceAll(/,(\s*[}\]])/g, '$1');
}

/**
 * Parses a JSON or JSONC configuration string.
 *
 * @param content - Raw JSON or JSONC text.
 * @returns Parsed configuration object.
 */
export function parseJsoncConfig(content: string): DropdxConfig {
  const cleaned = stripJsonCommentsAndTrailingCommas(content).trim();
  return cleaned ? (JSON.parse(cleaned) as DropdxConfig) : {};
}

/**
 * Strips an inline `#` comment from a YAML or TOML value string while respecting quotes.
 *
 * @param rawValue - Raw value expression on the right-hand side.
 * @returns Value string without trailing comment.
 */
function stripInlineComment(rawValue: string): string {
  let quoteChar: '"' | "'" | null = null;
  let isEscaped = false;

  for (let i = 0; i < rawValue.length; i++) {
    const ch = rawValue[i];

    if (quoteChar) {
      if (isEscaped) {
        isEscaped = false;
      } else if (ch === '\\' && quoteChar === '"') {
        isEscaped = true;
      } else if (ch === quoteChar) {
        quoteChar = null;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      quoteChar = ch;
      continue;
    }

    if (ch === '#') {
      return rawValue.slice(0, i).trim();
    }
  }

  return rawValue.trim();
}

/**
 * Converts a scalar string token from YAML or TOML into a primitive JavaScript value.
 *
 * @param raw - Trimmed scalar token.
 * @returns Parsed boolean, number, undefined, or string value.
 */
function parseScalarValue(raw: string): unknown {
  const val = stripInlineComment(raw);
  if (!val || val === 'null' || val === '~') {
    return undefined;
  }
  if (val === 'true') return true;
  if (val === 'false') return false;

  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    const inner = val.slice(1, -1);
    return val.startsWith('"')
      ? inner.replaceAll(String.raw`\"`, '"').replaceAll(String.raw`\\`, '\\')
      : inner;
  }

  const num = Number(val);
  return Number.isNaN(num) ? val : num;
}

/**
 * Parses a YAML configuration string into a DropdxConfig object.
 *
 * @param content - Raw YAML text.
 * @returns Parsed configuration object.
 */
export function parseYamlConfig(content: string): DropdxConfig {
  const result: Record<string, unknown> = {};
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line === '---' || line === '...' || line.startsWith('#')) {
      continue;
    }

    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) {
      continue;
    }

    const key = line
      .slice(0, colonIndex)
      .trim()
      .replaceAll(/^['"]|['"]$/g, '');
    if (!key) continue;

    const rawVal = line.slice(colonIndex + 1).trim();
    const parsedVal = parseScalarValue(rawVal);
    if (parsedVal !== undefined) {
      result[key] = parsedVal;
    }
  }

  return result as DropdxConfig;
}

/**
 * Parses a TOML configuration string into a DropdxConfig object.
 *
 * @param content - Raw TOML text.
 * @returns Parsed configuration object.
 */
export function parseTomlConfig(content: string): DropdxConfig {
  const result: Record<string, unknown> = {};
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('[')) {
      continue;
    }

    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) {
      continue;
    }

    const key = line
      .slice(0, eqIndex)
      .trim()
      .replaceAll(/^['"]|['"]$/g, '');
    if (!key) continue;

    const rawVal = line.slice(eqIndex + 1).trim();
    const parsedVal = parseScalarValue(rawVal);
    if (parsedVal !== undefined) {
      result[key] = parsedVal;
    }
  }

  return result as DropdxConfig;
}

/**
 * Parses configuration file content according to its file extension
 * (`.json`, `.jsonc`, `.yaml`, `.yml`, `.toml`).
 *
 * @param content - Raw file text.
 * @param filePath - File path or name used to detect format.
 * @returns Parsed DropdxConfig object.
 */
export function parseConfigContent(
  content: string,
  filePath: string
): DropdxConfig {
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case '.yaml':
    case '.yml': {
      return parseYamlConfig(content);
    }
    case '.toml': {
      return parseTomlConfig(content);
    }
    default: {
      return parseJsoncConfig(content);
    }
  }
}
