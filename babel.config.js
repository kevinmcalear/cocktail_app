module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo adds the worklets plugin and transforms import.meta
    // (used by zustand's middleware on web) on its own.
    presets: ['babel-preset-expo'],
    // 'unambiguous' lets Babel detect CJS vs ESM per file, so mixed-format
    // dependencies still get import.meta transformed.
    sourceType: 'unambiguous',
  };
};
