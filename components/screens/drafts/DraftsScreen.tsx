import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Caption, Display, GlassButton, useBreakpoint, useDs, useGutter, type IconName } from '@/components/ds';
import { ResultRow } from '@/components/search/ResultRows';
import { space } from '@/constants/tokens';
import { useAuth } from '@/ctx/AuthContext';
import { useBars } from '@/hooks/useBars';
import { useDrafts } from '@/hooks/useDrafts';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';
import { timeAgo } from '@/lib/commandSearchGrid';
import { confirmAsync, showMessage } from '@/lib/dialogs';
import { DRAFT_KIND_LABEL, draftHref, draftTitle, groupDrafts } from '@/lib/draftList';

const ICON: Record<string, IconName> = {
  cocktail: 'wineglass',
  beer: 'mug.fill',
  wine: 'wineglass',
  ingredient: 'drop.fill',
  menu: 'list.bullet',
};

/**
 * New > Drafts: what's been saved as a draft to the account, by venue, newest
 * first. Tap to carry on in its editor; the bin deletes it. Drinks being added
 * with a wizard stay on the device and pick up in the wizard itself.
 */
export function DraftsScreen() {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const wide = useBreakpoint() !== 'phone';
  const sidebar = useIsWideWeb();
  const userId = useAuth().user?.id ?? null;
  const { drafts, isLoading, deleteDraft } = useDrafts();
  const { data: bars } = useBars();
  const [deleting, setDeleting] = useState<string | null>(null);

  const barName = (barId: string) => {
    if (!barId) return 'Just yours';
    // A to-one embed: an object at runtime, typed as a list.
    const bar = bars?.find((b) => b.bar_id === barId)?.bars as { name?: string } | { name?: string }[] | null | undefined;
    return (Array.isArray(bar) ? bar[0]?.name : bar?.name) ?? 'A venue';
  };

  const remove = async (id: string, title: string) => {
    const ok = await confirmAsync({ title: 'Delete this draft?', message: `“${title}” will be gone for good.`, confirmText: 'Delete', destructive: true });
    if (!ok) return;
    setDeleting(id);
    try {
      await deleteDraft(id);
    } catch (e) {
      showMessage('Couldn’t delete the draft', e instanceof Error ? e.message : 'Try again in a moment.');
    } finally {
      setDeleting(null);
    }
  };

  const groups = groupDrafts(drafts);

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + (sidebar ? space.xxl : space.sm), paddingHorizontal: gutter, paddingBottom: insets.bottom + space.xxxl, maxWidth: wide ? 760 : undefined },
        ]}
      >
        {sidebar ? null : (
          <View style={styles.top}>
            <GlassButton icon="chevron.left" accessibilityLabel="Back" onPress={() => (router.canGoBack() ? router.back() : router.navigate('/'))} />
          </View>
        )}
        <View style={styles.title}>
          <Display>Drafts</Display>
          {drafts.length ? <Caption tone="muted">{`${drafts.length} unfinished`}</Caption> : null}
        </View>

        {!isLoading && !drafts.length ? <Body tone="muted">Nothing unfinished. Drafts you save show up here.</Body> : null}

        {groups.map((g) => (
          <View key={g.barId || 'mine'} style={styles.group}>
            <Caption tone="muted" role="heading" style={styles.groupTitle}>
              {barName(g.barId).toUpperCase()}
            </Caption>
            {g.drafts.map((d) => {
              const title = draftTitle(d);
              const href = draftHref(d);
              const caption = [
                DRAFT_KIND_LABEL[d.entity_type] ?? 'Draft',
                d.user_id && d.user_id !== userId ? 'a teammate’s' : null,
                `${timeAgo(new Date(d.updated_at).getTime())} ago`,
              ]
                .filter(Boolean)
                .join(' · ');
              return (
                <View key={d.id} style={styles.row}>
                  <View style={styles.main}>
                    <ResultRow
                      title={title}
                      caption={caption}
                      icon={ICON[d.entity_type] ?? 'doc.text'}
                      onPress={() => (href ? router.push(href as Href) : showMessage('Can’t open this draft', 'It was made in an older version of the app.'))}
                    />
                  </View>
                  <GlassButton
                    icon="trash"
                    accessibilityLabel={`Delete draft ${title}`}
                    onPress={() => (deleting === d.id ? undefined : void remove(d.id, title))}
                  />
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: '100%', alignSelf: 'center', gap: space.lg },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { gap: space.xs },
  group: { gap: space.xs },
  groupTitle: { letterSpacing: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  main: { flex: 1, minWidth: 0 },
});
