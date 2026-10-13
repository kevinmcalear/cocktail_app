import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { BackbarTheme, Body, Button, Caption, PressableScale, Surface, Tag, useDs, useGutter } from '@/components/ds';
import { SubPageHead, usePageFrame } from '@/components/nav/PageFrame';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { WebHead } from '@/components/WebHead';
import { space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useBarGlassware, useBarPageId, useDeleteBarGlass, useSaveBarGlass, type BarGlass } from '@/hooks/useBarGlassware';
import { useCapabilities } from '@/hooks/useCapabilities';
import { confirmAsync } from '@/lib/dialogs';
import { GLASS_TYPE_LABEL, glassTitle } from '@/lib/glassware';

import { GlassForm } from './GlassForm';

/**
 * The glasses a venue pours into (bar_glassware): each type's main glass is
 * how its drinks are drawn, and a glass that names its maker's page puts the
 * venue on that page. Admins change them (the brand permission, which the
 * database checks too); everyone at the venue can look.
 */
export function GlasswareScreen({ barId }: { barId: string }) {
  return (
    <BackbarTheme>
      <GlasswarePage barId={barId} />
    </BackbarTheme>
  );
}

function GlasswarePage({ barId }: { barId: string }) {
  const ds = useDs();
  const router = useRouter();
  const frame = usePageFrame('text');
  const gutter = useGutter();
  const tabBarInset = useTabBarInset();
  const venue = useActiveVenue().venues.find((v) => v.id === barId);
  const { data: caps = [] } = useCapabilities(barId);
  const canEdit = caps.includes('brand');
  const { data: pageId, isLoading: pageLoading } = useBarPageId(barId);
  const { data: glasses = [], isLoading, error } = useBarGlassware(barId);
  const save = useSaveBarGlass(barId, pageId);
  const remove = useDeleteBarGlass(barId);
  // The glass open in the form: its id, 'new', or null for none.
  const [open, setOpen] = useState<string | null>(null);
  const editing = open && open !== 'new' ? (glasses.find((g) => g.id === open) ?? null) : null;
  const close = () => {
    setOpen(null);
    save.reset();
    remove.reset();
  };
  const failure = save.error || remove.error ? 'Couldn’t save that. Check your connection and try again.' : null;

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <WebHead>
        <title>Glassware</title>
      </WebHead>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ paddingTop: frame.top, paddingBottom: tabBarInset + space.xxxl, paddingHorizontal: gutter }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[frame.column, styles.readable]}>
          {/* On wide web the sidebar is the way around: the "Venue settings" crumb, no Back. */}
          <SubPageHead
            title="Glassware"
            crumbs={[{ label: 'Venue settings', href: `/settings/bar/${barId}` as Href }]}
            onBack={() => (router.canGoBack() ? router.back() : router.replace(`/settings/bar/${barId}` as Href))}
          />
          <Body tone="muted">
            The glasses {venue?.name ?? 'the venue'} pours into. Each type’s main glass is how its drinks are drawn, and a glass that names its maker’s page puts
            the venue on that page.
          </Body>
          {isLoading || pageLoading ? <Caption tone="muted">Loading…</Caption> : null}
          {error ? <Body tone="muted">Couldn’t load the glassware. Check your connection and try again.</Body> : null}
          {!pageLoading && !pageId ? (
            <Body tone="muted">Glassware sits on the venue’s public page, and this venue doesn’t have one yet. Find it on the map and claim it, then come back.</Body>
          ) : null}

          {pageId && !isLoading ? (
            <>
              {glasses.length ? (
                <Surface style={styles.list}>
                  <View role="list">
                    {glasses.map((g, i) => (
                      <GlassRow key={g.id} glass={g} first={i === 0} canEdit={canEdit} onOpen={() => setOpen(g.id)} />
                    ))}
                  </View>
                </Surface>
              ) : error ? null : (
                // A failed load already says so: an empty list here would be wrong.
                <Body tone="muted">No glasses listed yet.</Body>
              )}
              {canEdit && open ? (
                <Surface style={styles.card}>
                  <GlassForm
                    key={open}
                    glass={editing}
                    saving={save.isPending}
                    deleting={remove.isPending}
                    error={failure}
                    onSave={(row) => save.mutate(row, { onSuccess: close })}
                    onCancel={close}
                    onDelete={
                      editing
                        ? async () => {
                            if (await confirmAsync({ title: `Remove ${glassTitle(editing)}?`, message: 'It comes off the venue’s glassware and its maker’s page.', confirmText: 'Remove', destructive: true })) {
                              remove.mutate(editing.id, { onSuccess: close });
                            }
                          }
                        : undefined
                    }
                  />
                </Surface>
              ) : canEdit ? (
                <Button label="Add a glass" icon="plus" onPress={() => setOpen('new')} style={styles.start} />
              ) : (
                <Caption tone="muted">You can look, but changing the glassware needs an Admin at this venue.</Caption>
              )}
            </>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function GlassRow({ glass, first, canEdit, onOpen }: { glass: BarGlass; first: boolean; canEdit: boolean; onOpen: () => void }) {
  const ds = useDs();
  const title = glassTitle(glass);
  const maker = glass.maker_page?.display_name ?? glass.maker;
  const detail = [GLASS_TYPE_LABEL[glass.glass], maker ? `by ${maker}` : null, glass.series].filter(Boolean).join(' · ');
  const body = (
    <>
      <View style={styles.flex}>
        <Body numberOfLines={1}>{title}</Body>
        <Caption tone="muted" numberOfLines={2}>
          {detail}
        </Caption>
      </View>
      {glass.is_default ? <Tag label="Main" /> : null}
    </>
  );
  const style = [styles.row, first ? null : { borderTopColor: ds.c.line, borderTopWidth: StyleSheet.hairlineWidth }];
  if (!canEdit) {
    return (
      <View role="listitem" style={style}>
        {body}
      </View>
    );
  }
  return (
    <PressableScale role="button" accessibilityLabel={`Change ${title}. ${detail}`} onPress={onOpen} style={style}>
      {body}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  readable: { gap: space.lg },
  list: { paddingVertical: space.xs },
  card: { gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingVertical: space.sm },
  flex: { flex: 1, minWidth: 0 },
  start: { alignSelf: 'flex-start' },
});
