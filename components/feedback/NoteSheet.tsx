import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, BrandProvider, Button, Caption, Chip, Field, PressableScale, TextLink, useDs } from '@/components/ds';
import { MenuSheet } from '@/components/screens/menus/MenuSheet';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { DEFAULT_ACCENT, layout, radius, space } from '@/constants/tokens';
import { useUserId } from '@/ctx/AuthContext';
import { sendFailure, useSendNote, type NoteKind, type NotePhoto } from '@/hooks/useSendNote';
import { newDraftId } from '@/lib/drinkWizard';
import { useNoteDrafts } from '@/store/useNoteDrafts';

/** Where a note comes from, shown on the sheet and sent with it. */
export interface NoteAbout {
  /** "Adding a drink › Ice" */
  screen: string;
  drinkName?: string | null;
  /** The drink's draft (WizardDraft.id): the kept words stay with it as its name changes. */
  draftId?: string | null;
  barId?: string | null;
  barName?: string | null;
  /** What the sheet calls where it's from, when `screen` is a path: a screenshot's "/cocktail/<id>" shows as "your screenshot". */
  label?: string;
}

export const REPORT_KINDS = [
  { id: 'broken', label: 'Something’s broken' },
  { id: 'wrong', label: 'Looks wrong' },
  { id: 'slow', label: 'It’s slow' },
  { id: 'data', label: 'Wrong information' },
  { id: 'other', label: 'Something else' },
] as const satisfies readonly { id: NoteKind; label: string }[];

export type ReportKind = (typeof REPORT_KINDS)[number]['id'];

/** "Sent with: Adding a drink › Ice · Ash Garden · Little Rye"; a report says the app version and device go too. */
export function sentWith(about: NoteAbout, report?: boolean): string {
  const where = about.label ?? about.screen;
  const parts = report ? [where, 'app version and device'] : [where, about.drinkName?.trim(), about.barName];
  return `Sent with: ${parts.filter(Boolean).join(' · ')}`;
}

interface NoteSheetProps {
  visible: boolean;
  onClose: () => void;
  about: NoteAbout;
  /**
   * Report a problem: what kind, optional words, and Email us instead when
   * onEmail is given (with what's typed; resolves to what to say when no
   * email app opened). Without it, Tell us.
   */
  report?: { onEmail?: (kind: ReportKind, body: string) => Promise<string | null> };
  /** A picture it opens with: the screenshot it was sent from (ScreenshotReport). */
  photo?: NotePhoto;
  /** Tell us's question and field, when it isn't "What do you do differently?" (Your bottles: a bottle missing or wrong). */
  ask?: { title: string; field: string };
}

/**
 * The one sheet for notes to the Cocktail team (Eddie wave 2, fix 16): Tell us
 * ("What do you do differently?", from under the ice, method and technique
 * lists) and Report a problem. It shows what it's sent with, keeps the words
 * on the device until they're sent (useNoteDrafts), and thanks them after.
 * In the Cocktail accent, not the venue's: it's a note to us.
 */
export function NoteSheet(props: NoteSheetProps) {
  return (
    <BrandProvider accent={DEFAULT_ACCENT} accentText="ink">
      <Sheet {...props} />
    </BrandProvider>
  );
}

function Sheet({ visible, onClose, about, report, ask, photo: given }: NoteSheetProps) {
  const ds = useDs();
  const userId = useUserId();
  // Words typed for one drink at one bar stay with that draft and bar (not its name, which changes as it's typed).
  const key = [userId ?? 'signed-out', about.screen, about.barId ?? '', about.draftId ?? ''].join(':');
  const draft = useNoteDrafts((s) => s.drafts[key]);
  const saveDraft = useNoteDrafts((s) => s.save);
  const send = useSendNote();
  // A picked photo (or the screenshot it opened with), and the id its upload is stored under (so a retry reuses it).
  const [photo, setPhoto] = useState<NotePhoto | null>(given ?? null);
  const [problem, setProblem] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const body = draft?.body ?? '';
  // Report a problem starts on "Something's broken", as the board draws it.
  const kind: NoteKind = report ? ((draft?.kind as ReportKind | null | undefined) ?? 'broken') : 'tell_us';
  const update = (change: { body?: string; kind?: ReportKind }) => saveDraft(key, { body, kind: report ? kind : null, ...change });
  const canSend = (report ? true : body.trim().length > 0) && !send.isPending;

  // Opened again after a thank-you: a fresh sheet. Here, not in close(), so the thanks stays put while it slides away.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible && sent) {
      setSent(false);
      setPhoto(null);
    }
  }

  const close = () => {
    // A send still going keeps going: it clears the words and thanks them when it lands.
    if (!send.isPending) send.reset();
    setProblem(null);
    onClose();
  };

  const pick = async () => {
    setProblem(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
      const asset = result.canceled ? null : result.assets?.[0];
      if (asset) setPhoto({ uri: asset.uri, id: newDraftId(), type: asset.mimeType ?? null });
    } catch {
      setProblem('That photo couldn’t be opened. Try another.');
    }
  };

  const submit = () => {
    setProblem(null);
    // The hook clears the kept words when it lands (draftKey), even if this sheet has gone by then.
    send.mutate({ kind, screen: about.screen, drinkName: about.drinkName, barId: about.barId, body, photo, draftKey: key }, { onSuccess: () => setSent(true) });
  };

  const email = async () => {
    setProblem(null);
    const failed = report?.onEmail ? await report.onEmail(kind as ReportKind, body) : null;
    if (failed) return setProblem(failed);
    // Sent by email: it doesn't wait here to be sent a second time.
    saveDraft(key, null);
    close();
  };

  if (sent) {
    return (
      <MenuSheet visible={visible} onClose={close} eyebrow={report ? 'Report a problem' : 'Tell us'} title={report ? 'Thanks for telling us.' : 'Thanks. It’s with us.'} footer={<Button label="Done" size="lg" onPress={close} />}>
        <Body tone="muted">{report ? 'A person reads every one, and we’ll fix what we can.' : 'Only the Cocktail team sees this. We’ll tell you when it’s in.'}</Body>
      </MenuSheet>
    );
  }

  const shown = problem ?? (send.isError ? sendFailure(send.error) : null);
  const footer = (
    <View style={styles.footer}>
      {shown ? (
        <Caption tone="accent" role="alert">
          {shown}
        </Caption>
      ) : null}
      <Button label={send.isPending ? 'Sending…' : 'Send'} size="lg" disabled={!canSend} onPress={submit} />
      {report?.onEmail ? <TextLink label="Email us instead" tone="ink" disabled={send.isPending} onPress={() => void email()} /> : null}
    </View>
  );
  // Nothing typed while it's sending, so nothing new is cleared with the sent words; nor
  // before auth knows who this is, when the words would be kept under no one.
  const editable = !send.isPending && !!userId;
  const screenshot = !!given && photo === given;
  const photoRow = photo ? (
    <View style={styles.photoRow}>
      <Image source={{ uri: photo.uri }} style={styles.thumb} contentFit="cover" accessibilityLabel={screenshot ? 'Your screenshot' : 'Your photo'} />
      <Body style={styles.flex}>{screenshot ? 'Screenshot added' : 'Photo added'}</Body>
      {editable ? <TextLink label="Remove" tone="ink" onPress={() => setPhoto(null)} /> : null}
    </View>
  ) : (
    <PressableScale role="button" accessibilityLabel="Add a photo (optional)" disabled={!editable} onPress={() => void pick()} style={[styles.addPhoto, { borderColor: ds.c.lineStrong }]}>
      <IconSymbol name="camera" size={18} color={ds.c.ink} />
      <Body>Add a photo (optional)</Body>
    </PressableScale>
  );

  if (report) {
    return (
      <MenuSheet visible={visible} onClose={close} title="Report a problem" footer={footer}>
        <View role="radiogroup" aria-label="What kind of problem" style={styles.chips}>
          {REPORT_KINDS.map((k) => (
            <Chip key={k.id} label={k.label} selected={kind === k.id} disabled={!editable} onPress={() => update({ kind: k.id })} />
          ))}
        </View>
        <Field label="What happened (optional)" value={body} onChangeText={(text) => update({ body: text })} editable={editable} multiline minLines={3} maxLength={2000} />
        {photoRow}
        <Caption tone="muted">{sentWith(about, true)}</Caption>
      </MenuSheet>
    );
  }

  return (
    <MenuSheet visible={visible} onClose={close} eyebrow="Tell us" title={ask?.title ?? 'What do you do differently?'} footer={footer}>
      <View style={[styles.with, { backgroundColor: ds.c.raised }]}>
        <IconSymbol name="bubble.left" size={16} color={ds.c.muted} />
        <Caption tone="muted" style={styles.flex}>
          {sentWith(about)}
        </Caption>
      </View>
      <Field label={ask?.field ?? 'What you do'} value={body} onChangeText={(text) => update({ body: text })} editable={editable} multiline minLines={4} maxLength={2000} />
      {photoRow}
      <Caption tone="muted">Only the Cocktail team sees this. We’ll tell you when it’s in.</Caption>
    </MenuSheet>
  );
}

const styles = StyleSheet.create({
  footer: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  with: { flexDirection: 'row', alignItems: 'center', gap: space.sm + 2, paddingHorizontal: space.md + 2, paddingVertical: space.sm + 2, borderRadius: radius.control },
  flex: { flex: 1 },
  addPhoto: { flexDirection: 'row', alignItems: 'center', gap: space.sm + 2, minHeight: layout.minTapTarget + 4, paddingHorizontal: space.lg, borderRadius: radius.pill, borderWidth: 1, borderStyle: 'dashed', alignSelf: 'stretch' },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  thumb: { width: 56, height: 56, borderRadius: radius.control },
});
