import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, DrinkImage, LockedSection, PressableScale, Tag, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useSetLineService, useSetServiceStyle } from '@/hooks/useServiceSpec';
import { useEffectiveRole } from '@/hooks/useViewAs';
import { pictureTag, type ItemImageLink } from '@/lib/itemImages';
import { roleLabel } from '@/lib/roles';
import { isServiceStyle } from '@/lib/service';
import { SERVICE_OPENS_AT, serviceShots, shotCaption, shotList, type ServiceShot } from '@/lib/servicePhotos';
import type { SpecLine } from '@/lib/spec';

import { PhotoViewer } from './PhotoViewer';
import { ServiceSpec } from './ServiceSpec';
import { ShotList } from './ShotList';

interface ServiceSectionProps {
  itemId: string;
  barId: string | null;
  name: string;
  links: ItemImageLink[] | null | undefined;
  /** The viewer can edit this drink (useCanEditItem). */
  canEdit: boolean;
  /** Glassware icon for empty tiles. */
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
 * the station, then the side, top, garnish and hand-off photos. Editors set
 * the service spec here and, with the photos capability, get a shot list of
 * the angles still to photograph. Venue drinks open it at Employee; guests
 * see it locked.
 */
export function ServiceSection({ itemId, barId, name, links, canEdit, glass, wide, lines, showLines, serviceStyle, preview }: ServiceSectionProps) {
  const realRole = useEffectiveRole(barId);
  const { data: capabilities } = useCapabilities(preview ? null : barId);
  const setLine = useSetLineService(itemId);
  const setStyle = useSetServiceStyle(itemId);
  const [open, setOpen] = useState<ServiceShot | null>(null);
  const shots = serviceShots(links);
  const canAdd = !preview && canEdit && (!barId || !!capabilities?.includes('photos'));
  const canSetSpec = !preview && canEdit && lines.length > 0;
  // Nothing to show and nothing this person can add: leave the page alone.
  if (!canAdd && !canSetSpec && !lines.length && !shots.some((shot) => shot.picture)) return null;
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
      <Body tone="muted">How it should look when it goes out.</Body>
      <View style={styles.grid}>
        {shots.map((shot) => (
          <ShotTile key={shot.angle} shot={shot} name={name} glass={glass} basis={wide ? '22%' : '40%'} onOpen={() => setOpen(shot)} />
        ))}
      </View>
      {canAdd ? <ShotList itemId={itemId} shots={shotList(shots)} /> : null}
      <PhotoViewer shot={open} name={name} onClose={() => setOpen(null)} />
    </LockedSection>
  );
}

function ShotTile({ shot, name, glass, basis, onOpen }: { shot: ServiceShot; name: string; glass: string | null; basis: `${number}%`; onOpen: () => void }) {
  const ds = useDs();
  const tag = pictureTag(shot.picture);
  if (!shot.picture) {
    return (
      <View style={[styles.tile, { flexBasis: basis }]}>
        <View
          accessible
          accessibilityLabel={`${name}, ${shotCaption(shot)}`}
          style={[styles.empty, { borderColor: ds.c.lineStrong, backgroundColor: ds.c.surface }]}
        >
          <Caption tone="muted" align="center">
            {shotCaption(shot)}
          </Caption>
        </View>
        <Caption>{shot.label}</Caption>
      </View>
    );
  }
  return (
    <PressableScale
      role="button"
      accessibilityLabel={`${name}, ${shotCaption(shot)}. Open full screen`}
      onPress={onOpen}
      style={[styles.tile, { flexBasis: basis }]}
    >
      <DrinkImage source={shot.picture.url} generated={shot.picture.isSketch} glass={glass} accessibilityLabel={`${name}, ${shot.label}`} aspectRatio={1} radius="control" hideTag />
      <View style={styles.caption}>
        <Caption>{shot.label}</Caption>
        {tag ? <Tag label={tag} tone={shot.picture.isSketch ? 'sketch' : 'warning'} /> : null}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: { flexGrow: 1, gap: space.xs },
  empty: {
    aspectRatio: 1,
    borderRadius: radius.control,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.sm,
  },
  caption: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xs },
});
