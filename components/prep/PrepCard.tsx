import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, PressableScale, Spec, Surface, Tag, useDs } from '@/components/ds';
import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { radius, space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useItemPrep, usePrepUsedIn } from '@/hooks/usePrepCard';
import { gramsPer100ml, leadTimeLabel, shelfLifeLabel, timerLabel, totals, totalsLine, type RecipeLine } from '@/lib/scale';
import { formatQuantity, toQuantity } from '@/lib/quantity';

import { MakeSheet } from './MakeSheet';
import { PrepEditSheet } from './PrepEditSheet';

interface PrepCardProps {
  itemId: string;
  itemName: string;
  barId: string | null;
  recipe: RecipeLine[];
  /** The viewer can edit the item itself. */
  canEditItem: boolean;
}

/**
 * The prep card on a house-made ingredient's page: what a batch makes and
 * weighs, how long it keeps, how long it takes, where it lives, how it's
 * made, the steps, and what else it goes into. "Make" scales it on the bench.
 */
export function PrepCard(props: PrepCardProps) {
  return (
    <VenueBrandProvider>
      <Card {...props} />
    </VenueBrandProvider>
  );
}

function Card({ itemId, itemName, barId, recipe, canEditItem }: PrepCardProps) {
  const ds = useDs();
  const router = useRouter();
  const { active, venues } = useActiveVenue();
  const { data: capabilities } = useCapabilities(barId);
  const { data: card, isPending } = useItemPrep(itemId);
  const { data: usedIn = [] } = usePrepUsedIn(itemId);
  const [making, setMaking] = useState(false);
  const [editing, setEditing] = useState(false);
  const canEdit = barId ? !!capabilities?.includes('prep') || canEditItem : canEditItem;
  const accent = venues.find((v) => v.id === barId)?.accent ?? active?.accent ?? undefined;
  if (isPending || !card) return null;

  const prep = card.prep;
  const t = totals(recipe);
  const yieldQ = toQuantity(prep?.yield_amount, prep?.yield_unit);
  const per100 = gramsPer100ml(t, prep?.yield_amount ?? null, prep?.yield_unit ?? null);
  const facts = [
    yieldQ && { label: 'Yield', value: formatQuantity(yieldQ) },
    totalsLine(t) && { label: 'One batch', value: totalsLine(t) },
    per100 && { label: 'Per 100 ml', value: `${per100} g` },
    shelfLifeLabel(prep?.shelf_life_hours ?? null) && { label: 'Keeps', value: shelfLifeLabel(prep?.shelf_life_hours ?? null)! },
    leadTimeLabel(prep?.lead_time_minutes ?? null, prep?.lead_time_note ?? null) && { label: 'Takes', value: leadTimeLabel(prep?.lead_time_minutes ?? null, prep?.lead_time_note ?? null)! },
    prep?.storage && { label: 'Storage', value: prep.storage },
  ].filter((f): f is { label: string; value: string } => !!f);

  return (
    <Surface style={styles.card}>
      <View style={styles.head}>
        <Caption tone="muted" role="heading" style={styles.eyebrow}>
          PREP
        </Caption>
        {prep?.actions.length ? (
          <View style={styles.tags}>
            {prep.actions.map((a) => (
              <Tag key={a} label={a} />
            ))}
          </View>
        ) : null}
      </View>
      {facts.length ? (
        <View style={styles.facts} role="list">
          {facts.map((f) => (
            <View
              key={f.label}
              role="listitem"
              accessibilityLabel={`${f.label}: ${f.value}`}
              // A short figure shares a row; a sentence ("Cool before bottling") takes the whole one.
              style={[styles.fact, { backgroundColor: ds.c.raised, flexBasis: f.value.length > 12 ? '100%' : '30%' }]}
            >
              <Caption tone="muted">{f.label}</Caption>
              <Spec>{f.value}</Spec>
            </View>
          ))}
        </View>
      ) : (
        <Body tone="muted">{canEdit ? 'No prep card yet. Add the yield and how long it keeps.' : 'No prep card yet.'}</Body>
      )}
      {card.steps.length ? (
        <View style={styles.steps}>
          {card.steps.map((s) => (
            <View key={s.position} style={styles.step}>
              <Caption tone="muted" style={styles.number}>
                {s.position + 1}
              </Caption>
              <Body style={styles.stepText}>{s.body}</Body>
              {s.timer_seconds ? <Caption tone="accent">{timerLabel(s.timer_seconds)}</Caption> : null}
            </View>
          ))}
        </View>
      ) : null}
      {usedIn.length ? (
        <View style={styles.usedIn}>
          <Caption tone="muted">Goes into</Caption>
          <View style={styles.tags}>
            {usedIn.map((u) => (
              <PressableScale key={u.id} accessibilityLabel={`Open ${u.name}`} onPress={() => router.push(`/ingredient/${u.id}` as never)}>
                <Tag label={u.name} tone="accent" />
              </PressableScale>
            ))}
          </View>
        </View>
      ) : null}
      <View style={styles.actions}>
        {recipe.length ? <Button label="Make" icon="flask" onPress={() => setMaking(true)} /> : null}
        {canEdit ? <Button label={prep ? 'Edit prep card' : 'Add prep card'} variant="secondary" onPress={() => setEditing(true)} /> : null}
      </View>
      <MakeSheet visible={making} onClose={() => setMaking(false)} itemName={itemName} recipe={recipe} card={card} accent={accent} />
      {editing ? <PrepEditSheet visible onClose={() => setEditing(false)} itemId={itemId} itemName={itemName} current={card} /> : null}
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  head: { gap: space.sm },
  eyebrow: { letterSpacing: 1 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  fact: { flexGrow: 1, flexShrink: 1, maxWidth: '100%', padding: space.sm, borderRadius: radius.control, gap: 2 },
  steps: { gap: space.xs },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  number: { width: 20, paddingTop: 2 },
  stepText: { flex: 1 },
  usedIn: { gap: space.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
