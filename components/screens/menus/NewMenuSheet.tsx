import { useRouter } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';

import { Body, Button, Caption, Field } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useCreateMenu, useMenuLayouts } from '@/hooks/useMenuMutations';
import { useMenu } from '@/hooks/useMenus';
import { useMode } from '@/hooks/useMode';
import { blankSection, copySections, type MenuLayout } from '@/lib/menuLayout';
import { groupMenus, homeNight, plural } from '@/lib/menus';
import { stageMenuPhotos } from '@/lib/menuPhotoHandoff';
import { focusInModal, MODAL_AUTOFOCUS } from '@/lib/modalAutoFocus';
import type { MenuPhoto } from '@/lib/readMenu';
import type { MenuSummary } from '@/types/menus';

import { EMPTY_NIGHT, HomeNightFields } from './HomeNight';
import { MenuPhotos } from './MenuPhotos';
import { Choice, MenuSheet } from './MenuSheet';

type Start = { kind: 'copy'; menuId: string } | { kind: 'layout'; layoutId: string } | { kind: 'photo' } | { kind: 'blank' };

interface NewMenuSheetProps {
  visible: boolean;
  onClose: () => void;
  /** The venue's menus, to copy one. */
  menus: MenuSummary[];
  now: number;
}

// Drink Creator and up build a venue's menus (private.can_write).
const BUILDS_MENUS = 35;

/**
 * A new menu starts as a draft: a name, whose it is, and what it starts from
 * (a copy of another menu, a saved layout, photos of a printed menu, or one
 * empty section). Photos go to a review of what was read (/menus/from-photo),
 * which makes the menu.
 */
export function NewMenuSheet({ visible, onClose, menus, now }: NewMenuSheetProps) {
  const router = useRouter();
  const { venues, active } = useActiveVenue();
  // Home mode is like another account: a menu made there is always your own.
  const home = useMode().mode === 'home';
  const buildable = home ? [] : venues.filter((v) => v.roleLevel >= BUILDS_MENUS);
  const [name, setName] = useState('');
  const nameRef = useRef<ComponentRef<typeof TextInput>>(null);
  const [barId, setBarId] = useState<string | null>(buildable.some((v) => v.id === active?.id) ? active!.id : (buildable[0]?.id ?? null));
  const venueMenus = menus.filter((m) => m.barId === barId);
  const groups = groupMenus(venueMenus, now);
  const copyable = [...groups.on, ...groups.upcoming, ...groups.draft, ...groups.previous].slice(0, 3);
  const [start, setStart] = useState<Start>(copyable[0] ? { kind: 'copy', menuId: copyable[0].id } : { kind: 'blank' });
  const { data: layouts = [] } = useMenuLayouts(barId);
  const { data: source } = useMenu(start.kind === 'copy' ? start.menuId : null);
  const create = useCreateMenu();
  const [photos, setPhotos] = useState<MenuPhoto[]>([]);
  const [night, setNight] = useState(EMPTY_NIGHT);
  const [error, setError] = useState<string | null>(null);

  const pickVenue = (id: string | null) => {
    setBarId(id);
    const first = menus.find((m) => m.barId === id);
    if (start.kind !== 'photo') setStart(first ? { kind: 'copy', menuId: first.id } : { kind: 'blank' });
  };

  const submit = async () => {
    // From photos, the menu's printed title can name it.
    if (!name.trim() && start.kind !== 'photo') return setError('Give the menu a name.');
    const when = home ? homeNight(night, Date.now()) : null;
    if (when && 'error' in when) return setError(when.error);
    let layout: MenuLayout = { name, coverUrl: null, coverPosition: 50, sections: [blankSection()] };
    if (start.kind === 'photo') {
      if (!photos.length) return setError('Add a photo of the menu first.');
      stageMenuPhotos({ photos, barId, name: name.trim(), night: when ?? undefined });
      onClose();
      return router.push('/menus/from-photo');
    }
    if (start.kind === 'copy') {
      if (!source) return setError('Still loading that menu. Try again in a moment.');
      layout = { name, coverUrl: source.coverUrl, coverPosition: source.coverPosition, sections: copySections(source.sections, true) };
    } else if (start.kind === 'layout') {
      const chosen = layouts.find((l) => l.id === start.layoutId);
      if (chosen?.sections.length) layout = { ...layout, sections: copySections(chosen.sections, false) };
    }
    setError(null);
    try {
      const id = await create.mutateAsync({ barId, layout, night: when ?? undefined });
      onClose();
      router.push(`/menus/${id}/edit`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t make the menu. Try again.');
    }
  };

  return (
    <MenuSheet
      visible={visible}
      onClose={onClose}
      title="New menu"
      subtitle={home ? 'Only you see it. Share the menu card with your guests when it’s ready.' : 'It starts as a draft. Nobody sees it until it goes on.'}
      onShow={MODAL_AUTOFOCUS ? undefined : () => focusInModal(nameRef)}
      footer={
        <Button
          label={create.isPending ? 'Making the draft…' : start.kind === 'photo' ? 'Read the menu' : 'Create draft'}
          size="lg"
          onPress={submit}
          disabled={create.isPending}
        />
      }
    >
      <Field ref={nameRef} label="Name" value={name} onChangeText={setName} placeholder={start.kind === 'photo' ? 'Or use the one on the menu' : home ? 'Friday at ours' : 'Winter menu'} autoFocus={MODAL_AUTOFOCUS} />
      {home ? <HomeNightFields value={night} onChange={setNight} /> : null}
      {buildable.length > 1 ? (
        <>
          <Caption tone="muted">For</Caption>
          <View role="radiogroup" accessibilityLabel="Who the menu is for" style={styles.wrap}>
            {buildable.map((v) => (
              <Choice key={v.id} label={v.name} selected={barId === v.id} onPress={() => pickVenue(v.id)} />
            ))}
          </View>
        </>
      ) : null}
      <Caption tone="muted">Start from</Caption>
      <View role="radiogroup" accessibilityLabel="Start from" style={styles.list}>
        {copyable.map((m) => (
          <Choice
            key={m.id}
            label={`Copy ${m.name}`}
            detail={`${plural(m.itemIds.length, 'drink')}, same sections. Swap what’s changing.`}
            selected={start.kind === 'copy' && start.menuId === m.id}
            onPress={() => setStart({ kind: 'copy', menuId: m.id })}
          />
        ))}
        {layouts.map((l) => (
          <Choice
            key={l.id}
            label={l.name}
            detail={`A saved layout: ${l.sections.map((s) => s.name).join(', ') || 'no sections'}.`}
            selected={start.kind === 'layout' && start.layoutId === l.id}
            onPress={() => setStart({ kind: 'layout', layoutId: l.id })}
          />
        ))}
        <Choice label="From a photo" detail="Read a printed menu: its sections, drinks and prices." selected={start.kind === 'photo'} onPress={() => setStart({ kind: 'photo' })} />
        <Choice label="Blank" detail="One section. Add more as you go." selected={start.kind === 'blank'} onPress={() => setStart({ kind: 'blank' })} />
      </View>
      {start.kind === 'photo' ? <MenuPhotos photos={photos} onChange={setPhotos} onError={setError} /> : null}
      {error ? <Body tone="accent">{error}</Body> : null}
    </MenuSheet>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  list: { gap: space.sm },
});
