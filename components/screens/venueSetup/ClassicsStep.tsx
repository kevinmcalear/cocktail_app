import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, Chip, DrinkImage, TextLink } from '@/components/ds';
import { bringFiles } from '@/components/screens/onboarding/BringStep';
import { SetupFooter, SetupPage } from '@/components/screens/onboarding/SetupPage';
import { RadioCard } from '@/components/screens/onboarding/SetupParts';
import { space } from '@/constants/tokens';
import { useAddClassicCopies, useVenueClassicCopies } from '@/hooks/useClassics';
import { useDrinkLists } from '@/hooks/useDiscover';
import { pickReadFiles, type ReadFile } from '@/lib/readAnything';
import { starterClassics } from '@/lib/whatNext';

import { StepChrome } from './WhatNextParts';

const SHOWN = 6;

/**
 * "What are you pouring now?" (What next, last step): bring in the menu
 * that's on now (Bring in reads it while setup carries on), or start from 20
 * classics as the venue's own copies, unticking any it doesn't make.
 */
export function ClassicsStep({
  barId,
  onFiles,
  onPaste,
  onDone,
  onSkip,
  onBack,
}: {
  barId: string;
  onFiles: (files: ReadFile[]) => void;
  onPaste: () => void;
  onDone: () => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  const [choice, setChoice] = useState<'bring' | 'classics'>('classics');
  const [off, setOff] = useState<string[]>([]);
  const [all, setAll] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [picked, setPicked] = useState(0);
  const catalog = useDrinkLists();
  const copies = new Set(useVenueClassicCopies(barId).data ?? []);
  // The ones the venue already has a drink of aren't offered again.
  const offered = starterClassics(catalog.data ?? []).filter((c) => !copies.has(c.id));
  const chosen = offered.filter((c) => !off.includes(c.id));
  const add = useAddClassicCopies(barId);
  const failed = add.data?.failed ?? [];
  const flip = (id: string) => setOff((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));
  const bring = async () => {
    setProblem(await bringFiles(pickReadFiles, barId, (files) => {
      setPicked((n) => n + files.length);
      onFiles(files);
    }));
  };

  const footer =
    choice === 'classics' && chosen.length ? (
      <SetupFooter
        label={add.isPending ? `Adding ${chosen.length} classics…` : `Add ${chosen.length} ${chosen.length === 1 ? 'classic' : 'classics'}`}
        pending={add.isPending}
        onPress={() => add.mutate(chosen, { onSuccess: (r) => !r.failed.length && onDone() })}
        skipLabel="Skip"
        onSkip={onSkip}
      />
    ) : (
      <SetupFooter label="Next" onPress={picked ? onDone : onSkip} skipLabel="Skip" onSkip={onSkip} />
    );

  return (
    <StepChrome title="What are you pouring now?" step="menu" onBack={onBack}>
      <SetupPage footer={footer}>
        <RadioCard label="Bring in your current menu" detail="A photo, a PDF or a link. We read it, you check it." selected={choice === 'bring'} onPress={() => setChoice('bring')}>
          {choice === 'bring' ? (
            <View style={styles.actions}>
              <Button label={picked ? `${picked} picked · add more` : 'Photos or a PDF'} variant="secondary" size="sm" onPress={() => void bring()} />
              <Button label="Paste a link" variant="ghost" size="sm" onPress={onPaste} />
            </View>
          ) : null}
        </RadioCard>
        {problem ? <Caption tone="accent">{problem}</Caption> : null}
        {offered.length ? (
          <RadioCard
            label={`Start with ${offered.length} classics`}
            detail="Your own copies, ready to change. Untick any you don’t make."
            selected={choice === 'classics'}
            onPress={() => setChoice('classics')}
          >
            {choice === 'classics' && !all ? (
              <View style={styles.tiles}>
                {offered.slice(0, SHOWN).map((c) => (
                  <View key={c.id} style={styles.tile}>
                    <DrinkImage source={c.imageUrl} itemId={c.id} accessibilityLabel={c.name} thumb sketchDetail="thumb" radius="control" style={off.includes(c.id) ? styles.off : undefined} />
                    <Caption tone="muted" numberOfLines={1}>
                      {c.name}
                    </Caption>
                  </View>
                ))}
              </View>
            ) : null}
          </RadioCard>
        ) : catalog.isSuccess ? (
          <Caption tone="muted">The classics are all in your Library already.</Caption>
        ) : null}
        {choice === 'classics' && offered.length ? (
          all ? (
            <View role="group" aria-label="Classics to add" style={styles.chips}>
              {offered.map((c) => (
                <Chip key={c.id} multi label={c.name} selected={!off.includes(c.id)} onPress={() => flip(c.id)} />
              ))}
            </View>
          ) : (
            <TextLink label={`See all ${offered.length}`} onPress={() => setAll(true)} />
          )
        ) : null}
        {failed.length ? <Caption tone="accent" role="alert">{`Couldn’t add ${failed.join(', ')}. Try again, or add them from Library.`}</Caption> : null}
        {add.error ? <Caption tone="accent" role="alert">Couldn’t add the classics. Check your connection and try again.</Caption> : null}
      </SetupPage>
    </StepChrome>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
  tile: { width: 64, gap: space.xs },
  off: { opacity: 0.35 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
});
