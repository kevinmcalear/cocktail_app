import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, Caption, DsText, GlassButton, Title, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { fontFamilies, layout, radius, space, type } from '@/constants/tokens';
import { useEffectiveRole } from '@/hooks/useViewAs';
import { withAlpha } from '@/lib/color';
import { DRINK_SECTIONS, lensCell } from '@/lib/roleLens';
import { ROLE_LEVELS } from '@/lib/roles';

import { Choice } from '../menus/MenuSheet';

const NAME_W = 220;
const CELL_W = 92;
const NAME_W_PHONE = 150;
const CELL_W_PHONE = 72;

/**
 * What each role opens on a venue drink (board drink-role-lens): a role
 * picker and every section by role, the first role to open each marked.
 * Default levels; a venue can move specs to another role and its own roles
 * can grant more, so the drink page itself always asks the server.
 */
export function RoleLensScreen({ itemId, barId }: { itemId: string; barId: string | null }) {
  return (
    <BackbarTheme>
      <Lens itemId={itemId} barId={barId} />
    </BackbarTheme>
  );
}

function Lens({ itemId, barId }: { itemId: string; barId: string | null }) {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const mine = useEffectiveRole(barId);
  const phone = useBreakpoint() === 'phone';
  const nameW = phone ? NAME_W_PHONE : NAME_W;
  const cellW = phone ? CELL_W_PHONE : CELL_W;
  // Your own view until you pick one (the drink, and so its venue, may still be loading).
  const [picked, setRole] = useState<number | null>(null);
  const role = picked ?? (ROLE_LEVELS.some((r) => r.level === mine) ? mine : 30);
  const back = () => (router.canGoBack() ? router.back() : router.replace(`/cocktail/${itemId}` as Href));

  return (
    <View style={[styles.flex, { backgroundColor: ds.c.ground }]}>
      <ScrollView contentContainerStyle={{ paddingTop: (Platform.OS === 'ios' ? space.sm : insets.top) + (phone ? layout.minTapTarget : 0) + space.xl, paddingBottom: insets.bottom + space.xxxl, paddingHorizontal: gutter, gap: space.lg }}>
        <View style={styles.page}>
          <Caption tone="muted" style={styles.eyebrow}>
            ONE DRINK, FIVE VIEWS
          </Caption>
          <Title>What each role opens on a venue drink</Title>
          <Body tone="muted">Locked sections stay on the page, collapsed, and say which role opens them. Default levels shown; a venue can move specs to another role. Pick a role to see its column.</Body>
          <View role="radiogroup" accessibilityLabel="View the drink as" style={styles.roles}>
            {ROLE_LEVELS.map((r) => (
              <Choice key={r.level} label={r.label} selected={r.level === role} onPress={() => setRole(r.level)} />
            ))}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.grow}>
            {/* The table spans the page; section names take what the role columns leave (board drink-role-lens). */}
            <View role="table" accessibilityLabel="Sections by role" style={styles.grow}>
              <View role="row" style={[styles.row, { borderBottomColor: ds.c.lineStrong }]}>
                <Caption tone="muted" role="columnheader" style={[styles.name, { minWidth: nameW }]}>
                  Section
                </Caption>
                {ROLE_LEVELS.map((r) => (
                  <View key={r.level} role="columnheader" style={[styles.cell, { width: cellW }]}>
                    <Caption color={r.level === role ? ds.accentText : ds.c.muted} style={r.level === role ? styles.on : undefined}>
                      {r.label === 'Drink Creator' ? 'Creator' : r.label}
                    </Caption>
                    <Caption tone="muted">{String(r.level)}</Caption>
                  </View>
                ))}
              </View>
              {DRINK_SECTIONS.map((sec) => (
                <View key={sec.name} role="row" style={[styles.row, { borderBottomColor: ds.c.line }]}>
                  <DsText variant="body" role="rowheader" style={[styles.name, styles.sectionName, { minWidth: nameW }]}>
                    {sec.name}
                  </DsText>
                  {ROLE_LEVELS.map((r) => {
                    const cell = lensCell(sec.opensAt, r.level);
                    const column = r.level === role;
                    return (
                      <View
                        key={r.level}
                        role="cell"
                        accessibilityLabel={`${sec.name}, ${r.label}: ${cell === 'lock' ? 'locked' : 'open'}`}
                        style={[styles.cell, { width: cellW }, styles.mark, cell !== 'lock' && { backgroundColor: column ? withAlpha(ds.accentText, 0.22) : ds.c.raised }]}
                      >
                        <Caption tone={cell === 'lock' ? 'muted' : 'ink'}>{cell === 'first' ? '● Open' : cell === 'open' ? 'Open' : 'Lock'}</Caption>
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>
          <Caption tone="muted">Open: shown in full. Lock: a collapsed row that says &quot;Opens at&quot; the first role with a dot. Batch needs the amounts, so it follows the spec.</Caption>
        </View>
      </ScrollView>
      {/* Wider screens go back through the sidebar; phones keep a back button. */}
      {phone ? (
        <View style={[styles.controls, { top: (Platform.OS === 'ios' ? space.sm : insets.top) + space.sm, left: gutter }]}>
          <GlassButton accessibilityLabel="Back" icon={Platform.OS === 'web' ? 'chevron.left' : 'xmark'} onPress={back} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { gap: space.lg, maxWidth: layout.page.text, width: '100%' },
  eyebrow: { fontFamily: fontFamilies.mono, letterSpacing: 1.2 },
  roles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, minHeight: layout.minTapTarget - space.xs },
  grow: { flexGrow: 1 },
  name: { flex: 1, paddingRight: space.md },
  sectionName: { fontSize: type.caption.fontSize + 2, lineHeight: type.caption.lineHeight + 2 },
  cell: { alignItems: 'center', marginLeft: 2 },
  mark: { marginVertical: space.xs, paddingVertical: space.xs, borderRadius: radius.mark },
  on: { fontFamily: fontFamilies.bodySemiBold },
  controls: { position: 'absolute' },
});
