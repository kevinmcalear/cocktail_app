const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const { resolve: defaultResolver } = require('metro-resolver');

const config = getDefaultConfig(__dirname);

// Define the alias for tslib
const ALIASES = {
  'tslib': path.resolve(__dirname, 'node_modules/tslib/tslib.es6.js'),
};

// Configure the resolver to use the alias
config.resolver.resolveRequest = (context, moduleName, platform, ...args) => {
  if (moduleName === 'tslib') {
    return {
      filePath: ALIASES.tslib,
      type: 'sourceFile',
    };
  }
  
  // Chain to the default resolver, setting resolveRequest to null to avoid infinite recursion
  return defaultResolver(
    {
      ...context,
      resolveRequest: null,
    },
    moduleName,
    platform,
    ...args
  );
};

module.exports = config;
