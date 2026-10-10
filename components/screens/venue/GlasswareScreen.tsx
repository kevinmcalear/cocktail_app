import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, Button, Caption, GlassButton, PressableScale, Surface, Tag, Title, useDs, useGutter } from '@/components/ds';
import { WebHead } from '@/components/WebHead';
import { layout, space } from '@/constants/tokens';
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
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
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
      <View style={[styles.nav, { paddingTop: insets.top + space.sm, paddingHorizontal: gutter }]}>
        <GlassButton
          accessibilityLabel={Platform.OS === 'web' ? 'Back' : 'Close'}
          icon={Platform.OS === 'web' ? 'chevron.left' : 'xmark'}
          onPress={() => (router.canGoBack() ? router.back() : router.replace(`/settings/bar/${barId}` as Href))}
        />
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space.xxxl, paddingHorizontal: gutter }} keyboardShouldPersistTaps="handled">
        <View style={styles.readable}>
          <Title>Glassware</Title>
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
              ) : (
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
  nav: { flexDirection: 'row', paddingBottom: space.sm, minHeight: layout.minTapTarget },
  readable: { maxWidth: 640, width: '100%', alignSelf: 'center', gap: space.lg, paddingTop: space.md },
  list: { paddingVertical: space.xs },
  card: { gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingVertical: space.sm },
  flex: { flex: 1, minWidth: 0 },
  start: { alignSelf: 'flex-start' },
});
