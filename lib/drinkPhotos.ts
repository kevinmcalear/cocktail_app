import type { ItemPicture } from './itemImages';
import { formatScore } from './ranking';

interface PersonPhoto {
  imageUrl: string;
  isMine: boolean;
  poster: { name: string } | null;
  score: number | null;
}

/**
 * The line under someone's photo of a drink: "Photo by Jo · ranked it 8.4".
 * A poster without a profile the viewer may read is "a guest".
 */
export function photoCredit(photo: Pick<PersonPhoto, 'isMine' | 'poster' | 'score'>): string {
  const who = photo.isMine ? 'you' : (photo.poster?.name ?? 'a guest');
  return photo.score == null ? `Photo by ${who}` : `Photo by ${who} · ranked it ${formatScore(photo.score)}`;
}

/**
 * The drink page's pictures and the credit under its name. A drink with no
 * real photo of its own (nothing, or only a sketch) leads with the photo
 * whose poster ranked it highest, credited to them; the sketch stays behind
 * it. Photos without a score come after scored ones; ties go to the newest
 * (`people` arrives newest first and the sort is stable).
 */
export function heroPictures(own: ItemPicture[], people: PersonPhoto[] | null | undefined): { pictures: ItemPicture[]; credit: string | null } {
  const person = own.some((p) => !p.isSketch) ? null : ([...(people ?? [])].sort((a, b) => (b.score ?? -1) - (a.score ?? -1))[0] ?? null);
  if (person) {
    const credit = photoCredit(person);
    return { pictures: [{ url: person.imageUrl, isSketch: false, isOutdated: false, credit, sourceUrl: null }, ...own], credit };
  }
  return { pictures: own, credit: own[0]?.credit ? `Photo: ${own[0].credit}` : null };
}
