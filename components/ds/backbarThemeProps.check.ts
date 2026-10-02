// BackbarTheme's web markup must not depend on the parent's scheme, or a route
// that hydrates after the root has switched to dark fails hydration (#418).
// Run: npm run test:unit
import assert from 'node:assert/strict';

import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { TamaguiProvider, Theme } from 'tamagui';

import tamaguiConfig from '../../tamagui.config';
import { backbarThemeProps } from './backbarThemeProps';

/** The markup of a Back Bar theme in `scheme`, rendered under a `parent` scheme. */
function markup(parent: 'light' | 'dark', scheme: 'light' | 'dark') {
  const html = renderToString(
    createElement(
      TamaguiProvider,
      { config: tamaguiConfig, defaultTheme: parent },
      createElement('main', null, createElement(Theme, backbarThemeProps(scheme), createElement('p')))
    )
  );
  return html.slice(html.indexOf('<main>'), html.indexOf('</main>'));
}

// What the static export renders, and what a late route hydrates on a dark device.
assert.equal(markup('dark', 'light'), markup('light', 'light'));
// Forced schemes (the Batch screen is always light) and the settled dark state.
assert.equal(markup('light', 'dark'), markup('dark', 'dark'));
assert.match(markup('light', 'light'), /t_light/);
assert.match(markup('dark', 'dark'), /t_dark/);

// Tamagui's slider leaves an interval running, which would keep node alive.
process.exit(0);
