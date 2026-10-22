import { defineConfig } from 'eslint/config';
import spellbookx from 'eslint-plugin-spellbookx';

export default defineConfig([
  spellbookx.configs['recommended-spellcheck'],
  spellbookx.configs.node,
  {
    ignores: ['.agents/**'],
  },
]);
