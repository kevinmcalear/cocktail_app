import { StyleSheet, View } from 'react-native';

import { Button, Caption } from '@/components/ds';
import { useSignedIn } from '@/ctx/AuthContext';
import { useSaveBarMenu, useSavedMenus } from '@/hooks/useKept';
import { useMyBar } from '@/hooks/useHomeBar';
import { space } from '@/constants/tokens';

import { useAgeGate } from '../safety/AgeGate';

/**
 * Save a bar's menu to Collection, and how much of it your shelf makes.
 * Signed in only; saving needs a confirmed age, like the menu page itself.
 */
export function SaveMenuButton({ editionId, drinkIds }: { editionId: string; drinkIds: string[] }) {
  const signedIn = useSignedIn();
  const saved = useSavedMenus().data?.some((m) => m.editionId === editionId) ?? false;
  const save = useSaveBarMenu();
  const bar = useMyBar();
  const age = useAgeGate();
  if (!signedIn) return null;
  const on = save.isPending && save.variables ? save.variables.save : saved;
  const ready = drinkIds.filter((id) => bar.canMakeIds.has(id)).length;
  return (
    <View style={styles.wrap}>
      <Button
        label={on ? 'Saved' : 'Save menu'}
        icon={on ? 'bookmark.fill' : 'bookmark'}
        variant={on ? 'secondary' : 'primary'}
        accessibilityHint={on ? 'Removes this menu from your Collection' : 'Keeps this menu in your Collection'}
        onPress={() => (on ? save.mutate({ editionId, save: false }) : age.gate(() => save.mutate({ editionId, save: true })))}
      />
      {drinkIds.length && bar.shelf.length ? <Caption tone="muted">{`${ready} of ${drinkIds.length} ready from your shelf`}</Caption> : null}
      {save.error ? <Caption tone="accent">{save.error.message}</Caption> : null}
      {age.sheet}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs, alignItems: 'flex-start' },
});
