import { useSettingsStore } from '@/store/useSettingsStore';
import { useColorScheme as useSystemColorScheme } from 'react-native';

function resolveScheme(systemScheme: ReturnType<typeof useSystemColorScheme>, themeMode: 'system' | 'light' | 'dark'): 'light' | 'dark' {
    if (themeMode !== 'system') return themeMode;
    return systemScheme === 'dark' ? 'dark' : 'light';
}

export function useColorScheme(): 'light' | 'dark' {
    return resolveScheme(useSystemColorScheme(), useSettingsStore((state) => state.themeMode));
}
