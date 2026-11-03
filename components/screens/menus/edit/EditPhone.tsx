import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, DsText, GlassSurface, PressableScale, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { FormScrollContainer } from '@/components/recipe/FormScrollContainer';
import { font, layout, menuCover, radius, space } from '@/constants/tokens';

import { MenuPageHead } from '../page/MenuPageHead';
import { addTarget, CoverButtons, EditGroup, EditSections } from './EditParts';
import type { EditViewProps } from './MenuEditScreen';

/**
 * A phone (and a tablet) editing a menu in place (Menu-who-creator-edit): the
 * page's head with Back and the cover's buttons, the card under the name,
 * the sections, and the glass toolbar over the foot of the page.
 */
export function EditPhone({ editor, look, onDates, done }: EditViewProps) {
  const ds = useDs();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const wide = useBreakpoint() !== 'phone';
  const [barHeight, setBarHeight] = useState(58);
  const { layout: menu } = editor;
  const drinks = menu.sections.flatMap((s) => s.drinks);
  const target = addTarget(editor);
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
          {editor.error ? (
            <Body tone="accent" role="alert">
              {editor.error}
            </Body>
          ) : null}
          <EditGroup editor={editor} look={look} onDates={onDates ?? (() => {})} />
        </View>
        <View style={column}>
          <EditSections editor={editor} ink={look.ink} />
        </View>
      </FormScrollContainer>
      <View onLayout={(e) => setBarHeight(e.nativeEvent.layout.height)} style={[styles.dock, { left: gutter, right: gutter, bottom: insets.bottom + space.lg }]}>
        <GlassSurface style={styles.bar}>
          <View role="toolbar" accessibilityLabel="Edit the menu" style={styles.tools}>
            <Tool label="Add drink" hint="Add a drink to the menu" onPress={target ? () => editor.setSheet({ kind: 'add', key: target }) : undefined} />
            <Tool label="Section" hint="Add a section" onPress={editor.addSection} />
            {onDates ? <Tool label={look.home ? 'Night' : 'Dates'} hint={look.home ? 'The night and who’s coming' : 'When it goes on'} onPress={onDates} /> : null}
            <PressableScale role="button" accessibilityLabel={editor.saving ? 'Saving' : 'Done editing'} disabled={editor.saving} onPress={done} style={[styles.done, { backgroundColor: ds.c.ink }]}>
              <DsText variant="label" color={ds.c.ground} style={font.semiBold}>
                Done
              </DsText>
            </PressableScale>
          </View>
        </GlassSurface>
      </View>
    </View>
  );
}

/** A word in the toolbar. */
export function Tool({ label, hint, onPress }: { label: string; hint: string; onPress?: () => void }) {
  return (
    <PressableScale role="button" accessibilityLabel={label} accessibilityHint={hint} disabled={!onPress} onPress={onPress} style={[styles.tool, !onPress && styles.off]}>
      <DsText variant="label" style={font.semiBold}>
        {label}
      </DsText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  head: { gap: space.lg },
  dock: { position: 'absolute' },
  bar: { borderRadius: radius.pill },
  tools: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 58, paddingLeft: space.md, paddingRight: space.xs + 2 },
  tool: { minHeight: layout.minTapTarget, paddingHorizontal: space.xs, justifyContent: 'center' },
  off: { opacity: 0.4 },
  done: { minHeight: layout.minTapTarget, paddingHorizontal: space.lg, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
