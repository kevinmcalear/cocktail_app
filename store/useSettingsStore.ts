import { FEATURES } from '@/constants/features';
import { DEFAULT_SEARCH_ALL } from '@/lib/barContextFilter';
import { DEFAULT_UNIT } from '@/lib/units';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ThemeMode = 'system' | 'light' | 'dark';

export type SpecUnit = 'g' | 'ml' | 'oz';

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
    { id: 'g', label: 'g' },
];

interface SettingsState {
    themeMode: ThemeMode;
    defaultSearchContext: DefaultSearchContext;
    defaultUnit: string;
    /** How a spec reads on the drink page: as written, or converted to g, ml or oz. */
    specUnit: SpecUnit;
    setSpecUnit: (unit: SpecUnit) => void;
    /** Behind the bar: keep the screen awake on specs and use larger spec type. */
    serviceMode: boolean;
    toggleServiceMode: () => void;
    setThemeMode: (mode: ThemeMode) => void;
    setDefaultSearchContext: (value: DefaultSearchContext) => void;
    setDefaultUnit: (unit: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            themeMode: 'system',
            defaultSearchContext: DEFAULT_SEARCH_ALL,
            defaultUnit: DEFAULT_UNIT,
            specUnit: 'ml',
            setSpecUnit: (unit) => set({ specUnit: unit }),
            serviceMode: false,
            toggleServiceMode: () => set((state) => ({ serviceMode: !state.serviceMode })),
            setThemeMode: (mode) => set({ themeMode: mode }),
            setDefaultSearchContext: (value) => set({ defaultSearchContext: value }),
            setDefaultUnit: (unit) => set({ defaultUnit: unit }),
        }),
        {
            name: 'settings-storage',
            storage: createJSONStorage(() => AsyncStorage),
            // Service mode is switched off for launch: don't bring back a stored "on".
            merge: (persisted, current) => {
                const saved = persisted as Partial<SettingsState> | undefined;
                return { ...current, ...saved, serviceMode: FEATURES.service && !!saved?.serviceMode };
            },
        }
    )
);

/** Read preferred unit outside React (merge, handoff defaults). */
export function getPreferredUnit(): string {
    return useSettingsStore.getState().defaultUnit || DEFAULT_UNIT;
}
