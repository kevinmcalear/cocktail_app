-- How a photo lays out its page (boards Decided-photo-top, Decided-photo-bright,
-- Desk-photo-side-dark, Desk-photo-side-bright).
--
--   * images.brightness: the photo's mean lightness (L*, 0 to 1). A bright
--     photo makes a light page; until now every photo made a dark one.
--   * images.text_zone: where the photo has quiet room for the title, as
--     {"top", "bottom", "light"}: a band of the photo as shares of its height,
--     and the lightness the title has to read against. Null with a brightness
--     means the scan found no room, so the title goes under the photo.
--
-- Both are read from the photo's pixels at upload (components/drink/
-- drinkImages.ts, with supabase/functions/_shared/photoLayout.ts); older
-- photos get them from scripts/backfill-photo-layout.ts. Null brightness means not read yet: the
-- page stays dark with the title under the photo, as before.
--
-- New columns only. images keeps its policies: anyone signed in inserts a row
-- with these, as with url, thumbhash, width and height.
alter table public.images
  add column brightness real check (brightness between 0 and 1),
  add column text_zone jsonb check (
    text_zone is null or (
      jsonb_typeof(text_zone) = 'object'
      and jsonb_typeof(text_zone -> 'top') = 'number'
      and jsonb_typeof(text_zone -> 'bottom') = 'number'
      and jsonb_typeof(text_zone -> 'light') = 'number'
    )
  );

comment on column public.images.brightness is 'Mean lightness of the photo (L*, 0 to 1), read at upload: a bright photo makes a light page. Null until read.';
comment on column public.images.text_zone is 'Quiet room for the title: {"top", "bottom"} as shares of the photo''s height and "light", its lightness (L*, 0 to 1). Null when the photo has none (or brightness is null: not read yet).';
