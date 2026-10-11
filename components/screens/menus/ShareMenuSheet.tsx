import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, Share, StyleSheet, View } from 'react-native';

import { Body, Button } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useShareMenu } from '@/hooks/useMenuMutations';
import { cardWhen, homeMenuLine, nightLine } from '@/lib/menus';
import { siteOrigin } from '@/lib/venueLink';
import type { MenuDetail } from '@/types/menus';

import { AnswerRow } from '../addDrink/ReviewStep';
import type { CardPictures } from './MenuSections';
import { Choice, MenuSheet } from './MenuSheet';
import { CardHeader, MonoLabel } from './ReviewParts';

// The server's refusal when you have no public profile yet (guard_menu_share).
const NEEDS_PROFILE = /public profile/;

const PICTURES: { value: CardPictures; label: string; line: string }[] = [
  { value: 'above', label: 'Above', line: 'Sketches above each name' },
  { value: 'beside', label: 'Beside', line: 'Sketches beside each name' },
  { value: 'none', label: 'None', line: 'Names only' },
];

type SharedMenu = Pick<MenuDetail, 'id' | 'name' | 'sharedAt'> &
  Partial<Pick<MenuDetail, 'barId' | 'sections' | 'coverUrl' | 'coverPosition' | 'menuDate' | 'guestCount' | 'startsAt' | 'endsAt' | 'plannedStartsAt' | 'plannedEndsAt'>>;

/**
 * Share a menu with a link, as a review step: the menu on paper, then "Ready
 * to share?" and its answers (name, drinks, night, what's on the card, who
 * sees what), then Print and Share link. A home menu shares this way, and a
 * venue's one-night menu without going live (b15). Sharing publishes nothing:
 * the link shows drinks that are already public, the rest as "House drink".
 */
export function ShareMenuSheet({ menu, onClose }: { menu: SharedMenu; onClose: () => void }) {
  const router = useRouter();
  const share = useShareMenu();
  const { venues } = useActiveVenue();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pictures, setPictures] = useState<CardPictures>('above');
  const [choosing, setChoosing] = useState(false);
  const [now] = useState(() => Date.now());
  const url = `${siteOrigin()}/m/${menu.id}`;
  const web = Platform.OS === 'web';
  const drinks = (menu.sections ?? []).flatMap((s) => s.drinks);
  const venue = venues.find((v) => v.id === menu.barId) ?? null;
  const dated = { startsAt: menu.startsAt ?? null, endsAt: menu.endsAt ?? null, menuDate: menu.menuDate ?? null, plannedStartsAt: menu.plannedStartsAt ?? null, plannedEndsAt: menu.plannedEndsAt ?? null };
  const nightStart = menu.barId ? (menu.startsAt ?? menu.plannedStartsAt ?? null) : null;
  const night = nightStart ? nightLine(nightStart) : homeMenuLine({ menuDate: menu.menuDate ?? null, guestCount: menu.guestCount ?? null }, now);
  const card = `/menus/${menu.id}/card?pictures=${pictures}`;

  const setShared = async (shared: boolean): Promise<boolean> => {
    setError(null);
    setCopied(false);
    try {
      await share.mutateAsync({ menuId: menu.id, shared });
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That didn’t work. Try again.');
      return false;
    }
  };

  const send = async () => {
    if (!menu.sharedAt && !(await setShared(true))) return;
    setError(null);
    try {
      if (!web) {
        await Share.share({ message: url, url, title: menu.name });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // The browser can refuse clipboard access; the link is on screen to copy by hand.
      setError('Couldn’t copy the link. Select it above and copy it yourself.');
    }
  };
  const go = (to: string) => {
    onClose();
    router.push(to as never);
  };
  const edit = () => go(`/menus/${menu.id}/edit`);

  return (
    <MenuSheet
      visible
      onClose={onClose}
      title="Share this menu"
      footer={
        <View style={styles.footer}>
          <Button label="Print" icon="printer" variant="secondary" size="lg" onPress={() => go(card)} />
          <Button label={copied ? 'Link copied' : 'Share link'} icon="link" size="lg" onPress={() => void send()} disabled={share.isPending} style={styles.flex} />
        </View>
      }
    >
      <CardHeader name={menu.name} when={cardWhen(dated)} coverUrl={menu.coverUrl ?? null} coverPosition={menu.coverPosition} drinks={drinks} onOpenCard={() => go(card)} />
      <MonoLabel>Ready to share?</MonoLabel>
      <View role="list">
        <AnswerRow label="Name" value={menu.name} onPress={edit} />
        {drinks.length ? <AnswerRow label="Drinks" value={drinks.map((d) => d.name).join(', ')} onPress={edit} /> : null}
        {night ? <AnswerRow label="Night" value={night} onPress={menu.barId ? edit : undefined} /> : null}
        <AnswerRow label="On the card" value={`${PICTURES.find((p) => p.value === pictures)?.line}${menu.barId ? ', with prices' : ''}`} onPress={() => setChoosing(!choosing)} hint="Shows the choices" />
        {choosing ? (
          <View role="radiogroup" accessibilityLabel="Pictures on the card" style={styles.choices}>
            {PICTURES.map((p) => (
              <Choice key={p.value} label={p.label} selected={pictures === p.value} onPress={() => setPictures(p.value)} />
            ))}
          </View>
        ) : null}
        <AnswerRow label="Who sees what" value={`Anyone with the link. Drinks ${venue?.name ?? 'you'} ha${venue ? 's' : 've'}n’t made public show as House drink.`} />
        {menu.sharedAt ? <AnswerRow label="Link" value={url} /> : null}
      </View>
      {menu.sharedAt ? <Button label="Stop sharing" icon="xmark" variant="ghost" onPress={() => void setShared(false)} disabled={share.isPending} /> : null}
      {error ? <Body tone="accent">{error}</Body> : null}
      {error && NEEDS_PROFILE.test(error) ? <Button label="Set up your public profile" icon="person.crop.circle" variant="secondary" onPress={() => go('/settings/profile')} /> : null}
    </MenuSheet>
  );
}

const styles = StyleSheet.create({
  footer: { flexDirection: 'row', gap: space.md },
  flex: { flex: 1 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingVertical: space.md },
});
