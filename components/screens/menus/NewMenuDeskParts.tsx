import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { BackbarTheme, BrandProvider, Caption, DsText, PressableScale, useDs, type IconName } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { displayFaces, fontFamilies, radius, space } from '@/constants/tokens';
import type { Venue } from '@/hooks/useActiveVenue';
import type { MenuLayoutTemplate } from '@/hooks/useMenuMutations';
import { STATUS } from '@/constants/palette';
import { readableAccent, withAlpha } from '@/lib/color';
import { menuStatus, plural, previewSections } from '@/lib/menus';
import type { MenuPhoto } from '@/lib/readMenu';
import type { MenuSectionDetail, MenuSummary } from '@/types/menus';

import { GuestCardContent } from './MenuCardScreen';
import { MenuVisual } from './MenuVisual';
import type { Start } from './useNewMenu';

export type DeskStart = 'saved' | 'photo' | 'paste' | 'blank';

const TILES: { kind: DeskStart; label: string; detail: string; icon: IconName }[] = [
  { kind: 'saved', label: 'A menu you saved', detail: '', icon: 'doc.on.doc' },
  { kind: 'photo', label: 'A photo', detail: 'Drop a printed menu here', icon: 'camera' },
  { kind: 'paste', label: 'A list', detail: 'Paste drink names', icon: 'list.bullet' },
  { kind: 'blank', label: 'Blank', detail: 'One section to fill', icon: 'plus' },
];

/** Start from, two across; the picked one ringed and tinted in the accent. Blank is last (nm-decided). */
export function DeskStartTiles({ picked, saved, onPick }: { picked: DeskStart; saved: string | null; onPick: (kind: DeskStart) => void }) {
  const ds = useDs();
  return (
    <View role="radiogroup" accessibilityLabel="Start from" style={styles.tiles}>
      {TILES.filter((t) => t.kind !== 'saved' || saved).map((t) => {
        const on = picked === t.kind;
        const detail = t.kind === 'saved' ? saved! : t.detail;
        return (
          <PressableScale
            key={t.kind}
            role="radio"
            aria-checked={on}
            accessibilityLabel={`${t.label}. ${detail}`}
            onPress={() => onPick(t.kind)}
            style={[styles.tile, { borderColor: on ? ds.accentText : ds.c.line, backgroundColor: on ? withAlpha(ds.accentFill.fill, 0.08) : ds.c.surface }]}
          >
            <View style={[styles.icon, { backgroundColor: ds.c.raised }]} aria-hidden>
              <IconSymbol name={t.icon} size={16} color={ds.c.ink} />
            </View>
            <View style={styles.flex}>
              <DsText variant="caption" style={{ fontFamily: fontFamilies.bodySemiBold }}>
                {t.label}
              </DsText>
              <Caption tone="muted" numberOfLines={2}>
                {detail}
              </Caption>
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}

/** A menu you saved, as small guest cards four across (and on, a row at a time): its drinks, its name, how many or On now; then saved layouts. */
export function SavedCards({ menus, layouts, start, now, onPick }: { menus: MenuSummary[]; layouts: MenuLayoutTemplate[]; start: Start; now: number; onPick: (start: Start) => void }) {
  const ds = useDs();
  const items = [
    ...menus.map((m) => ({ key: m.id, name: m.name, start: { kind: 'copy', menuId: m.id } as Start, menu: m, line: menuStatus(m, now) === 'on' ? 'On now' : plural(m.itemIds.length, 'drink') })),
    ...layouts.map((l) => ({ key: l.id, name: l.name, start: { kind: 'layout', layoutId: l.id } as Start, menu: null, line: 'Layout' })),
  ];
  const picked = start.kind === 'copy' ? start.menuId : start.kind === 'layout' ? start.layoutId : null;
  return (
    <View role="radiogroup" accessibilityLabel="Which menu" style={styles.saved}>
      {items.map((it) => (
        <PressableScale key={it.key} role="radio" aria-checked={picked === it.key} accessibilityLabel={`${it.name}. ${it.line}`} onPress={() => onPick(it.start)} style={[styles.savedCard, { borderColor: picked === it.key ? ds.accentText : ds.c.line, backgroundColor: ds.c.surface }]}>
          <View style={[styles.savedPic, { backgroundColor: ds.c.paper }]} aria-hidden>
            {it.menu ? <MenuVisual name={it.name} coverUrl={it.menu.coverUrl} coverPosition={it.menu.coverPosition} pictures={it.menu.pictures.slice(0, 2)} height={52} /> : <Rules />}
          </View>
          <View style={styles.savedText}>
            <DsText variant="body" numberOfLines={2} style={{ fontFamily: displayFaces[ds.displayFace].regular }}>
              {it.name}
            </DsText>
            <Caption color={it.line === 'On now' ? readableAccent(STATUS.success, ds.c.surface) : ds.c.muted} numberOfLines={1}>
              {it.line}
            </Caption>
          </View>
        </PressableScale>
      ))}
    </View>
  );
}

function Rules() {
  const ds = useDs();
  return (
    <View style={styles.rules}>
      {[40, 32, 40].map((w, i) => (
        <View key={i} style={{ width: w, height: 1.5, backgroundColor: withAlpha(ds.c.sketchInk, 0.45) }} />
      ))}
    </View>
  );
}

interface DeskPreviewProps {
  name: string;
  when: string | null;
  venue: Venue | null;
  /** Null: nothing to show yet, the empty card. */
  sections: Pick<MenuSectionDetail, 'id' | 'name' | 'drinks'>[] | null;
  newIds?: ReadonlySet<string>;
  photos: MenuPhoto[] | null;
}

// As many drinks as the square card holds at preview size, two across.
const FITS = 6;

/**
 * The right of New menu on a wide screen: the real guest card, flat and
 * square on paper (nm-decided), filling in as you go; or the printed menu's
 * first page when it starts from a photo.
 */
export function DeskPreview({ name, when, venue, sections, newIds, photos }: DeskPreviewProps) {
  const ds = useDs();
  const cut = sections ? previewSections(sections, FITS) : null;
  const foot = [cut?.more ? `+ ${cut.more} more` : null, venue?.name].filter(Boolean).join(' · ');
  return (
    <BackbarTheme scheme="light">
      <BrandProvider accent={venue?.accent ?? undefined} displayFace={venue?.displayFace}>
        <View style={[styles.paper, { backgroundColor: ds.c.paper }]}>
          {photos ? (
            photos.length ? (
              <Image source={{ uri: photos[0].uri }} contentFit="contain" style={styles.page} accessible accessibilityLabel="Page 1 of the menu" />
            ) : (
              <View style={styles.empty}>
                <IconSymbol name="camera" size={28} color={ds.c.sketchInk} />
                <Caption color={ds.c.sketchInk}>Drop a printed menu here</Caption>
              </View>
            )
          ) : cut?.sections.length ? (
            <View style={styles.card}>
              <GuestCardContent name={name || 'Your menu'} when={when} venue={venue} sections={cut.sections} pictures="above" newIds={newIds} compact />
            </View>
          ) : (
            <EmptyCard name={name} when={when} />
          )}
          {photos || !foot ? null : (
            <Caption tone="muted" style={styles.foot}>
              {foot.toUpperCase()}
            </Caption>
          )}
        </View>
      </BrandProvider>
    </BackbarTheme>
  );
}

/** Nothing on it yet: the name (faint until there is one), a rule, four empty frames. */
function EmptyCard({ name, when }: { name: string; when: string | null }) {
  const ds = useDs();
  return (
    <View style={styles.card} aria-hidden>
      {when ? <Caption tone="muted" style={styles.eyebrow}>{when.toUpperCase()}</Caption> : null}
      <DsText variant="title" align="center" color={name ? ds.c.ink : withAlpha(ds.c.ink, 0.3)} style={{ fontFamily: displayFaces[ds.displayFace].regular }}>
        {name || 'Your menu'}
      </DsText>
      <View style={[styles.rule, { backgroundColor: ds.c.lineStrong }]} />
      <View style={styles.frames}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={styles.frameCell}>
            <View style={[styles.frame, { borderColor: withAlpha(ds.c.sketchInk, 0.3) }]} />
            <View style={[styles.frameLine, { backgroundColor: withAlpha(ds.c.sketchInk, 0.22) }]} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: { flexBasis: '48%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm + 2, minHeight: 64, padding: space.md, borderRadius: radius.control + 2, borderWidth: 1, borderCurve: 'continuous' },
  icon: { width: 32, height: 32, borderRadius: radius.control - 4, alignItems: 'center', justifyContent: 'center' },
  saved: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  savedCard: { flexBasis: '23%', flexGrow: 0, minWidth: 0, borderRadius: radius.control + 2, borderWidth: 1, overflow: 'hidden', borderCurve: 'continuous' },
  savedPic: { height: 52, justifyContent: 'center' },
  savedText: { padding: space.sm, gap: 2 },
  rules: { alignItems: 'center', gap: space.xs + 1 },
  // Square, as big as the column's height allows.
  paper: { flex: 1, maxWidth: '100%', aspectRatio: 1, borderRadius: radius.card, overflow: 'hidden', alignItems: 'center', paddingVertical: space.xl, paddingHorizontal: space.lg, borderCurve: 'continuous' },
  card: { flex: 1, width: '100%', alignItems: 'center', overflow: 'hidden', gap: space.sm },
  page: { flex: 1, width: '100%' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm },
  foot: { fontFamily: fontFamilies.mono, letterSpacing: 1.5, paddingTop: space.md },
  eyebrow: { fontFamily: fontFamilies.mono, letterSpacing: 1.5 },
  rule: { width: 48, height: 1, marginVertical: space.sm },
  frames: { flexDirection: 'row', flexWrap: 'wrap', width: '80%', justifyContent: 'space-around', rowGap: space.xl, paddingTop: space.lg },
  frameCell: { width: '40%', alignItems: 'center', gap: space.sm },
  frame: { width: 64, height: 76, borderRadius: radius.control, borderWidth: 1.5, borderStyle: 'dashed' },
  frameLine: { width: 96, height: 1.5 },
});
