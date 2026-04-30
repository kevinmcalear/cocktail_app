const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Define the alias for tslib
const ALIASES = {
  'tslib': path.resolve(__dirname, 'node_modules/tslib/tslib.es6.js'),
};

// Configure the resolver to use the alias
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'tslib') {
    return {
      filePath: ALIASES.tslib,
      type: 'sourceFile',
    };
  }
  
  // Ensure you call the default resolver for everything else
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
