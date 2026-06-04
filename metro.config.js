const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Define the alias for tslib
const ALIASES = {
  'tslib': path.resolve(__dirname, 'node_modules/tslib/tslib.es6.js'),
};

// Store the original resolver
const originalResolveRequest = config.resolver.resolveRequest;

// Configure the resolver to use the alias
config.resolver.resolveRequest = (context, moduleName, platform, ...args) => {
  if (moduleName === 'tslib') {
    return {
      filePath: ALIASES.tslib,
      type: 'sourceFile',
    };
  }
  
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform, ...args);
  }
  
  // Chain to the default resolver provided in the context
  return context.resolveRequest(context, moduleName, platform, ...args);
};

module.exports = config;
