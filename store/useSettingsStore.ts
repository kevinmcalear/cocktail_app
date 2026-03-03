import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface SettingsState {
    isEditModeEnabled: boolean;
    isTestingEnabled: boolean;
    toggleEditMode: () => void;
    toggleTesting: () => void;
    setEditMode: (enabled: boolean) => void;
    setTesting: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            isEditModeEnabled: false,
            isTestingEnabled: false,
            toggleEditMode: () => set((state) => ({ isEditModeEnabled: !state.isEditModeEnabled })),
            toggleTesting: () => set((state) => ({ isTestingEnabled: !state.isTestingEnabled })),
            setEditMode: (enabled) => set({ isEditModeEnabled: enabled }),
            setTesting: (enabled) => set({ isTestingEnabled: enabled }),
        }),
        {
            name: 'settings-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
