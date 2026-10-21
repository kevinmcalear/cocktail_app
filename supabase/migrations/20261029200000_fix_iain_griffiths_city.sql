-- Iain Griffiths' seeded profile put him in London. He has lived in Brooklyn
-- since March 2020 and runs Bar Snack in New York's East Village (opened
-- November 2024). Other New York people are stored with city 'New York'.
--
-- Only touches the row while it still holds the seeded value and is unclaimed,
-- so nothing he has set himself is overwritten. The rest of his bio checks out.
-- Sources: distilling.com/distillermagazine/iain-griffiths-of-bar-snack/ and
-- thespiritsbusiness.com/2024/11/bar-snack-opens-in-east-village/.

UPDATE public.profiles
SET city = 'New York'
WHERE handle = 'iain.griffiths'
  AND kind = 'person'
  AND city = 'London'
  AND NOT is_claimed;
