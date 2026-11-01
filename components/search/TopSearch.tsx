import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassButton, useDs, useGutter } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useKeyboardHeight } from '@/hooks/useKeyboardInset';

import { DISMISS, PlaceRow, type SearchTabState } from './BottomSearch';
import { SearchField } from './SearchField';
import { SearchBody, searchPlaceholder } from './SearchPanel';

/**
 * Android's search, the /search page over the tabs: the search bar on top of
 * a tab's page (ScreenHeader.tsx) opens into its field in the same place,
 * with Back beside it and the place row under it, as Material's search view
 * does; results scroll below.
 */
export function TopSearch({ query, setQuery, scope, setScope, mine, area, onShowOnMap, focused, show, setShow, counts, setCounts }: SearchTabState) {
  const ds = useDs();
  const gutter = useGutter();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const keyboard = useKeyboardHeight();
  const back = () => (router.canGoBack() ? router.back() : router.navigate('/'));
  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <View style={[styles.top, { paddingTop: insets.top + space.sm }]}>
        <View style={[styles.field, { paddingHorizontal: gutter }]}>
          <GlassButton icon="chevron.left" accessibilityLabel="Back" onPress={back} />
          <View style={styles.screen}>
            <SearchField query={query} onQuery={setQuery} placeholder={searchPlaceholder(scope, mine, area)} autoFocus={focused} />
          </View>
        </View>
        <PlaceRow query={query} scope={scope} setScope={setScope} mine={mine} area={area} show={show} setShow={setShow} counts={counts} />
      </View>
      <ScrollView
        style={styles.screen}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={DISMISS}
        contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: space.md, paddingBottom: Math.max(keyboard, insets.bottom) + space.lg, gap: space.lg }}
      >
        <SearchBody query={query} scope={scope} onScope={setScope} mine={mine} area={area} onShowOnMap={onShowOnMap} show={show} onShow={setShow} onCounts={setCounts} typeAhead={setQuery} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, minWidth: 0 },
  top: { gap: space.sm },
  field: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
