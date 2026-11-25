import { cli } from '../src/cli.js';

if (import.meta.main) {
  try {
    await cli(Deno.args);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\n✖ Fatal dropdx error: ${message}\n`);
    Deno.exit(1);
  }
}
