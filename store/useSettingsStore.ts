import type { MapsApp } from '@/lib/directions';
import { DEFAULT_UNIT, followBarUnit, savedUnit, stickyUnit } from '@/lib/units';
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

/** The Units choices: a person's own, and a bar's (bars.spec_unit). */
export const DEFAULT_UNIT_OPTIONS: { id: string; label: string }[] = [
    { id: 'ml', label: 'ml' },
    { id: 'oz', label: 'oz' },
    { id: 'cl', label: 'cl' },
    { id: 'g', label: 'g' },
];

/** cl has no spec conversion yet, so specs in cl read in ml. */
export function specUnitFor(unit: string): SpecUnit {
    return unit === 'g' || unit === 'oz' ? unit : 'ml';
}

interface SettingsState {
    themeMode: ThemeMode;
    /**
     * Your own Units (Settings › Preferences, decided 10 Oct): new recipe
     * lines start in it, and drink pages read specs in it. Null follows the
     * unit of the bar you work at (barUnit), and with no bar, ml (Kevin, 1 Nov 2026).
     */
    units: string | null;
    /** Your own unit, or null to follow your bar's. The drink page's switch sets it too. */
    setUnits: (unit: string | null) => void;
    /**
     * The unit of the bar you work at (bars.spec_unit), kept by
     * useBarUnitSync; null with no bar. Saved, so a cold start reads it
     * before the bars arrive.
     */
    barUnit: string | null;
    setBarUnit: (unit: string | null) => void;
    /** False for a unit saved before bars had one, until lib/units followBarUnit has looked at it. */
    unitsChecked: boolean;
    /** This device's freezer, in °C, for the Batch sheet's "will it freeze" check. */
    freezerC: number;
    setFreezerC: (c: number) => void;
    setThemeMode: (mode: ThemeMode) => void;
    /** iPhone: the maps app Directions goes straight to ("Remember my choice"); null asks each time. */
    directionsApp: MapsApp | null;
    setDirectionsApp: (app: MapsApp | null) => void;
    /** "Not now" to "Is this one of your glasses?", by lib/glassware.ts glassPromptKey: not asked again on this device. */
    glassesNotNow: string[];
    skipGlassPrompt: (key: string) => void;
}

/** Version 0 kept the unit twice (defaultUnit, specUnit), always set. It becomes your own (lib/units savedUnit), checked against your bar's once that's known. */
function migrateSettings(saved: unknown): Partial<SettingsState> {
    const old = { ...((saved ?? {}) as Partial<SettingsState> & { defaultUnit?: string; specUnit?: string }) };
    const units = savedUnit(old.defaultUnit) ?? savedUnit(old.specUnit);
    delete old.defaultUnit;
    delete old.specUnit;
    return { ...old, units, unitsChecked: !units };
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            themeMode: 'system',
            units: null,
            setUnits: (unit) => set({ units: unit, unitsChecked: true }),
            barUnit: null,
            setBarUnit: (unit) =>
                set((s) => {
                    const next = followBarUnit({ units: s.units, checked: s.unitsChecked }, unit);
                    return { barUnit: unit, units: next.units, unitsChecked: next.checked };
                }),
            unitsChecked: true,
            freezerC: -18,
            setFreezerC: (c) => set({ freezerC: c }),
            setThemeMode: (mode) => set({ themeMode: mode }),
            directionsApp: null,
            setDirectionsApp: (app) => set({ directionsApp: app }),
            glassesNotNow: [],
            skipGlassPrompt: (key) => set((s) => (s.glassesNotNow.includes(key) ? s : { glassesNotNow: [...s.glassesNotNow, key] })),
        }),
        {
            name: 'settings-storage',
            storage: createJSONStorage(() => AsyncStorage),
            version: 1,
            migrate: (saved) => migrateSettings(saved) as SettingsState,
        }
    )
);

/** The unit you read and write in: your own, else your bar's, else ml. */
export function unitIn(s: Pick<SettingsState, 'units' | 'barUnit'>): string {
    return s.units ?? s.barUnit ?? DEFAULT_UNIT;
}

/** Your unit, and the unit specs read in (cl reads as ml). */
export function useUnits(): { unit: string; specUnit: SpecUnit } {
    const unit = useSettingsStore(unitIn);
    return { unit, specUnit: specUnitFor(unit) };
}

/** Read preferred unit outside React (merge, handoff defaults). */
export function getPreferredUnit(): string {
    return unitIn(useSettingsStore.getState());
}

/**
 * A unit picked on a spec line, or typed with a pour ("1 oz lemon"): ml or oz
 * becomes your own Units (lib/units stickyUnit), so the next line and the next
 * drink start in it, as the drink page's switch does. Lines already written keep theirs.
 */
export function rememberLineUnit(unit: string | null | undefined): void {
    const s = useSettingsStore.getState();
    const next = stickyUnit(unit, unitIn(s));
    if (next) s.setUnits(next);
}
