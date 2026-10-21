import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet } from 'react-native';

import { DsText, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { space } from '@/constants/tokens';
import { ensureAiConsent } from '@/lib/aiConsent';
import { invokeFunction } from '@/lib/invokeFunction';

interface GenerateImageButtonProps {
  /** Drinks are drawn in the app from their spec (components/ds/DrawnSketch), never by AI. */
  type: 'ingredient' | 'beer' | 'wine';
  id: string;
  name?: string;
  subIngredients?: string[];
}

/** Generate a picture for a beer, wine or ingredient: the half-tile beside Add in SortableImageList. */
export function GenerateImageButton({ type, id, name, subIngredients = [] }: GenerateImageButtonProps) {
  const ds = useDs();
  const [isGenerating, setIsGenerating] = useState(false);
  const queryClient = useQueryClient();

  const handlePress = async () => {
    if (isGenerating) return;
    if (!(await ensureAiConsent())) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsGenerating(true);

    try {
      let body: Record<string, unknown>;
      switch (type) {
        case 'beer':
          body = { beer_id: id };
          break;
        case 'wine':
          body = { wine_id: id };
          break;
        case 'ingredient':
          if (!name) throw new Error('Ingredient name is required');
          body = { ingredient_id: id, ingredient_name: name, sub_ingredients: subIngredients };
          break;
      }

      await invokeFunction(`generate-${type}-image`, body);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Await the invalidations so the spinner stays until the new data is ready.
      await queryClient.invalidateQueries({ queryKey: [type, id] });
      await queryClient.invalidateQueries({ queryKey: [`${type}s`] });
    } catch (err) {
      console.error('Generation Error:', err);
      Alert.alert('Generation Failed', err instanceof Error ? err.message : 'Something went wrong.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <PressableScale role="button" accessibilityLabel="Generate a picture" aria-busy={isGenerating} onPress={handlePress} disabled={isGenerating} style={styles.tile}>
      {isGenerating ? <ActivityIndicator size="small" color={ds.accentText} /> : <IconSymbol name="sparkles" size={18} color={ds.accentText} />}
      <DsText variant="label" color={ds.accentText}>
        {isGenerating ? 'Generating…' : 'Generate'}
      </DsText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, width: '100%', flexDirection: 'row', gap: space.xs + 2, alignItems: 'center', justifyContent: 'center' },
});
