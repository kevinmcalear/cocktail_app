import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, DrinkImage, LockedSection, PressableScale, Tag, TextLink, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import { useServiceNotes } from '@/hooks/useServiceNotes';
import { useEffectiveRole } from '@/hooks/useViewAs';
import { pictureTag, type ItemImageLink } from '@/lib/itemImages';
import { roleLabel } from '@/lib/roles';
import { isBatchedStyle, isServiceStyle } from '@/lib/service';
import { EMPTY_SERVICE_NOTES } from '@/lib/serviceNotes';
import { SERVICE_OPENS_AT, serviceShots, shotCaption, type ServiceShot } from '@/lib/servicePhotos';
import type { SpecLine } from '@/lib/spec';

import { ServiceSpec } from './ServiceSpec';

interface ServiceSectionProps {
  itemId: string;
  barId: string | null;
  name: string;
  links: ItemImageLink[] | null | undefined;
  /** Glassware icon, drawn when a photo has no subject. */
  glass: string | null;
  /** The spec as this role sees it, for what's batched and what's added at the station. */
  lines: SpecLine[];
  /** This role sees amounts (and so the batch split). */
  showLines: boolean;
  /** Who opens the amounts, for the split's lock line. */
  splitOpensAt: string;
  serviceStyle: string | null | undefined;
  /** /dev/drink only: a simulated role. */
  preview?: { role: number };
}

/**
 * How the drink goes out (boards drink-phone-venue and -floor): how the
 * garnish goes on and the hand-off, what's poured from the batch and what's
 * added at the station, then every service angle (a sketch until someone
 * photographs it) and the way into the full-screen service view. Venue drinks
 * open the section at Employee; the split opens with the amounts. Read only:
 * how it goes out, the split and the notes are set in the editor's Service.
 */
export function ServiceSection({ itemId, barId, name, links, glass, lines, showLines, splitOpensAt, serviceStyle, preview }: ServiceSectionProps) {
  const ds = useDs();
  const router = useRouter();
  const realRole = useEffectiveRole(barId);
  const unlocked = !barId || (preview?.role ?? realRole) >= SERVICE_OPENS_AT;
  const { data: notes = EMPTY_SERVICE_NOTES } = useServiceNotes(itemId, barId, unlocked && !preview);
  const shots = serviceShots(links);
  const open = (angle?: string) => router.push({ pathname: '/cocktail/[id]/service', params: { id: itemId, ...(angle ? { angle } : {}) } } as unknown as Href);

  return (
    <LockedSection title="Service" unlocked={unlocked} opensAt={roleLabel(SERVICE_OPENS_AT)}>
      {notes.garnish ? (
        <View style={styles.group}>
          <Caption tone="muted" style={styles.eyebrow}>
            GARNISH
          </Caption>
          <Body>{notes.garnish}</Body>
        </View>
      ) : null}
      {notes.handoff.length ? (
        <View style={styles.group}>
          <Caption tone="muted" style={styles.eyebrow}>
            GUEST VIEW
          </Caption>
          <View role="list">
            {notes.handoff.map((step, i) => (
              <View key={`${i}-${step}`} role="listitem" style={styles.step}>
                <View style={[styles.dot, { backgroundColor: ds.accentText }]} aria-hidden />
                <Body style={styles.flex}>{step}</Body>
              </View>
            ))}
          </View>
        </View>
      ) : null}
      {lines.length ? (
        <ServiceSpec
          lines={lines}
          style={isServiceStyle(serviceStyle) ? serviceStyle : null}
          showLines={showLines}
          canEdit={false}
        />
      ) : null}
      <Body tone="muted">How it should look when it goes out.</Body>
      <View style={styles.grid}>
        {shots.map((shot) => (
          <ShotTile key={shot.angle} shot={shot} itemId={itemId} name={name} glass={glass} basis="22%" onOpen={() => open(shot.angle)} />
        ))}
      </View>
      {!showLines && lines.length && isBatchedStyle(serviceStyle) ? (
        <View style={styles.lock}>
          <IconSymbol name="lock.fill" size={13} color={ds.c.muted} />
          <Caption tone="muted">The batch and station split opens at {splitOpensAt}</Caption>
        </View>
      ) : null}
      {preview ? null : <TextLink label="Open the service view" onPress={() => open()} />}
    </LockedSection>
  );
}

/** One angle: its photo, or the drink's sketch until there is one. Opens the service view at that angle. */
function ShotTile({ shot, itemId, name, glass, basis, onOpen }: { shot: ServiceShot; itemId: string; name: string; glass: string | null; basis: `${number}%`; onOpen: () => void }) {
  const tag = pictureTag(shot.picture);
  return (
    <PressableScale role="link" accessibilityLabel={`${name}, ${shotCaption(shot)}. Open the service view`} onPress={onOpen} style={[styles.tile, { flexBasis: basis }]}>
      <DrinkImage
        source={shot.picture?.url ?? null}
        generated={shot.picture?.isSketch}
        glass={glass}
        itemId={shot.picture ? undefined : itemId}
        accessibilityLabel={`${name}, ${shot.label}`}
        aspectRatio={1}
        radius="control"
      />
      <View style={styles.caption}>
        <Caption>{shot.label}</Caption>
        {tag ? <Tag label={tag} tone="warning" /> : null}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.xs },
  eyebrow: { letterSpacing: 1.2 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingVertical: space.xs },
  dot: { width: 6, height: 6, borderRadius: radius.pill, marginTop: 9 },
  flex: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: { flexGrow: 1, gap: space.xs },
  caption: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xs },
  lock: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
});
