import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassButton, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { useUserId } from '@/ctx/AuthContext';
import { space } from '@/constants/tokens';
import { useBringInMatchData } from '@/hooks/useBringInMatchData';
import { useBringInSave, type BringInSaveInput } from '@/hooks/useBringInSave';
import { useBringInPlace } from '@/hooks/useBringInPlace';
import { emptySummary, sourceLabel } from '@/lib/bringInBatch';
import { startChoices } from '@/lib/bringInDraft';
import { startReview } from '@/lib/importReview';
import { listenBringIn, takeBringIn } from '@/lib/bringInHandoff';
import { snapReadFiles, sourcesFromFiles } from '@/lib/readAnything';
import { askToNudge } from '@/lib/readyNudge';
import { useBringIn, type BringInJob } from '@/store/useBringIn';
import { useDrinkWizardStore, wizardPlace } from '@/store/useDrinkWizardStore';

import { BottlesCheck } from './BottlesCheck';
import { BringInChooser } from './BringInChooser';
import { ImportReview } from './ImportReview';
import { ImportReviewDesk } from './ImportReviewDesk';
import { MenuCheck } from './MenuCheck';
import { ReadingScreen } from './ReadingScreen';
import { RecipeCheck } from './RecipeCheck';
import { ResumeCard } from './ResumeCard';
import { useStartBringIn } from './useStartBringIn';

/** "From a photo", "From a PDF", "From pasted text", "From a link". */
function fromWords(job: BringInJob): string {
  if (job.source.url) return 'From a link';
  const files = job.source.files;
  if (!files.length) return job.source.name ? `From ${job.source.name}` : 'From pasted text';
  if (files.every((f) => f.mimeType === 'application/pdf')) return 'From a PDF';
  return files.length === 1 ? 'From a photo' : `From ${files.length} photos`;
}

/** What a review is called: the file's name, else what it was ("A PDF", "Pasted text"). */
const reviewName = (job: BringInJob) => job.source.name ?? job.source.files.find((f) => f.name)?.name ?? fromWords(job).replace(/^From (\w)/, (_, c: string) => c.toUpperCase());

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
  const userId = useUserId();
  const breakpoint = useBreakpoint();
  const desk = Platform.OS === 'web' && breakpoint === 'desktop';
  // A big import being reviewed: only its own person's, at the place it comes into.
  const review = useBringIn((s) => (s.reviewing ? s.reviews[s.reviewing] : undefined));
  const reviewing = !!review && review.userId === userId ? review : null;
  // The job whose reading has been seen through to its check (opened from the tray when ready, or Reading moved on).
  const [checkedId, setCheckedId] = useState<number | null>(() => (job?.status === 'ready' ? job.id : null));
  const checking = !!job && (job.local || checkedId === job.id);
  const data = useBringInMatchData(job?.barId ?? reviewing?.barId ?? null, !!job || !!reviewing);
  const save = useBringInSave(job?.barId ?? null);
  // Several recipes read: a review, one drink at a time, kept on this device until it's done.
  const recipes = checking && job?.status === 'ready' && job.reading?.kind === 'recipes' && job.reading.recipes.length > 1 ? job.reading.recipes : null;
  useEffect(() => {
    // Once: the job is let go as the review opens.
    if (!recipes || !job || !userId || useBringIn.getState().job?.id !== job.id) return;
    const files = job.source.files;
    const store = useBringIn.getState();
    store.openReview(
      startReview({
        id: `${userId}-${Date.now()}`,
        userId,
        barId: job.barId,
        name: reviewName(job),
        source: sourceLabel('recipes', { files: files.length, pdfs: files.filter((f) => f.mimeType === 'application/pdf').length, link: !!job.source.url }),
        recipes,
        files,
        choices: recipes.map(startChoices),
        summary: emptySummary('recipes'),
        now: new Date().toISOString(),
      })
    );
    store.clear(true);
  }, [recipes, job, userId]);

  // On screen: no tray. Gone: the tray takes over.
  useEffect(() => {
    useBringIn.getState().setForeground(true);
    return () => {
      useBringIn.getState().setForeground(false);
      // Left without Finish later (back, a link): what's left still waits, from the card.
      useBringIn.getState().setReviewing(null);
    };
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
  const finishLater = () => {
    useBringIn.getState().setReviewing(null);
    if (!useBringIn.getState().next(place.barId)) leave();
  };
  const cancel = () => {
    save.reset();
    if (useBringIn.getState().next(place.barId)) return;
    useBringIn.getState().clear();
    leave();
  };

  if (reviewing && !job) {
    if (!data) {
      return (
        <View style={[styles.center, { backgroundColor: ds.c.ground }]}>
          <ActivityIndicator color={ds.accentText} />
        </View>
      );
    }
    return desk ? <ImportReviewDesk id={reviewing.id} data={data} onFinishLater={finishLater} /> : <ImportReview id={reviewing.id} data={data} onFinishLater={finishLater} />;
  }
  if (!job) {
    return (
      <ScrollView style={{ backgroundColor: ds.c.ground }} contentContainerStyle={[styles.page, { paddingTop: insets.top + space.sm, paddingHorizontal: gutter, paddingBottom: insets.bottom + space.xl }]}>
        <GlassButton icon="chevron.left" accessibilityLabel="Back" onPress={leave} />
        <ResumeCard barId={place.barId} here />
        <BringInChooser />
      </ScrollView>
    );
  }
  // Still reading, or read but the catalog it's matched against hasn't come yet (Reading shows how far it's got).
  if (job.status !== 'ready' || (!checking && !job.local) || !data) {
    const background = () => {
      void askToNudge();
      leave();
    };
    // Bottles can be searched for by name instead, where they're added by hand: My Bar's search, or the venue's new bottle.
    const bottles = job.reading?.kind === 'bottles' ? job.reading.bottles : null;
    const searchInstead = () => {
      useBringIn.getState().clear();
      const name = bottles?.[0]?.name;
      if (job.barId) router.replace({ pathname: '/add-ingredient', params: { barId: job.barId, ...(name ? { name } : {}) } });
      else router.replace({ pathname: '/bar', params: { add: 'bottles' } });
    };
    return <ReadingScreen job={job} onClose={cancel} onBackground={background} onReady={() => setCheckedId(job.id)} onSearch={bottles ? searchInstead : undefined} />;
  }
  if (!job.reading || recipes) {
    return (
      <View style={[styles.center, { backgroundColor: ds.c.ground }]}>
        <ActivityIndicator color={ds.accentText} />
      </View>
    );
  }

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

const styles = StyleSheet.create({
  page: { width: '100%', maxWidth: 640, alignSelf: 'center', gap: space.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
