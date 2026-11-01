const { readFileSync } = require('fs');
const { join } = require('path');

const DS = '@/components/ds';

/**
 * `import { Button } from '@/components/ds'` becomes
 * `import { Button } from '@/components/ds/Button'` on the web.
 *
 * The barrel re-exports every component, and tree shaking keeps each
 * re-export some route uses, so one name from the barrel reached all of them
 * (DrinkImage, the sketch rules, the technique library): every web page
 * loaded them first. Direct imports keep each page to what it uses.
 * Native is one bundle, so it keeps the barrel. Jest keeps it too: tests mock
 * '@/components/ds' by that name. The map is read from the barrel's
 * `export { ... } from './File'` lines; anything else stays on the barrel.
 * metro.config.js keys Metro's cache on the barrel, so moving an export
 * between files rebuilds the files that import it.
 */
function dsDirectImports({ types: t }) {
  const source = readFileSync(join(__dirname, 'components/ds/index.ts'), 'utf8');
  const fileOf = new Map();
  for (const [, names, file] of source.matchAll(/^export\s*\{([^}]*)\}\s*from\s*'\.\/([^']+)';?$/gm)) {
    for (const name of names.split(',')) {
      const m = /^\s*(?:type\s+)?(\w+)(?:\s+as\s+(\w+))?\s*$/.exec(name);
      if (m) fileOf.set(m[2] ?? m[1], { file: `${DS}/${file}`, imported: m[1] });
    }
  }
  return {
    name: 'ds-direct-imports',
    visitor: {
      // Program enter, before the TypeScript plugin drops imports used only as types.
      Program(program) {
        let changed = false;
        for (const path of program.get('body')) {
          if (!path.isImportDeclaration() || path.node.source.value !== DS || path.node.importKind === 'type') continue;
          const byFile = new Map();
          const rest = [];
          for (const spec of path.node.specifiers) {
            const target = t.isImportSpecifier(spec) && fileOf.get(t.isIdentifier(spec.imported) ? spec.imported.name : spec.imported.value);
            if (!target) { rest.push(spec); continue; }
            const specs = byFile.get(target.file) ?? [];
            const next = t.importSpecifier(spec.local, t.identifier(target.imported));
            next.importKind = spec.importKind;
            specs.push(next);
            byFile.set(target.file, specs);
          }
          if (!byFile.size) continue;
          const imports = [...byFile].map(([file, specs]) => t.importDeclaration(specs, t.stringLiteral(file)));
          if (rest.length) imports.push(t.importDeclaration(rest, t.stringLiteral(DS)));
          path.replaceWithMultiple(imports);
          changed = true;
        }
        if (changed) program.scope.crawl();
      },
    },
  };
}

module.exports = function (api) {
  const platform = api.caller((caller) => caller && caller.platform);
  const test = api.caller((caller) => !!caller && caller.name === 'babel-jest');
  return {
    // babel-preset-expo adds the worklets plugin and transforms import.meta
    // (used by zustand's middleware on web) on its own.
    presets: ['babel-preset-expo'],
    plugins: platform === 'web' && !test ? [dsDirectImports] : [],
    // 'unambiguous' lets Babel detect CJS vs ESM per file, so mixed-format
    // dependencies still get import.meta transformed.
    sourceType: 'unambiguous',
  };
};
