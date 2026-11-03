import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, DateField, PressableScale, useDs, useToast, type IconName } from '@/components/ds';
import { PopoverMenu, type Anchor } from '@/components/ds/PopoverMenu';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space, STATUS } from '@/constants/tokens';
import { useCanDeleteDrink } from '@/hooks/useCocktails';
import { useCreateMenu, useSaveLayout, useSetMenuEnd } from '@/hooks/useMenuMutations';
import { readableAccent } from '@/lib/color';
import { itemHref } from '@/lib/itemRoutes';
import { copySections } from '@/lib/menuLayout';
import type { MenuDrink } from '@/types/menus';

import { MenuSheet } from '../MenuSheet';
import type { LayoutEditor } from '../useLayoutEditor';

/** One action in an editor sheet: an icon, its words, a chevron when it opens more. Delete is red. */
function Action({ icon, label, onPress, more, danger, disabled }: { icon: IconName; label: string; onPress: () => void; more?: boolean; danger?: boolean; disabled?: boolean }) {
  const ds = useDs();
  const ink = danger ? readableAccent(STATUS.danger, ds.c.ground) : ds.c.ink;
  return (
    <PressableScale role="button" accessibilityLabel={label} onPress={onPress} disabled={disabled} style={[styles.action, { borderBottomColor: ds.c.lineStrong }, disabled && styles.off]}>
      <View style={[styles.icon, { backgroundColor: ds.c.raised }]}>
        <IconSymbol name={icon} size={18} color={ink} />
      </View>
      <Body color={ink} style={styles.flex}>
        {label}
      </Body>
      {more ? <IconSymbol name="chevron.right" size={14} color={ds.c.muted} /> : null}
    </PressableScale>
  );
}

const CATEGORY = { cocktail: 'Cocktail', beer: 'Beer', wine: 'Wine' } as const;

/**
 * A row's menu (tap a drink while editing): Move to another section, Open the
 * drink, Move to top, and for the drink's own people Delete drink, with Undo.
 */
export function RowMenuSheet({ editor, sectionKey, drink, onClose }: { editor: LayoutEditor; sectionKey: string; drink: MenuDrink; onClose: () => void }) {
  const router = useRouter();
  const [moving, setMoving] = useState(false);
  const canDelete = useCanDeleteDrink(drink.id);
  const section = editor.section(sectionKey);
  const index = section?.drinks.findIndex((d) => d.id === drink.id) ?? -1;
  const others = editor.layout.sections.filter((s) => s.key !== sectionKey);
  const then = (fn: () => void) => () => {
    onClose();
    fn();
  };
  return (
    <MenuSheet visible onClose={onClose} title={moving ? `Move ${drink.name} to` : drink.name} subtitle={moving ? undefined : section?.name} plain>
      {moving ? (
        <View>
          <Action icon="chevron.left" label="Back" onPress={() => setMoving(false)} />
          {others.map((s) => (
            <Action key={s.key} icon="arrow.turn.down.right" label={s.name || 'Untitled section'} onPress={then(() => editor.moveTo(sectionKey, drink.id, s.key))} />
          ))}
        </View>
      ) : (
        <View>
          {others.length ? <Action icon="arrow.turn.down.right" label="Move to another section" more onPress={() => setMoving(true)} /> : null}
          <Action icon="arrow.up.right.square" label="Open the drink" onPress={then(() => router.push(itemHref(CATEGORY[drink.kind], drink.id) as never))} />
          {index > 0 ? <Action icon="arrow.up.to.line" label="Move to top" onPress={then(() => editor.move(sectionKey, index, 0))} /> : null}
          {canDelete ? <Action icon="trash" label="Delete drink" danger onPress={then(() => editor.deleteDrink(drink))} /> : null}
        </View>
      )}
    </MenuSheet>
  );
}

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** The last day a menu is on, from when it comes off (the start of the next day). */
export const lastDay = (endsAt: string) => new Date(Date.parse(endsAt) - 1);

/**
 * Ends (the card under the name): the last day the menu is on, or no end
 * date. It comes off at the start of the next day. A dated menu's end is its
 * ends_at; a draft's, its planned end.
 */
export function EndsSheet({ editor, onClose }: { editor: LayoutEditor; onClose: () => void }) {
  const { menu } = editor;
  const set = useSetMenuEnd();
  const end = menu.startsAt ? menu.endsAt : menu.plannedEndsAt;
  const [day, setDay] = useState(end ? ymd(lastDay(end)) : '');
  const [error, setError] = useState<string | null>(null);
  const start = menu.startsAt ?? menu.plannedStartsAt;
  const [today] = useState(() => ymd(new Date()));
  const min = start && ymd(new Date(start)) > today ? ymd(new Date(start)) : today;
  const save = async () => {
    setError(null);
    let endsAt: string | null = null;
    if (day) {
      const next = new Date(`${day}T00:00`);
      next.setDate(next.getDate() + 1);
      endsAt = next.toISOString();
    }
    try {
      await set.mutateAsync({ menuId: menu.id, endsAt, dated: !!menu.startsAt });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That didn’t save. Try again.');
    }
  };
  return (
    <MenuSheet visible onClose={onClose} title="Ends" save={{ label: set.isPending ? 'Saving…' : 'Save', onPress: save, disabled: set.isPending }}>
      <DateField label="Last day on" value={day} onChange={setDay} min={min} clearable placeholder="No end date" hint="It comes off at the start of the next day. Leave it empty and it stays on." />
      {error ? (
        <Caption tone="accent" role="alert">
          {error}
        </Caption>
      ) : null}
    </MenuSheet>
  );
}

/**
 * The desktop editor's ... (Miss-cover-credit-desk): a menu hung from the
 * button, Save layout for next time and Duplicate, with what saving a layout
 * keeps under them. A home menu has no layouts, so only Duplicate.
 */
export function EditMoreMenu({ editor, anchor, onClose }: { editor: LayoutEditor; anchor: Anchor | null; onClose: () => void }) {
  const ds = useDs();
  const router = useRouter();
  const toast = useToast();
  const saveLayout = useSaveLayout();
  const create = useCreateMenu();
  const home = !editor.menu.barId;
  const keepLayout = async () => {
    try {
      await saveLayout.mutateAsync({ name: `${editor.layout.name.trim()} layout`, sections: editor.layout.sections });
      toast.show({ title: 'Layout saved for your next menu' });
    } catch (e) {
      toast.show({ title: e instanceof Error ? e.message : 'Couldn’t save the layout.' });
    }
  };
  const duplicate = async () => {
    try {
      const { layout: l } = editor;
      const id = await create.mutateAsync({ barId: editor.menu.barId, layout: { ...l, name: `${l.name} copy`, sections: copySections(l.sections, true) } });
      router.replace(`/menus/${id}/edit`);
    } catch (e) {
      toast.show({ title: e instanceof Error ? e.message : 'Couldn’t copy the menu.' });
    }
  };
  const icon = (name: IconName) => (
    <View style={[styles.icon, { backgroundColor: ds.c.raised }]}>
      <IconSymbol name={name} size={16} color={ds.c.ink} />
    </View>
  );
  return (
    <PopoverMenu
      anchor={anchor}
      label={`More for ${editor.layout.name || 'this menu'}`}
      onClose={onClose}
      sections={[
        {
          items: [
            ...(home ? [] : [{ label: 'Save layout for next time', leading: icon('rectangle.stack'), onPress: () => void keepLayout() }]),
            { label: 'Duplicate', leading: icon('doc.on.doc'), onPress: () => void duplicate() },
          ],
        },
      ]}
      footer={home ? undefined : <Caption tone="muted">Save layout keeps the sections and their rules, to start the next menu from.</Caption>}
    />
  );
}

const styles = StyleSheet.create({
  action: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, borderBottomWidth: StyleSheet.hairlineWidth },
  icon: { width: 36, height: 36, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  off: { opacity: 0.5 },
});
