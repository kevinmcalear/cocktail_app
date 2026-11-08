import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useEffectEvent, useRef, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { useBreakpoint, useDs } from '@/components/ds';
import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { radius, space } from '@/constants/tokens';
import { BeerWineDraftEditScreen } from '@/components/screens/drink/edit/BeerWineEditScreen';
import type { DrinkKind } from '@/lib/drinkKinds';
import { useMenuDrinkHandoff } from '@/store/useMenuDrinkHandoff';

import { AddBeerWineWizard } from './AddBeerWineWizard';

export interface AddDrinkProps {
  isInline?: boolean;
  draftIdProp?: string;
  barIdProp?: string;
  initialNameProp?: string;
  onClose?: () => void;
  onSave?: () => void;
}

/**
 * /add-beer and /add-wine: a new one is added with the step-by-step wizard
 * (full page and in the workspace); a draft saved by the older editor opens
 * on the drink edit page.
 */
export function AddBeerWineRoute({ kind, ...props }: AddDrinkProps & { kind: DrinkKind }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ barId?: string; draftId?: string; name?: string; menuSectionId?: string }>();
  const draftId = props.draftIdProp !== undefined ? props.draftIdProp : params.draftId;
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const barId = (props.barIdProp !== undefined ? props.barIdProp : params.barId) || null;
  const initialName = props.initialNameProp !== undefined ? props.initialNameProp : params.name;
  const desktop = useBreakpoint() === 'desktop';
  const dialog = Platform.OS === 'web' && desktop && !props.isInline;
  // The dialog's Escape and scrim close as the X does, through the wizard (Leave it for now).
  const closeRef = useRef<(() => void) | null>(null);
  if (draftId) return <BeerWineDraftEditScreen kind={kind} draftId={draftId} barId={barId} initialName={initialName} onExit={props.onClose ?? goBack} />;

  const wizard = (
    <AddBeerWineWizard
      kind={kind}
      barId={barId}
      initialName={initialName}
      embedded={!!props.isInline || dialog}
      closeRef={closeRef}
      onClose={props.onClose ?? goBack}
      onSaved={(id) => {
        if (props.onSave) props.onSave();
        else if (params.menuSectionId) {
          // Made from a menu section: back to the menu editor, which puts it in that section.
          useMenuDrinkHandoff.getState().deliver(params.menuSectionId, id);
          goBack();
        } else router.replace(`/${kind}/${id}`);
      }}
    />
  );
  if (props.isInline) return wizard;
  return <VenueBrandProvider>{dialog ? (
        <WebDialog label={`Add a ${kind}`} onClose={() => closeRef.current?.()}>
          {wizard}
        </WebDialog>
      ) : (
        wizard
      )}</VenueBrandProvider>;
}

/** The web on a wide window (Add-beer, Web 1 of 7): the steps in a 600 dialog in the middle, over a scrim. */
// ponytail: a route, not a ds Sheet, because Sheet's close asks "Discard changes?" and this asks Leave it for now (Kevin, 8 Nov); move it onto Sheet if Sheet learns to hand its close to its content.
function WebDialog({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  const ds = useDs();
  const escape = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  });
  useEffect(() => {
    const listener = (e: KeyboardEvent) => escape(e);
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, []);
  return (
    <View style={[styles.scrim, { backgroundColor: ds.c.scrim }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" tabIndex={-1} />
      <View role="dialog" aria-modal aria-label={label} style={[styles.dialog, { backgroundColor: ds.c.ground, borderColor: ds.c.line }]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  dialog: { width: '100%', maxWidth: 600, height: '100%', maxHeight: 860, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
});
