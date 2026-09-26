const { getSentryExpoConfig } = require('@sentry/react-native/metro');
const path = require('path');

// Sentry's wrapper around Expo's default config adds debug IDs, so reported
// stack traces can be matched to uploaded source maps.
const config = getSentryExpoConfig(__dirname);

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

// The Tauri desktop shell (desktop/) isn't part of the bundle. Keep Metro out of
// its Rust build output and its own node_modules.
config.resolver.blockList = [
  ...[].concat(config.resolver.blockList ?? []),
  /[\\/]desktop[\\/](node_modules|src-tauri)[\\/].*/,
];

module.exports = config;
