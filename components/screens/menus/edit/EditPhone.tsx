import { useState } from 'react';
import { StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Caption, GlassSurface, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { FormScrollContainer } from '@/components/recipe/FormScrollContainer';
import { menuCover, radius, space } from '@/constants/tokens';

import { MenuPageHead } from '../page/MenuPageHead';
import { MenuTopBar } from '../page/MenuTopBar';
import { CoverButtons, EditAfter, EditGroup, EditSections } from './EditParts';
import { EditTools, saveProblem } from './EditTools';
import type { EditViewProps } from './MenuEditScreen';

/**
 * A phone (and a tablet) editing a menu in place (Menu-who-creator-edit): the
 * page's head with the cover's buttons, the card under the name, the
 * sections, and the glass toolbar over the foot of the page. Back stays put
 * while the page scrolls, as on the menu page (MenuTopBar): past the hero
 * the bar takes a backing and the menu's name.
 */
export function EditPhone(props: EditViewProps) {
  const { editor, look, onDates } = props;
  const ds = useDs();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const wide = useBreakpoint() !== 'phone';
  const [barHeight, setBarHeight] = useState(58);
  const [collapsed, setCollapsed] = useState(false);
  const track = (e: NativeSyntheticEvent<NativeScrollEvent>) => setCollapsed(e.nativeEvent.contentOffset.y > COLLAPSE_AT);
  const { layout: menu } = editor;
  const drinks = menu.sections.flatMap((s) => s.drinks);
  const problem = saveProblem(editor);
  const column = { paddingHorizontal: gutter, maxWidth: wide ? menuCover.column : undefined, width: '100%', alignSelf: 'center' } as const;
  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <FormScrollContainer
        // ponytail: on a phone the drag lists' container keeps onScroll for itself, so the bar changes when a scroll settles; a live change wants the container's scroll offset (outerScrollOffset).
        onScroll={track}
        onScrollEndDrag={track}
        onMomentumScrollEnd={track}
        scrollEventThrottle={32}
        contentContainerStyle={{ paddingBottom: insets.bottom + barHeight + space.xxl }}>
        <View style={[column, styles.head]}>
          <MenuPageHead
            heroIds={drinks.slice(0, 3).map((d) => d.id)}
            coverUrl={menu.coverUrl}
            coverCredit={menu.coverCredit?.trim() || null}
            name={menu.name.trim() || 'Untitled menu'}
            ink={look.ink}
            quiet={look.ink !== 'colour'}
            tag={look.tag}
            eyebrow={look.eyebrow}
            description={editor.menu.description}
            onBack={null}
            onShare={null}
            pill={null}
            bleed={gutter}
            top={insets.top}
            over={<CoverButtons editor={editor} onMedia={!!menu.coverUrl && ds.scheme === 'dark'} />}
          />
          <EditGroup editor={editor} look={look} onDates={onDates ?? (() => {})} />
        </View>
        <View style={column}>
          <EditSections editor={editor} ink={look.ink} />
          <EditAfter editor={editor} />
        </View>
      </FormScrollContainer>
      <View pointerEvents="box-none" style={styles.pinned}>
        <MenuTopBar onBack={editor.leave} onShare={null} pill={null} onMedia={!!menu.coverUrl && ds.scheme === 'dark' && !collapsed} collapsed={collapsed ? { title: menu.name.trim() || 'Untitled menu' } : null} top={insets.top} gutter={gutter} />
      </View>
      <View onLayout={(e) => setBarHeight(e.nativeEvent.layout.height)} style={[styles.dock, { left: gutter, right: gutter, bottom: insets.bottom + space.lg }]}>
        {problem ? (
          <GlassSurface style={styles.problem}>
            <Caption role="alert" tone="accent" numberOfLines={2}>{`Not saved: ${problem}`}</Caption>
          </GlassSurface>
        ) : null}
        <GlassSurface style={styles.bar}>
          <View role="toolbar" accessibilityLabel="Edit the menu" style={styles.tools}>
            <EditTools {...props} />
          </View>
        </GlassSurface>
      </View>
    </View>
  );
}

/** Scrolled this far, the hero has gone under the bar (as MenuScreen). */
const COLLAPSE_AT = 200;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  head: { gap: space.lg },
  dock: { position: 'absolute' },
  pinned: { position: 'absolute', top: 0, left: 0, right: 0 },
  bar: { borderRadius: radius.pill },
  tools: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 58, paddingLeft: space.md, paddingRight: space.xs + 2 },
  problem: { borderRadius: radius.control, paddingHorizontal: space.md, paddingVertical: space.sm, marginBottom: space.sm },
});
