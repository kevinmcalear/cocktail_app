import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassButton, useDs, useGutter } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useBringInMatchData } from '@/hooks/useBringInMatchData';
import { useBringInSave, type BringInSaveInput } from '@/hooks/useBringInSave';
import { useBringInPlace } from '@/hooks/useBringInPlace';
import { sourceLabel } from '@/lib/bringInBatch';
import { plainTitle } from '@/lib/importReview';
import { listenBringIn, takeBringIn } from '@/lib/bringInHandoff';
import { snapReadFiles, sourcesFromFiles } from '@/lib/readAnything';
import { askToNudge } from '@/lib/readyNudge';
import { useBringIn, type BringInJob } from '@/store/useBringIn';
import { useDrinkWizardStore, wizardPlace } from '@/store/useDrinkWizardStore';
import { useImportReview, useReviewsLoaded } from '@/store/useImportReview';

import { BottlesCheck } from './BottlesCheck';
import { BringInChooser } from './BringInChooser';
import { ImportReview } from './ImportReview';
import { MenuCheck } from './MenuCheck';
import { ReadingScreen } from './ReadingScreen';
import { RecipeCheck } from './RecipeCheck';
import { useStartBringIn } from './useStartBringIn';

/** "From a photo", "From a PDF", "From pasted text", "From a link". */
function fromWords(job: BringInJob): string {
  if (job.source.url) return 'From a link';
  const files = job.source.files;
  if (!files.length) return job.source.name ? `From ${job.source.name}` : 'From pasted text';
  if (files.every((f) => f.mimeType === 'application/pdf')) return 'From a PDF';
  return files.length === 1 ? 'From a photo' : `From ${files.length} photos`;
}

/**
 * /bring-in: what's being brought in, from reading to check. With nothing
 * given yet it's the ways in, as a page; things handed over by other screens
 * (onboarding, a menu's "finish in Bring in", a drop) start reading here.
 */
export function BringInFlow() {
  const ds = useDs();
  const router = useRouter();
  const gutter = useGutter();
  const insets = useSafeAreaInsets();
  const place = useBringInPlace();
  const start = useStartBringIn();
  const job = useBringIn((s) => s.job);
  // The job whose reading has been seen through to its check (opened from the tray when ready, or Reading moved on).
  const [checkedId, setCheckedId] = useState<number | null>(() => (job?.status === 'ready' ? job.id : null));
  const checking = !!job && (job.local || checkedId === job.id);
  const data = useBringInMatchData(job?.barId ?? null, !!job);
  const save = useBringInSave(job?.barId ?? null);
  // A big import (more than one recipe) is checked as a review that's kept on this device.
  const reviewId = useLocalSearchParams<{ review?: string }>().review ?? null;
  const review = useImportReview((s) => (reviewId ? s.reviews[reviewId] : undefined));
  const loaded = useReviewsLoaded();
  const many = !!job && job.status === 'ready' && (job.local || checking) && job.reading?.kind === 'recipes' && job.reading.recipes.length > 1;

  // On screen: no tray. Gone: the tray takes over.
  useEffect(() => {
    useBringIn.getState().setForeground(true);
    return () => useBringIn.getState().setForeground(false);
  }, []);
  // Handed over by another screen: text to check, or files to read.
  useEffect(() => {
    const text = takeBringIn();
    if (text) start([{ files: [], text, url: null }], { barId: place.barId });
    return listenBringIn((delivery) => {
      if ('text' in delivery) start([{ files: [], text: delivery.text, url: null }], { barId: place.barId });
      else void sourcesFromFiles(delivery.files, true).then((sources) => start(sources, { barId: place.barId }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)' as Href));

  useEffect(() => {
    if (!many || !job?.reading) return;
    const files = job.source.files;
    const id = useImportReview.getState().begin({
      barId: job.barId,
      title: files[0]?.name ? plainTitle(files[0].name) : job.source.name ? plainTitle(job.source.name) : `${job.reading.recipes.length} recipes`,
      source: sourceLabel('recipes', { files: files.length, pdfs: files.filter((f) => f.mimeType === 'application/pdf').length, link: !!job.source.url }),
      from: fromWords(job),
      recipes: job.reading.recipes,
      files,
    });
    useBringIn.getState().clear(true);
    router.setParams({ review: id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [many]);
  const cancel = () => {
    save.reset();
    if (useBringIn.getState().next(place.barId)) return;
    useBringIn.getState().clear();
    leave();
  };

  if (reviewId && !job) {
    if (review) return <ImportReview review={review} onLeave={leave} />;
    if (!loaded) return <Waiting />;
  }
  if (many) return <Waiting />;
  if (!job) {
    return (
      <ScrollView style={{ backgroundColor: ds.c.ground }} contentContainerStyle={[styles.page, { paddingTop: insets.top + space.sm, paddingHorizontal: gutter, paddingBottom: insets.bottom + space.xl }]}>
        <GlassButton icon="chevron.left" accessibilityLabel="Back" onPress={leave} />
        <BringInChooser />
      </ScrollView>
    );
  }
  if (job.status !== 'ready' || (!checking && !job.local)) {
    const background = () => {
      void askToNudge();
      leave();
    };
    return <ReadingScreen job={job} onClose={cancel} onBackground={background} onReady={() => setCheckedId(job.id)} />;
  }
  if (!data || !job.reading) return <Waiting />;

  const reading = job.reading;
  const files = job.source.files;
  const source = sourceLabel(reading.kind, { files: files.length, pdfs: files.filter((f) => f.mimeType === 'application/pdf').length, link: !!job.source.url });
  const run = (input: BringInSaveInput) =>
    save.mutate(input, {
      onSuccess: (done) => {
        useBringIn.getState().setDone(done);
        useBringIn.getState().clear(true);
        router.replace((done.batchId ? `/bring-in/done?batch=${done.batchId}` : '/bring-in/done') as Href);
      },
    });
  const error = save.error ? save.error.message : null;

  if (reading.kind === 'menu') {
    return (
      <MenuCheck
        reading={reading}
        files={files}
        data={data}
        name={job.menu?.name || null}
        saving={save.isPending}
        error={error}
        onCancel={cancel}
        onSave={({ name, rows, prices }) => run({ kind: 'menu', source, name, night: job.menu?.night ?? null, rows, prices })}
      />
    );
  }
  if (reading.kind === 'bottles') {
    return (
      <BottlesCheck
        reading={reading}
        files={files}
        data={data}
        where={job.barId ? (place.venueName ?? 'the venue') : 'My Bar'}
        saving={save.isPending}
        error={error}
        onCancel={cancel}
        onRetake={() => void snapReadFiles().then((more) => useBringIn.getState().addPages(more))}
        onSave={(bottles) => run({ kind: 'bottles', source, ...bottles })}
      />
    );
  }
  return (
    <RecipeCheck
      recipe={reading.recipes[0]}
      files={files}
      from={fromWords(job)}
      data={data}
      saving={save.isPending}
      error={error}
      onCancel={cancel}
      onSave={(drink) => run({ kind: 'recipes', source, drinks: [drink] })}
      onEditAll={({ draft }) => {
        // The full editor: the add-drink wizard, filled in, at its review.
        const wizardAt = wizardPlace(job.barId);
        const wizard = useDrinkWizardStore.getState();
        wizard.clear(wizardAt);
        wizard.patch(wizardAt, draft);
        wizard.setStep(wizardAt, 'review');
        useBringIn.getState().clear(true);
        router.replace((job.barId ? `/add-cocktail?barId=${job.barId}` : '/add-cocktail') as Href);
      }}
    />
  );
}

function Waiting() {
  const ds = useDs();
  return (
    <View style={[styles.center, { backgroundColor: ds.c.ground }]}>
      <ActivityIndicator color={ds.accentText} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { width: '100%', maxWidth: 640, alignSelf: 'center', gap: space.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
