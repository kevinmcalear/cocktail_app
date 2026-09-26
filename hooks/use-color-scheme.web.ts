import { useIsHydrated } from '@/hooks/useIsHydrated';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useColorScheme as useRNColorScheme } from 'react-native';

function resolveSystemScheme(systemScheme: ReturnType<typeof useRNColorScheme>): 'light' | 'dark' {
    if (systemScheme === 'dark' || systemScheme === 'light') return systemScheme;
    if (typeof window !== 'undefined') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
}

export function useColorScheme(): 'light' | 'dark' {
    const isHydrated = useIsHydrated();
    const systemScheme = useRNColorScheme();
    const themeMode = useSettingsStore((state) => state.themeMode);

    // Matches what the static export baked into the HTML. Returning the device
    // scheme during hydration left the export's t_light classes on a dark device.
    if (!isHydrated) return 'light';

    if (themeMode !== 'system') return themeMode;
    return resolveSystemScheme(systemScheme);
}
