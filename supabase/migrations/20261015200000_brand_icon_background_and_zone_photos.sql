-- Two things the venue tools boards draw that need the database (canvas
-- "Cocktail: the whole app", tools-brand-desktop and tools-backbar-desktop).

-- 1. Brand: the home-screen icon's background. The board offers three tiles
-- (Rust, Walnut, Cream): the logo on the venue's accent, on its dark ground,
-- or on cream. Null keeps today's icon: the logo padded with its own corner colour.
ALTER TABLE "public"."bars" ADD COLUMN IF NOT EXISTS "icon_background" "text"
    CHECK ("icon_background" IN ('accent', 'ground', 'cream'));
COMMENT ON COLUMN "public"."bars"."icon_background" IS
    'The home-screen icon''s background: accent, ground (the dark ground tint) or cream. Null: the logo''s own corner colour.';

-- The install manifest's icon (venue-app) reads it with the rest of the identity.
-- As 20260926150000_venue_identity.sql, plus icon_background.
DROP FUNCTION "public"."get_venue_branding"("p_slug" "text");
CREATE FUNCTION "public"."get_venue_branding"("p_slug" "text")
    RETURNS TABLE(
        "id" "uuid", "name" "text", "slug" "text", "logo_url" "text",
        "primary_color" "text", "secondary_color" "text", "accent_light_color" "text",
        "ground_tint" "text", "display_face" "public"."venue_display_face",
        "short_name" "text", "icon_url" "text", "icon_background" "text"
    )
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT b.id, b.name, b.slug, b.logo_url, b.primary_color, b.secondary_color, b.accent_light_color,
         b.ground_tint, b.display_face, b.short_name, b.icon_url, b.icon_background
  FROM public.bars b
  WHERE b.slug = lower(p_slug);
$$;

REVOKE EXECUTE ON FUNCTION "public"."get_venue_branding"("p_slug" "text") FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."get_venue_branding"("p_slug" "text") TO "anon", "authenticated", "service_role";

-- 2. Back bar: "Add a photo of this fridge". Zone photos go in the drinks
-- bucket under backbar/<bar id>/, with the same daily limit as every upload.
-- Writing the zone's photo_url is the existing bar_zones update policy.
-- As 20261010110000_daily_limits_rankings_uploads.sql, plus 'backbar'.
DROP POLICY "drinks_insert_app_folders" ON "storage"."objects";
CREATE POLICY "drinks_insert_app_folders" ON "storage"."objects" FOR INSERT TO "authenticated"
    WITH CHECK (
        "bucket_id" = 'drinks'
        AND ("storage"."foldername"("name"))[1] = ANY (ARRAY['backbar', 'beers', 'cocktails', 'drafts', 'ingredients', 'menus', 'wines'])
        AND "private"."has_upload_room"('drinks')
    );
