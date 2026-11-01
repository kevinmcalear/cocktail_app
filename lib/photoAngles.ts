import type { ImageAngle } from './itemImages';

/** A draft's photos, one per angle (the add wizard's "Which is which?"). */
export type AnglePhotos = Partial<Record<ImageAngle, string>>;

/** The angles in the order "Which is which?" offers them; the hero leads the drink's page. */
export const PHOTO_ANGLES: readonly { angle: ImageAngle; label: string }[] = [
  { angle: 'hero', label: 'Hero' },
  { angle: 'side', label: 'Side' },
  { angle: 'top', label: 'Top' },
  { angle: 'garnish', label: 'Close up' },
  { angle: 'handoff', label: 'Guest view' },
];

/** How many more photos fit: one per angle. */
export const roomFor = (photos: AnglePhotos) => PHOTO_ANGLES.filter(({ angle }) => !photos[angle]).length;

/** The draft's photos in angle order: the rows "Which is which?" starts with. */
export const photoUris = (photos: AnglePhotos) => PHOTO_ANGLES.flatMap(({ angle }) => (photos[angle] ? [photos[angle]] : []));

export const angleOf = (photos: AnglePhotos, uri: string) => PHOTO_ANGLES.find(({ angle }) => photos[angle] === uri)?.angle ?? null;

/** Newly picked photos take the free angles in order, so the first one picked is the Hero when there's none. Extra photos are left out. */
export function addPhotos(photos: AnglePhotos, uris: readonly string[]): AnglePhotos {
  const next = { ...photos };
  const free = PHOTO_ANGLES.filter(({ angle }) => !next[angle]);
  uris.slice(0, free.length).forEach((uri, i) => (next[free[i].angle] = uri));
  return next;
}

/** Gives a photo an angle; the photo that had it takes this one's old angle, so each keeps one. */
export function setAngle(photos: AnglePhotos, uri: string, angle: ImageAngle): AnglePhotos {
  const was = angleOf(photos, uri);
  if (was === angle) return photos;
  const next = { ...photos, [angle]: uri };
  const other = photos[angle];
  if (was) {
    if (other) next[was] = other;
    else delete next[was];
  }
  return next;
}
