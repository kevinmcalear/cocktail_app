import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, GlassButton, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { DrawingBar } from '@/components/ds/DrawingBar';
import { space } from '@/constants/tokens';
import { useUserId } from '@/ctx/AuthContext';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useMenu } from '@/hooks/useMenus';
import { usePhotoTone } from '@/hooks/usePhotoTone';
import type { MenuDetail } from '@/types/menus';

import { useLayoutEditor } from '../useLayoutEditor';
import { EditDesktop } from './EditDesktop';
import { EditPhone } from './EditPhone';
import { EditSheets } from './EditSheets';
import { editLook } from './EditParts';

/**
 * Editing a menu in place (2027 canvas, Menu-who-creator-edit; on the web,
 * Miss-cover-credit-desk): the menu page itself, with a handle, a price box
 * and a minus on each row, a pencil on each section, the name, dates and
 * cover credit in the card under the name, and a glass toolbar (Add drink,
 * Section, Dates, Done). It saves on its own a moment after each change;
 * Done saves what's left and goes back to the page.
 */
export function MenuEditScreen({ menuId }: { menuId: string }) {
  const ds = useDs();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const router = useRouter();
  const userId = useUserId();
  // Edits start from the server's copy, never a cached one: saving writes the
  // whole layout, so a stale start would undo someone else's changes.
  const { data: menu, isLoading, isFetchedAfterMount } = useMenu(menuId, { fresh: true });
  const caps = useCapabilities(menu?.barId);
  const canEdit = menu ? (menu.barId ? Array.isArray(caps.data) && caps.data.includes('menus') : menu.createdBy === userId) : false;
  const checking = isLoading || !isFetchedAfterMount || (!!menu?.barId && caps.isLoading);

  if (!menu || !canEdit || checking) {
    return (
      <View style={[styles.screen, styles.message, { backgroundColor: ds.c.ground, paddingTop: insets.top + space.lg, paddingHorizontal: gutter }]}>
        <GlassButton icon="chevron.left" accessibilityLabel="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace(`/menus/${menuId}`))} />
        <Body tone="muted">
          {checking ? 'Opening the menu…' : !menu ? 'This menu isn’t there any more.' : 'Only people who build menus at this venue can edit it.'}
        </Body>
      </View>
    );
  }
  return (
    <DrawingBar barId={menu.barId}>
      <EditBody key={menu.id} menu={menu} />
    </DrawingBar>
  );
}

function EditBody({ menu }: { menu: MenuDetail }) {
  const router = useRouter();
  const editor = useLayoutEditor(menu, { paste: useLocalSearchParams<{ paste?: string }>().paste === '1' });
  const desktop = useBreakpoint() === 'desktop';
  const { venues } = useActiveVenue();
  const look = editLook(editor, venues.find((v) => v.id === menu.barId)?.name ?? null);
  // As on the page, a cover photo sets the page light or dark (Menu-g-photo-*); the editor shows it while drafting too.
  const cover = desktop ? null : editor.layout.coverUrl;
  const [tone, focused] = [usePhotoTone(cover), useIsFocused()];
  const onDates = () => (look.home ? editor.setSheet({ kind: 'night' }) : void editor.goLive());
  // Done: save what's left, then back to the menu page. A save that can't go keeps you here with why.
  const done = async () => {
    if (!(await editor.persist())) return;
    if (router.canGoBack()) router.back();
    else router.replace(`/menus/${menu.id}`);
  };
  const props = { editor, look, onDates: look.canDate || look.home ? onDates : null, done };
  return (
    <BackbarTheme scheme={cover ? tone : undefined}>
      {cover && focused ? <StatusBar style={tone === 'dark' ? 'light' : 'dark'} /> : null}
      {desktop ? <EditDesktop {...props} /> : <EditPhone {...props} />}
      <EditSheets editor={editor} />
    </BackbarTheme>
  );
}

export type EditViewProps = { editor: ReturnType<typeof useLayoutEditor>; look: ReturnType<typeof editLook>; onDates: (() => void) | null; done: () => Promise<void> };

const styles = StyleSheet.create({
  screen: { flex: 1 },
  message: { gap: space.lg },
});
