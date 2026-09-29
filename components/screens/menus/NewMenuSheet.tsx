import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';

import { Body, Button, Caption, Field } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useCreateMenu, useMenuLayouts } from '@/hooks/useMenuMutations';
import { useMenu } from '@/hooks/useMenus';
import { blankSection, copySections, type MenuLayout } from '@/lib/menuLayout';
import { focusInModal, MODAL_AUTOFOCUS } from '@/lib/modalAutoFocus';
import { groupMenus, plural } from '@/lib/menus';
import type { MenuSummary } from '@/types/menus';

import { Choice, MenuSheet } from './MenuSheet';

type Start = { kind: 'copy'; menuId: string } | { kind: 'layout'; layoutId: string } | { kind: 'blank' };

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
 * (a copy of another menu, a saved layout, or one empty section).
 */
export function NewMenuSheet({ visible, onClose, menus, now }: NewMenuSheetProps) {
  const router = useRouter();
  const { venues, active } = useActiveVenue();
  const buildable = venues.filter((v) => v.roleLevel >= BUILDS_MENUS);
  const [name, setName] = useState('');
  const nameRef = useRef<TextInput>(null);
  const [barId, setBarId] = useState<string | null>(buildable.some((v) => v.id === active?.id) ? active!.id : (buildable[0]?.id ?? null));
  const venueMenus = menus.filter((m) => m.barId === barId);
  const groups = groupMenus(venueMenus, now);
  const copyable = [...groups.on, ...groups.upcoming, ...groups.draft, ...groups.previous].slice(0, 3);
  const [start, setStart] = useState<Start>(copyable[0] ? { kind: 'copy', menuId: copyable[0].id } : { kind: 'blank' });
  const { data: layouts = [] } = useMenuLayouts(barId);
  const { data: source } = useMenu(start.kind === 'copy' ? start.menuId : null);
  const create = useCreateMenu();
  const [error, setError] = useState<string | null>(null);

  const pickVenue = (id: string | null) => {
    setBarId(id);
    const first = menus.find((m) => m.barId === id);
    setStart(first ? { kind: 'copy', menuId: first.id } : { kind: 'blank' });
  };

  const submit = async () => {
    if (!name.trim()) return setError('Give the menu a name.');
    let layout: MenuLayout = { name, coverUrl: null, coverPosition: 50, sections: [blankSection()] };
    if (start.kind === 'copy') {
      if (!source) return setError('Still loading that menu. Try again in a moment.');
      layout = { name, coverUrl: source.coverUrl, coverPosition: source.coverPosition, sections: copySections(source.sections, true) };
    } else if (start.kind === 'layout') {
      const chosen = layouts.find((l) => l.id === start.layoutId);
      if (chosen?.sections.length) layout = { ...layout, sections: copySections(chosen.sections, false) };
    }
    setError(null);
    try {
      const id = await create.mutateAsync({ barId, layout });
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
      subtitle="It starts as a draft. Nobody sees it until it goes on."
      onShow={MODAL_AUTOFOCUS ? undefined : () => focusInModal(nameRef)}
      footer={<Button label={create.isPending ? 'Making the draft…' : 'Create draft'} size="lg" onPress={submit} disabled={create.isPending} />}
    >
      <Field ref={nameRef} label="Name" value={name} onChangeText={setName} placeholder="Winter menu" autoFocus={MODAL_AUTOFOCUS} />
      <Caption tone="muted">For</Caption>
      <View role="radiogroup" accessibilityLabel="Who the menu is for" style={styles.wrap}>
        {buildable.map((v) => (
          <Choice key={v.id} label={v.name} selected={barId === v.id} onPress={() => pickVenue(v.id)} />
        ))}
        <Choice label="Just me" selected={barId === null} onPress={() => pickVenue(null)} />
      </View>
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
        <Choice label="Blank" detail="One section. Add more as you go." selected={start.kind === 'blank'} onPress={() => setStart({ kind: 'blank' })} />
      </View>
      {error ? <Body tone="accent">{error}</Body> : null}
    </MenuSheet>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  list: { gap: space.sm },
});
