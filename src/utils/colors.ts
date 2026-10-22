/**
 * @file src/utils/colors.ts
 * Purple and violet-centric ANSI color palettes and text formatting helpers.
 */

export const c = {
  reset: '\u{1B}[0m',
  bold: '\u{1B}[1m',
  dim: '\u{1B}[2m',
  italic: '\u{1B}[3m',
  underline: '\u{1B}[4m',

  // Basic foreground colors
  black: '\u{1B}[30m',
  red: '\u{1B}[31m',
  green: '\u{1B}[32m',
  yellow: '\u{1B}[33m',
  blue: '\u{1B}[34m',
  magenta: '\u{1B}[35m',
  cyan: '\u{1B}[36m',
  white: '\u{1B}[37m',

  // Bright foreground colors
  brightMagenta: '\u{1B}[95m',
  brightCyan: '\u{1B}[96m',

  // 24-bit Truecolor RGB (Purple & violet aesthetic)
  purple: '\u{1B}[38;2;168;85;247m', // #a855f7 - primary vibrant purple
  lavender: '\u{1B}[38;2;192;132;252m', // #c084fc - soft lavender
  deepViolet: '\u{1B}[38;2;147;51;234m', // #9333ea - deep violet
  fuchsia: '\u{1B}[38;2;217;70;239m', // #d946ef - radiant fuchsia
  gold: '\u{1B}[38;2;251;191;36m', // #fbbf24 - gold warning
  emerald: '\u{1B}[38;2;52;211;153m', // #34d399 - emerald success
  coral: '\u{1B}[38;2;248;113;113m', // #f87171 - coral error
  sky: '\u{1B}[38;2;56;189;248m', // #38bdf8 - sky info
};

/**
 * Wraps text in bold style.
 *
 * @param text - Input text string.
 * @returns Formatted bold text.
 */
export const bold = (text: string): string => `${c.bold}${text}${c.reset}`;

/**
 * Wraps text in dim style.
 *
 * @param text - Input text string.
 * @returns Formatted dim text.
 */
export const dim = (text: string): string => `${c.dim}${text}${c.reset}`;

/**
 * Wraps text in purple color.
 *
 * @param text - Input text string.
 * @returns Formatted purple text.
 */
export const purple = (text: string): string => `${c.purple}${text}${c.reset}`;

/**
 * Wraps text in lavender color.
 *
 * @param text - Input text string.
 * @returns Formatted lavender text.
 */
export const lavender = (text: string): string =>
  `${c.lavender}${text}${c.reset}`;

/**
 * Wraps text in green color.
 *
 * @param text - Input text string.
 * @returns Formatted green text.
 */
export const green = (text: string): string => `${c.emerald}${text}${c.reset}`;

/**
 * Wraps text in red color.
 *
 * @param text - Input text string.
 * @returns Formatted red text.
 */
export const red = (text: string): string => `${c.coral}${text}${c.reset}`;

/**
 * Wraps text in yellow color.
 *
 * @param text - Input text string.
 * @returns Formatted yellow text.
 */
export const yellow = (text: string): string => `${c.gold}${text}${c.reset}`;

/**
 * Wraps text in cyan color.
 *
 * @param text - Input text string.
 * @returns Formatted cyan text.
 */
export const cyan = (text: string): string => `${c.sky}${text}${c.reset}`;
