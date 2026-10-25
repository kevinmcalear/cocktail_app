import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Tag } from '@/components/ds';
import { MenuCardFrame, MenuLine } from '@/components/screens/menus/MenuRows';
import { space } from '@/constants/tokens';
import { useMenuEditions } from '@/hooks/useProfiles';
import { editionCardLine, editionPastLine, type MenuEdition } from '@/lib/menuEditions';

/** Past menus listed before "Show all 9 menus". */
const FIRST_PAST = 5;

/**
 * A bar's menus (menus-one-look, BandElsewhere): the one on now as a card
 * with its drink band, then the past ones as lines, the name over its dates
 * and count. Each opens the menu's guest page, the paper menu. Its public
 * page and its profile's menu history both draw this.
 */
export function PublicMenus({ profileId, name }: { profileId: string; name: string }) {
  const router = useRouter();
  const { data = [], isLoading } = useMenuEditions(profileId);
  const [all, setAll] = useState(false);
  if (isLoading) return <Caption tone="muted">Loading menus…</Caption>;
  if (!data.length) return <Body tone="muted">{`No menus from ${name} here yet.`}</Body>;
  const now = data.find((m) => m.is_current) ?? null;
  const past = data.filter((m) => m !== now);
  const shown = all ? past : past.slice(0, FIRST_PAST);
  const open = (m: MenuEdition) => router.push(`/p/${profileId}/menus/${m.id}` as Href);
  return (
    <View style={styles.block}>
      {now ? (
        <MenuCardFrame
          label={`${now.name}, on now, ${editionCardLine(now)}. Open the menu`}
          onPress={() => open(now)}
          name={now.name}
          coverUrl={null}
          // ponytail: an edition's drinks carry no photo, so the band draws their sketches; add image_url to menu editions to show photos.
          pictures={now.drinks.map((d) => ({ id: d.id, name: d.name, imageUrl: null, isSketch: false }))}
          line={editionCardLine(now)}
          trailing={<Tag label="On now" tone="success" dot />}
        />
      ) : null}
      {shown.length ? (
        <View role="list">
          {shown.map((m) => (
            <MenuLine key={m.id} name={m.name} line={editionPastLine(m)} label={`${m.name}. ${editionPastLine(m)}. Open the menu`} onPress={() => open(m)} />
          ))}
        </View>
      ) : null}
      {past.length > FIRST_PAST && !all ? <Button label={`Show all ${data.length} menus`} variant="secondary" onPress={() => setAll(true)} style={styles.start} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.sm },
  start: { alignSelf: 'flex-start', marginTop: space.sm },
});
