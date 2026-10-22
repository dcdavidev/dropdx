import { defineConfig } from 'eslint/config';
import spellbookx from 'eslint-plugin-spellbookx';

export default defineConfig([
  spellbookx.configs['recommended-spellcheck'],
  spellbookx.configs.node,
  {
    ignores: ['.agents/**', 'CHANGELOG.md'],
    rules: {
      'no-process-exit': 'off',
      'unicorn/no-process-exit': 'off',
      'markdown/no-missing-label-refs': 'off',
    },
  },
]);
