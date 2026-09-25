import { useSettingsStore } from '@/store/useSettingsStore';
import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

function resolveSystemScheme(systemScheme: ReturnType<typeof useRNColorScheme>): 'light' | 'dark' {
    if (systemScheme === 'dark' || systemScheme === 'light') return systemScheme;
    if (typeof window !== 'undefined') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
}

const subscribeNoop = () => () => {};

/**
 * False while static rendering and while React hydrates that HTML, true after.
 * React uses the server snapshot for the hydration pass and then re-renders with
 * the client one, so the hydrated tree matches the prerendered HTML and the real
 * scheme lands in an ordinary update. Hydration does not patch mismatched
 * attributes, so returning the client scheme straight away left the `t_light`
 * classes from the static export in place on a dark device. Components that
 * mount later (not hydrating) get the client snapshot on their first render.
 */
function useIsHydrated(): boolean {
    return useSyncExternalStore(subscribeNoop, () => true, () => false);
}

export function useColorScheme(): 'light' | 'dark' {
    const isHydrated = useIsHydrated();
    const systemScheme = useRNColorScheme();
    const themeMode = useSettingsStore((state) => state.themeMode);

    // Matches what the static export baked into the HTML.
    if (!isHydrated) return 'light';

    if (themeMode !== 'system') return themeMode;
    return resolveSystemScheme(systemScheme);
}
