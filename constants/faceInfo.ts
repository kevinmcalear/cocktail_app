import type { DisplayFace } from './tokens';

/**
 * What the type pickers say about each face: its name, who drew it, and its
 * style (Book, Worn, Deco, Tavern, Modern, Poster, Sign). Apart from
 * `displayFaces` (every page reads that) so the words load with the Brand and
 * Theme screens only.
 */
export const faceInfo: Record<DisplayFace, { label: string; by: string; style: string }> = {
  instrument: { label: 'Instrument Serif', by: 'Rodrigo Fuenzalida', style: 'Default' },
  newsreader: { label: 'Newsreader', by: 'Production Type', style: 'Book' },
  fell: { label: 'IM Fell English', by: 'Igino Marini', style: 'Worn' },
  imbue: { label: 'Imbue', by: 'Tyler Finck', style: 'Deco' },
  besley: { label: 'Besley', by: 'Owen Earl', style: 'Tavern' },
  bricolage: { label: 'Bricolage Grotesque', by: 'Mathieu Triay', style: 'Modern' },
  belleza: { label: 'Belleza', by: 'Eduardo Tunni', style: 'Poster' },
  shoulders: { label: 'Big Shoulders', by: 'Patric King', style: 'Sign' },
};
