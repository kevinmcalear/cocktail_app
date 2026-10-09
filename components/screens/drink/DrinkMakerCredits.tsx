import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Headline, Tag } from '@/components/ds';
import { MakerPicker } from '@/components/maker/MakerPicker';
import { space } from '@/constants/tokens';
import { useDrinkBarPage, useDrinkMakerCredits, useEditMakerCredit, type MakerCredit } from '@/hooks/useMakers';

const WHAT = {
  ice: { title: 'Ice by', ask: 'Who cuts the ice?' },
  glassware: { title: 'Glass by', ask: 'Who made the glass?' },
} as const;

/**
 * In the glass sheet: who cut the drink's ice and who made its glass. The
 * drink's editors name the maker, the maker's team confirms it, and a bar that
 * cuts its own ice credits itself. Others see confirmed credits only.
 */
export function DrinkMakerCredits({ itemId, canEdit }: { itemId: string; canEdit: boolean }) {
  const { data: credits = [] } = useDrinkMakerCredits(itemId);
  const shown = canEdit ? credits : credits.filter((c) => c.confirmed_at);
  if (!canEdit && !shown.length) return null;
  return (
    <View style={styles.stack}>
      {(['ice', 'glassware'] as const).map((makes) => (
        <CreditRow key={makes} itemId={itemId} makes={makes} credits={shown.filter((c) => c.makes === makes)} canEdit={canEdit} />
      ))}
    </View>
  );
}

function CreditRow({ itemId, makes, credits, canEdit }: { itemId: string; makes: 'ice' | 'glassware'; credits: MakerCredit[]; canEdit: boolean }) {
  const edit = useEditMakerCredit(itemId);
  const { data: ownBar } = useDrinkBarPage(canEdit && makes === 'ice' ? itemId : null);
  const [picking, setPicking] = useState(false);
  if (!canEdit && !credits.length) return null;
  const add = (profileId: string) => edit.mutate({ profileId, makes }, { onSuccess: () => setPicking(false) });

  return (
    <View style={styles.stack}>
      <Headline>{WHAT[makes].title}</Headline>
      {credits.map((c) => (
        <View key={c.profile_id} style={styles.row}>
          <Body numberOfLines={1} style={styles.name}>
            {c.maker?.display_name ?? 'A maker'}
          </Body>
          {canEdit && !c.confirmed_at ? <Tag label="Waiting for them to confirm" /> : null}
          {canEdit ? (
            <Button label="Remove" variant="ghost" disabled={edit.isPending} onPress={() => edit.mutate({ profileId: c.profile_id, makes, remove: true })} />
          ) : null}
        </View>
      ))}
      {canEdit && !credits.length && !picking ? (
        <View style={styles.actions}>
          <Button label={WHAT[makes].ask} variant="secondary" onPress={() => setPicking(true)} />
          {ownBar ? <Button label="We cut our own" variant="ghost" disabled={edit.isPending} onPress={() => add(ownBar.id)} /> : null}
        </View>
      ) : null}
      {canEdit && picking ? (
        <View style={styles.stack}>
          <MakerPicker label={WHAT[makes].ask} makes={makes} onPick={(m) => add(m.id)} />
          <Caption tone="muted">They see it on their page once they confirm it.</Caption>
          <Button label="Cancel" variant="ghost" onPress={() => setPicking(false)} style={styles.start} />
        </View>
      ) : null}
      {edit.error ? (
        <Caption tone="accent" role="alert">
          Couldn’t save that. Check your connection and try again.
        </Caption>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  name: { flex: 1, minWidth: 120 },
  actions: { flexDirection: 'row', gap: space.xs, flexWrap: 'wrap' },
  start: { alignSelf: 'flex-start' },
});
