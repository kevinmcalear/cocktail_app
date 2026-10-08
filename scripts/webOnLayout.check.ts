// react-native-web's onLayout is patched (patches/react-native-web+*.patch):
// upstream decided whether to watch a view's size only when it mounted, so a
// View that gained onLayout on a later render (React reusing a View that had
// none) never fired it. DrawnSketch drew blank paper on web because of that.
// This fails if an upgrade drops the patch.
// Run: npm run test:unit
import assert from 'node:assert/strict';

import { JSDOM } from 'jsdom';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>');

// jsdom has no ResizeObserver: record what's watched, and fire by hand.
const watched = new Set<Element>();
let fire: ((entries: { target: Element }[]) => void) | null = null;
class FakeResizeObserver {
  constructor(cb: (entries: { target: Element }[]) => void) {
    fire = cb;
  }
  observe(n: Element) {
    watched.add(n);
  }
  unobserve(n: Element) {
    watched.delete(n);
  }
  disconnect() {}
}
Object.assign(dom.window, { ResizeObserver: FakeResizeObserver });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, ShadowRoot: dom.window.ShadowRoot, IS_REACT_ACT_ENVIRONMENT: true });

async function main() {
  // Imported after the globals exist: react-native-web checks for a DOM on load.
  // @ts-expect-error react-native-web ships no types for its internals
  const { default: View } = await import('react-native-web/dist/cjs/exports/View');

  const container = dom.window.document.getElementById('root')!;
  const root = createRoot(container);
  const layouts: number[] = [];
  const onLayout = (e: { nativeEvent: { layout: { width: number } } }) => layouts.push(e.nativeEvent.layout.width);

  await act(async () => root.render(createElement(View, { testID: 'v' })));
  const node = container.querySelector('[data-testid="v"]')!;
  assert.equal(watched.has(node), false, 'a View without onLayout is not watched');

  await act(async () => root.render(createElement(View, { testID: 'v', onLayout })));
  assert.equal(container.querySelector('[data-testid="v"]'), node, 'same DOM node, reused');
  assert.equal(watched.has(node), true, 'a View that gains onLayout is watched');

  await act(async () => fire!([{ target: node }]));
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(layouts.length, 1, 'its onLayout fires');

  await act(async () => root.render(createElement(View, { testID: 'v' })));
  assert.equal(watched.has(node), false, 'dropping onLayout stops watching');

  await act(async () => root.unmount());
  console.log('webOnLayout.check: ok');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
