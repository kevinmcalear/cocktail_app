-- How a bar pours a beer or a wine (canvas HFuAk, Item-page, And-page and
-- Desk-page, beer and wine): five new columns on items, all optional.
--
--   * serve_temp_c: how cold it goes out, in whole degrees. Guests read it
--     in words ("Very cold, pilsner glass"), staff read the number ("150 ml,
--     served at 16°C"). Its one home: no separate serving note.
--   * glass_note: what the glass gets before the pour ("rinsed cold").
--   * pour_note: how to pour it ("two fingers of head").
--   * tap_line: which line it's on, for a beer on tap ("Line 2").
--   * bottle_price: a wine's price by the bottle, text as typed like price
--     ("64", "MP").
--
-- No view or function reads them, so nothing new reaches signed-out readers:
-- the bar's team read them from items under its existing policy.

ALTER TABLE "public"."items"
    ADD COLUMN "serve_temp_c" smallint CHECK ("serve_temp_c" BETWEEN -5 AND 30),
    ADD COLUMN "glass_note" "text" CHECK (char_length("glass_note") <= 80),
    ADD COLUMN "pour_note" "text" CHECK (char_length("pour_note") <= 80),
    ADD COLUMN "tap_line" "text" CHECK (char_length("tap_line") <= 40),
    ADD COLUMN "bottle_price" "text" CHECK (char_length("bottle_price") <= 20);

COMMENT ON COLUMN "public"."items"."serve_temp_c" IS 'How cold a beer or wine goes out, in degrees C. Guests read it as words, staff as the number.';
COMMENT ON COLUMN "public"."items"."glass_note" IS 'What the glass gets before the pour: "rinsed cold".';
COMMENT ON COLUMN "public"."items"."pour_note" IS 'How to pour it: "two fingers of head".';
COMMENT ON COLUMN "public"."items"."tap_line" IS 'The tap line a beer is on: "Line 2". Null when it isn''t on tap.';
COMMENT ON COLUMN "public"."items"."bottle_price" IS 'A wine''s price by the bottle, as typed (like price).';
