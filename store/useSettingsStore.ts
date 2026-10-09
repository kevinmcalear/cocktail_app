import { DEFAULT_UNIT } from '@/lib/units';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ThemeMode = 'system' | 'light' | 'dark';

export type SpecUnit = 'g' | 'ml' | 'oz';

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
    defaultUnit: string;
    /** How a spec reads on the drink page: as written, or converted to g, ml or oz. */
    specUnit: SpecUnit;
    setSpecUnit: (unit: SpecUnit) => void;
    /** This device's freezer, in °C, for the Batch sheet's "will it freeze" check. */
    freezerC: number;
    setFreezerC: (c: number) => void;
    setThemeMode: (mode: ThemeMode) => void;
    setDefaultUnit: (unit: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            themeMode: 'system',
            defaultUnit: DEFAULT_UNIT,
            specUnit: 'ml',
            setSpecUnit: (unit) => set({ specUnit: unit }),
            freezerC: -18,
            setFreezerC: (c) => set({ freezerC: c }),
            setThemeMode: (mode) => set({ themeMode: mode }),
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
