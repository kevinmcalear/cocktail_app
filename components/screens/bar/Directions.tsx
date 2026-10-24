import { useState } from 'react';
import { Linking, Platform, Pressable, Share, StyleSheet, Switch, View } from 'react-native';

import { Body, Button, Caption, DsText, GlassButton, Sheet, Title, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, space } from '@/constants/tokens';
import { appUrl, geoListingUrl, geoUrl, googleMapsUrl, listingUrl, type Destination, type MapsApp } from '@/lib/directions';
import { useSettingsStore } from '@/store/useSettingsStore';

export interface DirectionsTarget extends Destination {
  /** "42 Gertrude St, Fitzroy", for the sheet and Copy address. */
  address: string | null;
  /** "400 m · about 5 min on foot", when the person's position is known. */
  away: string | null;
}

const APPS: { id: MapsApp; label: string; note: string; icon: 'map.fill' | 'globe' | 'arrow.triangle.turn.up.right.diamond' }[] = [
  { id: 'apple', label: 'Apple Maps', note: 'This iPhone’s maps', icon: 'map.fill' },
  { id: 'google', label: 'Google Maps', note: 'Opens the app, or the website if it isn’t installed', icon: 'globe' },
  { id: 'waze', label: 'Waze', note: 'Only shows when it’s installed', icon: 'arrow.triangle.turn.up.right.diamond' },
];

/** directions: a route to the bar. listing: the bar's own page in the maps app (Discover's map card). */
type Kind = 'directions' | 'listing';

async function openApp(app: MapsApp, d: DirectionsTarget, kind: Kind) {
  try {
    // Waze has no listings: it routes either way.
    await Linking.openURL(kind === 'listing' && app !== 'waze' ? listingUrl(app, d) : appUrl(app, d));
  } catch {
    // Google Maps or Waze isn't installed: the web map instead.
    await Linking.openURL(kind === 'listing' ? listingUrl('google', d) : googleMapsUrl(d));
  }
}

async function copy(text: string) {
  try {
    // ponytail: loaded on tap, so a build without the clipboard module (an older binary on an OTA update) falls back to the share sheet, which has Copy.
    const Clipboard = await import('expo-clipboard');
    await Clipboard.setStringAsync(text);
  } catch {
    await Share.share({ message: text });
  }
}

/**
 * Directions to a bar, or (`listing`) its listing in a maps app: on iPhone
 * the sheet of maps apps (disc-directions-sheet), or straight to the
 * remembered app; on Android a geo: link for the person's maps app; on the
 * web Google Maps in a new tab. `open` starts it; render `sheet` somewhere
 * on the screen.
 */
export function useDirections(target: DirectionsTarget | null, kind: Kind = 'directions') {
  const [shown, setShown] = useState(false);
  const remembered = useSettingsStore((s) => s.directionsApp);
  const open = () => {
    if (!target) return;
    const web = kind === 'listing' ? listingUrl('google', target) : googleMapsUrl(target);
    if (Platform.OS === 'web') void Linking.openURL(web);
    else if (Platform.OS === 'android') void Linking.openURL(kind === 'listing' ? geoListingUrl(target) : geoUrl(target)).catch(() => Linking.openURL(web));
    else if (remembered) void openApp(remembered, target, kind);
    else setShown(true);
  };
  const sheet = target && Platform.OS === 'ios' ? <DirectionsSheet visible={shown} target={target} kind={kind} onClose={() => setShown(false)} /> : null;
  return { open, sheet };
}

/**
 * The map card's round maps button, beside the heart: the bar's listing in
 * Apple or Google Maps, where its photos, reviews and Directions are.
 */
export function MapsButton({ target }: { target: DirectionsTarget | null }) {
  const { open, sheet } = useDirections(target, 'listing');
  if (!target) return null;
  return (
    <>
      <GlassButton
        icon="mappin.and.ellipse"
        accessibilityLabel={`${target.name} in ${Platform.OS === 'ios' ? 'Maps' : 'Google Maps'}${target.away ? `, ${target.away}` : ''}`}
        onPress={open}
      />
      {sheet}
    </>
  );
}

/** The Directions pill: "Directions to Little Rye, opens your maps app". */
export function DirectionsButton({ target, variant = 'secondary', size }: { target: DirectionsTarget | null; variant?: 'secondary' | 'ghost'; size?: 'sm' }) {
  const { open, sheet } = useDirections(target);
  if (!target) return null;
  return (
    <>
      <Button
        label="Directions"
        icon="arrow.triangle.turn.up.right.diamond"
        variant={variant}
        size={size}
        onPress={open}
        accessibilityLabel={`Directions to ${target.name}, ${Platform.OS === 'web' ? 'opens Google Maps in a new tab' : 'opens your maps app'}`}
      />
      {sheet}
    </>
  );
}

function DirectionsSheet({ visible, target, kind, onClose }: { visible: boolean; target: DirectionsTarget; kind: Kind; onClose: () => void }) {
  const ds = useDs();
  const setRemembered = useSettingsStore((s) => s.setDirectionsApp);
  const [remember, setRemember] = useState(false);
  // Waze shows only when it's installed (app.config.ts lists its scheme for this check).
  const [waze, setWaze] = useState(false);
  const onShow = () => void Linking.canOpenURL('waze://').then(setWaze, () => setWaze(false));
  const pick = (app: MapsApp) => {
    if (remember) setRemembered(app);
    onClose();
    void openApp(app, target, kind);
  };
  const title = kind === 'listing' ? `Open ${target.name} in` : `Directions to ${target.name}`;
  const header = (
    <View style={styles.head}>
      <View style={styles.flex}>
        <Title role="heading">{title}</Title>
        {target.address || target.away ? <Caption tone="muted">{[target.address, target.away].filter(Boolean).join(' · ')}</Caption> : null}
      </View>
      <GlassButton icon="xmark" accessibilityLabel="Close" onPress={onClose} />
    </View>
  );
  const row = (key: string, icon: (typeof APPS)[number]['icon'] | 'doc.on.doc', label: string, note: string, onPress: () => void) => (
    <Pressable key={key} role="button" accessibilityLabel={label} onPress={onPress} style={[styles.row, { borderTopColor: ds.c.line }]}>
      <IconSymbol name={icon} size={22} color={ds.c.ink} />
      <View style={styles.flex}>
        <Body>{label}</Body>
        <Caption tone="muted">{note}</Caption>
      </View>
    </Pressable>
  );
  return (
    <Sheet visible={visible} onClose={onClose} accessibilityLabel={title} header={header} style={styles.panel} onShow={onShow}>
      <View role="list" aria-label="Open in">
        {APPS.filter((a) => a.id !== 'waze' || (waze && kind === 'directions')).map((a) => row(a.id, a.icon, a.label, a.note, () => pick(a.id)))}
        {target.address ? row('copy', 'doc.on.doc', 'Copy address', target.address, () => void copy(target.address!).then(onClose)) : null}
      </View>
      <View style={styles.remember}>
        <View style={styles.flex}>
          <DsText variant="body">Remember my choice</DsText>
          <Caption tone="muted">Maps then open straight there. Change it in Settings, Preferences.</Caption>
        </View>
        <Switch value={remember} onValueChange={setRemember} accessibilityLabel="Remember my choice" />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  panel: { maxWidth: 480, padding: space.xl, paddingTop: space.sm },
  flex: { flex: 1, minWidth: 0 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingBottom: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget + space.md, borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: space.sm },
  remember: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingTop: space.lg },
});
