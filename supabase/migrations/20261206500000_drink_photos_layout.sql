-- get_drink_photos returns how each photo lays out its page (Kevin, 1 Nov
-- 2026): images.brightness and text_zone (20261206000000_photo_layout.sql),
-- and its width and height for the crop. A drink page that leads with
-- someone's photo can then make a light page or put the title in the photo,
-- as it does for the drink's own photos, without a second read.
--
-- Everything else as 20261008850100_drink_photos.sql: runs as the caller, so
-- drink_photos' policies decide what's in it; search_path ''; signed-out
-- visitors can't call it. New columns change the function's result, so it is
-- dropped and made again with the same grants.

DROP FUNCTION "public"."get_drink_photos"("uuid", integer);

CREATE FUNCTION "public"."get_drink_photos"("p_item_id" "uuid", "p_limit" integer DEFAULT 30)
    RETURNS TABLE(
        "id" "uuid", "image_url" "text", "created_at" timestamp with time zone, "is_mine" boolean,
        "poster_handle" "text", "poster_name" "text", "poster_avatar_url" "text", "score" numeric,
        "brightness" real, "text_zone" "jsonb", "width" integer, "height" integer
    )
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  SELECT dp.id, im.url, dp.created_at, dp.user_id = auth.uid(),
         p.handle, p.display_name, p.avatar_url,
         private.drink_photo_score(dp.id),
         im.brightness, im.text_zone, im.width, im.height
  FROM public.drink_photos dp
  JOIN public.images im ON im.id = dp.image_id
  LEFT JOIN public.profiles p ON p.user_id = dp.user_id AND p.kind = 'person'
  WHERE dp.item_id = p_item_id AND dp.moderated_at IS NULL
  ORDER BY dp.created_at DESC
  LIMIT least(greatest(coalesce(p_limit, 30), 1), 100);
$$;

REVOKE EXECUTE ON FUNCTION "public"."get_drink_photos"("uuid", integer) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."get_drink_photos"("uuid", integer) TO "authenticated", "service_role";
