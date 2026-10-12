import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, DrinkImage, DsText, Field, GlassButton, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import { useRemoveCareerDrink, useRemoveWorkedMenu, useSaveCareerDrink, useSaveWorkedMenu } from '@/hooks/useOnboarding';
import { useWorkedMenus } from '@/hooks/useProfiles';
import type { RankVenue } from '@/hooks/useRankings';
import { drinkNameError, menuNameError } from '@/lib/onboarding';

import { BarPick } from './CareerSteps';
import { SetupFooter, SetupPage } from './SetupPage';

const TILE = 48;

/** One thing they've added on this step: a tile, two lines, and Remove. */
function AddedRow({ tile, title, line, onRemove, removing }: { tile: ReactNode; title: string; line: string; onRemove: () => void; removing: boolean }) {
  const ds = useDs();
  return (
    <View role="listitem" style={[styles.row, { borderBottomColor: ds.c.line }]}>
      <View style={[styles.tile, { backgroundColor: ds.c.paper }]}>{tile}</View>
      <View style={styles.flex}>
        <DsText variant="headline" numberOfLines={1}>{title}</DsText>
        <Caption tone="muted" numberOfLines={1}>{line}</Caption>
      </View>
      <GlassButton accessibilityLabel={`Remove ${title}`} icon="xmark" onPress={removing ? () => {} : onRemove} />
    </View>
  );
}

/**
 * A menu they worked on, at a bar that may have closed. Same save as a job:
 * their own profile. ponytail: a worked menu has no drinks linked yet (b62),
 * so rows show a menu tile and no drink count; the drawing and "9 drinks"
 * come once worked menus carry their drinks.
 */
export function MenuStep({ personId, onDone }: { personId: string | null; onDone: () => void }) {
  const ds = useDs();
  const [bar, setBar] = useState<RankVenue | null>(null);
  const [name, setName] = useState('');
  const [tried, setTried] = useState(false);
  const menus = useWorkedMenus(personId).data ?? [];
  const save = useSaveWorkedMenu();
  const remove = useRemoveWorkedMenu();
  const nameProblem = tried ? menuNameError(name) : null;

  const submit = () => {
    setTried(true);
    if (!personId || !bar || menuNameError(name)) return;
    save.mutate({ personId, barId: bar.id, name, year: null }, { onSuccess: () => { setName(''); setTried(false); setBar(null); } });
  };

  return (
    <SetupPage footer={<SetupFooter onPress={onDone} onSkip={onDone} />}>
      {menus.length ? (
        <View role="list" accessibilityLabel="Menus you’ve added">
          {menus.map((m) => (
            <AddedRow
              key={m.id}
              tile={<IconSymbol name="list.bullet" size={22} color={ds.c.sketchInk} />}
              title={m.name}
              line={m.year ? `${m.bar.display_name} · ${m.year}` : m.bar.display_name}
              removing={remove.isPending}
              onRemove={() => remove.mutate(m.id)}
            />
          ))}
        </View>
      ) : null}
      <Field label="Menu name" value={name} onChangeText={setName} placeholder="Autumn 2025" error={nameProblem ?? undefined} maxLength={120} />
      <BarPick bar={bar} onPick={setBar} label="Bar" />
      {tried && !bar ? <Caption tone="accent">Pick the bar it was at.</Caption> : null}
      {save.error || remove.error ? <Caption tone="accent">{(save.error ?? remove.error)?.message}</Caption> : null}
      <Button label={save.isPending ? 'Saving…' : 'Add menu'} variant="secondary" onPress={submit} disabled={save.isPending} />
    </SetupPage>
  );
}

interface AddedDrink {
  id: string;
  name: string;
  bar: string | null;
}

/**
 * A cocktail they worked on: a normal shared drink, origin bar optional and
 * allowed to be closed. The list is what they added on this step, so Remove
 * only ever takes back a drink they just made.
 */
export function DrinkStep({ personId, onDone }: { personId: string | null; onDone: () => void }) {
  const [bar, setBar] = useState<RankVenue | null>(null);
  const [name, setName] = useState('');
  const [tried, setTried] = useState(false);
  const [added, setAdded] = useState<AddedDrink[]>([]);
  const save = useSaveCareerDrink();
  const remove = useRemoveCareerDrink();

  const submit = () => {
    setTried(true);
    if (!personId || drinkNameError(name)) return;
    const drink = { name: name.trim(), bar: bar?.display_name ?? null };
    save.mutate(
      { personId, barId: bar?.id ?? null, name },
      {
        onSuccess: (id) => {
          setAdded((list) => [...list, { id, ...drink }]);
          setName('');
          setTried(false);
          setBar(null);
        },
      }
    );
  };

  return (
    <SetupPage footer={<SetupFooter onPress={onDone} onSkip={onDone} />}>
      {added.length ? (
        <View role="list" accessibilityLabel="Drinks you’ve added">
          {added.map((d) => (
            <AddedRow
              key={d.id}
              tile={<DrinkImage itemId={d.id} accessibilityLabel="" aspectRatio={1} radius={0} sketchDetail="thumb" style={styles.fill} />}
              title={d.name}
              line={d.bar ? `${d.bar} · you made it` : 'You made it'}
              removing={remove.isPending}
              onRemove={() => remove.mutate(d.id, { onSuccess: () => setAdded((list) => list.filter((x) => x.id !== d.id)) })}
            />
          ))}
        </View>
      ) : null}
      <Field label="Drink" value={name} onChangeText={setName} placeholder="Its name" error={tried ? (drinkNameError(name) ?? undefined) : undefined} maxLength={80} />
      <BarPick bar={bar} onPick={setBar} label="Where" />
      {save.error || remove.error ? <Caption tone="accent">{(save.error ?? remove.error)?.message}</Caption> : null}
      {!personId ? <Caption tone="accent">Add your name first.</Caption> : null}
      <Button label={save.isPending ? 'Saving…' : 'Add drink'} variant="secondary" onPress={submit} disabled={save.isPending} />
    </SetupPage>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  tile: { width: TILE, height: TILE, borderRadius: radius.control, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  fill: { width: TILE, height: TILE },
  flex: { flex: 1, minWidth: 0 },
});
