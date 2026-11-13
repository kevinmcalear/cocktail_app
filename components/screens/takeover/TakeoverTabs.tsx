import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, useDs } from '@/components/ds';
import { ListGroup, ListRow, SectionLabel } from '@/components/ds/ListGroup';
import { DrinkListRow, DrinkRows } from '@/components/screens/drinks/DrinksParts';
import { space } from '@/constants/tokens';
import { andList } from '@/lib/runSheetText';

import { AddRow, BarMark } from './parts';
import { RunLinkRow } from './RunLinkRow';
import type { TakeoverModel } from './useTakeoverModel';

/** Lists (Keep-phone takeover A): their list with each drink's maker (its creator credit) and serves, and the house list beside it, each drink on or off tonight. */
export function TakeoverLists({ m }: { m: TakeoverModel }) {
  const router = useRouter();
  const open = (itemId: string) => router.push(`/cocktail/${itemId}` as Href);
  return (
    <View style={styles.tab}>
      <SectionLabel title="Their list" aside={m.guestName ? `${m.guestName} · ${m.theirs.length}` : String(m.theirs.length)} />
      {m.theirs.length ? (
        <DrinkRows>
          {m.theirs.map((d) => (
            <DrinkListRow
              key={d.id}
              itemId={d.itemId}
              name={d.name}
              line={[m.makers[d.itemId], (d.partyId && m.data?.parties.find((p) => p.id === d.partyId)?.name) || m.guestName || m.hostName].filter(Boolean).join(' · ')}
              end={d.serves ? { text: d.serves.toLocaleString('en-GB'), under: 'serves', tone: 'ink' } : { text: 'No count', tone: 'warn' }}
              onPress={() => open(d.itemId)}
            />
          ))}
        </DrinkRows>
      ) : (
        <Body tone="muted">No drinks on their list yet.</Body>
      )}
      {m.house ? (
        <>
          <SectionLabel title="House list beside it" aside={`${m.house.on} of ${m.house.drinks.length} stay on`} />
          <DrinkRows>
            {m.house.drinks.map((d) => (
              <DrinkListRow
                key={d.id}
                itemId={d.id}
                name={d.name}
                line={`${m.hostName} · ${m.house!.name}`}
                end={d.on ? { text: 'On', tone: 'ready' } : { text: 'Off tonight', tone: 'muted' }}
                onPress={() => open(d.id)}
              />
            ))}
          </DrinkRows>
        </>
      ) : null}
    </View>
  );
}

/** People (takeover B): the parties and what each does, then the guest bartenders and when their access ends. */
export function TakeoverPeople({ m, onAdd }: { m: TakeoverModel; onAdd: () => void }) {
  // What the brand brings on the run sheet ("Kestrel Gin and tonic"); the board's "menu cards and education" are tasks, which aren't stored yet.
  const brings = (id: string) => {
    if (!m.sheet) return '';
    const needs = m.sheet.parties.find((p) => p.id === id)?.needs ?? [];
    return needs.length ? andList([...needs.slice(0, 3).map((n) => n.name), ...(needs.length > 3 ? [`${needs.length - 3} more`] : [])]) : 'nothing on the run sheet yet';
  };
  const parties = [
    { key: 'host', name: m.hostName, color: m.colorOf(null), line: 'Hosts · buys the stock' },
    ...(m.data?.parties ?? []).map((p) => ({
      key: p.id,
      name: p.name,
      color: m.colorOf(p.id),
      line: p.kind === 'guest' ? 'Guest bar · brings its list and prep' : ['Brand', brings(p.id)].filter(Boolean).join(' · '),
    })),
  ].filter((p) => p.name);
  return (
    <View style={styles.tab}>
      <SectionLabel title="Parties" />
      <ListGroup>
        {parties.map((p, i) => (
          <ListRow key={p.key} first={i === 0} lead={<BarMark name={p.name} color={p.color} />} title={p.name} detail={p.line} />
        ))}
      </ListGroup>
      {m.seesTeam ? (
        <>
          <SectionLabel title="Guest bartenders" />
          {m.guests.length || m.canStaff ? (
            <ListGroup>
              {m.guests.map((g, i) => (
                <ListRow key={g.key} first={i === 0} lead={<BarMark name={g.name} color={null} />} title={g.name} detail={g.line} />
              ))}
              {m.canStaff ? <AddRow label="Add a guest bartender" icon="person.badge.plus" onPress={onAdd} /> : null}
            </ListGroup>
          ) : (
            <Caption tone="muted">No guest bartenders yet.</Caption>
          )}
        </>
      ) : null}
    </View>
  );
}

/** Run sheet (takeover C): a link per party, what is still open, and the full run sheet. */
export function TakeoverRunSheet({ m, menuId }: { m: TakeoverModel; menuId: string }) {
  const router = useRouter();
  const ds = useDs();
  const parties = (m.sheet?.parties ?? []).filter((p) => p.id !== null);
  return (
    <View style={styles.tab}>
      <SectionLabel title="Run-sheet links, one per party" />
      {parties.length ? (
        <ListGroup>
          {parties.map((p, i) => (
            <RunLinkRow key={p.id} first={i === 0} color={m.colorOf(p.id)} party={p} sheet={m.sheet!} menu={m.data!.menu} canSend={m.canPlan} />
          ))}
        </ListGroup>
      ) : (
        <Body tone="muted">Add the guest bar and any brands on the run sheet, and each gets its own link.</Body>
      )}
      {m.open.length ? (
        <>
          <SectionLabel title="Still open" />
          <ListGroup>
            {m.open.map((o, i) => (
              <ListRow key={o.key} first={i === 0} icon="exclamationmark.triangle" title={o.name} detail={o.why} value={o.ask} warn />
            ))}
          </ListGroup>
        </>
      ) : null}
      <Button
        label="Open the full run sheet"
        icon="doc"
        variant="secondary"
        onPress={() => router.push(`/menus/${menuId}/run-sheet` as Href)}
        style={[styles.full, { borderColor: ds.c.line }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tab: { gap: space.sm + 2 },
  full: { marginTop: space.md },
});
