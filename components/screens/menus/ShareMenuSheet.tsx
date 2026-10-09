import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, Share } from 'react-native';

import { Body, Button, Caption } from '@/components/ds';
import { useShareMenu } from '@/hooks/useMenuMutations';
import { homeMenuLine } from '@/lib/menus';
import { siteOrigin } from '@/lib/venueLink';
import type { MenuDetail } from '@/types/menus';

import { AnswerRow } from '../addDrink/ReviewStep';
import { MenuSheet } from './MenuSheet';
import { CardHeader } from './ReviewParts';

// The server's refusal when you have no public profile yet (guard_menu_share).
const NEEDS_PROFILE = /public profile/;

type SharedMenu = Pick<MenuDetail, 'id' | 'name' | 'sharedAt'> & Partial<Pick<MenuDetail, 'sections' | 'coverUrl' | 'coverPosition' | 'menuDate' | 'guestCount'>>;

/**
 * Share a home menu, as a review step: the menu on paper, who sees what, the
 * link, and the guest card to print. One button shares. Sharing publishes
 * nothing: the link shows drinks that are already public, and the rest as
 * "House drink" with no name.
 */
export function ShareMenuSheet({ menu, onClose }: { menu: SharedMenu; onClose: () => void }) {
  const router = useRouter();
  const share = useShareMenu();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const url = `${siteOrigin()}/m/${menu.id}`;
  const web = Platform.OS === 'web';
  const drinks = (menu.sections ?? []).flatMap((s) => s.drinks);

  const setShared = async (shared: boolean) => {
    setError(null);
    setCopied(false);
    try {
      await share.mutateAsync({ menuId: menu.id, shared });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That didn’t work. Try again.');
    }
  };

  const send = async () => {
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

  return (
    <MenuSheet
      visible
      onClose={onClose}
      title="Share this menu"
      subtitle={menu.name}
      footer={
        menu.sharedAt ? (
          <Button label={copied ? 'Link copied' : web ? 'Copy link' : 'Share link'} icon={web ? 'doc.on.doc' : 'square.and.arrow.up'} size="lg" onPress={() => void send()} />
        ) : (
          <Button label="Share a link" icon="link" size="lg" onPress={() => void setShared(true)} disabled={share.isPending} />
        )
      }
    >
      <CardHeader
        name={menu.name}
        when={menu.menuDate !== undefined && menu.guestCount !== undefined ? homeMenuLine({ menuDate: menu.menuDate, guestCount: menu.guestCount }, now) : null}
        coverUrl={menu.coverUrl ?? null}
        coverPosition={menu.coverPosition}
        drinks={drinks}
      />
      <AnswerRow
        label="Who sees what"
        value="Anyone with the link sees the menu’s name, date and sections. Drinks that are already public show by name; your own unpublished ones show as “House drink”, with no name or spec. Sharing doesn’t publish anything."
      />
      <AnswerRow label="Link" value={menu.sharedAt ? url : 'Not shared yet'} />
      <AnswerRow label="Guest card" value="Each drink with its sketch or photo, to print or save as a PDF" onPress={() => go(`/menus/${menu.id}/card`)} hint="Opens the guest card" opens />
      {menu.sharedAt ? <Button label="Stop sharing" icon="xmark" variant="ghost" onPress={() => void setShared(false)} disabled={share.isPending} /> : null}
      {error ? <Body tone="accent">{error}</Body> : null}
      {error && NEEDS_PROFILE.test(error) ? <Button label="Set up your public profile" icon="person.crop.circle" variant="secondary" onPress={() => go('/settings/profile')} /> : null}
      {menu.sharedAt ? <Caption tone="muted">Stop sharing and the link stops working. Share again and the same link works again.</Caption> : null}
    </MenuSheet>
  );
}
