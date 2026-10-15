import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { useAuth } from '@/ctx/AuthContext';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useMode } from '@/hooks/useMode';
import { useVenueFeatures } from '@/hooks/useVenueFeatures';
import { dotTabs, lineNews, mergeSeen, NEWS_DAYS, parseSeen, pendingNews, withSeen, type FeatureEvent, type FeatureNewsSeen } from '@/lib/featureNews';
import { supabase } from '@/lib/supabase';
import { tabPath, VENUE_FEATURES, type VenueTab } from '@/lib/venueFeatures';

type EventsRead = { events: FeatureEvent[]; joinedAt: string | null; seen: FeatureNewsSeen };

export const featureEventsKey = (barId: string | null, userId: string | null) => ['venue-feature-events', barId, userId] as const;

/** Your marks as the server has them now: the session's copy is only as fresh as its token (an hour). */
async function serverSeen(): Promise<FeatureNewsSeen | null> {
  const { data, error } = await supabase.auth.getUser();
  return error ? null : parseSeen(data.user?.user_metadata);
}

/**
 * A venue's switches of the last NEWS_DAYS (public.venue_feature_events, which
 * only its members read), when you joined it, and your marks. Never throws:
 * an error keeps what was saved, and the table not being there yet (the app
 * shipped before its migration) is no news. Saved between launches, per
 * person, so the dot is there on the first frame.
 */
function useFeatureEvents(barId: string | null, userId: string | null) {
  const client = useQueryClient();
  const key = featureEventsKey(barId, userId);
  return useQuery({
    queryKey: key,
    enabled: !!barId && !!userId,
    meta: { persist: true },
    queryFn: async (): Promise<EventsRead> => {
      const since = new Date(Date.now() - NEWS_DAYS * 24 * 3600_000).toISOString();
      const [events, mine, seen] = await Promise.all([
        supabase.from('venue_feature_events').select('id, feature, enabled, by_user, at').eq('bar_id', barId!).gte('at', since).order('at', { ascending: false }).limit(100),
        supabase.from('user_bars').select('created_at').eq('bar_id', barId!).eq('user_id', userId!).maybeSingle(),
        serverSeen(),
      ]);
      const saved = client.getQueryData<EventsRead>(key);
      if (events.error) return saved ?? { events: [], joinedAt: null, seen: seen ?? {} };
      return { events: events.data ?? [], joinedAt: mine.data?.created_at ?? saved?.joinedAt ?? null, seen: seen ?? saved?.seen ?? {} };
    },
  });
}

// One save at a time, shared by the tab bar and the Library line. Each save
// merges with what the server has and with marks still waiting, so neither
// undoes the other's mark, nor one made on another device.
const queue: { waiting: FeatureNewsSeen; last: Promise<unknown> } = { waiting: {}, last: Promise.resolve() };

function saveMark(barId: string, e: FeatureEvent, kind: 'line' | 'tab', base: FeatureNewsSeen, save: (next: FeatureNewsSeen) => Promise<{ error: Error | null }>): Promise<boolean> {
  queue.waiting = mergeSeen(queue.waiting, withSeen({}, barId, e, kind, Date.now()));
  const run = queue.last.then(async () => {
    const next = withSeen(mergeSeen(base, await serverSeen(), queue.waiting), barId, e, kind, Date.now());
    const { error } = await save(next);
    if (!error) queue.waiting = {};
    return !error;
  });
  queue.last = run.catch(() => {});
  return run.catch(() => false);
}

/**
 * "New at <venue>" (lib/featureNews.ts): the line to show at the top of the
 * Library, the tabs that get a dot, and marking either seen. Marks save to
 * your account, so they follow you to every device; until the save lands the
 * mark holds here, and if it fails the news comes back.
 */
export function useFeatureNews() {
  const { mode } = useMode();
  const { active } = useActiveVenue();
  const { user, updateProfile } = useAuth();
  const features = useVenueFeatures();
  const barId = mode === 'venue' ? (active?.id ?? null) : null;
  const userId = user?.id ?? null;
  const { data } = useFeatureEvents(barId, userId);
  const [now] = useState(Date.now);
  const [local, setLocal] = useState<FeatureNewsSeen | null>(null);
  const seen = mergeSeen(parseSeen(user?.user_metadata), data?.seen, local);
  const on = VENUE_FEATURES.map((f) => f.key).filter((k) => features.has(k));
  const pending = data && barId ? pendingNews(data.events, { me: userId, on, joinedAt: data.joinedAt, now }) : [];

  const markSeen = (e: FeatureEvent, kind: 'line' | 'tab'): Promise<boolean> => {
    if (!barId) return Promise.resolve(false);
    // Holds here until saved; if the save fails, the news comes back.
    setLocal((had) => mergeSeen(had, { [barId]: { [e.feature]: { [kind]: e.at } } }));
    return saveMark(barId, e, kind, seen, (next) => updateProfile({ featureNews: next })).finally(() => setLocal(null));
  };

  return {
    venueName: active?.name ?? null,
    barId,
    line: barId ? lineNews(pending, seen, barId) : null,
    dots: barId ? dotTabs(pending, seen, barId) : [],
    markSeen,
  };
}

/**
 * The tabs with a dot, for a tab bar or the sidebar. Opening one clears its
 * dot; a failed save tries again on the next visit, not on every render.
 */
export function useFeatureNewsDots(): VenueTab[] {
  const { dots, markSeen } = useFeatureNews();
  const pathname = usePathname();
  const tried = useRef(new Set<string>());
  const open = dots.find((d) => tabPath(d.tab) === pathname);
  const openId = open?.event.id ?? null;
  useEffect(() => {
    if (!open) {
      tried.current.clear();
      return;
    }
    if (tried.current.has(open.event.id)) return;
    tried.current.add(open.event.id);
    markSeen(open.event, 'tab');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per switch opened, not per render
  }, [openId]);
  return dots.map((d) => d.tab);
}
