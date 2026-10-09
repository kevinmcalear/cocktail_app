import { useRouter } from 'expo-router';
import { useState } from 'react';

import { Body, Button } from '@/components/ds';
import { useCreateMenu, useDeleteMenu, useEndMenu, useSetMenuKind } from '@/hooks/useMenuMutations';
import { useVenueMenus } from '@/hooks/useMenus';
import { confirmAsync } from '@/lib/dialogs';
import { copySections } from '@/lib/menuLayout';
import { groupMenus } from '@/lib/menus';
import type { MenuDetail, MenuStatus } from '@/types/menus';

import { GoLiveSheet } from './GoLiveSheet';
import { MenuSheet } from './MenuSheet';

interface MenuMoreSheetProps {
  menu: MenuDetail;
  status: MenuStatus;
  visible: boolean;
  onClose: () => void;
}

/**
 * The rest of what you can do with a menu: copy it, put it on or take it off,
 * file a venue's draft under R&D (or back), delete it.
 */
export function MenuMoreSheet({ menu, status, visible, onClose }: MenuMoreSheetProps) {
  const router = useRouter();
  const create = useCreateMenu();
  const end = useEndMenu();
  const remove = useDeleteMenu();
  const setKind = useSetMenuKind();
  const rnd = menu.kind === 'rnd';
  const { data: venueMenus = [] } = useVenueMenus(menu.barId);
  const [goLive, setGoLive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The web confirm dialog renders under a modal, so the sheet steps aside while it asks.
  const [asking, setAsking] = useState(false);
  const [now] = useState(() => Date.now());
  const groups = groupMenus(venueMenus.filter((m) => m.barId === menu.barId && m.id !== menu.id), now);
  const busy = create.isPending || end.isPending || remove.isPending || setKind.isPending;

  const run = async (action: () => Promise<void>) => {
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That didn’t work. Try again.');
    }
  };

  const duplicate = () =>
    run(async () => {
      const id = await create.mutateAsync({
        barId: menu.barId,
        layout: { name: `${menu.name} copy`, coverUrl: menu.coverUrl, coverPosition: menu.coverPosition, sections: copySections(menu.sections, true) },
      });
      onClose();
      router.push(`/menus/${id}/edit`);
    });

  const takeOff = () =>
    run(async () => {
      setAsking(true);
      const ok = await confirmAsync({
        title: status === 'on' ? `Take ${menu.name} off?` : `Unschedule ${menu.name}?`,
        message: status === 'on' ? 'It moves to Previous. You can put it on again later.' : 'It goes back to being a draft.',
        confirmText: status === 'on' ? 'Take off' : 'Unschedule',
      });
      setAsking(false);
      if (!ok) return;
      await end.mutateAsync(menu.id);
      onClose();
    });

  const file = () =>
    run(async () => {
      await setKind.mutateAsync({ menuId: menu.id, kind: rnd ? 'menu' : 'rnd' });
      onClose();
    });

  const destroy = () =>
    run(async () => {
      setAsking(true);
      const ok = await confirmAsync({
        title: `Delete ${menu.name}?`,
        message: 'The menu goes for good. Its drinks stay in the library.',
        confirmText: 'Delete',
        destructive: true,
      });
      setAsking(false);
      if (!ok) return;
      await remove.mutateAsync(menu.id);
      onClose();
      router.replace('/menus/all');
    });

  if (goLive) {
    return (
      <GoLiveSheet
        visible
        onClose={() => setGoLive(false)}
        menu={menu}
        others={[...groups.on, ...groups.upcoming]}
        onDone={() => {
          setGoLive(false);
          onClose();
        }}
      />
    );
  }

  return (
    <MenuSheet visible={visible && !asking} onClose={onClose} title={menu.name}>
      <Button label="Duplicate as a new draft" icon="doc.on.doc" variant="secondary" onPress={duplicate} disabled={busy} />
      {rnd ? null : status === 'on' || status === 'upcoming' ? (
        <Button label={status === 'on' ? 'Take it off now' : 'Unschedule'} icon="xmark" variant="secondary" onPress={takeOff} disabled={busy} />
      ) : (
        <Button label={status === 'draft' ? 'Go live…' : 'Put it on again…'} icon="play.fill" variant="secondary" onPress={() => setGoLive(true)} disabled={busy} />
      )}
      {menu.barId && (rnd || status === 'draft') ? (
        <Button label={rnd ? 'Move back to drafts' : 'File under R&D'} icon="flask" variant="secondary" onPress={file} disabled={busy} />
      ) : null}
      <Button label="Delete menu" icon="trash" variant="ghost" onPress={destroy} disabled={busy} />
      {error ? <Body tone="accent">{error}</Body> : null}
    </MenuSheet>
  );
}
