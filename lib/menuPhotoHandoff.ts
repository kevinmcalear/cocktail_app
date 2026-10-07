import type { HomeNight } from '@/hooks/useMenuMutations';
import type { MenuPhoto } from '@/lib/readMenu';

/** What New menu hands the photo review (/menus/from-photo): the pages and the new menu's details. */
export interface MenuPhotoStart {
  photos: MenuPhoto[];
  barId: string | null;
  /** Empty: the name printed on the menu. */
  name: string;
  night?: HomeNight;
}

// One pending start, kept until the review screen is done with it, so a
// remount (dev double render) still finds it.
let staged: MenuPhotoStart | null = null;

export function stageMenuPhotos(start: MenuPhotoStart): void {
  staged = start;
}

export function peekMenuPhotos(): MenuPhotoStart | null {
  return staged;
}

export function clearMenuPhotos(): void {
  staged = null;
}
