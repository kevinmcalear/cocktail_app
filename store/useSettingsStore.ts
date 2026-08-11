import { DEFAULT_SEARCH_ALL } from '@/lib/barContextFilter';
import { DEFAULT_UNIT } from '@/lib/units';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ThemeMode = 'system' | 'light' | 'dark';

/** 'all' | 'personal' | bar uuid */
export type DefaultSearchContext = string;

export const THEME_MODES: { id: ThemeMode; label: string }[] = [
    { id: 'system', label: 'System' },
    { id: 'light', label: 'Light' },
    { id: 'dark', label: 'Dark' },
];

/** Preferred default for new recipe lines. */
export const DEFAULT_UNIT_OPTIONS: { id: string; label: string }[] = [
    { id: 'ml', label: 'ml' },
    { id: 'oz', label: 'oz' },
    { id: 'cl', label: 'cl' },
];

interface SettingsState {
    isEditModeEnabled: boolean;
    isTestingEnabled: boolean;
    themeMode: ThemeMode;
    defaultSearchContext: DefaultSearchContext;
    defaultUnit: string;
    toggleEditMode: () => void;
    toggleTesting: () => void;
    setEditMode: (enabled: boolean) => void;
    setTesting: (enabled: boolean) => void;
    setThemeMode: (mode: ThemeMode) => void;
    setDefaultSearchContext: (value: DefaultSearchContext) => void;
    setDefaultUnit: (unit: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            isEditModeEnabled: false,
            isTestingEnabled: false,
            themeMode: 'system',
            defaultSearchContext: DEFAULT_SEARCH_ALL,
            defaultUnit: DEFAULT_UNIT,
            toggleEditMode: () => set((state) => ({ isEditModeEnabled: !state.isEditModeEnabled })),
            toggleTesting: () => set((state) => ({ isTestingEnabled: !state.isTestingEnabled })),
            setEditMode: (enabled) => set({ isEditModeEnabled: enabled }),
            setTesting: (enabled) => set({ isTestingEnabled: enabled }),
            setThemeMode: (mode) => set({ themeMode: mode }),
            setDefaultSearchContext: (value) => set({ defaultSearchContext: value }),
            setDefaultUnit: (unit) => set({ defaultUnit: unit }),
        }),
        {
            name: 'settings-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);

/** Read preferred unit outside React (merge, handoff defaults). */
export function getPreferredUnit(): string {
    return useSettingsStore.getState().defaultUnit || DEFAULT_UNIT;
}
