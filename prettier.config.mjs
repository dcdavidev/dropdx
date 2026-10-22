import { createRequire } from 'node:module';

import baseConfig from 'prettier-config-spellbookx';

const require = createRequire(
  import.meta.resolve('prettier-config-spellbookx')
);

const config = {
  ...baseConfig,
  plugins: baseConfig.plugins?.map((plugin) =>
    typeof plugin === 'string' ? require.resolve(plugin) : plugin
  ),
};

export default config;
