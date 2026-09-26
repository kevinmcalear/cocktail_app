/**
 * An item's pictures as the app selects them from item_images. Sketches are
 * drawn by the server (automatically, or with the Generate button) and carry
 * is_generated; photos whose spec changed since they were taken carry
 * outdated_since until an editor confirms them.
 */
export interface ItemImageLink {
  sort_order?: number | null;
  is_generated?: boolean | null;
  outdated_since?: string | null;
  images?: { url?: string | null } | null;
}

export interface ItemPicture {
  url: string;
  isSketch: boolean;
  isOutdated: boolean;
}

/** Photos first, then sketches, each in their saved order. The first is the hero. */
export function orderedPictures(links: ItemImageLink[] | null | undefined): ItemPicture[] {
  return (links ?? [])
    .filter((link) => !!link.images?.url)
    .sort(
      (a, b) =>
        Number(!!a.is_generated) - Number(!!b.is_generated) ||
        Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)
    )
    .map((link) => ({
      url: link.images!.url!,
      isSketch: !!link.is_generated,
      isOutdated: !link.is_generated && !!link.outdated_since,
    }));
}

export function heroPicture(links: ItemImageLink[] | null | undefined): ItemPicture | null {
  return orderedPictures(links)[0] ?? null;
}

/** The small label shown on a picture, if any. */
export function pictureTag(picture: ItemPicture | null | undefined): string | null {
  if (!picture) return null;
  if (picture.isSketch) return 'Sketch';
  if (picture.isOutdated) return 'May be out of date';
  return null;
}
