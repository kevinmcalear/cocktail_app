import { useSettingsStore } from '@/store/useSettingsStore';
import { useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

function resolveSystemScheme(systemScheme: ReturnType<typeof useRNColorScheme>): 'light' | 'dark' {
    if (systemScheme === 'dark' || systemScheme === 'light') return systemScheme;
    if (typeof window !== 'undefined') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
}

export function useColorScheme(): 'light' | 'dark' {
    const [hasHydrated, setHasHydrated] = useState(false);
    const systemScheme = useRNColorScheme();
    const themeMode = useSettingsStore((state) => state.themeMode);

    useEffect(() => {
        setHasHydrated(true);
    }, []);

    if (typeof window === 'undefined' && !hasHydrated) {
        return 'light';
    }

    if (themeMode !== 'system') return themeMode;
    return resolveSystemScheme(systemScheme);
}
