import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { useAuth } from '@/ctx/AuthContext';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useMode } from '@/hooks/useMode';
import { useVenueFeatures } from '@/hooks/useVenueFeatures';
import { dotTabs, lineNews, NEWS_DAYS, parseSeen, pendingNews, withSeen, type FeatureEvent, type FeatureNewsSeen } from '@/lib/featureNews';
import { supabase } from '@/lib/supabase';
import { VENUE_FEATURES, type VenueTab } from '@/lib/venueFeatures';

type EventsRead = { events: FeatureEvent[]; joinedAt: string | null };

export const featureEventsKey = (barId: string | null) => ['venue-feature-events', barId] as const;

/**
 * A venue's switches of the last NEWS_DAYS (public.venue_feature_events, which
 * only its members read), and when you joined it. Never throws: an error
 * keeps what was saved, and the table not being there yet (the app shipped
 * before its migration) is no news. Saved between launches, so the dot is
 * there on the first frame.
 */
function useFeatureEvents(barId: string | null, userId: string | null) {
  const client = useQueryClient();
  return useQuery({
    queryKey: featureEventsKey(barId),
    enabled: !!barId && !!userId,
    meta: { persist: true },
    queryFn: async (): Promise<EventsRead> => {
      const since = new Date(Date.now() - NEWS_DAYS * 24 * 3600_000).toISOString();
      const [events, mine] = await Promise.all([
        supabase.from('venue_feature_events').select('id, feature, enabled, by_user, at').eq('bar_id', barId!).gte('at', since).order('at', { ascending: false }).limit(100),
        supabase.from('user_bars').select('created_at').eq('bar_id', barId!).eq('user_id', userId!).maybeSingle(),
      ]);
      const saved = client.getQueryData<EventsRead>(featureEventsKey(barId));
      if (events.error) return saved ?? { events: [], joinedAt: null };
      return { events: events.data ?? [], joinedAt: mine.data?.created_at ?? saved?.joinedAt ?? null };
    },
  });
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
  const seen = local ?? parseSeen(user?.user_metadata);
  const on = VENUE_FEATURES.map((f) => f.key).filter((k) => features.has(k));
  const pending = data && barId ? pendingNews(data.events, { me: userId, on, joinedAt: data.joinedAt, now }) : [];

  const markSeen = (e: FeatureEvent, kind: 'line' | 'tab') => {
    if (!barId) return;
    const next = withSeen(seen, barId, e, kind, Date.now());
    setLocal(next);
    // Once saved, the account has it; if it failed, the news comes back.
    updateProfile({ featureNews: next }).finally(() => setLocal(null));
  };

  return {
    venueName: active?.name ?? null,
    barId,
    line: barId ? lineNews(pending, seen, barId) : null,
    dots: barId ? dotTabs(pending, seen, barId) : [],
    markSeen,
  };
}

const tabPath = (tab: VenueTab) => (tab === 'index' ? '/' : `/${tab}`);

/**
 * The tabs with a dot, for a tab bar or the sidebar. Opening one clears its
 * dot, once per switch (a failed save doesn't retry on every render).
 */
export function useFeatureNewsDots(): VenueTab[] {
  const { dots, markSeen } = useFeatureNews();
  const pathname = usePathname();
  const tried = useRef(new Set<string>());
  const open = dots.find((d) => tabPath(d.tab) === pathname);
  useEffect(() => {
    if (!open || tried.current.has(open.event.id)) return;
    tried.current.add(open.event.id);
    markSeen(open.event, 'tab');
  });
  return dots.map((d) => d.tab);
}
