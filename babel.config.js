module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // 'unambiguous' is critical: it tells Babel to guess the module type
    // which helps the plugin catch import.meta in both CJS and ESM files.
    sourceType: 'unambiguous', 
    plugins: [
      'babel-plugin-transform-import-meta',
      'react-native-reanimated/plugin',
    ],
  };
};
