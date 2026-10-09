import { useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Button, Caption, Field, GlassButton, Headline, LockedSection, ReviewRow, Segmented, useDs, useGutter } from '@/components/ds';
import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { space } from '@/constants/tokens';
import { useBringIn, useSpecCatalog } from '@/hooks/useBulk';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useHereVenue } from '@/hooks/useMode';
import { isLink } from '@/lib/bringInAnywhere';
import { takeBringIn } from '@/lib/bringInHandoff';
import { stageMenuPhotos } from '@/lib/menuPhotoHandoff';
import type { BottleReading } from '@/lib/readBottle';
import type { IngredientAlias } from '@/lib/ingredientNames';
import { matchIngredient, matchKey, type CatalogItem } from '@/lib/match';
import { compileBringIn, parseBringIn, type BringBlock } from '@/lib/paste';

import { BottlePhotoSheet } from '../bottles/BottlePhotoSheet';
import { BringInRead, type BringInReadResult } from './BringInRead';

type Mode = 'drinks' | 'ingredients';

function lineKey(block: number, line: number): string {
  return `${block}:${line}`;
}

/** What a pasted list will create, and the choices still open. */
function Review({
  blocks,
  catalog,
  aliases,
  venueId,
  picks,
  kinds,
  onPick,
  onKind,
}: {
  blocks: BringBlock[];
  catalog: CatalogItem[];
  aliases: readonly IngredientAlias[];
  venueId: string | null;
  picks: Record<string, string>;
  kinds: Record<string, string>;
  onPick: (key: string, id: string) => void;
  onKind: (key: string, value: string) => void;
}) {
  const shown = new Set<string>();
  return (
    <View style={{ gap: space.md }}>
      {blocks.map((block, i) => (
        <View key={`${block.name}-${i}`} style={{ gap: space.sm }}>
          {block.kind === 'bottle' ? null : <Headline>{block.name || 'Needs a name'}</Headline>}
          {block.kind === 'bottle' ? <Bottle name={block.name} catalog={catalog} aliases={aliases} venueId={venueId} pickKey={lineKey(i, 0)} picks={picks} kinds={kinds} shown={shown} onPick={onPick} onKind={onKind} /> : null}
          {block.lines.map((line, j) => (
            <Line key={lineKey(i, j)} name={line.name} amount={line.amount === null ? '' : `${line.amount} ${line.unit}`} catalog={catalog} aliases={aliases} venueId={venueId} pickKey={lineKey(i, j)} picks={picks} kinds={kinds} shown={shown} onPick={onPick} onKind={onKind} />
          ))}
          {block.notes.map((note) => (
            <Caption key={note} tone="muted">
              {note}
            </Caption>
          ))}
        </View>
      ))}
    </View>
  );
}

function Bottle(props: Omit<LineProps, 'amount'>) {
  return <Line {...props} amount="" />;
}

interface LineProps {
  name: string;
  amount: string;
  catalog: CatalogItem[];
  aliases: readonly IngredientAlias[];
  venueId: string | null;
  pickKey: string;
  picks: Record<string, string>;
  kinds: Record<string, string>;
  shown: Set<string>;
  onPick: (key: string, id: string) => void;
  onKind: (key: string, value: string) => void;
}

function Line({ name, amount, catalog, aliases, venueId, pickKey, picks, kinds, shown, onPick, onKind }: LineProps) {
  const match = matchIngredient(name, catalog, venueId, aliases);
  const label = name.trim();
  if (match.kind === 'one') return <ReviewRow state="have" amount={amount} title={label} detail="In the library" />;
  if (match.kind === 'pick') {
    const chosen = match.items.some((item) => item.id === picks[pickKey]) ? picks[pickKey] : null;
    return (
      <ReviewRow
        state={chosen ? 'have' : 'pick'}
        amount={amount}
        title={label}
        detail={chosen ? 'In the library' : 'Which one?'}
        choices={match.items.map((item) => ({ id: item.id, label: item.name }))}
        chosen={chosen}
        onChoose={(id) => onPick(pickKey, id)}
      />
    );
  }
  const key = matchKey(label);
  const kindField = !shown.has(key);
  if (kindField) shown.add(key);
  return (
    <ReviewRow state="new" amount={amount} title={label} detail="New">
      {kindField ? (
        <Field label={`Kind of ${label}`} value={key in kinds ? kinds[key] : (match.kindItem?.name ?? '')} onChangeText={(value) => onKind(key, value)} placeholder="Gin" autoCapitalize="words" />
      ) : null}
    </ReviewRow>
  );
}

function BringInBody() {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  // At home, things come in to your own bar, never to the venue you were last at.
  const active = useHereVenue();
  const barId = active?.id ?? null;
  const caps = useCapabilities(barId);
  const canEdit = !barId || !!caps.data?.includes('edit_drinks');
  const { catalog, aliases, methods, glasses, isLoading } = useSpecCatalog();
  const bring = useBringIn(barId);
  const [mode, setMode] = useState<Mode>('drinks');
  const [text, setText] = useState(() => takeBringIn() ?? '');
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [kinds, setKinds] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [lastRead, setLastRead] = useState<BringInReadResult | null>(null);
  const [bottles, setBottles] = useState<BottleReading[] | null>(null);
  // A lone link is read with "Read this link", never added as a drink called that link.
  const blocks = useMemo(() => (isLink(text) ? [] : parseBringIn(text, mode)), [text, mode]);
  const compiled = useMemo(() => compileBringIn(blocks, catalog, barId, picks, kinds, methods, glasses, aliases), [blocks, catalog, barId, picks, kinds, methods, glasses, aliases]);
  const count = (compiled.write?.creates.length ?? 0) + (compiled.write?.items.length ?? 0);

  const save = async () => {
    if (!compiled.write) return;
    setMessage(null);
    const result = await bring.mutateAsync(compiled.write);
    if (result.error) setMessage(result.error);
    else router.back();
  };

  const onRead = (result: BringInReadResult, replace: boolean) => {
    // A menu goes to the menu check, bottles to the shelf check; recipes stay here.
    if (result.reading.kind === 'menu' && result.reading.menu) {
      stageMenuPhotos({ photos: result.files, barId, name: '', reading: result.reading.menu });
      router.push('/menus/from-photo' as Href);
      return;
    }
    if (result.reading.kind === 'bottles') {
      setBottles(result.reading.bottles);
      return;
    }
    const fresh = replace || mode !== 'drinks' || !text.trim();
    setMode('drinks');
    setText(fresh ? result.text : `${text.trim()}\n\n${result.text}`);
    if (fresh) {
      setPicks({});
      setKinds({});
    }
    setLastRead(result);
  };

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground, paddingTop: insets.top + space.sm }]}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: insets.bottom + space.xxl, gap: space.lg }}>
        <GlassButton icon="chevron.left" accessibilityLabel="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <LockedSection title="Bring in" unlocked={canEdit || caps.isLoading} opensAt="Drink Creator">
          <Segmented
            accessibilityLabel="What you’re pasting"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'drinks', label: 'Drinks' },
              { value: 'ingredients', label: 'Ingredients' },
            ]}
          />
          <Field
            label="The list"
            value={text}
            onChangeText={setText}
            minLines={6}
            placeholder={mode === 'drinks' ? 'Negroni\n30 ml Gin\n30 ml Campari\n\nMartini\n60 ml Gin' : 'Gin\nCampari\n\nGin syrup\n200 g sugar\n200 ml water'}
          />
          <Caption tone="muted">{mode === 'drinks' ? 'A blank line starts the next drink. A line with an amount, or starting with a dash, is a spec line.' : 'One bottle a line. A block with amounts is something you make in house.'}</Caption>
          <BringInRead
            mode={mode}
            text={text}
            onRead={onRead}
            onPasteText={(pasted) => setText((prev) => (prev.trim() ? `${prev.trim()}\n\n${pasted}` : pasted))}
          />
          {lastRead?.unsure.length ? <Caption tone="accent">{`Hard to read, check these: ${lastRead.unsure.join(', ')}.`}</Caption> : null}
          {isLoading ? <Body tone="muted">Loading the library…</Body> : <Review blocks={blocks} catalog={catalog} aliases={aliases} venueId={barId} picks={picks} kinds={kinds} onPick={(key, id) => setPicks((prev) => ({ ...prev, [key]: id }))} onKind={(key, value) => setKinds((prev) => ({ ...prev, [key]: value }))} />}
          {compiled.error && text.trim() ? <Caption tone="accent">{compiled.error}</Caption> : null}
          {message ? <Caption tone="accent">{message}</Caption> : null}
          <Button label={bring.isPending ? 'Bringing in…' : `Add ${count}`} onPress={save} disabled={!count || !!compiled.error || bring.isPending} />
        </LockedSection>
      </ScrollView>
      {bottles ? (
        <BottlePhotoSheet
          visible
          readings={bottles}
          target={barId ? { kind: 'venue', barId, name: active?.name ?? 'The venue', canEdit } : { kind: 'home' }}
          onClose={() => setBottles(null)}
        />
      ) : null}
    </View>
  );
}

export function BringInScreen() {
  return (
    <VenueBrandProvider>
      <BringInBody />
    </VenueBrandProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
