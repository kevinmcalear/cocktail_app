import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Caption, GlassSurface, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { FormScrollContainer } from '@/components/recipe/FormScrollContainer';
import { menuCover, radius, space } from '@/constants/tokens';

import { MenuPageHead } from '../page/MenuPageHead';
import { CoverButtons, EditGroup, EditSections } from './EditParts';
import { EditTools, saveProblem } from './EditTools';
import type { EditViewProps } from './MenuEditScreen';

/**
 * A phone (and a tablet) editing a menu in place (Menu-who-creator-edit): the
 * page's head with Back and the cover's buttons, the card under the name,
 * the sections, and the glass toolbar over the foot of the page.
 */
export function EditPhone(props: EditViewProps) {
  const { editor, look, onDates } = props;
  const ds = useDs();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const wide = useBreakpoint() !== 'phone';
  const [barHeight, setBarHeight] = useState(58);
  const { layout: menu } = editor;
  const drinks = menu.sections.flatMap((s) => s.drinks);
  const problem = saveProblem(editor);
  const column = { paddingHorizontal: gutter, maxWidth: wide ? menuCover.column : undefined, width: '100%', alignSelf: 'center' } as const;
  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <FormScrollContainer contentContainerStyle={{ paddingBottom: insets.bottom + barHeight + space.xxl }}>
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
            onBack={editor.leave}
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
        </View>
      </FormScrollContainer>
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

const styles = StyleSheet.create({
  screen: { flex: 1 },
  head: { gap: space.lg },
  dock: { position: 'absolute' },
  bar: { borderRadius: radius.pill },
  tools: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 58, paddingLeft: space.md, paddingRight: space.xs + 2 },
  problem: { borderRadius: radius.control, paddingHorizontal: space.md, paddingVertical: space.sm, marginBottom: space.sm },
});
