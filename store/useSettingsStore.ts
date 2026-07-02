import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ThemeMode = 'system' | 'light' | 'dark';

export const THEME_MODES: { id: ThemeMode; label: string }[] = [
    { id: 'system', label: 'System' },
    { id: 'light', label: 'Light' },
    { id: 'dark', label: 'Dark' },
];

interface SettingsState {
    isEditModeEnabled: boolean;
    isTestingEnabled: boolean;
    themeMode: ThemeMode;
    toggleEditMode: () => void;
    toggleTesting: () => void;
    setEditMode: (enabled: boolean) => void;
    setTesting: (enabled: boolean) => void;
    setThemeMode: (mode: ThemeMode) => void;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            isEditModeEnabled: false,
            isTestingEnabled: false,
            themeMode: 'system',
            toggleEditMode: () => set((state) => ({ isEditModeEnabled: !state.isEditModeEnabled })),
            toggleTesting: () => set((state) => ({ isTestingEnabled: !state.isTestingEnabled })),
            setEditMode: (enabled) => set({ isEditModeEnabled: enabled }),
            setTesting: (enabled) => set({ isTestingEnabled: enabled }),
            setThemeMode: (mode) => set({ themeMode: mode }),
        }),
        {
            name: 'settings-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
