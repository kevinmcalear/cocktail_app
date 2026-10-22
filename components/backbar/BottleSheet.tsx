import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, IngredientThumb } from '@/components/ds';
import { MenuSheet } from '@/components/screens/menus/MenuSheet';
import { SettingsRow } from '@/components/screens/settings/SettingsParts';
import { space } from '@/constants/tokens';
import { useBottleSpots } from '@/hooks/useBackBar';
import { useApplySwap, useSpecCatalog, useSwapSource } from '@/hooks/useBulk';
import { useVenueMenus } from '@/hooks/useMenus';
import { bottleLine, pourCount, pourersOf, stillPours, swapQuestion } from '@/lib/backBarSwap';
import { plainDbMessage } from '@/lib/dbError';
import type { ItemLocation } from '@/types/backBar';

import { PickBottle, PourList, type Bottle } from './BottleSwap';
import type { BottleDone } from './useBottleToast';

type Step = 'menu' | 'pick' | 'swap' | 'off';

interface BottleSheetProps {
  barId: string;
  location: ItemLocation;
  /** `edit_drinks`: may swap the drinks and preps too, not just the spots. */
  canEditDrinks: boolean;
  onMove: () => void;
  /** Opens the spot's shelf, container and par. */
  onEdit: () => void;
  onDone: (done: BottleDone) => void;
  onClose: () => void;
}

/**
 * Tap a bottle on the back bar (board eddie-oct22-wave2, fix 13): replace it
 * with another bottle, or take it off, and the drinks and preps that pour it
 * follow in one go. The swap is the Library's (useApplySwap), so each drink
 * keeps its old spec as a version and Undo puts it back.
 */
export function BottleSheet({ barId, location, canEditDrinks, onMove, onEdit, onDone, onClose }: BottleSheetProps) {
  const source = useSwapSource(barId);
  const menus = useVenueMenus(barId);
  const { catalog } = useSpecCatalog();
  const apply = useApplySwap();
  const spots = useBottleSpots(barId);
  const [now] = useState(() => Date.now());
  const [step, setStep] = useState<Step>('menu');
  // Replace puts the new bottle in the old one's spots; Take it off clears them.
  const [goal, setGoal] = useState<'replace' | 'off'>('replace');
  const [replaceWith, setReplaceWith] = useState<Bottle | null>(null);
  const [unticked, setUnticked] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bottle: Bottle = { id: location.item_id, name: location.item?.name ?? 'This bottle' };
  const names = useMemo(() => {
    const map: Record<string, string> = { ...(source.data?.names ?? {}) };
    for (const item of catalog) map[item.id] = item.name;
    return map;
  }, [source.data?.names, catalog]);
  const genericId = catalog.find((item) => item.id === bottle.id)?.genericId ?? null;
  // The plain kind ("Mezcal") that drinks fall back to when the bottle goes.
  const plain: Bottle | null = genericId && names[genericId] ? { id: genericId, name: names[genericId] } : null;
  const rows = useMemo(
    () => pourersOf(source.data?.drinks ?? [], bottle.id, replaceWith, names, menus.data ?? [], now),
    [source.data?.drinks, bottle.id, replaceWith, names, menus.data, now]
  );
  const chosen = canEditDrinks ? rows.filter((row) => !unticked[row.hit.drink.id]) : [];

  const finish = async (swapDrinks: boolean) => {
    setBusy(true);
    setError(null);
    let undone: BottleDone['undone'] = [];
    try {
      if (swapDrinks && replaceWith && chosen.length) {
        const result = await apply.mutateAsync({
          drinks: chosen.map((row) => row.hit.drink),
          findId: bottle.id,
          replaceId: replaceWith.id,
          mode: 'bottle',
          note: `Swapped ${bottle.name} for ${replaceWith.name}`,
        });
        undone = result.undone;
        if (result.error) {
          // What finished can still be undone; the spots stay as they were. Closed, so a retry starts from fresh specs.
          if (undone.length) {
            onDone({ title: result.error, bottle, replaceWith, undone, moved: [], removed: [] });
            onClose();
          } else setError(result.error);
          return;
        }
      }
      const moved = goal === 'replace' && replaceWith ? await spots.replace.mutateAsync({ fromId: bottle.id, toId: replaceWith.id }) : [];
      const removed = goal === 'off' ? await spots.takeOff.mutateAsync(bottle.id) : [];
      const poured = undone.length ? `${pourCount(chosen)} now ${chosen.length === 1 ? 'pours' : 'pour'} ${replaceWith?.name}` : null;
      const title =
        goal === 'off'
          ? `${bottle.name} is off the back bar`
          : (poured ?? `${replaceWith?.name} replaced ${bottle.name} on the back bar`);
      onDone({ title, detail: goal === 'off' ? (poured ?? undefined) : undefined, bottle, replaceWith, undone, moved, removed });
      onClose();
    } catch (e) {
      const message = plainDbMessage(e) ?? 'That didn’t save. Check your connection and try again.';
      // The drinks changed but the spots didn't: still offer Undo for the drinks.
      if (undone.length) onDone({ title: `The drinks changed, the back bar didn’t. ${message}`, bottle, replaceWith, undone, moved: [], removed: [] });
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  // Nothing is taken off or replaced before the list of what pours it is known.
  // A failed read would look like "nothing pours it", so it blocks the changes too.
  const waiting = busy || source.isLoading || menus.isLoading || !!source.error;
  const toggle = (id: string) => setUnticked((prev) => ({ ...prev, [id]: !prev[id] }));
  const pick = (picked: Bottle) => {
    setReplaceWith(picked);
    setStep('swap');
  };
  const start = (next: 'replace' | 'off', first: Step) => {
    setGoal(next);
    setStep(first);
  };
  const leave = (then: () => void) => {
    onClose();
    then();
  };
  const verb = goal === 'replace' ? `Replace ${bottle.name}` : `Take ${bottle.name} off`;

  let title = bottle.name;
  let eyebrow: string | undefined;
  let subtitle: string | undefined;
  let body: React.ReactNode = null;
  let footer: React.ReactNode = null;
  if (step === 'menu') {
    subtitle = bottleLine(plain?.name ?? null, location.shelf, rows) || undefined;
    body = (
      <View>
        <SettingsRow label="Replace with another bottle" onPress={() => start('replace', 'pick')} />
        <SettingsRow label="Take it off the back bar" onPress={() => start('off', 'off')} />
        <SettingsRow label="Move it" onPress={() => leave(onMove)} />
        <SettingsRow label="Shelf, container and par" onPress={() => leave(onEdit)} />
      </View>
    );
  } else if (step === 'pick') {
    eyebrow = verb;
    title = goal === 'replace' ? 'Which bottle goes in its place?' : 'What do the drinks pour instead?';
    body = <PickBottle barId={barId} bottle={bottle} onPick={pick} />;
  } else if (step === 'off') {
    title = `Take ${bottle.name} off the back bar?`;
    body = (
      <>
        <Body>{rows.length ? stillPours(rows) : 'No drinks or preps pour it.'}</Body>
        <Caption tone="muted">
          {rows.length
            ? `It comes off every spot it has on the map. Left as they are, while a menu that’s on pours it, it shows under Waiting for a spot.${canEditDrinks ? '' : ' Drink Creators and up can swap the drinks.'}`
            : 'It comes off every spot it has on the map.'}
        </Caption>
      </>
    );
    footer = (
      <>
        {rows.length && canEditDrinks ? (
          <Button label="Swap them first" onPress={() => (plain ? pick(plain) : setStep('pick'))} disabled={waiting} />
        ) : null}
        <Button
          label={busy ? 'Taking it off…' : rows.length ? 'Take it off, leave the drinks' : 'Take it off'}
          variant={rows.length && canEditDrinks ? 'secondary' : 'primary'}
          onPress={() => void finish(false)}
          disabled={waiting}
        />
      </>
    );
  } else if (replaceWith) {
    eyebrow = verb;
    title = rows.length ? swapQuestion(rows) : goal === 'replace' ? `Put ${replaceWith.name} in its place?` : `Take ${bottle.name} off?`;
    body = <PourList replaceWith={replaceWith} rows={rows} unticked={unticked} onToggle={toggle} onChange={() => setStep('pick')} canEditDrinks={canEditDrinks} />;
    const all = chosen.length === rows.length;
    const primary = chosen.length ? (all ? `Update all ${chosen.length}` : `Update ${chosen.length}`) : goal === 'replace' ? 'Replace it on the back bar' : 'Take it off';
    footer = (
      <>
        <Button label={busy ? 'Saving…' : primary} onPress={() => void finish(true)} disabled={waiting} />
        {chosen.length ? (
          <Button label={goal === 'replace' ? 'Not now, just the back bar' : 'Take it off, leave the drinks'} variant="ghost" onPress={() => void finish(false)} disabled={waiting} />
        ) : null}
      </>
    );
  }

  return (
    <MenuSheet
      visible
      onClose={onClose}
      plain={step === 'menu' || step === 'off'}
      title={title}
      eyebrow={eyebrow}
      subtitle={subtitle}
      leading={step === 'menu' ? <IngredientThumb id={bottle.id} name={bottle.name} size={56} /> : undefined}
      footer={footer ? <View style={styles.footer}>{footer}</View> : undefined}
    >
      {source.isLoading && step !== 'pick' ? <Caption tone="muted">Looking through the specs…</Caption> : null}
      {source.error && step !== 'pick' ? (
        <Caption tone="accent" role="alert">
          Couldn’t read which drinks pour it. Check your connection and try again.
        </Caption>
      ) : null}
      {body}
      {error ? (
        <Caption tone="accent" role="alert">
          {error}
        </Caption>
      ) : null}
    </MenuSheet>
  );
}

const styles = StyleSheet.create({
  footer: { gap: space.sm },
});
