/** item_images.angle. Hero pictures lead the drink; the rest are service photos. */
export type ImageAngle = 'hero' | 'side' | 'top' | 'garnish' | 'handoff';

/**
 * An item's pictures as the app selects them from item_images. Sketches are
 * drawn by the server (automatically, or with the Generate button) and carry
 * is_generated; photos whose spec changed since they were taken carry
 * outdated_since until an editor confirms them.
 */
export interface ItemImageLink {
  id?: string;
  /** Selects that leave it out get every link, as before angles existed. */
  angle?: ImageAngle | null;
  sort_order?: number | null;
  is_generated?: boolean | null;
  outdated_since?: string | null;
  images?: { url?: string | null; credit?: string | null; source_url?: string | null; palette?: string[] | null } | null;
}

export interface ItemPicture {
  url: string;
  isSketch: boolean;
  isOutdated: boolean;
  /** Who a borrowed photo belongs to, and the page it came from. */
  credit: string | null;
  sourceUrl: string | null;
  /** Its colours (images.palette), where the query read them: the first fills the frame while it loads. */
  palette?: string[] | null;
}

/** Whether a link is one of the item's hero pictures (not a service angle). */
export function isHeroLink(link: ItemImageLink): boolean {
  return (link.angle ?? 'hero') === 'hero';
}

/**
 * The hero pictures: photos first, then sketches, each in their saved order.
 * The first is the hero. Service angles (side, top, ...) are left out, so a
 * top-down shot never becomes a drink's thumbnail.
 */
export function orderedPictures(links: ItemImageLink[] | null | undefined): ItemPicture[] {
  return (links ?? [])
    .filter((link) => !!link.images?.url && isHeroLink(link))
    .sort(
      (a, b) =>
        Number(!!a.is_generated) - Number(!!b.is_generated) ||
        Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)
    )
    .map(toPicture);
}

/** A link with a file, as the app shows it. */
export function toPicture(link: ItemImageLink): ItemPicture {
  return {
    url: link.images!.url!,
    isSketch: !!link.is_generated,
    isOutdated: !link.is_generated && !!link.outdated_since,
    credit: link.images!.credit ?? null,
    sourceUrl: link.images!.source_url ?? null,
    palette: link.images!.palette ?? null,
  };
}

export function heroPicture(links: ItemImageLink[] | null | undefined): ItemPicture | null {
  return orderedPictures(links)[0] ?? null;
}

/**
 * The small label shown on a picture, if any: only a photo taken before the
 * spec changed. A drawing carries no tag: it's obviously a drawing (decided
 * 10 Oct 2026, it read as an edit button).
 */
export function pictureTag(picture: Pick<ItemPicture, 'isSketch' | 'isOutdated'> | null | undefined): string | null {
  return picture && !picture.isSketch && picture.isOutdated ? 'May be out of date' : null;
}

/** What a screen reader hears for one of an item's pictures: "Photo 2 of 4, sketch". */
export function pictureLabel(picture: Pick<ItemPicture, 'isSketch' | 'isOutdated'>, index: number, total: number): string {
  // Screen readers still hear it's a drawing: they can't see that it obviously is one.
  const tag = picture.isSketch ? 'Sketch' : pictureTag(picture);
  const position = total > 1 ? `Photo ${index + 1} of ${total}` : 'Photo';
  return tag ? `${position}, ${tag.toLowerCase()}` : position;
}

/** A name folded for matching: lower case, no accents, single spaces ("Apérol  Fizz" is "aperol fizz"). */
export function nameKey(name: string): string {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** The drink a prep batches, from its name: "Aperol Fizz Batch" and "Aperol Fizz (batch)" batch "Aperol Fizz". */
export function batchedDrinkName(name: string): string | null {
  return /^(.+?)[\s(-]+batch(?:ed)?\)?\s*$/i.exec(name.trim())?.[1] ?? null;
}

/** batchedDrinkName as a nameKey, for matching against drinks. */
export function batchedDrinkKey(name: string): string | null {
  const drink = batchedDrinkName(name);
  return drink ? nameKey(drink) : null;
}

/**
 * A batch's hero links with its drink's photos in front, when the batch has no
 * photo of its own. Sketches of the drink stay with the drink: a batch's own
 * sketch is no worse than the drink's.
 * ponytail: matched by name at the same venue; a real batch-to-drink link is the upgrade if names drift.
 */
export function withDrinkPhotos(own: ItemImageLink[] | null | undefined, drink: ItemImageLink[] | null | undefined): ItemImageLink[] {
  const ownLinks = own ?? [];
  if (orderedPictures(ownLinks).some((p) => !p.isSketch)) return ownLinks;
  return [...(drink ?? []).filter((link) => !link.is_generated), ...ownLinks];
}
