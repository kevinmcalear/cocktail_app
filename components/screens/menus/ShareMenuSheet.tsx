import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Platform, Share, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DsText, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import { useShareMenu } from '@/hooks/useMenuMutations';
import { siteOrigin } from '@/lib/venueLink';
import type { MenuDetail } from '@/types/menus';

import { MenuSheet } from './MenuSheet';

// The server's refusal when you have no public profile yet (guard_menu_share).
const NEEDS_PROFILE = /public profile/;

/**
 * Share a home menu: a link anyone can open (/m/<id>), or the guest card to
 * print. Sharing publishes nothing: the link shows drinks that are already
 * public, and the rest as "House drink" with no name.
 */
export function ShareMenuSheet({ menu, onClose }: { menu: Pick<MenuDetail, 'id' | 'name' | 'sharedAt'>; onClose: () => void }) {
  const ds = useDs();
  const router = useRouter();
  const share = useShareMenu();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const url = `${siteOrigin()}/m/${menu.id}`;
  const web = Platform.OS === 'web';

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

  return (
    <MenuSheet visible onClose={onClose} title="Share this menu" subtitle={menu.name}>
      <Body tone="muted">
        Anyone with the link sees the menu’s name, date and sections. Drinks that are already public show by name. Your own drinks that you haven’t published show as “House drink”, with no name or spec. Sharing
        doesn’t publish anything.
      </Body>
      {menu.sharedAt ? (
        <>
          <View style={[styles.link, { borderColor: ds.c.line, backgroundColor: ds.c.ground }]}>
            <DsText variant="spec" selectable numberOfLines={1}>
              {url}
            </DsText>
          </View>
          <Button label={copied ? 'Link copied' : web ? 'Copy link' : 'Share link'} icon={web ? 'doc.on.doc' : 'square.and.arrow.up'} onPress={() => void send()} />
          <Button label="Stop sharing" icon="xmark" variant="ghost" onPress={() => void setShared(false)} disabled={share.isPending} />
        </>
      ) : (
        <Button label="Share a link" icon="link" onPress={() => void setShared(true)} disabled={share.isPending} />
      )}
      <Button
        label="Guest card to print"
        icon="doc.text"
        variant="secondary"
        onPress={() => {
          onClose();
          router.push(`/menus/${menu.id}/card`);
        }}
      />
      {error ? <Body tone="accent">{error}</Body> : null}
      {error && NEEDS_PROFILE.test(error) ? (
        <Button
          label="Set up your public profile"
          icon="person.crop.circle"
          variant="secondary"
          onPress={() => {
            onClose();
            // Settings › Public profile, from #137. Cast until that route is on this branch's typed routes.
            router.push('/settings/profile' as Href);
          }}
        />
      ) : null}
      {menu.sharedAt ? <Caption tone="muted">Stop sharing and the link stops working. Share again and the same link works again.</Caption> : null}
    </MenuSheet>
  );
}

const styles = StyleSheet.create({
  link: { borderWidth: 1, borderRadius: radius.control, paddingHorizontal: space.md, paddingVertical: space.sm },
});
