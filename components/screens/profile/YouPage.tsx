import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { BackbarTheme, useDs } from '@/components/ds';
import { NativeHeader, NativeTitle, useHeaderScroll } from '@/components/nav/NativeHeader';
import { usePageColumn } from '@/components/nav/Page';
import { WebHead } from '@/components/WebHead';
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
  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <WebHead>
        <title>{title}</title>
      </WebHead>
      <NativeHeader title={title} scroll={scroll} actions={actions} />
      <ScrollView {...scroll.props} contentContainerStyle={[column, styles.body, { paddingBottom: scroll.bottom }]}>
        <NativeTitle title={title} />
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { gap: space.lg },
});
