import type { MapsApp } from '@/lib/directions';
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

/**
 * The one Units setting (Settings › Preferences, decided 10 Oct): new recipe
 * lines start in it, and drink pages read specs in it. cl has no spec
 * conversion yet, so specs read in ml then.
 *
 * ponytail: two fields kept in step by both setters, so the drink page's
 * switch and Settings stay one choice without touching the spec reader;
 * fold them into one `units` field when the spec reader learns cl.
 */
export function specUnitFor(unit: string): SpecUnit {
    return unit === 'g' || unit === 'oz' ? unit : 'ml';
}

interface SettingsState {
    themeMode: ThemeMode;
    /** Units: ml, oz, cl or g. New recipe lines start in it. */
    defaultUnit: string;
    /** How a spec reads on the drink page (Units, with cl read as ml). */
    specUnit: SpecUnit;
    /** The drink page's switch: changes Units too. */
    setSpecUnit: (unit: SpecUnit) => void;
    /** This device's freezer, in °C, for the Batch sheet's "will it freeze" check. */
    freezerC: number;
    setFreezerC: (c: number) => void;
    setThemeMode: (mode: ThemeMode) => void;
    setDefaultUnit: (unit: string) => void;
    /** iPhone: the maps app Directions goes straight to ("Remember my choice"); null asks each time. */
    directionsApp: MapsApp | null;
    setDirectionsApp: (app: MapsApp | null) => void;
    /** "Not now" to "Is this one of your glasses?", by lib/glassware.ts glassPromptKey: not asked again on this device. */
    glassesNotNow: string[];
    skipGlassPrompt: (key: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            themeMode: 'system',
            defaultUnit: DEFAULT_UNIT,
            specUnit: 'ml',
            setSpecUnit: (unit) => set({ specUnit: unit, defaultUnit: unit }),
            freezerC: -18,
            setFreezerC: (c) => set({ freezerC: c }),
            setThemeMode: (mode) => set({ themeMode: mode }),
            setDefaultUnit: (unit) => set({ defaultUnit: unit, specUnit: specUnitFor(unit) }),
            directionsApp: null,
            setDirectionsApp: (app) => set({ directionsApp: app }),
            glassesNotNow: [],
            skipGlassPrompt: (key) => set((s) => (s.glassesNotNow.includes(key) ? s : { glassesNotNow: [...s.glassesNotNow, key] })),
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
