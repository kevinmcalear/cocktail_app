-- Photos in sizes, with a blur placeholder (decision image-pipeline, 31 Oct).
--
-- A photo's copies are found by path (lib/thumbnails.ts): the 480 px list
-- copy under thumbs/ (made by the image-palette function, as before) and a
-- 1080 px page copy beside the original ("1@1080.jpg"). The phone resizes the
-- original and makes the page copy at upload; image-palette makes it for
-- older photos.
--
--   * images.thumbhash: a ThumbHash (base64), painted while the photo loads.
--     Set only once the page copy exists, so the app asks for it only when
--     there is one.
--   * images.width, images.height: the photo's size in pixels, so its frame
--     never jumps when it arrives.
--
-- All null for a photo not done yet. images keeps its policies: anyone signed
-- in inserts a row with these, as with url.
alter table public.images
  add column thumbhash text,
  add column width integer check (width > 0),
  add column height integer check (height > 0);

comment on column public.images.thumbhash is 'ThumbHash of the photo (base64), set once its 1080 px page copy exists (lib/thumbnails.ts).';
comment on column public.images.width is 'The photo''s width in pixels.';
comment on column public.images.height is 'The photo''s height in pixels.';
