import { toPicture, type ImageAngle, type ItemImageLink, type ItemPicture } from './itemImages';

export type ServiceAngle = Exclude<ImageAngle, 'hero'>;

/** How staff should see a drink when they send it, in shot-list order. */
export const SERVICE_ANGLES: readonly { angle: ServiceAngle; label: string; brief: string }[] = [
  { angle: 'side', label: 'Side', brief: 'On the bar top, eye level' },
  { angle: 'top', label: 'Top', brief: 'Straight down, glass centred' },
  { angle: 'garnish', label: 'Garnish', brief: 'Close up' },
  { angle: 'handoff', label: 'Guest view', brief: "From the guest's side" },
];

/**
 * Venue drinks' service photos open at Employee (20): floor staff hand drinks
 * over too. Guests see the section locked. Drinks without a venue show them to
 * everyone.
 */
export const SERVICE_OPENS_AT = 20;

/**
 * photo: a current photo. outdated: a photo taken before the spec changed.
 * sketch: drawn, not photographed. missing: nothing yet.
 */
export type ShotStatus = 'photo' | 'outdated' | 'sketch' | 'missing';

export interface ServiceShot {
  angle: ServiceAngle;
  label: string;
  brief: string;
  picture: ItemPicture | null;
  status: ShotStatus;
  /** Photo links a new photo of this angle replaces. Sketches are the server's to manage. */
  photoLinkIds: string[];
}

const rank = (link: ItemImageLink) => (link.is_generated ? 2 : link.outdated_since ? 1 : 0);

/**
 * One angle's best picture: a current photo, then an outdated one, then a
 * sketch. A service angle shows its newest; the hero shows the main photo
 * (the lowest sort_order, as the drink page leads with it).
 */
function shotFor<A extends ImageAngle>(usable: ItemImageLink[], angle: A, label: string, brief: string, mine: (link: ItemImageLink) => boolean) {
  const links = usable.filter(mine);
  const order = angle === 'hero' ? 1 : -1;
  const best = [...links].sort((a, b) => rank(a) - rank(b) || order * (Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)))[0];
  const picture: ItemPicture | null = best ? toPicture(best) : null;
  const status: ShotStatus = !picture ? 'missing' : picture.isSketch ? 'sketch' : picture.isOutdated ? 'outdated' : 'photo';
  const photoLinkIds = links.filter((link) => !link.is_generated && link.id).map((link) => link.id!);
  return { angle, label, brief, picture, status, photoLinkIds };
}

/** One shot per service angle, each with its best picture: a current photo, then an outdated one, then a sketch. */
export function serviceShots(links: ItemImageLink[] | null | undefined): ServiceShot[] {
  const usable = (links ?? []).filter((link) => !!link.images?.url);
  return SERVICE_ANGLES.map(({ angle, label, brief }) => shotFor(usable, angle, label, brief, (link) => link.angle === angle));
}

/** A drink's whole shot list: the hero (a link with no angle is a hero, as before angles) and the four service angles. */
export type PhotoShot = Omit<ServiceShot, 'angle'> & { angle: ImageAngle };

export function photoShots(links: ItemImageLink[] | null | undefined): PhotoShot[] {
  const usable = (links ?? []).filter((link) => !!link.images?.url);
  const hero = shotFor(usable, 'hero', 'Hero', 'The drink on its own, for its page', (link) => !link.angle || link.angle === 'hero');
  return [hero, ...serviceShots(links)];
}

/** "2 of 5": the angles with a real photo, current or not. */
export function photosTaken(shots: Pick<PhotoShot, 'status'>[]): number {
  return shots.filter((s) => s.status === 'photo' || s.status === 'outdated').length;
}

/** The angles still to photograph: missing, sketched or out of date. */
export function shotList(shots: ServiceShot[]): ServiceShot[] {
  return shots.filter((shot) => shot.status !== 'photo');
}

/** What a tile says about its picture, in words. */
export function shotCaption(shot: ServiceShot): string {
  switch (shot.status) {
    case 'missing':
      return `${shot.label}: no photo yet`;
    case 'sketch':
      return `${shot.label}: sketch, no photo yet`;
    case 'outdated':
      return `${shot.label}: may be out of date`;
    default:
      return shot.label;
  }
}
