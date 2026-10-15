import { useRouter, type Href } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Field, GlassButton, Sheet, Title, useDs, useSheetClose } from '@/components/ds';
import { fontFamilies, radius, space } from '@/constants/tokens';
import { useSetMissingPrices } from '@/hooks/useBulk';
import { stageBringIn } from '@/lib/bringInHandoff';
import { plural, savedLine } from '@/lib/menus';
import { bringInText } from '@/lib/paste';
import { MAX_MENU_PHOTOS } from '@/lib/readMenu';
import type { MenuSummary } from '@/types/menus';

import { HomeNightFields } from './HomeNight';
import { MenuPhotos } from './MenuPhotos';
import { Choice } from './MenuSheet';
import { DeskPreview, DeskStartTiles, SavedCards, type DeskStart } from './NewMenuDeskParts';
import { NameIdeas, VenueDatesFields } from './NewMenuParts';
import { MonoLabel } from './ReviewParts';
import { useMenuPhotoDrop } from './useMenuPhotoDrop';
import { useNewMenu } from './useNewMenu';
import { useNewMenuPaste } from './useNewMenuPaste';

interface NewMenuDeskProps {
  onClose: () => void;
  menus: MenuSummary[];
  now: number;
}

/**
 * New menu on a wide screen (venue-menus-new A1 to A4, nm-decided): one page.
 * On the left how it starts, its name with ideas, who it's for and when it
 * goes on; on the right the guest card, flat and square, filling in. A list
 * is pasted and matched here; a photo dropped anywhere starts from it.
 * Create draft, or ⌘↵.
 */
export function NewMenuDesk({ onClose, menus, now }: NewMenuDeskProps) {
  return (
    <Sheet visible onClose={onClose} accessibilityLabel="New menu" style={styles.dialog}>
      <DeskBody onClose={onClose} menus={menus} now={now} />
    </Sheet>
  );
}

function DeskBody({ onClose, menus, now }: NewMenuDeskProps) {
  const ds = useDs();
  const router = useRouter();
  const m = useNewMenu({ menus, now, onClose });
  const [text, setText] = useState('');
  const pasting = m.start.kind === 'paste';
  const paste = useNewMenuPaste(text, m.barId, pasting);
  const setPrices = useSetMissingPrices();
  const picked: DeskStart = m.start.kind === 'copy' || m.start.kind === 'layout' ? 'saved' : m.start.kind;
  const saved = [...m.copyable, ...m.layouts];
  const photo = m.start.kind === 'photo';

  // A photo dropped anywhere on the dialog starts from it.
  const root = useRef<ComponentRef<typeof View>>(null);
  const dragging = useMenuPhotoDrop(root, (more) => {
    m.setStart({ kind: 'photo' });
    m.setPhotos((before) => [...before, ...more].slice(0, MAX_MENU_PHOTOS));
  });

  const pick = (kind: DeskStart) => {
    m.setError(null);
    if (kind !== 'saved') return m.setStart({ kind });
    if (m.copyable[0]) m.setStart({ kind: 'copy', menuId: m.copyable[0].id });
    else if (m.layouts[0]) m.setStart({ kind: 'layout', layoutId: m.layouts[0].id });
  };

  const create = async () => {
    if (m.pending || setPrices.isPending) return;
    if (!pasting) return void (await m.submit());
    if (!paste.found && !paste.missing.length) return m.setError('Paste the drinks first, one a line.');
    if (paste.unsure) return m.setError(`${plural(paste.unsure, 'name matches', 'names match')} more than one drink. Add the bar or year to say which.`);
    // Nothing is written until the draft can be made.
    if (m.problem()) return;
    try {
      if (paste.prices.length) await setPrices.mutateAsync(paste.prices);
    } catch {
      return m.setError('Couldn’t set those prices. Try again.');
    }
    // The drinks that aren't there yet go to Bring in, over the builder: back lands on the menu.
    if ((await m.submit(paste.sections)) && paste.missing.length) {
      stageBringIn(bringInText(paste.missing));
      router.push('/bring-in' as Href);
    }
  };
  const latest = useRef(create);
  useEffect(() => {
    latest.current = create;
  });
  useEffect(() => {
    // ⌘↵ (Ctrl+Enter off a Mac) makes the draft from anywhere in the dialog.
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        void latest.current();
      }
    };
    // Capture: a text field can stop Enter before it bubbles up.
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, []);

  const cardSections = m.start.kind === 'copy' ? (m.source?.sections ?? null) : pasting ? paste.preview.map((s) => ({ id: s.key, name: s.name, drinks: s.drinks })) : null;
  const drinkCount = m.source?.sections.reduce((n, s) => n + s.drinks.length, 0) ?? 0;
  const note =
    m.start.kind === 'copy'
      ? m.source
        ? `Copied from ${m.source.name}: ${plural(m.source.sections.length, 'section')}, ${plural(drinkCount, 'drink')}`
        : 'Setting the menu…'
      : m.layout
        ? `${m.layout.name}: ${plural(m.layout.sections.length, 'section')}, no drinks yet`
        : photo
          ? m.photos.length
            ? 'Next, it’s read and drawn onto your paper. Drop more pages anywhere.'
            : 'Drop the pages anywhere on this window, or add them on the left.'
          : pasting
            ? text.trim()
              ? [`${paste.found} found${m.venue ? ` in ${m.venue.name}` : ''}`, paste.missing.length ? `${paste.missing.length} new, Bring in starts ${paste.missing.length === 1 ? 'it' : 'them'} for you` : null, paste.unsure ? `${paste.unsure} to say which` : null].filter(Boolean).join(' · ')
              : 'Paste drink names and they’re matched as you go.'
            : 'One section to start. Drinks go in once it’s made.';

  return (
    <View ref={root} style={[styles.row, dragging && { borderColor: ds.accentText }]}>
      <View style={[styles.left, { borderRightColor: ds.c.line }]}>
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <View>
            <Title>New menu</Title>
            <Caption tone="muted">{m.home ? 'Only you see it. Share it with your guests when it’s ready.' : 'A draft until it goes on. Nobody sees it before then.'}</Caption>
          </View>
          <MonoLabel>Start from</MonoLabel>
          <DeskStartTiles picked={picked} saved={saved.length ? savedLine(saved.map((s) => s.name)) : null} onPick={pick} />
          {picked === 'saved' ? <SavedCards menus={m.copyable} layouts={m.layouts} start={m.start} now={now} onPick={m.setStart} /> : null}
          {photo ? <MenuPhotos small photos={m.photos} onChange={m.setPhotos} onError={m.setError} /> : null}
          {pasting ? (
            <Field label="Drink names, one a line" value={text} onChangeText={setText} placeholder={'House Martini\nBolo Tie\nSours:\nSmoke Signal - 19'} minLines={6} autoFocus hint="One drink a line. A line ending in a colon starts a section." />
          ) : null}
          <MonoLabel>Name</MonoLabel>
          <Field label="Name" hideLabel value={m.name} onChangeText={m.setName} placeholder={photo ? 'From the photo' : m.home ? 'Friday at ours' : (m.ideas[0] ?? 'Winter menu')} hint={photo ? 'Leave it empty to use the name printed on it.' : undefined} />
          {photo ? null : <NameIdeas ideas={m.ideas} name={m.name} onPick={m.setName} />}
          {m.buildable.length > 1 ? (
            <>
              <MonoLabel>For</MonoLabel>
              <View role="radiogroup" accessibilityLabel="Who the menu is for" style={styles.wrap}>
                {m.buildable.map((v) => (
                  <Choice key={v.id} label={v.name} selected={m.barId === v.id} onPress={() => m.pickVenue(v.id)} />
                ))}
              </View>
            </>
          ) : null}
          <MonoLabel>{m.home ? 'When' : 'Goes on'}</MonoLabel>
          {m.home ? <HomeNightFields value={m.night} onChange={m.setNight} /> : <VenueDatesFields value={m.plan} onChange={m.setPlan} now={now} quick={false} />}
        </ScrollView>
        <View style={[styles.footer, { borderTopColor: ds.c.line }]}>
          {m.error ? <Body tone="accent">{m.error}</Body> : photo ? <Caption tone="muted">We read its sections, drinks and prices. You check every drink before anything is made.</Caption> : null}
          <View style={styles.actions}>
            <Button label={m.pending || setPrices.isPending ? 'Making the draft…' : photo ? 'Read the menu' : 'Create draft'} size="lg" onPress={create} disabled={m.pending || setPrices.isPending} style={styles.flex} />
            <Caption tone="muted" style={styles.keys} aria-hidden>
              ⌘ ↵
            </Caption>
          </View>
        </View>
      </View>
      <View style={styles.right}>
        <View style={styles.rightHead}>
          <MonoLabel>{photo && m.photos.length ? `Your photo · ${plural(m.photos.length, 'page')}` : 'What guests will see'}</MonoLabel>
          <Close />
        </View>
        <DeskPreview name={m.name.trim()} when={m.when} venue={m.venue} sections={cardSections} newIds={pasting ? paste.newIds : undefined} photos={photo ? m.photos : null} />
        <Caption tone="muted" align="center" style={styles.monoNote}>
          {note}
        </Caption>
      </View>
    </View>
  );
}

function Close() {
  return <GlassButton icon="xmark" accessibilityLabel="Close" onPress={useSheetClose()} />;
}

const styles = StyleSheet.create({
  dialog: { maxWidth: 1120, height: '90%', maxHeight: 820, borderRadius: radius.card + 2 },
  row: { flex: 1, flexDirection: 'row', borderWidth: 1.5, borderColor: 'transparent', borderRadius: radius.card + 2 },
  left: { width: 440, borderRightWidth: StyleSheet.hairlineWidth },
  form: { padding: space.xl, gap: space.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  footer: { paddingHorizontal: space.xl, paddingVertical: space.lg, gap: space.sm, borderTopWidth: StyleSheet.hairlineWidth },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1 },
  keys: { fontFamily: fontFamilies.mono },
  right: { flex: 1, padding: space.xl, gap: space.md, alignItems: 'center' },
  rightHead: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monoNote: { fontFamily: fontFamilies.mono },
});
