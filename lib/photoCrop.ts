/** A drink photo's shape: 4 wide by 5 tall, as the picker crops it (components/drink/drinkImages.ts). */
export const PHOTO_ASPECT = 4 / 5;
/** How far in the crop can zoom, past filling the frame. */
export const MAX_ZOOM = 4;

export interface Size {
  width: number;
  height: number;
}

/** Where the photo sits in the crop frame: zoom (1 fills the frame) and how far its centre is moved, in frame points. */
export interface CropView {
  zoom: number;
  x: number;
  y: number;
}

/** The scale that makes the whole photo just cover the frame. */
export function coverScale(photo: Size, frame: Size): number {
  return Math.max(frame.width / photo.width, frame.height / photo.height);
}

/** How far the photo's centre can move along one side before an edge shows inside the frame. */
export function panLimit(photoSide: number, frameSide: number, scale: number): number {
  'worklet';
  return Math.max(0, (photoSide * scale - frameSide) / 2);
}

/** The part of the photo the frame shows, in the photo's own pixels, whole and inside the photo. */
export function cropRect(photo: Size, frame: Size, view: CropView): { originX: number; originY: number; width: number; height: number } {
  const scale = coverScale(photo, frame) * Math.min(MAX_ZOOM, Math.max(1, view.zoom));
  const width = Math.min(photo.width, Math.round(frame.width / scale));
  const height = Math.min(photo.height, Math.round(frame.height / scale));
  const originX = Math.round(photo.width / 2 - view.x / scale - width / 2);
  const originY = Math.round(photo.height / 2 - view.y / scale - height / 2);
  return {
    originX: Math.min(photo.width - width, Math.max(0, originX)),
    originY: Math.min(photo.height - height, Math.max(0, originY)),
    width,
    height,
  };
}
