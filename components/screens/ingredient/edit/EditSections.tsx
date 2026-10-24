import { usePreventRemove, useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';

import { useWhereItLives } from '@/components/backbar/WhereItLives';
import { Body, Caption, FieldButton, Headline, PressableScale, Sheet, Switch, useDs } from '@/components/ds';
import { PublishSection } from '@/components/screens/publishing/PublishSection';
import { RowDivider, SettingsRow } from '@/components/screens/settings/SettingsParts';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { displayFaces, fontFamilies, layout, radius, space, type } from '@/constants/tokens';
import { useUserId } from '@/ctx/AuthContext';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useItemPublishing } from '@/hooks/usePublishing';
import { confirmDiscardChanges } from '@/lib/dialogs';
import { PUBLISH_COPY } from '@/lib/publishing';
import { capitalizeFirst } from '@/lib/stringUtils';

const NO_OUTLINE = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null;

/**
 * Ask before leaving with unsaved changes, by Back or a swipe (on the web,
 * closing the tab too). Returns what lets the page go once it's saved.
 */
export function useLeaveGuard(dirty: boolean) {
  // repeat() lifts the guard itself before it goes on.
  return usePreventRemove(dirty, ({ repeat }) => void confirmDiscardChanges(true).then((ok) => ok && repeat()));
}

/** The name, in the venue's face over a rule, as the drink editor sets it. */
export function NameField({ value, onChange }: { value: string; onChange: (name: string) => void }) {
  const ds = useDs();
  return (
    <View style={styles.nameBox}>
      <Caption tone="muted">Name</Caption>
      <TextInput
        value={value}
        onChangeText={onChange}
        onBlur={() => onChange(capitalizeFirst(value))}
        placeholder="e.g. Rich Simple Syrup"
        placeholderTextColor={ds.c.muted}
        aria-label="Name"
        style={[styles.name, NO_OUTLINE, { color: ds.c.ink, borderBottomColor: ds.c.lineStrong, fontFamily: displayFaces[ds.displayFace].regular }]}
      />
    </View>
  );
}

/** What it's a kind of ("Tanqueray" is a kind of Gin): opens the search; x clears it. */
export function KindOf({ name, onPick, onClear }: { name: string | null; onPick: () => void; onClear: () => void }) {
  const ds = useDs();
  return (
    <View style={styles.kind}>
      <Caption tone="muted">Kind of</Caption>
      <View>
        <PressableScale role="button" accessibilityLabel={name ? `Kind of ${name}. Change it` : 'Choose what it’s a kind of'} onPress={onPick} style={[styles.kindBox, { backgroundColor: ds.c.raised, borderColor: ds.c.line }]}>
          <Body tone={name ? undefined : 'muted'} numberOfLines={1}>
            {name ?? 'e.g. Gin, Sweet Vermouth'}
          </Body>
        </PressableScale>
        {name ? (
          <View style={styles.clear}>
            <FieldButton icon="xmark.circle.fill" label="Clear what it’s a kind of" onPress={onClear} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** Opens the back bar to place it. Where it lives' rows and the Spot tool both go here. */
export function useGiveItASpot(itemId: string, name: string) {
  const router = useRouter();
  return () => router.push({ pathname: '/back-bar', params: { place: itemId, name } } as never);
}

/**
 * Where it lives, in Edit (the read view only shows it): each spot at the
 * active venue as a row that opens the back bar on it, and Give it a spot or
 * Add another spot. Shown to whoever can place things there.
 */
export function WhereEdit({ itemId, name }: { itemId: string; name: string }) {
  const ds = useDs();
  const where = useWhereItLives(itemId);
  const canPlace = !!where.capabilities?.some((c) => c === 'edit_drinks' || c === 'prep');
  const place = useGiveItASpot(itemId, name);
  if (!where.shown || !where.canRead || !canPlace) return null;
  return (
    <View style={styles.section}>
      <Headline role="heading">Where it lives</Headline>
      <View>
        {where.lines.map((line, i) => (
          <View key={`${line}-${i}`}>
            {i > 0 ? <RowDivider /> : null}
            <SettingsRow label="Where it lives" value={line} onPress={place} />
          </View>
        ))}
      </View>
      <PressableScale role="button" accessibilityLabel={where.lines.length ? 'Add another spot' : 'Give it a spot'} onPress={place} style={[styles.add, { borderColor: ds.c.lineStrong }]}>
        <IconSymbol name="plus" size={18} color={ds.accentText} />
        <Body style={styles.medium}>{where.lines.length ? 'Add another spot' : 'Give it a spot'}</Body>
      </PressableScale>
      <Caption tone="muted">{`Staff find it here in Back bar${where.active ? ` at ${where.active.name}` : ''}.`}</Caption>
    </View>
  );
}

/**
 * Who sees it: who can see it (opens the publishing choices, which save as
 * they're picked, as on the drink editor) and Hide in search, saved with Done.
 */
export function WhoSees({ itemId, barId, hide, onHide }: { itemId: string; barId: string | null; hide: boolean; onHide: (hide: boolean) => void }) {
  const userId = useUserId();
  const { data: caps = [] } = useCapabilities(barId);
  const { data: publishing } = useItemPublishing(itemId, barId);
  const [open, setOpen] = useState(false);
  const canChange = !!publishing && (barId ? caps.includes('publish') : !!userId && publishing.createdBy === userId);
  const value = !publishing ? null : !canChange && !barId ? 'Everyone' : PUBLISH_COPY[publishing.mode].label;
  return (
    <View style={styles.section}>
      <Headline role="heading">Who sees it</Headline>
      {value ? canChange ? <SettingsRow label="Who can see it" value={value} onPress={() => setOpen(true)} /> : <SettingsRow label="Who can see it" value={value} trailing={<View />} disabled onPress={() => undefined} /> : null}
      <View style={styles.switchRow}>
        <View style={styles.flex}>
          <Body>Hide in search</Body>
          <Caption tone="muted">Keep it out of ⌘K. It can still go in recipes.</Caption>
        </View>
        <Switch value={hide} onValueChange={onHide} label="Hide in search" />
      </View>
      {open ? (
        <Sheet visible onClose={() => setOpen(false)} accessibilityLabel="Who can see it" style={styles.sheet} header={<Headline role="heading">Who can see it</Headline>}>
          <PublishSection itemId={itemId} barId={barId} noun="ingredient" mode="edit" />
        </Sheet>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  nameBox: { gap: space.xs },
  name: { ...type.display, borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: space.xs },
  kind: { gap: space.xs },
  kindBox: { minHeight: layout.minTapTarget, borderRadius: radius.control, borderWidth: 1, paddingHorizontal: space.md, paddingRight: layout.minTapTarget, justifyContent: 'center' },
  clear: { position: 'absolute', top: 0, bottom: 0, right: 0, justifyContent: 'center' },
  add: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 52, paddingHorizontal: space.md, borderRadius: radius.control, borderWidth: 1.5, borderStyle: 'dashed' },
  medium: { fontFamily: fontFamilies.bodyMedium },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingTop: space.xs },
  flex: { flex: 1, gap: 2 },
  sheet: { paddingHorizontal: space.xl, paddingBottom: space.xxl },
});
