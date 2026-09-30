-- Credit for photos that came from somewhere else (a bar's site, a magazine,
-- Instagram): who took or published it, and the page it came from. The drink
-- page shows "Photo: <credit>" and links to the source. Both stay NULL for
-- photos taken in the app and for generated sketches.

ALTER TABLE "public"."images"
    ADD COLUMN "credit" "text",
    ADD COLUMN "source_url" "text",
    ADD CONSTRAINT "images_credit_length" CHECK (char_length("credit") BETWEEN 1 AND 120),
    ADD CONSTRAINT "images_source_url_http" CHECK ("source_url" ~ '^https?://' AND char_length("source_url") <= 2000);
