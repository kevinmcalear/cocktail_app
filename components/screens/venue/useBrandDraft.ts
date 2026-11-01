import { useState } from 'react';

import { useLoadedFace } from '@/components/ds';
import { displayFaces } from '@/constants/tokens';
import { pickBrandImage, removeLogoBackground, useSaveVenueBrand, type VenueBrandRow } from '@/hooks/useVenueBrand';
import { brandProblems, faceFromDb, faceToSave, normalizeHex, usableGroundTint } from '@/lib/brand';

import type { BrandDraftState } from './BrandForm';
import type { BrandLook } from './BrandPreview';

export function draftFrom(row: VenueBrandRow): BrandDraftState {
  return {
    logoUrl: row.logo_url,
    iconUrl: row.icon_url,
    accent: row.primary_color ?? '',
    face: faceFromDb(row.display_face),
    tint: row.ground_tint ?? '',
    shortName: row.short_name ?? '',
    iconBackground: row.icon_background,
  };
}

/**
 * A venue's theme as it's being edited, shared by Theme and venue setup's
 * Look step: the draft, what's wrong with it, the patch to save, uploads,
 * background removal and the saved message.
 */
export function useBrandDraft(row: VenueBrandRow, canEdit: boolean) {
  const [draft, setDraft] = useState(() => draftFrom(row));
  const set = <K extends keyof BrandDraftState>(key: K) => (value: BrandDraftState[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const [suggested, setSuggested] = useState<string[]>([]);
  const [busy, setBusy] = useState<'logo' | 'icon' | 'background' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const save = useSaveVenueBrand(row.id);

  const problems = brandProblems({ accent: draft.accent, groundTint: draft.tint, shortName: draft.shortName });
  const patch = {
    logo_url: draft.logoUrl,
    icon_url: draft.iconUrl,
    primary_color: normalizeHex(draft.accent),
    display_face: faceToSave(draft.face, row.display_face),
    ground_tint: normalizeHex(draft.tint),
    short_name: draft.shortName.trim() || null,
    icon_background: draft.iconBackground,
  };
  const changed = canEdit && (Object.keys(patch) as (keyof typeof patch)[]).some((k) => (patch[k] ?? null) !== (row[k] ?? null));
  const ok = Object.keys(problems).length === 0 && !busy;

  const upload = async (kind: 'logo' | 'icon') => {
    setBusy(kind);
    setMessage(null);
    try {
      const picked = await pickBrandImage(row.id, kind === 'logo');
      if (!picked) return;
      if (kind === 'logo') {
        set('logoUrl')(picked.url);
        setSuggested(picked.colors.map((c) => c.toUpperCase()));
      } else set('iconUrl')(picked.url);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'The image didn’t upload. Try again.');
    } finally {
      setBusy(null);
    }
  };

  const removeBackground = async () => {
    if (!draft.logoUrl) return;
    setBusy('background');
    setMessage(null);
    try {
      const done = await removeLogoBackground(row.id, draft.logoUrl);
      if (done === 'unavailable') setMessage('Background removal arrives with the next update. For now, upload a PNG with a transparent background.');
      else {
        set('logoUrl')(done.url);
        setMessage('Background removed. Check it on dark and light, then save.');
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Couldn’t remove the background. Try again.');
    } finally {
      setBusy(null);
    }
  };

  // Saved, except a face the database doesn't have yet: the venue keeps its own,
  // the picker goes back to it, and the note says so.
  const saved = (done: string, then?: () => void) => (r: { faceKept: boolean }) => {
    if (!r.faceKept) {
      if (done) setMessage(done);
      then?.();
      return;
    }
    const kept = faceFromDb(row.display_face);
    set('face')(kept);
    setMessage(`${displayFaces[draft.face].label} isn’t available for venues yet, so ${row.name} keeps ${displayFaces[kept].label}. Everything else is saved.`);
  };

  const discard = () => {
    setDraft(draftFrom(row));
    setSuggested([]);
    setMessage(null);
  };

  // A face that loads on demand previews in Redaction until its file is in.
  const shownFace = useLoadedFace(draft.face);
  const look: BrandLook = {
    id: row.id,
    name: row.name,
    logoUrl: draft.logoUrl,
    iconUrl: draft.iconUrl,
    shortName: draft.shortName,
    accent: normalizeHex(draft.accent),
    displayFace: shownFace,
    groundTint: usableGroundTint(normalizeHex(draft.tint)),
    iconBackground: draft.iconBackground,
  };

  return { draft, set, suggested, busy, message, setMessage, problems, patch, changed, ok, save, saved, upload, removeBackground, discard, look };
}
