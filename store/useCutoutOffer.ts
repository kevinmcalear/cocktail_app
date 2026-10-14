import { create } from 'zustand';

import { cutout, cutoutAvailable } from '@/modules/subject-cutout';

interface CutoutOffer {
  original: string;
  cutout: string;
  /** The photo to keep: the cut-out or the original. Closes the offer. */
  choose: (uri: string) => void;
}

/**
 * The cut-out waiting on a yes or no, and the CutoutOfferHosts that can show
 * it. A host sits on each screen or sheet that picks drink photos, not in the
 * root layout: on iOS a sheet only shows from the screen on top, and photos
 * are often picked on a modal screen (Photos) or inside a sheet (the editor's).
 * The host mounted last shows the offer: that's the screen on top.
 * ponytail: "last mounted" is a guess at "on top"; it holds for stacks and
 * sheets. A root host in a full-window overlay is the upgrade if it ever doesn't.
 */
export const useCutoutOffer = create<{ offer: CutoutOffer | null; hosts: string[] }>()(() => ({ offer: null, hosts: [] }));

/** For a CutoutOfferHost's effect: registers it, and returns the unregister. */
export function registerCutoutHost(id: string): () => void {
  useCutoutOffer.setState((s) => ({ hosts: [...s.hosts, id] }));
  return () => useCutoutOffer.setState((s) => ({ hosts: s.hosts.filter((h) => h !== id) }));
}

/**
 * After a drink photo is picked: lifts the drink off its background on the
 * device and, when that worked, asks whether to use the cut-out. Resolves
 * with the photo to upload. Where cut-outs aren't possible (web, older
 * binaries, no clear subject) or no host is on screen to ask, it resolves
 * the original straight away and nothing is shown.
 */
export async function offerCutout(uri: string): Promise<string> {
  if (!cutoutAvailable || useCutoutOffer.getState().hosts.length === 0) return uri;
  const cut = await cutout(uri);
  if (!cut) return uri;
  return new Promise((resolve) => {
    useCutoutOffer.setState({
      offer: {
        original: uri,
        cutout: cut.uri,
        choose: (chosen) => {
          useCutoutOffer.setState({ offer: null });
          resolve(chosen);
        },
      },
    });
  });
}
