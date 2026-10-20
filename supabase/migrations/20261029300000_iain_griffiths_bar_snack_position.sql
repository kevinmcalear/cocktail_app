-- Iain Griffiths' page lists only a past Dandelyan job, not the bar he co-owns.
-- Adds his current Bar Snack position, using the title the other seeded
-- co-owners get ("Co-founder and co-owner").
-- Sources: thespiritsbusiness.com/2024/11/bar-snack-opens-in-east-village/
-- (Iain Griffiths and Oliver Cleary are co-owners).
--
-- Both profiles are unclaimed and this runs as SQL with no signed-in user, so
-- the position is accepted on both sides and shows straight away. Safe to
-- re-run: the (person, bar, title) key is unique.

INSERT INTO public.profile_positions (person_profile_id, bar_profile_id, title, is_current, source_url)
SELECT p.id, b.id, 'Co-founder and co-owner', true,
       'https://www.thespiritsbusiness.com/2024/11/bar-snack-opens-in-east-village/'
FROM public.profiles p, public.profiles b
WHERE p.handle = 'iain.griffiths' AND p.kind = 'person'
  AND b.handle = 'barsnack.nyc' AND b.kind = 'bar'
ON CONFLICT (person_profile_id, bar_profile_id, title) DO NOTHING;
