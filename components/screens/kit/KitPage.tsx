import { useRouter, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Surface } from '@/components/ds';
import { VenueSubPage } from '@/components/screens/venue/VenueSubPage';
import { space } from '@/constants/tokens';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';

export type KitKind = 'glassware' | 'ice' | 'tools';

/** A kit list: /settings/bar/<venue>/ice, or My Bar's /kit/ice (null venue). */
export const kitListHref = (barId: string | null, kind: KitKind) => (barId ? `/settings/bar/${barId}/${kind}` : `/kit/${kind}`) as Href;

/** Where one thing in the kit opens: /settings/bar/<venue>/kit/ice/<id>, or My Bar's /kit/ice/<id>. */
export const kitItemHref = (barId: string | null, kind: KitKind, id: string) => (barId ? `/settings/bar/${barId}/kit/${kind}/${id}` : `/kit/${kind}/${id}`) as Href;

/** Opens one thing in the kit: a page of its own on a phone, beside the list on a wide screen. */
export function useOpenKitItem(barId: string | null, kind: KitKind, openId: string | null | undefined) {
  const router = useRouter();
  return (id: string) => (openId ? router.replace(kitItemHref(barId, kind, id)) : router.push(kitItemHref(barId, kind, id)));
}

/** After Remove: back to the list it was opened from, or to the list when it was opened by a link. */
export function useCloseKitItem(barId: string | null, kind: KitKind) {
  const router = useRouter();
  return () => (router.canGoBack() ? router.back() : router.replace(kitListHref(barId, kind)));
}

interface KitPageProps {
  /** The venue; null is My Bar's Kit. */
  barId: string | null;
  kind: KitKind;
  /** "Ice". */
  title: string;
  intro: string;
  /** The thing open, from the route; null is the list alone. */
  openId?: string | null;
  /** Its name, for the phone page's title. Null while it loads or once it's gone. */
  openName?: string | null;
  list: ReactNode;
  /** Its page (KitItemPage). */
  item?: ReactNode;
  loading?: boolean;
  /** The list didn't load: the open thing isn't known to be gone. */
  failed?: boolean;
}

/**
 * Kit › Glassware, Ice or Tools (Kit and ice, steps 1 and 2): the list, and
 * the thing opened from it. On a phone the opened thing is a page of its own
 * that goes back to the list; on a wide screen it sits beside the list.
 */
export function KitPage({ barId, kind, title, intro, openId, openName, list, item, loading, failed }: KitPageProps) {
  const wide = useIsWideWeb();
  const listHref = kitListHref(barId, kind);
  const gone = loading || item ? null : <Body tone="muted">{failed ? 'Couldn’t load it. Check your connection and try again.' : 'That’s not in the kit any more.'}</Body>;
  if (openId && !wide) {
    return (
      <VenueSubPage barId={barId} title={openName ?? title} up={{ label: title, href: listHref }}>
        {item ?? gone}
      </VenueSubPage>
    );
  }
  return (
    <VenueSubPage barId={barId} title={title} intro={intro} wide={!!openId}>
      {openId ? (
        <View style={styles.split}>
          <View style={styles.list}>{list}</View>
          <Surface style={styles.item}>{item ?? gone}</Surface>
        </View>
      ) : (
        list
      )}
    </VenueSubPage>
  );
}

const styles = StyleSheet.create({
  split: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xl },
  list: { flex: 1, minWidth: 0, maxWidth: 520 },
  item: { flex: 1, minWidth: 0, padding: space.lg },
});
