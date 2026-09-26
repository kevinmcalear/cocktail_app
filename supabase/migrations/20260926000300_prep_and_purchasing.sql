-- DRAFT (schema proposal, docs/schema_proposal.md section 4). Local stack only.
--
-- Prep metadata on house-made ingredients (an ingredient item with its own
-- recipe rows), and purchasing on bought ones. The prep list works backwards
-- from a menu or event with these; the order list groups bought ingredients by
-- supplier.
--
-- Par lives only on item_locations, per place ("restock this spot to 2"). A
-- bar's par for an item, house-made or bought, is the sum over its locations.
--
--   item_prep         yield, shelf life and lead time. One row per item,
--                     since house-made items belong to one bar (items.bar_id).
--   suppliers         a bar's suppliers.
--   item_purchasing   per bar and item: supplier, bottle or pack size, order code.
--   item_costs        per bar and item: what a pack costs. Its own table so
--                     costs stay hidden from everyone without 'costs'.

CREATE TABLE "public"."item_prep" (
    "item_id" "uuid" PRIMARY KEY REFERENCES "public"."items"("id") ON DELETE CASCADE,
    -- What one batch of the recipe makes: 4 L.
    "yield_amount" numeric CHECK ("yield_amount" > 0),
    "yield_unit" "text",
    -- How long it keeps once made.
    "shelf_life_hours" integer CHECK ("shelf_life_hours" > 0),
    -- Hands-off time before it's ready (drip, infuse, freeze), so the prep
    -- list can say when to start.
    "lead_time_minutes" integer CHECK ("lead_time_minutes" >= 0),
    -- "24 h drip", "12 h freeze"
    "lead_time_note" "text" CHECK (char_length("lead_time_note") <= 60),
    "updated_by" "uuid" DEFAULT "auth"."uid"() REFERENCES "auth"."users"("id") ON DELETE SET NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "item_prep_yield_check" CHECK (("yield_amount" IS NULL) = ("yield_unit" IS NULL))
);

CREATE TABLE "public"."suppliers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() PRIMARY KEY,
    "bar_id" "uuid" NOT NULL REFERENCES "public"."bars"("id") ON DELETE CASCADE,
    "name" "text" NOT NULL CHECK (char_length(btrim("name")) BETWEEN 1 AND 80),
    "website" "text",
    -- How to order: cut-off day, minimum order, rep's name.
    "order_notes" "text" CHECK (char_length("order_notes") <= 1000),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    UNIQUE ("id", "bar_id")
);

CREATE UNIQUE INDEX "suppliers_bar_id_name_key" ON "public"."suppliers" ("bar_id", lower(btrim("name")));

CREATE TABLE "public"."item_purchasing" (
    "bar_id" "uuid" NOT NULL REFERENCES "public"."bars"("id") ON DELETE CASCADE,
    "item_id" "uuid" NOT NULL REFERENCES "public"."items"("id") ON DELETE CASCADE,
    "supplier_id" "uuid",
    -- One bottle or pack: 700 ml, 2 kg.
    "pack_size_amount" numeric CHECK ("pack_size_amount" > 0),
    "pack_size_unit" "text",
    "order_code" "text" CHECK (char_length("order_code") <= 60),
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    PRIMARY KEY ("bar_id", "item_id"),
    FOREIGN KEY ("supplier_id", "bar_id") REFERENCES "public"."suppliers"("id", "bar_id") ON DELETE SET NULL ("supplier_id"),
    CONSTRAINT "item_purchasing_pack_check" CHECK (("pack_size_amount" IS NULL) = ("pack_size_unit" IS NULL))
);

CREATE INDEX "item_purchasing_item_id_idx" ON "public"."item_purchasing" ("item_id");
CREATE INDEX "item_purchasing_supplier_id_idx" ON "public"."item_purchasing" ("supplier_id");

CREATE TABLE "public"."item_costs" (
    "bar_id" "uuid" NOT NULL REFERENCES "public"."bars"("id") ON DELETE CASCADE,
    "item_id" "uuid" NOT NULL REFERENCES "public"."items"("id") ON DELETE CASCADE,
    -- Price of one pack (item_purchasing.pack_size), in minor units.
    "pack_cost_minor" integer NOT NULL CHECK ("pack_cost_minor" >= 0),
    "currency" "text" NOT NULL CHECK ("currency" ~ '^[A-Z]{3}$'),
    "updated_by" "uuid" DEFAULT "auth"."uid"() REFERENCES "auth"."users"("id") ON DELETE SET NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    PRIMARY KEY ("bar_id", "item_id")
);

CREATE INDEX "item_costs_item_id_idx" ON "public"."item_costs" ("item_id");

ALTER TABLE "public"."item_prep" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."suppliers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."item_purchasing" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."item_costs" ENABLE ROW LEVEL SECURITY;

-- item_prep: readable with the item when it's personal or shared; for a bar's
-- item, by members who see house-made recipes or run prep. Writable by the
-- bar's prep crew (they keep yield and shelf life current), and by whoever can edit the
-- item if they can also see house-made recipes. (FOR ALL also grants reads,
-- so the write rule must never be wider than the read rule.)
CREATE POLICY "item_prep_select" ON "public"."item_prep" FOR SELECT TO "authenticated"
    USING (EXISTS (
        SELECT 1 FROM "public"."items" "i"
        WHERE "i"."id" = "item_id"
          AND ("i"."bar_id" IS NULL
               OR "i"."bar_id" IN (SELECT "private"."bars_with_capability"('house_made'))
               OR "i"."bar_id" IN (SELECT "private"."bars_with_capability"('prep')))
    ));
CREATE POLICY "item_prep_write" ON "public"."item_prep" FOR ALL TO "authenticated"
    USING (EXISTS (
        SELECT 1 FROM "public"."items" "i"
        WHERE "i"."id" = "item_id"
          AND ("i"."bar_id" IN (SELECT "private"."bars_with_capability"('prep'))
               OR ("private"."can_edit_item"("i"."id")
                   AND ("i"."bar_id" IS NULL OR "i"."bar_id" IN (SELECT "private"."bars_with_capability"('house_made')))))
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM "public"."items" "i"
        WHERE "i"."id" = "item_id"
          AND ("i"."bar_id" IN (SELECT "private"."bars_with_capability"('prep'))
               OR ("private"."can_edit_item"("i"."id")
                   AND ("i"."bar_id" IS NULL OR "i"."bar_id" IN (SELECT "private"."bars_with_capability"('house_made')))))
    ));

-- Suppliers and purchasing: the prep crew builds orders, and whoever handles
-- costs keeps them current.
CREATE POLICY "suppliers_all" ON "public"."suppliers" FOR ALL TO "authenticated"
    USING ("bar_id" IN (SELECT "private"."bars_with_capability"('prep'))
           OR "bar_id" IN (SELECT "private"."bars_with_capability"('costs')))
    WITH CHECK ("bar_id" IN (SELECT "private"."bars_with_capability"('prep'))
                OR "bar_id" IN (SELECT "private"."bars_with_capability"('costs')));

CREATE POLICY "item_purchasing_select" ON "public"."item_purchasing" FOR SELECT TO "authenticated"
    USING ("bar_id" IN (SELECT "private"."bars_with_capability"('prep'))
           OR "bar_id" IN (SELECT "private"."bars_with_capability"('costs')));
CREATE POLICY "item_purchasing_write" ON "public"."item_purchasing" FOR ALL TO "authenticated"
    USING ("bar_id" IN (SELECT "private"."bars_with_capability"('prep'))
           OR "bar_id" IN (SELECT "private"."bars_with_capability"('costs')))
    WITH CHECK (
        ("bar_id" IN (SELECT "private"."bars_with_capability"('prep'))
         OR "bar_id" IN (SELECT "private"."bars_with_capability"('costs')))
        AND "private"."item_usable_at_bar"("item_id", "bar_id")
    );

CREATE POLICY "item_costs_all" ON "public"."item_costs" FOR ALL TO "authenticated"
    USING ("bar_id" IN (SELECT "private"."bars_with_capability"('costs')))
    WITH CHECK ("bar_id" IN (SELECT "private"."bars_with_capability"('costs'))
                AND "private"."item_usable_at_bar"("item_id", "bar_id"));
