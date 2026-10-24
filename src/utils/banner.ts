/**
 * @file src/utils/banner.ts
 * Console reporting, banners, step logs, help text, and summary tables.
 */

import type { PublishResult } from '../types.js';
import {
  bold,
  c,
  cyan,
  dim,
  green,
  lavender,
  purple,
  red,
  yellow,
} from './colors.js';

export {
  bold,
  c,
  cyan,
  dim,
  green,
  lavender,
  purple,
  red,
  yellow,
} from './colors.js';

/**
 * Prints the main header banner to the console.
 */
export function logBanner(): void {
  console.log(
    `\n${c.purple}${c.bold}╔════════════════════════════════════════════════════════════════════════╗${c.reset}`
  );
  console.log(
    `${c.purple}${c.bold}║             🧙  DROPDX AUTOMATED RELEASE & PUBLISH PIPELINE  🚀        ║${c.reset}`
  );
  console.log(
    `${c.purple}${c.bold}╚════════════════════════════════════════════════════════════════════════╝${c.reset}\n`
  );
}

/**
 * Logs a major release pipeline step.
 *
 * @param current - Current step sequence index.
 * @param total - Total count of pipeline steps.
 * @param title - Step heading text.
 * @param emoji - Indicator emoji.
 */
export function logStep(
  current: number,
  total: number,
  title: string,
  emoji = '⚡'
): void {
  const upperTitle = title.toUpperCase();
  const stepText = `[${current}/${total}] ${emoji}  ${upperTitle}`;
  console.log(`\n${lavender(bold(stepText))}`);
  console.log(dim('─'.repeat(72)));
}

/**
 * Logs a success message.
 *
 * @param msg - Notification text.
 */
export function logSuccess(msg: string): void {
  console.log(`  ${green('✔')} ${msg}`);
}

/**
 * Logs an informational message.
 *
 * @param msg - Informational notice text.
 */
export function logInfo(msg: string): void {
  console.log(`  ${cyan('ℹ')} ${msg}`);
}

/**
 * Logs a warning message.
 *
 * @param msg - Warning text.
 */
export function logWarn(msg: string): void {
  console.log(`  ${yellow('⚠')} ${msg}`);
}

/**
 * Logs an error message.
 *
 * @param msg - Error details.
 */
export function logError(msg: string): void {
  console.error(`  ${red('✖')} ${msg}`);
}

/**
 * Prints pipeline usage guidelines and available flags.
 */
export function printHelp(): void {
  console.log(`
${purple(bold('🧙 DROPDX - Automated Release & Publish CLI 🚀'))}

${purple(bold('Uso:'))}
  ${cyan('npx dropdx')} [opzioni]
  ${cyan('pnpm exec dropdx')} [opzioni]
  ${cyan('dropdx')} [opzioni]

${purple(bold('Opzioni Version Bump:'))}
  ${cyan('--bump <patch|minor|major>')}   Livello di incremento versione (default: patch)
  ${cyan('--patch')}                       Scorciatoia per --bump patch
  ${cyan('--minor')}                       Scorciatoia per --bump minor
  ${cyan('--major')}                       Scorciatoia per --bump major
  ${cyan('-m, --summary <testo>')}         Messaggio di sintesi / commit per la release

${purple(bold('Opzioni Registry & Pubblicazione:'))}
  ${cyan('--registry <url>')}              Registry npm (default: da .npmrc o https://registry.npmjs.org/)
  ${cyan('--tag <name>')}                  npm dist-tag (default: latest)
  ${cyan('--access <public|restricted>')}  Livello di accesso npm (default: public)
  ${cyan('--otp <code>')}                  Codice 2FA One-Time Password per npm
  ${cyan('--stage')}                       Pubblica in staging queue npm (deferring 2FA a npm stage approve)
  ${cyan('--provenance')}                  Genera provenance attestation (utile in CI)

${purple(bold('Opzioni Engine & Workflow:'))}
  ${cyan('-c, --config <path>')}             File di configurazione (default: .config/dropdx.config.json)
  ${cyan('--engine <name>')}                 Engine: auto, changeset, release-it, semantic-release, lerna, bumpp, standard-version, np, internal
  ${cyan('-d, --dry-run')}                 Simula controlli, bump, build e publish senza modifiche remote
  ${cyan('--skip-build')}                  Salta la fase di build dei pacchetti
  ${cyan('--skip-git')}                    Salta commit, tag e push su git
  ${cyan('--skip-publish')}                Salta la pubblicazione sul registry npm
  ${cyan('--allow-dirty')}                 Permette l'esecuzione anche con modifiche non committate nel git repo

${purple(bold('Informazioni Generali:'))}
  ${cyan('-h, --help')}                    Mostra questo messaggio di aiuto
  ${cyan('-v, --version')}                 Mostra la versione di dropdx
`);
}

/**
 * Formats the display status for a single package publish outcome.
 *
 * @param res - Package publish result.
 * @param isDryRun - Whether dry-run mode is active.
 * @returns Colored status string.
 */
function formatPublishStatus(res: PublishResult, isDryRun?: boolean): string {
  if (!res.success) {
    return red(`FAILED (${res.reason || 'unknown'})`);
  }
  if (isDryRun) {
    return yellow(
      res.staged ? 'SIMULATED STAGE (dry-run)' : 'SIMULATED (dry-run)'
    );
  }
  if (res.staged) {
    if (res.approved) {
      return green('PUBLISHED (staged & approved)');
    }
    const idSuffix = res.stageId ? `: ${res.stageId}` : '';
    return cyan(`STAGED (pending 2FA${idSuffix})`);
  }
  return green('PUBLISHED');
}

/**
 * Prints the tabular summary of the release results.
 *
 * @param results - Publish outcomes array.
 * @param options - Pipeline options flags.
 * @param options.dryRun - Whether dry-run mode is active.
 * @param options.tag - Dist-tag released.
 */
export function logTable(
  results: PublishResult[],
  options: { dryRun?: boolean; tag?: string }
): void {
  console.log(
    `\n${c.purple}${c.bold}╔════════════════════════════════════════════════════════════════════════╗${c.reset}`
  );
  console.log(
    `${c.purple}${c.bold}║                           RELEASE SUMMARY                              ║${c.reset}`
  );
  console.log(
    `${c.purple}${c.bold}╚════════════════════════════════════════════════════════════════════════╝${c.reset}\n`
  );

  console.log(
    `  ${bold('Package Name'.padEnd(35))} ${bold('Version'.padEnd(14))} ${bold('Status')}`
  );
  console.log(`  ${dim('─'.repeat(65))}`);

  for (const res of results) {
    const statusText = formatPublishStatus(res, options.dryRun);
    console.log(
      `  ${res.name.padEnd(35)} v${res.version.padEnd(13)} ${statusText}`
    );
  }

  const pendingStaged = results.filter(
    (r) => r.success && r.staged && !r.approved && !options.dryRun
  );
  if (pendingStaged.length > 0) {
    console.log(
      `\n  ${cyan(bold('🔐 Staged Publishing — Pending 2FA Approval (https://docs.npmjs.com/staged-publishing):'))}`
    );
    for (const stagedPkg of pendingStaged) {
      const regFlag = stagedPkg.registry
        ? ` --registry ${stagedPkg.registry}`
        : '';
      const cmdHint = stagedPkg.stageId
        ? cyan(`npm stage approve ${stagedPkg.stageId}${regFlag}`)
        : `${cyan(`npm stage list "${stagedPkg.name}"${regFlag}`)} ${dim('->')} ${cyan(`npm stage approve <stage-id>${regFlag}`)}`;
      console.log(`    ${dim('•')} ${bold(stagedPkg.name)}: ${cmdHint}`);
    }
  }

  const isAllSucceeded = results.length > 0 && results.every((r) => r.success);
  if (isAllSucceeded) {
    let actionWord = 'published';
    if (options.dryRun) {
      actionWord = 'simulated';
    } else if (pendingStaged.length > 0) {
      actionWord = 'staged';
    }
    const tagInfo = options.tag ? ` at tag ${options.tag}` : '';
    console.log(
      `\n${green(bold(`🎉 All packages ${actionWord} successfully${tagInfo}! 🧙✨`))}\n`
    );
  } else if (results.length === 0) {
    console.log(`\n${yellow(bold('⚠️ No packages were published.'))}\n`);
  } else {
    console.log(
      `\n${red(bold('❌ Release finished with errors. Review the logs above.'))}\n`
    );
  }
}
