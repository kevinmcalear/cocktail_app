-- House prep recipes keep their sources too (after 20261017700000). Stage 4 of
-- the bottle catalog plan: https://claude.ai/artifact/Vu6seuSNtN42nKYb2nDCVR
--
-- item_sources (20261011151000) gains the three facts a house prep carries:
--
--   recipe   the amounts: the ratio a page gives, as we wrote it out
--   yield    what one batch makes, when the page says
--   keeps    how long it keeps, from a page that says so. A prep keeps the
--            shortest time any of its sources gives.
--
-- Nothing else changes: signed-in people read a shared row's sources, a venue
-- row's stay with the venue, and only app admins (and migrations) write them.

ALTER TABLE "public"."item_sources"
    DROP CONSTRAINT "item_sources_field_check",
    ADD CONSTRAINT "item_sources_field_check" CHECK ("field" IN (
        'exists', 'name', 'maker', 'abv', 'origin', 'gi', 'style', 'merge', 'recipe', 'yield', 'keeps'
    ));
