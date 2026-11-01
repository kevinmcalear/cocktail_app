import { ActivityIndicator, View } from 'react-native';

import { BackbarTheme, Body, useDs } from '@/components/ds';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { SignInCard } from '@/components/screens/published/SignInCard';
import { BlockLabel } from '@/components/screens/rankings/ScoreRows';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useSignedIn } from '@/ctx/AuthContext';
import { useMyDrinksGuestSays } from '@/hooks/useScores';
import { myDrinkLine } from '@/lib/scores';

import { Note, ScorePage } from './ScoreParts';

/**
 * Your drinks (Loop-reasons "mydrinks"): what guests say about the drinks
 * credited to you, just you. People get credit by name; only drinks get
 * scores, so there's no score of yours here.
 */
export function MyDrinksScreen() {
  return (
    <BackbarTheme>
      <MyDrinks />
    </BackbarTheme>
  );
}

function MyDrinks() {
  const ds = useDs();
  const signedIn = useSignedIn();
  const { data: drinks = [], isLoading, error } = useMyDrinksGuestSays();
  let list;
  if (!signedIn) list = <SignInCard title="Your drinks" text="Sign in to see what guests say about the drinks credited to you." replace />;
  else if (error) list = <Body tone="muted">Couldn’t load your drinks. Try again in a moment.</Body>;
  else if (isLoading) list = <ActivityIndicator color={ds.c.muted} />;
  else if (!drinks.length) list = <Body tone="muted">No drinks are credited to you yet. When a bar credits you with one, what guests say about it shows here.</Body>;
  else
    list = (
      <View>
        <BlockLabel aside={`${drinks.length} ${drinks.length === 1 ? 'drink' : 'drinks'}`}>Credited to you</BlockLabel>
        {drinks.map((d) => (
          <DrinkRow key={d.item_id} name={d.name} itemId={d.item_id} imageUrl={null} glass={null} displayName href={`/cocktail/${d.item_id}`} caption={myDrinkLine(d)} trailing={<IconSymbol name="chevron.right" size={14} color={ds.c.faint} />} />
        ))}
      </View>
    );
  return (
    <ScorePage eyebrow="What guests say · just you" title="Your drinks">
      <Note icon="lock.fill">Only you see this. People get credit by name, and only drinks get scores.</Note>
      {list}
    </ScorePage>
  );
}
