-- A short summary for each book or source, shown under its title on the
-- book page (board prep-hist-book): "The first American bar book. Most of the
-- old punches, slings, sours and cocktails are written down here for the
-- first time." Optional; the page shows nothing without one. Readable by
-- everyone like the rest of the row ("Anyone reads sources"); only app admins
-- write it ("App admins manage sources"). No policy changes.

ALTER TABLE public.sources
  ADD COLUMN IF NOT EXISTS summary text
  CONSTRAINT sources_summary_check CHECK (summary IS NULL OR char_length(summary) BETWEEN 1 AND 600);

COMMENT ON COLUMN public.sources.summary IS 'One short paragraph about the book, shown on its page. Facts only, in our own words.';
