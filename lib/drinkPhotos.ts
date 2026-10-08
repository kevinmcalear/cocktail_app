import { formatScore } from './ranking';

/**
 * The line under someone's photo of a drink: "Photo by Jo · ranked it 8.4".
 * A poster without a profile the viewer may read is "a guest".
 */
export function photoCredit(photo: { isMine: boolean; poster: { name: string } | null; score: number | null }): string {
  const who = photo.isMine ? 'you' : (photo.poster?.name ?? 'a guest');
  return photo.score == null ? `Photo by ${who}` : `Photo by ${who} · ranked it ${formatScore(photo.score)}`;
}
