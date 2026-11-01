import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { BackbarTheme, useDs } from '@/components/ds';
import { NativeHeader, NativeTitle, useHeaderScroll } from '@/components/nav/NativeHeader';
import { usePageColumn } from '@/components/nav/Page';
import { WebHead } from '@/components/WebHead';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';
import { space } from '@/constants/tokens';

/** A list opened from You: its title in the native header, the page under it. */
export function YouPage({ title, actions, wide, children }: { title: string; actions?: ReactNode; wide?: boolean; children: ReactNode }) {
  return (
    <BackbarTheme>
      <Page title={title} actions={actions} wide={wide}>
        {children}
      </Page>
    </BackbarTheme>
  );
}

function Page({ title, actions, wide, children }: { title: string; actions?: ReactNode; wide?: boolean; children: ReactNode }) {
  const ds = useDs();
  const scroll = useHeaderScroll();
  const column = usePageColumn(wide ? 'wide' : 'text');
  // Wide screens have no header bar, so the page's buttons sit beside its title.
  const bare = useIsWideWeb();
  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <WebHead>
        <title>{title}</title>
      </WebHead>
      <NativeHeader title={title} scroll={scroll} actions={actions} />
      <ScrollView {...scroll.props} contentContainerStyle={[column, styles.body, { paddingBottom: scroll.bottom }]}>
        {bare && actions ? (
          <View style={styles.titled}>
            <View style={styles.flex}>
              <NativeTitle title={title} />
            </View>
            {actions}
          </View>
        ) : (
          <NativeTitle title={title} />
        )}
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { gap: space.lg },
  titled: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md },
  flex: { flex: 1, minWidth: 0 },
});
