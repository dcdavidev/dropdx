const { defineConfig } = require('@cspell/cspell-types');

module.exports = defineConfig({
  version: '0.2',
  import: ['cspell-config-spellbookx', '@cspell/dict-it-it/cspell-ext.json'],
  ignorePaths: ['.agents/**'],
  dictionaryDefinitions: [
    {
      name: 'project-custom-words',
      path: './.config/cspell/custom.txt',
      addWords: true,
    },
  ],
  dictionaries: ['project-custom-words', 'it-it'],
});
