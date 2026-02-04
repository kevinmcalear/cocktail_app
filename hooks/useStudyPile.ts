import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useState } from 'react';

const STUDY_PILE_KEY = 'cocktail_study_pile';

export function useStudyPile() {
    const [studyPile, setStudyPile] = useState<string[]>([]);

    useEffect(() => {
        const loadStudyPile = async () => {
            try {
                const stored = await SecureStore.getItemAsync(STUDY_PILE_KEY);
                if (stored) {
                    setStudyPile(JSON.parse(stored));
                }
            } catch (error) {
                console.error('Error loading study pile:', error);
            }
        };
        loadStudyPile();
    }, []);

    const toggleStudyPile = useCallback(async (id: string) => {
        try {
            const newStudyPile = studyPile.includes(id)
                ? studyPile.filter(f => f !== id)
                : [...studyPile, id];

            setStudyPile(newStudyPile);
            await SecureStore.setItemAsync(STUDY_PILE_KEY, JSON.stringify(newStudyPile));
        } catch (error) {
            console.error('Error toggling study pile:', error);
        }
    }, [studyPile]);

    const isInStudyPile = useCallback((id: string) => {
        return studyPile.includes(id);
    }, [studyPile]);

    return { studyPile, toggleStudyPile, isInStudyPile };
}
