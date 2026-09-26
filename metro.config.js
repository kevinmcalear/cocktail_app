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

// Agent worktrees (.claude/worktrees) are full copies of the repo, each with its
// own node_modules. Watching them ran Metro out of memory, and their files
// shadowed this checkout's. The Tauri desktop shell (desktop/) isn't part of the
// bundle either: keep Metro out of its Rust build output and node_modules.
// blockList is also the file crawler's ignore list.
const claudeDir = new RegExp(`^${path.resolve(__dirname, '.claude').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[/\\\\].*`);
config.resolver.blockList = [
  ...[].concat(config.resolver.blockList ?? []),
  claudeDir,
  /[\\/]desktop[\\/](node_modules|src-tauri)[\\/].*/,
];

module.exports = config;
