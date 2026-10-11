import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, DrinkImage, LockedSection, PressableScale, Tag } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useSetLineService, useSetServiceStyle } from '@/hooks/useServiceSpec';
import { useEffectiveRole } from '@/hooks/useViewAs';
import { pictureTag, type ItemImageLink } from '@/lib/itemImages';
import { roleLabel } from '@/lib/roles';
import { isServiceStyle } from '@/lib/service';
import { SERVICE_OPENS_AT, serviceShots, shotCaption, type ServiceShot } from '@/lib/servicePhotos';
import type { SpecLine } from '@/lib/spec';

import { PhotoViewer, type ViewedPhoto } from './PhotoViewer';
import { ServiceSpec } from './ServiceSpec';

interface ServiceSectionProps {
  itemId: string;
  barId: string | null;
  name: string;
  links: ItemImageLink[] | null | undefined;
  /** The viewer can edit this drink (useCanEditItem). */
  canEdit: boolean;
  /** Glassware icon, drawn when a photo has no subject. */
  glass: string | null;
  wide: boolean;
  /** The spec as this role sees it, for what's batched and what's added at the station. */
  lines: SpecLine[];
  /** This role sees amounts (and so the batch split). */
  showLines: boolean;
  serviceStyle: string | null | undefined;
  /** /dev/drink only: a simulated role. */
  preview?: { role: number };
}

/**
 * How the drink goes out: what's poured from the batch and what's added at
 * the station, then any service photos that exist (side, top, garnish,
 * hand-off). Empty angles stay off this page; adding them is edit mode.
 * Venue drinks open the section at Employee; guests see it locked.
 */
export function ServiceSection({ itemId, barId, name, links, canEdit, glass, wide, lines, showLines, serviceStyle, preview }: ServiceSectionProps) {
  const realRole = useEffectiveRole(barId);
  const setLine = useSetLineService(itemId);
  const setStyle = useSetServiceStyle(itemId);
  const [open, setOpen] = useState<ServiceShot | null>(null);
  const shots = serviceShots(links).filter((shot) => shot.status === 'photo' || shot.status === 'outdated');
  const canSetSpec = !preview && canEdit && lines.length > 0;
  if (!canSetSpec && !lines.length && !shots.length) return null;
  const unlocked = !barId || (preview?.role ?? realRole) >= SERVICE_OPENS_AT;

  return (
    <LockedSection title="Service" unlocked={unlocked} opensAt={roleLabel(SERVICE_OPENS_AT)}>
      {lines.length ? (
        <ServiceSpec
          lines={lines}
          style={isServiceStyle(serviceStyle) ? serviceStyle : null}
          showLines={showLines}
          canEdit={canSetSpec}
          onSetLine={(key, atService) => setLine.mutate({ key, atService })}
          onSetStyle={(style) => setStyle.mutate(style)}
        />
      ) : null}
      {setLine.error || setStyle.error ? <Caption tone="accent">{"Couldn't save. Check your connection and try again."}</Caption> : null}
      {shots.length ? (
        <>
          <Body tone="muted">How it should look when it goes out.</Body>
          <View style={styles.grid}>
            {shots.map((shot) => (
              <ShotTile key={shot.angle} shot={shot} name={name} glass={glass} basis={wide ? '22%' : '40%'} onOpen={() => setOpen(shot)} />
            ))}
          </View>
        </>
      ) : null}
      <PhotoViewer photo={open?.picture ? viewed(open) : null} name={name} onClose={() => setOpen(null)} />
    </LockedSection>
  );
}

/** A service photo as the viewer shows it: its angle, tagged when it's out of date. */
function viewed(shot: ServiceShot): ViewedPhoto {
  const tag = pictureTag(shot.picture);
  return { url: shot.picture!.url, title: shot.label, tag: tag ? { label: tag, tone: 'warning' } : null };
}

function ShotTile({ shot, name, glass, basis, onOpen }: { shot: ServiceShot; name: string; glass: string | null; basis: `${number}%`; onOpen: () => void }) {
  const tag = pictureTag(shot.picture);
  if (!shot.picture) return null;
  return (
    <PressableScale
      role="button"
      accessibilityLabel={`${name}, ${shotCaption(shot)}. Open full screen`}
      onPress={onOpen}
      style={[styles.tile, { flexBasis: basis }]}
    >
      <DrinkImage source={shot.picture.url} generated={shot.picture.isSketch} glass={glass} accessibilityLabel={`${name}, ${shot.label}`} aspectRatio={1} radius="control" />
      <View style={styles.caption}>
        <Caption>{shot.label}</Caption>
        {tag ? <Tag label={tag} tone="warning" /> : null}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: { flexGrow: 1, gap: space.xs },
  caption: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xs },
});
