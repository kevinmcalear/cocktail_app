-- Reasons on a rank (Loop-rank "What stood out?", Kept-score "And the room?"):
-- up to two optional reasons about the drink, and optional words about the
-- room when it was had at a bar. Two new columns on rank_entries, so they
-- live with the rank they explain and follow its existing own-rows policy:
-- only the person who ranked can read or write them. Bars see totals only,
-- through a later read (lane H5); nothing here shows them to anyone else.
--
--   * reasons: drink reasons, at most two, from a fixed set.
--   * room_reasons: room reasons, from a fixed set, only on a rank at a bar.
--
-- Re-ranking clears both (the app sends empty arrays with the new rank), so a
-- reason always belongs to the rank it was given with.

ALTER TABLE "public"."rank_entries"
    ADD COLUMN "reasons" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    ADD COLUMN "room_reasons" "text"[] DEFAULT '{}'::"text"[] NOT NULL;

ALTER TABLE "public"."rank_entries"
    ADD CONSTRAINT "rank_entries_reasons_known" CHECK (
        "reasons" <@ ARRAY['too_sweet', 'too_strong', 'watery', 'beautiful', 'order_again']::"text"[]
        AND cardinality("reasons") <= 2
    ),
    ADD CONSTRAINT "rank_entries_room_reasons_known" CHECK (
        "room_reasons" <@ ARRAY['great_room', 'easy_to_talk', 'good_music', 'loud', 'cramped', 'too_dark']::"text"[]
        AND (cardinality("room_reasons") = 0 OR "venue_profile_id" IS NOT NULL)
    );

COMMENT ON COLUMN "public"."rank_entries"."reasons" IS
    'Up to two optional reasons about the drink, given after ranking it. Private to the ranker; bars see totals only.';
COMMENT ON COLUMN "public"."rank_entries"."room_reasons" IS
    'Optional words about the room, only on a rank at a bar. They never change a score. Private to the ranker; the bar sees totals only.';
