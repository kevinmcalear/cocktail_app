import { JSDOM } from 'jsdom';
import { act } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';

import { useColorScheme } from '@/hooks/use-color-scheme.web';
import { useSettingsStore } from '@/store/useSettingsStore';

jest.mock('react-native', () => ({ useColorScheme: () => 'dark' }));

// A local DOM for hydrateRoot. The jsdom test environment can't load
// jest.setup.tsx (Tamagui needs matchMedia at import time).
const dom = new JSDOM('<!doctype html><html><body></body></html>');
const g = globalThis as Record<string, unknown>;

// Each value the hook returns, in render order.
let seen: string[] = [];

function Probe() {
  const scheme = useColorScheme();
  seen.push(scheme);
  return <div className={`t_${scheme}`} />;
}

/** Static-render Probe, then hydrate that HTML on the "client". */
async function hydrateProbe() {
  const container = dom.window.document.createElement('div');
  container.innerHTML = renderToString(<Probe />);
  seen = [];
  const errors: unknown[] = [];
  g.window = dom.window;
  g.document = dom.window.document;
  try {
    let root: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => {
      root = hydrateRoot(container, <Probe />, { onRecoverableError: (e) => errors.push(e) });
    });
    const className = container.firstElementChild?.className;
    await act(async () => root?.unmount());
    return { className, errors };
  } finally {
    delete g.window;
    delete g.document;
  }
}

beforeAll(() => {
  g.IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(() => {
  seen = [];
  useSettingsStore.setState({ themeMode: 'system' });
});

describe('useColorScheme (web)', () => {
  test('static render uses light, as the export bakes into the HTML', () => {
    expect(renderToString(<Probe />)).toContain('t_light');
  });

  test('hydration matches the static HTML, then switches to the real scheme', async () => {
    const { className, errors } = await hydrateProbe();
    expect(seen).toEqual(['light', 'dark']);
    expect(className).toBe('t_dark');
    expect(errors).toEqual([]);
  });

  test('the in-app override wins after hydration', async () => {
    useSettingsStore.setState({ themeMode: 'light' });
    const { className } = await hydrateProbe();
    expect(className).toBe('t_light');
  });
});
