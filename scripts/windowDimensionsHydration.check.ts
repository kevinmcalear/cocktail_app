// react-native-web's useWindowDimensions is patched (patches/react-native-web+*.patch)
// to hydrate with the static export's window (0 x 0) and then switch to the
// real one. Without the patch every layout that reads the window width fails
// hydration on a cold web load. This fails if an upgrade drops the patch.
// Run: npm run test:unit
import assert from 'node:assert/strict';

import { JSDOM } from 'jsdom';
import { act, createElement } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>');
// jsdom has no layout, so give it the viewport react-native-web measures.
Object.assign(dom.window, { visualViewport: { width: 1280, height: 800, scale: 1, addEventListener() {} } });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });

async function main() {
  // Imported after the globals exist: react-native-web checks for a DOM on load.
  // @ts-expect-error react-native-web ships no types for its internals
  const rnw: { default: () => { width: number } } = await import('react-native-web/dist/exports/useWindowDimensions');
  const useWindowDimensions = rnw.default;

  const widths: number[] = [];
  function Probe() {
    const { width } = useWindowDimensions();
    widths.push(width);
    return createElement('div', { style: { width } });
  }

  const container = dom.window.document.getElementById('root')!;
  // What the static export bakes in.
  container.innerHTML = '<div style="width:0"></div>';
  assert.equal(renderToString(createElement(Probe)), container.innerHTML);

  widths.length = 0;
  const errors: unknown[] = [];
  await act(async () => {
    hydrateRoot(container, createElement(Probe), { onRecoverableError: (e) => errors.push(e) });
  });

  assert.deepEqual(errors, []);
  assert.deepEqual([...new Set(widths)], [0, 1280], 'hydrates with the static width, then the real one');
  assert.equal((container.firstElementChild as HTMLElement).style.width, '1280px');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
